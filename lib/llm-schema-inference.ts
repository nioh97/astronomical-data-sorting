/**
 * LLM Schema Inference Module
 * 
 * LLM is used ONLY for semantic understanding - NOT for data transport.
 * Returns small schema definition (<5KB), never full datasets.
 */

export interface SchemaInferenceInput {
  filename: string
  fileType: string
  headers: string[]
  sampleRows: Record<string, any>[]
  metadata?: Record<string, any>
}

export interface ColumnSchema {
  sourceField: string
  canonicalName: string
  unit: string | null
  targetUnit: string | null
  description: string
  conversionRule?: string
}

export interface SchemaInferenceResult {
  datasetName: string
  columns: ColumnSchema[]
}

/**
 * Calls Ollama LLM to infer schema and semantic meaning
 * Returns ONLY schema definition - no row data
 */
async function callOllamaForSchemaInference(input: SchemaInferenceInput): Promise<SchemaInferenceResult | null> {
  try {
    // Limit sample rows to 15 for LLM context
    const sampleRows = input.sampleRows.slice(0, 15)

    // Construct focused prompt for schema inference only
    const prompt = `You are a scientific data schema inference engine for astronomical measurements.

Your task is to analyze a dataset and infer the semantic meaning of each column. You will return ONLY a schema definition - no row data, no explanations, no markdown.

Dataset Information:
- Filename: ${input.filename}
- File Type: ${input.fileType}
- Headers: ${JSON.stringify(input.headers)}
- Sample Rows (first 15): ${JSON.stringify(sampleRows, null, 2)}
- Metadata: ${JSON.stringify(input.metadata || {}, null, 2)}

CRITICAL RULES:
- Output ONLY valid JSON - no explanations, no markdown, no confidence scores
- Return ONLY schema definition - do NOT include any row data
- Analyze column names, sample values, and metadata to infer meaning
- Decide canonical field names using scientific conventions
- Identify original units from column names, values, or metadata
- Specify target standardized units (degrees, km, mag, ISO 8601, or null)
- Describe conversion rules in plain text (e.g., "convert radians to degrees by multiplying by 57.2958")
- If a field is an identifier or categorical, unit should be null
- If unsure about a field, still provide best-effort inference

Standard Unit Conventions:
- Coordinates: "degrees" (not radians)
- Distance: "km" (not AU, parsecs, or light years)
- Brightness: "mag" (not magnitude)
- Time: "ISO 8601" (for dates/timestamps)
- Identifiers: null (no unit)
- Categorical: null (no unit)

Output Schema (STRICT JSON ONLY - NO ROWS):
{
  "datasetName": "string (cleaned filename without extension)",
  "columns": [
    {
      "sourceField": "string (original column name)",
      "canonicalName": "string (standardized semantic name)",
      "unit": "string | null (original unit if detectable, otherwise null)",
      "targetUnit": "string | null (standardized target unit)",
      "description": "string (brief description of what this field represents)",
      "conversionRule": "string | undefined (plain text description of conversion, e.g., 'multiply by 1.496e8 to convert AU to km')"
    }
  ]
}

IMPORTANT:
- Return ONLY the JSON object above
- Do NOT include any row data
- Do NOT include explanations outside the JSON
- Do NOT use markdown code blocks
- Keep response under 5KB
- If conversion is needed, describe it in conversionRule as plain text`

    // Call Ollama API
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen2.5:3b",
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1, // Very low temperature for deterministic output
          num_predict: 2000, // Limit response length (schema should be small)
        },
      }),
    })

    if (!response.ok) {
      console.error("Ollama API call failed:", response.statusText)
      return null
    }

    const data = await response.json()
    const responseText = data.response || ""

    // Extract JSON from response (handle markdown code blocks if present)
    let jsonText = responseText.trim()
    
    // Remove markdown code blocks if present
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1]
    } else {
      // Try to extract JSON object
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        jsonText = jsonMatch[0]
      }
    }

    let parsed: SchemaInferenceResult

    try {
      parsed = JSON.parse(jsonText)
    } catch (e) {
      console.error("Failed to parse LLM JSON response:", e)
      if (process.env.NODE_ENV === "development") {
        console.error("Raw LLM response:", responseText.substring(0, 500))
      }
      return null
    }

    // Validate response structure
    if (
      !parsed.datasetName ||
      !Array.isArray(parsed.columns) ||
      parsed.columns.length === 0
    ) {
      console.error("Invalid LLM response structure")
      return null
    }

    // Validate columns structure
    for (const col of parsed.columns) {
      if (!col.sourceField || !col.canonicalName || typeof col.description !== "string") {
        console.error("Invalid column structure:", col)
        return null
      }
    }

    return parsed
  } catch (error) {
    console.error("Error calling Ollama for schema inference:", error)
    return null
  }
}

/**
 * Main schema inference function
 * Returns schema definition only - no row data
 */
export async function inferDatasetSchemaWithLLM(
  input: SchemaInferenceInput
): Promise<SchemaInferenceResult> {
  // Call LLM for schema inference
  const result = await callOllamaForSchemaInference(input)

  if (!result) {
    // Retry once with fewer sample rows if first attempt fails
    if (input.sampleRows.length > 5) {
      console.warn("Retrying schema inference with fewer sample rows...")
      const retryResult = await callOllamaForSchemaInference({
        ...input,
        sampleRows: input.sampleRows.slice(0, 5),
      })
      if (retryResult) {
        return retryResult
      }
    }
    throw new Error("LLM schema inference failed. Please ensure Ollama is running and the model is available.")
  }

  return result
}

