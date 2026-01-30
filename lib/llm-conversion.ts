/**
 * STAGE 2 — DATA CONVERSION
 * 
 * Uses ONLY qwen-2.5-3b for numeric conversion.
 * Converts full dataset based on user-selected units.
 * Uses NDJSON (newline-delimited JSON) format for resilient parsing.
 */

/**
 * Helper function to chunk an array into smaller arrays
 */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

export interface ConversionInput {
  filename: string
  fileType: "csv" | "json" | "xml"
  headers: string[]
  rows: Record<string, any>[] // Full dataset
  fieldAnalysis: {
    field_name: string
    semantic_type: string
    unit_required: boolean
    allowed_units: string[]
    recommended_unit: string | null
    reason: string
  }[]
  selectedUnits: Record<string, string | null> // User-selected units per field
}

export interface DatasetColumn {
  name: string
  semanticType: string
  unit: string | null
  description: string
}

export interface ConversionOutput {
  datasetName: string
  columns: DatasetColumn[]
  rows: Record<string, number | string | null>[]
}

/**
 * Calls qwen-2.5-3b to convert a single chunk of rows
 * Returns only the converted rows (not columns)
 */
async function callQwenForChunk(
  chunkRows: Record<string, any>[],
  chunkIndex: number,
  totalChunks: number,
  fieldAnalysis: ConversionInput["fieldAnalysis"],
  selectedUnits: ConversionInput["selectedUnits"],
  headers: string[],
  isRetry: boolean = false
): Promise<Record<string, number | string | null>[] | null> {
  try {
    // Construct prompt for chunk conversion ONLY
    // Use stricter prompt on retry
    const systemInstruction = isRetry
      ? `You are a strict JSON output engine. You MUST return ONLY valid JSON in the exact format specified. No exceptions.`
      : `You are a scientific data conversion engine for astronomical measurements.`

    const prompt = `${systemInstruction}

Your task is to convert a CHUNK of rows based on user-selected units. You will return ONLY the converted rows.

IMPORTANT: You MUST return complete, valid JSON. Do NOT truncate the response.

Chunk Information:
- Chunk ${chunkIndex + 1} of ${totalChunks}
- Rows in this chunk: ${chunkRows.length}
- Headers: ${JSON.stringify(headers)}

Field Analysis and Selected Units:
${JSON.stringify(
  fieldAnalysis.map((f) => ({
    field_name: f.field_name,
    semantic_type: f.semantic_type,
    selected_unit: selectedUnits[f.field_name] || null,
  })),
  null,
  2
)}

Rows to Convert:
${JSON.stringify(chunkRows, null, 2)}

CRITICAL RULES:
- Output ONLY valid JSON - no explanations, no markdown
- Return ONLY the "rows" array - do NOT include columns or datasetName
- Convert ALL numeric values to user-selected units
- For unit_required=false fields, keep values as-is (no conversion)
- For unit_required=true fields, convert to selected_unit
- Preserve non-numeric values (identifiers, strings) unchanged
- Column names must match original field names

Conversion Rules:
- right_ascension: deg ↔ rad ↔ hour_angle (1 hour = 15 degrees, 1 rad = 57.2958 degrees)
- declination: deg ↔ rad (1 rad = 57.2958 degrees)
- angular_distance: deg ↔ arcmin ↔ arcsec (1 deg = 60 arcmin = 3600 arcsec)
- distance: AU ↔ km ↔ parsec ↔ lightyear
  - 1 AU = 149597870.7 km
  - 1 parsec = 3.085677581e13 km
  - 1 lightyear = 9.461e12 km
- brightness: mag → mag (no conversion, passthrough)
- color_index: mag → mag (no conversion, passthrough)
- object_id, object_type, observation_time: no conversion (passthrough)

Output Format (NDJSON - ONE ROW PER LINE):
- Output ONE JSON OBJECT per line
- Each line is a COMPLETE, VALID JSON object
- NO surrounding array brackets
- NO surrounding object braces
- NO trailing commas
- NO explanations or text
- NO markdown code blocks

Example REQUIRED output format:
{"field_name": converted_value}
{"field_name": converted_value}
{"field_name": converted_value}

CRITICAL OUTPUT REQUIREMENTS:
- Return ONLY valid JSON objects, one per line
- Do NOT include column definitions
- Do NOT include datasetName
- Do NOT include explanations
- Do NOT include markdown code blocks
- Do NOT include any text before or after the JSON rows
- If unsure about a value, use null
- Convert all rows in this chunk
- Column names must match original field names
- Each line must be a complete, parseable JSON object`

    // Call Ollama API with qwen-2.5-3b ONLY
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen2.5:3b", // ONLY qwen-2.5-3b for this stage
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1, // Very low temperature for deterministic conversion (≤0.2)
          top_p: 0.9, // Top-p sampling (≤0.9)
          num_predict: Math.max(4000, chunkRows.length * 150), // Estimate tokens needed per chunk
        },
      }),
    })

    if (!response.ok) {
      console.error(`Ollama API call failed for chunk ${chunkIndex + 1}:`, response.statusText)
      return null
    }

    const data = await response.json()
    const responseText = data.response || ""

    // Parse NDJSON format: one JSON object per line
    const lines = responseText.split("\n").map((line) => line.trim()).filter((line) => line.length > 0)
    const parsedRows: Record<string, number | string | null>[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Skip lines that don't start with '{' (explanations, markdown, etc.)
      if (!line.startsWith("{")) {
        continue
      }

      try {
        const parsed = JSON.parse(line)
        // Validate it's an object (not array, string, etc.)
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          parsedRows.push(parsed)
        } else {
          console.warn(`Chunk ${chunkIndex + 1}, line ${i + 1}: Skipping non-object JSON`)
        }
      } catch (parseError) {
        // Skip lines that fail to parse (partial JSON, invalid syntax, etc.)
        console.warn(`Chunk ${chunkIndex + 1}, line ${i + 1}: Failed to parse JSON, skipping: ${line.substring(0, 50)}...`)
        continue
      }
    }

    // Validate we got at least some rows
    if (parsedRows.length === 0) {
      console.error(`Chunk ${chunkIndex + 1}: No valid rows parsed from NDJSON response`)
      return null
    }

    // Warn if we got fewer rows than expected (but don't fail)
    if (parsedRows.length < chunkRows.length) {
      console.warn(
        `Chunk ${chunkIndex + 1}: Parsed ${parsedRows.length} rows but expected ${chunkRows.length}`
      )
    }

    return parsedRows
  } catch (error) {
    console.error(`Error calling Ollama for chunk ${chunkIndex + 1}:`, error)
    return null
  }
}

/**
 * Validates and potentially retries chunk conversion with stricter prompt
 */
async function callQwenForChunkWithValidation(
  chunkRows: Record<string, any>[],
  chunkIndex: number,
  totalChunks: number,
  fieldAnalysis: ConversionInput["fieldAnalysis"],
  selectedUnits: ConversionInput["selectedUnits"],
  headers: string[]
): Promise<Record<string, number | string | null>[] | null> {
  // First attempt
  let result = await callQwenForChunk(
    chunkRows,
    chunkIndex,
    totalChunks,
    fieldAnalysis,
    selectedUnits,
    headers,
    false // isRetry = false
  )

  // If validation failed, retry with stricter prompt
  if (!result) {
    console.warn(`Chunk ${chunkIndex + 1}: First attempt failed validation, retrying with stricter prompt...`)
    result = await callQwenForChunk(
      chunkRows,
      chunkIndex,
      totalChunks,
      fieldAnalysis,
      selectedUnits,
      headers,
      true // isRetry = true
    )
  }

  // If still invalid after retry, throw error
  if (!result) {
    throw new Error(`Invalid LLM response structure for chunk ${chunkIndex + 1} after retry`)
  }

  return result
}

/**
 * Main conversion function
 * Returns full converted dataset
 * Uses chunked processing to prevent truncated JSON
 * Falls back to local deterministic conversion if LLM fails
 */
export async function convertDatasetWithLLM(input: ConversionInput): Promise<ConversionOutput> {
  const CHUNK_SIZE = 20 // Process 20 rows per chunk

  // Generate dataset name from filename
  const datasetName = input.filename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_")

  // Build columns from field analysis (once, reused for all chunks)
  const columns = input.fieldAnalysis.map((field) => ({
    name: field.field_name,
    semanticType: field.semantic_type,
    unit: input.selectedUnits[field.field_name] || null,
    description: field.reason, // Use reason as description
  }))

  // Split rows into chunks
  const rowChunks = chunkArray(input.rows, CHUNK_SIZE)
  const totalChunks = rowChunks.length

  console.log(`Processing ${input.rows.length} rows in ${totalChunks} chunk(s) of up to ${CHUNK_SIZE} rows each`)

  // Process each chunk
  const allConvertedRows: Record<string, number | string | null>[] = []
  const failedChunks: number[] = []

  for (let i = 0; i < rowChunks.length; i++) {
    const chunk = rowChunks[i]
    console.log(`Processing chunk ${i + 1}/${totalChunks} (${chunk.length} rows)...`)

    // Try to convert chunk
    let chunkResult = await callQwenForChunk(
      chunk,
      i,
      totalChunks,
      input.fieldAnalysis,
      input.selectedUnits,
      input.headers
    )

    // Retry once if chunk failed
    if (!chunkResult) {
      console.warn(`Chunk ${i + 1} failed, retrying once...`)
      chunkResult = await callQwenForChunk(
        chunk,
        i,
        totalChunks,
        input.fieldAnalysis,
        input.selectedUnits,
        input.headers
      )
    }

    if (chunkResult) {
      // Validate chunk result has correct number of rows
      if (chunkResult.length === chunk.length) {
        allConvertedRows.push(...chunkResult)
      } else {
        console.warn(
          `Chunk ${i + 1}: Expected ${chunk.length} rows but got ${chunkResult.length}, using local conversion for this chunk`
        )
        // Fall back to local conversion for this chunk
        const { convertValue, SemanticType } = await import("./unit-conversion")
        const localConverted = chunk.map((row) => {
          const convertedRow: Record<string, number | string | null> = {}
          input.fieldAnalysis.forEach((field) => {
            const sourceValue = row[field.field_name]
            const selectedUnit = input.selectedUnits[field.field_name] || null
            if (!field.unit_required) {
              convertedRow[field.field_name] = sourceValue
            } else {
              convertedRow[field.field_name] = convertValue(
                sourceValue,
                null,
                selectedUnit,
                field.semantic_type as SemanticType
              )
            }
          })
          return convertedRow
        })
        allConvertedRows.push(...localConverted)
      }
    } else {
      // Chunk failed after retry - use local conversion
      console.warn(`Chunk ${i + 1} failed after retry, using local deterministic conversion`)
      failedChunks.push(i + 1)
      const { convertValue, SemanticType } = await import("./unit-conversion")
      const localConverted = chunk.map((row) => {
        const convertedRow: Record<string, number | string | null> = {}
        input.fieldAnalysis.forEach((field) => {
          const sourceValue = row[field.field_name]
          const selectedUnit = input.selectedUnits[field.field_name] || null
          if (!field.unit_required) {
            convertedRow[field.field_name] = sourceValue
          } else {
            convertedRow[field.field_name] = convertValue(
              sourceValue,
              null,
              selectedUnit,
              field.semantic_type as SemanticType
            )
          }
        })
        return convertedRow
      })
      allConvertedRows.push(...localConverted)
    }
  }

  // Check if any chunks failed
  if (failedChunks.length > 0) {
    console.warn(`Conversion completed with ${failedChunks.length} chunk(s) using local fallback: ${failedChunks.join(", ")}`)
  }

  // Validate we have all rows
  if (allConvertedRows.length !== input.rows.length) {
    console.error(
      `Row count mismatch: expected ${input.rows.length} but got ${allConvertedRows.length}`
    )
    // This should not happen, but if it does, we'll still return what we have
  }

  return {
    datasetName,
    columns,
    rows: allConvertedRows,
  }
}

