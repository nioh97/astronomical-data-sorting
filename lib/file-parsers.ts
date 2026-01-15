import Papa from "papaparse"
import * as xml2js from "xml2js"

export interface ParsedData {
  headers: string[]
  rows: Record<string, any>[]
  metadata?: Record<string, any>
}

export async function parseCSV(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parsing errors: ${results.errors.map((e) => e.message).join(", ")}`))
          return
        }
        const rows = results.data as Record<string, any>[]
        const headers = rows.length > 0 ? Object.keys(rows[0]) : []
        resolve({ headers, rows, metadata: { totalRows: rows.length } })
      },
      error: (error) => {
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

        // Handle array of objects
        if (Array.isArray(data)) {
          if (data.length === 0) {
            resolve({ headers: [], rows: [] })
            return
          }
          const headers = Object.keys(data[0])
          resolve({ headers, rows: data, metadata: { totalRows: data.length } })
        }
        // Handle object with data array
        else if (data.data && Array.isArray(data.data)) {
          if (data.data.length === 0) {
            resolve({ headers: [], rows: [] })
            return
          }
          const headers = Object.keys(data.data[0])
          resolve({
            headers,
            rows: data.data,
            metadata: { ...data, totalRows: data.data.length },
          })
        }
        // Handle single object
        else {
          const headers = Object.keys(data)
          resolve({ headers, rows: [data], metadata: { totalRows: 1 } })
        }
      } catch (error) {
        reject(new Error(`JSON parsing error: ${error instanceof Error ? error.message : "Unknown error"}`))
      }
    }
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsText(file)
  })
}

export async function parseXML(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        xml2js.parseString(text, (err, result) => {
          if (err) {
            reject(new Error(`XML parsing error: ${err.message}`))
            return
          }

          // Try to extract data from common XML structures
          const rootKey = Object.keys(result)[0]
          const root = result[rootKey]

          // Look for array-like structures
          let rows: Record<string, any>[] = []
          let headers: string[] = []

          // Check for common patterns: items, records, data, entries
          const arrayKeys = ["item", "record", "data", "entry", "object", "observation"]
          for (const key of arrayKeys) {
            if (root[key] && Array.isArray(root[key])) {
              rows = root[key].map((item: any) => {
                const row: Record<string, any> = {}
                Object.keys(item).forEach((k) => {
                  row[k] = Array.isArray(item[k]) ? item[k][0] : item[k]
                })
                return row
              })
              if (rows.length > 0) {
                headers = Object.keys(rows[0])
              }
              break
            }
          }

          // If no array found, treat root as single object
          if (rows.length === 0) {
            const row: Record<string, any> = {}
            Object.keys(root).forEach((k) => {
              row[k] = Array.isArray(root[k]) ? root[k][0] : root[k]
            })
            rows = [row]
            headers = Object.keys(row)
          }

          resolve({ headers, rows, metadata: { totalRows: rows.length, rootKey } })
        })
      } catch (error) {
        reject(new Error(`XML parsing error: ${error instanceof Error ? error.message : "Unknown error"}`))
      }
    }
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsText(file)
  })
}

export async function parseFile(file: File): Promise<ParsedData> {
  const extension = file.name.split(".").pop()?.toLowerCase()

  switch (extension) {
    case "csv":
      return parseCSV(file)
    case "json":
      return parseJSON(file)
    case "xml":
      return parseXML(file)
    case "fits":
      // FITS files are binary and complex - for now, return error
      throw new Error("FITS file parsing not yet implemented. Please use CSV, JSON, or XML format.")
    default:
      throw new Error(`Unsupported file format: ${extension}. Supported formats: CSV, JSON, XML`)
  }
}

