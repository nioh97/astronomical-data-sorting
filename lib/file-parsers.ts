import Papa from "papaparse"
import * as xml2js from "xml2js"

/** Column metadata extracted from NASA-style # COLUMN comment lines (optional, for display). */
export interface ColumnMetadataEntry {
  description: string
  detectedUnit?: string
}

export interface ParsedData {
  headers: string[]
  rows: Record<string, any>[]
  metadata?: Record<string, any>
  columnMetadata?: Record<string, ColumnMetadataEntry>
}

const DELIMITER_CANDIDATES = ["\t", ",", ";", "|"] as const
const NASA_COMMENT_CHAR = "#"
const NASA_COLUMN_PREFIX = "# COLUMN "

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve((e.target?.result as string) ?? "")
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsText(file)
  })
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Extract column metadata from # COLUMN lines (before stripping). */
function extractColumnMetadataFromComments(lines: string[]): Record<string, ColumnMetadataEntry> {
  const out: Record<string, ColumnMetadataEntry> = {}
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith(NASA_COLUMN_PREFIX)) continue
    const rest = trimmed.slice(NASA_COLUMN_PREFIX.length).trim()
    const colonIdx = rest.indexOf(":")
    if (colonIdx === -1) continue
    const name = rest.slice(0, colonIdx).trim()
    let desc = rest.slice(colonIdx + 1).trim()
    let detectedUnit: string | undefined
    const bracketOpen = desc.lastIndexOf("[")
    const bracketClose = desc.lastIndexOf("]")
    if (bracketOpen !== -1 && bracketClose > bracketOpen) {
      detectedUnit = desc.slice(bracketOpen + 1, bracketClose).trim()
      desc = desc.slice(0, bracketOpen).trim()
    }
    if (name) out[name] = { description: desc || name, ...(detectedUnit && { detectedUnit }) }
  }
  return out
}

/**
 * Auto-detect delimiter from first non-comment lines. Supports \t, comma, ;, |.
 * Never assume comma — check \t first for NASA TSV.
 */
function detectDelimiter(nonCommentLines: string[]): string {
  const nonEmpty = nonCommentLines.filter((line) => line.trim().length > 0)
  if (nonEmpty.length === 0) return "\t"

  let bestDelimiter = "\t"
  let bestScore = -1

  for (const delim of DELIMITER_CANDIDATES) {
    const counts = nonEmpty.map((line) => (line.match(new RegExp(escapeRegExp(delim), "g")) ?? []).length)
    const allSame = counts.length > 0 && counts.every((c) => c === counts[0])
    const count = counts[0] ?? 0
    if (allSame && count > bestScore) {
      bestScore = count
      bestDelimiter = delim
    }
  }

  return bestScore >= 0 ? bestDelimiter : "\t"
}

/**
 * Parse CSV/TSV: auto-detect delimiter, ignore # comment lines, normalize empty to null.
 * Single path for NASA TSV and regular CSV. Never assume comma.
 */
export async function parseCSV(file: File): Promise<ParsedData> {
  const rawText = await readFileAsText(file)
  const allLines = rawText.split(/\r?\n/)
  const columnMetadata = extractColumnMetadataFromComments(allLines)
  const nonCommentLines = allLines.filter((line) => !line.trim().startsWith(NASA_COMMENT_CHAR))
  const textWithoutComments = nonCommentLines.join("\n")
  const detectedDelimiter = detectDelimiter(nonCommentLines)

  return new Promise((resolve, reject) => {
    Papa.parse(textWithoutComments, {
      header: true,
      delimiter: detectedDelimiter,
      skipEmptyLines: true,
      comments: false,
      dynamicTyping: true,
      transformHeader: (header) => (header != null ? String(header).trim() : ""),
      complete: (results) => {
        if (results.errors.length > 0 && typeof console !== "undefined" && console.warn) {
          console.warn("CSV parse warnings:", results.errors.map((e) => e.message).join("; "))
        }
        const rawRows = (results.data ?? []) as Record<string, any>[]
        const headers =
          rawRows.length > 0
            ? Object.keys(rawRows[0]).filter((h) => h != null && String(h).trim() !== "")
            : []
        if (rawRows.length === 0 || headers.length === 0) {
          reject(new Error("CSV is empty or has no valid headers"))
          return
        }
        const normalized = rawRows.map((row) => {
          const out: Record<string, any> = {}
          for (const key of headers) {
            const v = row[key]
            if (v === "" || v === undefined) out[key] = null
            else out[key] = v
          }
          return out
        })
        resolve({
          headers,
          rows: normalized,
          metadata: { totalRows: normalized.length },
          columnMetadata: Object.keys(columnMetadata).length > 0 ? columnMetadata : undefined,
        })
      },
      error: (error: unknown) => {
        reject(error)
      },
    })
  })
}

export async function parseJSON(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const data = JSON.parse(text)

        if (Array.isArray(data)) {
          if (data.length === 0) {
            resolve({ headers: [], rows: [] })
            return
          }
          const headers = Object.keys(data[0])
          resolve({ headers, rows: data, metadata: { totalRows: data.length } })
        } else if (data.data && Array.isArray(data.data)) {
          if (data.data.length === 0) {
            resolve({ headers: [], rows: [] })
            return
          }
          const headers = Object.keys(data.data[0])
          resolve({ headers, rows: data.data, metadata: { totalRows: data.data.length } })
        } else {
          reject(new Error("JSON must be an array of objects or { data: [...] }"))
        }
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsText(file)
  })
}

export async function parseXML(file: File): Promise<ParsedData> {
  const text = await readFileAsText(file)
  return new Promise((resolve, reject) => {
    xml2js.parseString(text, { explicitArray: true }, (err, result) => {
      if (err) {
        reject(err)
        return
      }
      try {
        const records = result?.root?.record ?? result?.records?.record ?? []
        if (records.length === 0) {
          resolve({ headers: [], rows: [] })
          return
        }
        const first = records[0]
        const headers = Object.keys(first).filter((k) => typeof first[k] === "object" && first[k]["0"] != null)
        const rows = records.map((rec: Record<string, any>) => {
          const row: Record<string, any> = {}
          for (const h of headers) {
            const val = rec[h]?.[0] ?? rec[h]
            row[h] = val === "" || val === undefined ? null : val
          }
          return row
        })
        resolve({ headers, rows, metadata: { totalRows: rows.length } })
      } catch (e) {
        reject(e)
      }
    })
  })
}

export async function parseFile(file: File): Promise<ParsedData> {
  const ext = file.name.split(".").pop()?.toLowerCase()
  if (ext === "json") return parseJSON(file)
  if (ext === "xml") return parseXML(file)
  return parseCSV(file)
}
