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
        xml2js.parseString(text, { explicitArray: false, mergeAttrs: true }, (err, result) => {
          if (err) {
            reject(new Error(`XML parsing error: ${err.message}`))
            return
          }

          // Try to extract data from common XML structures
          const rootKey = Object.keys(result)[0]
          const root = result[rootKey]

          let rows: Record<string, any>[] = []
          let headers: string[] = []

          // Check for SkyScribe_Clean_Data format (or similar VOTable-like structure)
          if (root.Metadata && root.TABLEDATA) {
            // Extract field names from Metadata
            const fields = Array.isArray(root.Metadata.FIELD) 
              ? root.Metadata.FIELD 
              : root.Metadata.FIELD 
                ? [root.Metadata.FIELD] 
                : []
            
            headers = fields.map((field: any) => {
              // Use the 'name' attribute from FIELD element
              // xml2js might put attributes in $ or directly on the object
              if (field.$ && field.$.name) {
                return field.$.name
              }
              if (field.name) {
                return field.name
              }
              if (typeof field === 'string') {
                return field
              }
              return ""
            }).filter((h: string) => h !== "")

            // Extract data rows from TABLEDATA
            const tableRows = Array.isArray(root.TABLEDATA.TR)
              ? root.TABLEDATA.TR
              : root.TABLEDATA.TR
                ? [root.TABLEDATA.TR]
                : []

            rows = tableRows.map((tr: any) => {
              const row: Record<string, any> = {}
              // Handle both array and single TD formats
              let cells: any[] = []
              if (Array.isArray(tr.TD)) {
                cells = tr.TD
              } else if (tr.TD) {
                cells = [tr.TD]
              } else if (Array.isArray(tr)) {
                // Sometimes TR might be an array directly
                cells = tr
              }
              
              // Map each cell to its corresponding header
              cells.forEach((cell: any, index: number) => {
                if (index < headers.length) {
                  const header = headers[index]
                  let value: any = null
                  
                  // Extract text content from cell (handle various formats)
                  if (cell === null || cell === undefined) {
                    value = null
                  } else if (typeof cell === 'string') {
                    value = cell.trim()
                  } else if (typeof cell === 'number') {
                    value = cell
                  } else if (cell._ !== undefined) {
                    // xml2js puts text content in _ property
                    value = typeof cell._ === 'string' ? cell._.trim() : cell._
                  } else if (Array.isArray(cell)) {
                    value = cell[0] !== undefined ? (typeof cell[0] === 'string' ? cell[0].trim() : cell[0]) : null
                  } else if (typeof cell === 'object') {
                    // Try to extract any text value
                    value = cell.toString ? cell.toString() : JSON.stringify(cell)
                  } else {
                    value = cell
                  }
                  
                  // Handle empty strings
                  if (value === '' || value === null || value === undefined) {
                    row[header] = null
                  } else {
                    // Try to convert to number if it looks like a number (but not if it's a string like "Var?")
                    const trimmedValue = typeof value === 'string' ? value.trim() : String(value)
                    if (trimmedValue !== '' && !isNaN(Number(trimmedValue)) && trimmedValue !== '') {
                      const numValue = Number(trimmedValue)
                      // Only convert if it's a valid number and not NaN
                      if (!isNaN(numValue)) {
                        row[header] = numValue
                      } else {
                        row[header] = value
                      }
                    } else {
                      row[header] = value
                    }
                  }
                }
              })
              return row
            })

            resolve({ 
              headers, 
              rows, 
              metadata: { 
                totalRows: rows.length, 
                rootKey,
                format: "SkyScribe",
                fieldCount: headers.length
              } 
            })
            return
          }

          // Check for common patterns: items, records, data, entries
          const arrayKeys = ["item", "record", "data", "entry", "object", "observation", "row", "tr"]
          for (const key of arrayKeys) {
            if (root[key] && Array.isArray(root[key])) {
              rows = root[key].map((item: any) => {
                const row: Record<string, any> = {}
                Object.keys(item).forEach((k) => {
                  if (k !== '$') { // Skip XML attributes object
                    const value = Array.isArray(item[k]) ? item[k][0] : item[k]
                    // Handle nested objects with _ text content
                    if (typeof value === 'object' && value !== null && value._) {
                      row[k] = value._.trim()
                    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                      row[k] = JSON.stringify(value)
                    } else {
                      row[k] = value
                    }
                  }
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
              if (k !== '$') {
                const value = Array.isArray(root[k]) ? root[k][0] : root[k]
                if (typeof value === 'object' && value !== null && value._) {
                  row[k] = value._.trim()
                } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                  row[k] = JSON.stringify(value)
                } else {
                  row[k] = value
                }
              }
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

