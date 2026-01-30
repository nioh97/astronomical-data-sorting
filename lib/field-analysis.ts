/**
 * STAGE 1 — FIELD & METADATA ANALYSIS
 * 
 * Uses ONLY llama-3.1-8b for semantic understanding.
 * NO conversion, NO rows, NO final data.
 */

import { safeParseJSON } from "@/lib/llm-json"

export interface FieldAnalysisInput {
  filename: string
  fileType: "csv" | "json" | "xml"
  headers: string[]
  sampleRows: Record<string, any>[] // First 5 rows only
  metadata?: Record<string, any> // datatype, UCD, xtype if available
}

export interface FieldAnalysisResult {
  field_name: string
  semantic_type: string
  unit_required: boolean
  allowed_units: string[]
  recommended_unit: string | null
  reason: string
}

export interface FieldAnalysisOutput {
  fields: FieldAnalysisResult[]
}

/**
 * Calls llama-3.1-8b to analyze field semantics and unit requirements
 * Returns ONLY field analysis - no conversion, no rows, no data
 */
async function callLlamaForFieldAnalysis(input: FieldAnalysisInput): Promise<FieldAnalysisOutput | null> {
  try {
    // Limit to first 5 rows for LLM context
    const sampleRows = input.sampleRows.slice(0, 5)

    // Prepare structured input for LLM
    const llmInput = {
      filename: input.filename,
      file_type: input.fileType,
      headers: input.headers,
      sample_rows: sampleRows,
      metadata: input.metadata || {},
    }

    // Construct prompt for field analysis ONLY
    const prompt = `You are a scientific data field analysis engine for astronomical measurements.

Your task is to analyze dataset fields and determine their semantic meaning and unit requirements. You will return ONLY field analysis - NO conversion, NO rows, NO final data.

Dataset Information:
- Filename: ${llmInput.filename}
- File Type: ${llmInput.file_type}
- Headers: ${JSON.stringify(llmInput.headers)}
- Sample Rows (first 5): ${JSON.stringify(sampleRows, null, 2)}
- Metadata: ${JSON.stringify(llmInput.metadata, null, 2)}

CRITICAL RULES:
- Output ONLY valid JSON - no explanations, no markdown
- Analyze semantic meaning from column names, values, and metadata
- Decide whether a unit is REQUIRED for each field
- If unit_required=true, provide allowed_units and recommended_unit
- If unit_required=false, set allowed_units=[], recommended_unit=null
- Do NOT convert values
- Do NOT output rows
- Do NOT output final data
- Do NOT guess units without justification

Semantic Types:
- right_ascension: Celestial coordinate (RA, alpha)
- declination: Celestial coordinate (DEC, delta)
- angular_distance: Angular separation or size
- distance: Physical distance to object
- brightness: Magnitude, flux, or luminosity
- color_index: Color difference (B-V, U-B, etc.)
- object_id: Identifier, name, or catalog number
- object_type: Classification or spectral type
- observation_time: Timestamp or observation date
- other: Other measurement types

Unit Requirements by Semantic Type:
- right_ascension: unit_required=true, allowed_units=["deg", "rad", "hour_angle"]
- declination: unit_required=true, allowed_units=["deg", "rad"]
- angular_distance: unit_required=true, allowed_units=["deg", "arcmin", "arcsec"]
- distance: unit_required=true, allowed_units=["AU", "km", "parsec", "lightyear"]
- brightness: unit_required=true, allowed_units=["mag"]
- color_index: unit_required=true, allowed_units=["mag"]
- object_id: unit_required=false, allowed_units=[]
- object_type: unit_required=false, allowed_units=[]
- observation_time: unit_required=false, allowed_units=[] (use ISO 8601 format)
- other: unit_required depends on field nature

Detection Rules:
1. Identifiers, strings, categorical fields → unit_required=false, allowed_units=[]
2. Numeric fields with semantic meaning → unit_required=true
3. Check metadata (UCD, xtype, datatype) for hints about units
4. Analyze sample values to infer unit requirements
5. Be scientifically conservative - if uncertain, set unit_required=false

Output Schema (STRICT JSON ONLY):
{
  "fields": [
    {
      "field_name": "string (original column name)",
      "semantic_type": "string (semantic type from list above)",
      "unit_required": true|false (whether this field requires a unit),
      "allowed_units": ["string"] (array of valid unit options, empty if unit_required=false),
      "recommended_unit": "string | null (recommended unit from allowed_units, or null if unit_required=false)",
      "reason": "string (1-2 sentence explanation for unit_required and recommended_unit)"
    }
  ]
}

IMPORTANT:
- Return ONLY the JSON object above
- Do NOT include any row data
- Do NOT include explanations outside the JSON
- Do NOT use markdown code blocks
- unit_required=false → allowed_units=[], recommended_unit=null
- unit_required=true → allowed_units must not be empty
- recommended_unit must be one of allowed_units or null
- No field should show "unknown" if unit is applicable
- Unitless fields must never request units`

    // Call Ollama API with llama-3.1-8b ONLY
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3.1:8b", // ONLY llama-3.1-8b for this stage
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.2, // Low temperature for deterministic output (≤0.2)
          top_p: 0.9, // Top-p sampling (≤0.9)
          num_predict: 2000, // Field analysis should be small
        },
      }),
    })

    if (!response.ok) {
      console.error("Ollama API call failed:", response.statusText)
      return null
    }

    const data = await response.json()
    const responseText = data.response || ""

    // Safely extract and parse JSON (returns null on failure, no exception)
    const parsed = safeParseJSON<FieldAnalysisOutput>(responseText, "Field Analysis JSON")
    if (!parsed) {
      console.error("Failed to parse LLM JSON response")
      return null
    }

    // Validate response structure
    if (!Array.isArray(parsed.fields) || parsed.fields.length === 0) {
      console.error("Invalid LLM response structure")
      return null
    }

    // Validate fields structure
    for (const field of parsed.fields) {
      if (
        !field.field_name ||
        !field.semantic_type ||
        typeof field.unit_required !== "boolean" ||
        !Array.isArray(field.allowed_units) ||
        typeof field.reason !== "string"
      ) {
        console.error("Invalid field structure:", field)
        return null
      }

      // Validate unit_required logic
      if (field.unit_required === false) {
        if (field.allowed_units.length > 0 || field.recommended_unit !== null) {
          console.warn(`Field ${field.field_name}: unit_required=false but has units, correcting...`)
          field.allowed_units = []
          field.recommended_unit = null
        }
      } else {
        // unit_required=true → must have allowed_units
        if (field.allowed_units.length === 0) {
          console.warn(`Field ${field.field_name}: unit_required=true but no allowed_units, setting unit_required=false`)
          field.unit_required = false
          field.recommended_unit = null
        }
        // Validate recommended_unit is in allowed_units
        if (field.recommended_unit !== null && !field.allowed_units.includes(field.recommended_unit)) {
          console.warn(`Field ${field.field_name}: recommended_unit not in allowed_units, setting to null`)
          field.recommended_unit = null
        }
      }
    }

    return parsed
  } catch (error) {
    console.error("Error calling Ollama for field analysis:", error)
    return null
  }
}

/**
 * Main field analysis function
 * Returns field analysis only - no conversion, no rows, no data
 * Includes retry mechanism for JSON parsing failures
 */
export async function analyzeFieldsWithLLM(input: FieldAnalysisInput): Promise<FieldAnalysisOutput> {
  let result = await callLlamaForFieldAnalysis(input)

  // Retry once if parsing failed (could be incomplete JSON)
  if (!result) {
    console.warn("First attempt failed, retrying field analysis...")
    result = await callLlamaForFieldAnalysis(input)
  }

  if (!result) {
    // Retry once with fewer sample rows if both attempts fail
    if (input.sampleRows.length > 3) {
      console.warn("Retrying field analysis with fewer sample rows...")
      const retryResult = await callLlamaForFieldAnalysis({
        ...input,
        sampleRows: input.sampleRows.slice(0, 3),
      })
      if (retryResult) {
        return retryResult
      }
    }
    throw new Error("LLM field analysis failed. Please ensure Ollama is running and llama3.1:8b model is available.")
  }

  return result
}

