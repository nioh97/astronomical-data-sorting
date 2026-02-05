/**
 * LLM Schema Inference Module (fault-tolerant)
 * safeExtractJSONObject + retry; fallback schema on failure. Never throw.
 */

import { safeExtractJSONObject } from "@/lib/safeExtractJSON"
import { LLM_SYSTEM_JSON_ONLY, LLM_USER_NO_TEXT_AROUND } from "@/lib/llm-retry"

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
    const prompt = `${LLM_SYSTEM_JSON_ONLY}

Your task is to analyze a dataset and infer the semantic meaning of each column. Return ONLY a schema definition - no row data. ${LLM_USER_NO_TEXT_AROUND}

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

    const data = await response.json().catch(() => ({}))
    const responseText = (data.response ?? "") as string
    const parsed = safeExtractJSONObject(responseText) as Record<string, unknown> | null
    if (!parsed || !Array.isArray(parsed.columns) || parsed.columns.length === 0) {
      if (typeof console !== "undefined" && console.warn) console.warn("Schema inference: invalid or empty response")
      return null
    }
    const datasetName = typeof parsed.datasetName === "string" ? parsed.datasetName : input.filename.replace(/\.[^/.]+$/, "")
    const validColumns: ColumnSchema[] = []
    for (const col of parsed.columns as Record<string, unknown>[]) {
      if (!col || typeof col.sourceField !== "string" || !col.sourceField || typeof col.canonicalName !== "string" || typeof col.description !== "string")
        continue
      validColumns.push({
        sourceField: col.sourceField as string,
        canonicalName: col.canonicalName as string,
        unit: (col.unit as string | null) ?? null,
        targetUnit: (col.targetUnit as string | null) ?? null,
        description: col.description as string,
        conversionRule: col.conversionRule as string | undefined,
      })
    }
    if (validColumns.length === 0) return null
    return { datasetName, columns: validColumns }
  } catch (error) {
    if (typeof console !== "undefined" && console.warn) console.warn("Schema inference error:", error)
    return null
  }
}

function buildFallbackSchema(input: SchemaInferenceInput): SchemaInferenceResult {
  const datasetName = input.filename.replace(/\.[^/.]+$/, "")
  const columns: ColumnSchema[] = (input.headers || []).map((name) => ({
    sourceField: name,
    canonicalName: name,
    unit: null,
    targetUnit: null,
    description: `Fallback: ${name}`,
  }))
  return { datasetName, columns }
}

/**
 * Main schema inference. Retry once on failure; then fallback schema. Never throw.
 */
export async function inferDatasetSchemaWithLLM(
  input: SchemaInferenceInput
): Promise<SchemaInferenceResult> {
  let result = await callOllamaForSchemaInference(input)
  if (!result && input.sampleRows.length > 5) {
    if (typeof console !== "undefined" && console.warn) console.warn("Schema inference: retrying with fewer rows")
    result = await callOllamaForSchemaInference({ ...input, sampleRows: input.sampleRows.slice(0, 5) })
  }
  if (!result) {
    if (typeof console !== "undefined" && console.warn) console.warn("Schema inference: using fallback schema")
    return buildFallbackSchema(input)
  }
  return result
}


