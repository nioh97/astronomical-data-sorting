/**
 * LLM Analysis Module
 * 
 * LLM is used ONLY for semantic understanding and unit detection.
 * NO unit conversion is performed here - user selects final units.
 */

import { safeParseJSON } from "@/lib/llm-json"

export interface LLMIngestionInput {
  filename: string
  fileType: "csv" | "json" | "xml"
  rawText: string
  parsedPreview: {
    headers: string[]
    sampleRows: Record<string, any>[]
    metadata?: Record<string, any>
  }
}

export interface FieldAnalysis {
  fieldName: string
  semanticType: string
  detectedUnit: string | null // Unit detected from metadata/parsing (may be "unknown", "none", or "formatted")
  suggestedUnits: string[] // Valid unit options for this semantic type
  recommendedUnit: string | null // AI's recommended final unit (from suggestedUnits)
  confidence: number // 0-1 confidence in the recommendation
  reasoning: string // 1-2 sentence explanation
  description: string
}

export interface LLMAnalysisResult {
  datasetName: string
  fields: FieldAnalysis[]
  rawRows: Record<string, any>[]
}

/**
 * Calls Ollama LLM to analyze dataset semantics and detect units
 * Returns field analysis and raw rows - NO conversion performed
 */
async function callOllamaForAnalysis(input: LLMIngestionInput): Promise<LLMAnalysisResult | null> {
  try {
    // Use all parsed rows (already parsed by file-parsers)
    const allRows = input.parsedPreview.sampleRows || []
    
    // Limit sample rows for LLM context (15 rows)
    const sampleRows = allRows.slice(0, 15)

    // Prepare structured input for LLM
    const llmInput = {
      filename: input.filename,
      file_type: input.fileType,
      headers: input.parsedPreview.headers,
      sample_rows: sampleRows,
      metadata: input.parsedPreview.metadata || {},
      raw_text_preview: input.rawText.substring(0, 2000),
    }

    // Get model from config (default: qwen2.5:3b, optional: llama3.1:8b)
    const model = process.env.NEXT_PUBLIC_LLM_MODEL || "qwen2.5:3b"

    // Construct prompt for semantic analysis only (NO conversion)
    const prompt = `You are a scientific data analysis engine for astronomical measurements.

Your task is to analyze a dataset and infer the semantic meaning of each column, detect units, and recommend final units. You will return field analysis and raw rows - NO unit conversion will be performed.

Dataset Information:
- Filename: ${llmInput.filename}
- File Type: ${llmInput.file_type}
- Headers: ${JSON.stringify(llmInput.headers)}
- Sample Rows (first 15): ${JSON.stringify(sampleRows, null, 2)}
- Metadata: ${JSON.stringify(llmInput.metadata, null, 2)}
- Raw Text Preview: ${llmInput.raw_text_preview}...

CRITICAL RULES:
- Output ONLY valid JSON - no explanations, no markdown
- Analyze semantic meaning from column names, values, and metadata
- Detect the original unit from metadata, column names, or value ranges
- Suggest valid unit options based on semantic type
- Recommend a final unit from suggestedUnits (your best guess)
- Provide confidence (0.0-1.0) and reasoning for your recommendation
- Do NOT perform any unit conversion
- Do NOT modify any row values
- Return raw rows exactly as provided

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

Unit Options by Semantic Type:
- right_ascension: ["deg", "rad", "hour_angle"]
- declination: ["deg", "rad"]
- angular_distance: ["deg", "arcmin", "arcsec"]
- distance: ["AU", "km", "parsec", "lightyear"]
- brightness: ["mag"] (only option)
- color_index: ["mag"] (only option)
- object_id: [] (no unit)
- object_type: [] (no unit)
- observation_time: ["ISO 8601"] (only option)

Detection Rules:
1. Identifiers, strings, categorical fields → detectedUnit = "none", suggestedUnits = [], recommendedUnit = null
2. Formatted coordinates (HMS/DMS in metadata) → detectedUnit = "formatted", suggestedUnits = ["deg", "rad"]
3. Angular quantities without explicit unit → detectedUnit = "unknown", suggestedUnits = ["deg", "arcmin", "arcsec"]
4. Photometric values → suggestedUnits = ["mag"], recommendedUnit = "mag"
5. Distance-like values → suggest ["km", "AU", "parsec"] based on value ranges:
   - Values < 1e9 → likely "AU"
   - Values 1e9-1e15 → likely "km"
   - Values > 1e15 → likely "parsec" or "lightyear"

Output Schema (STRICT JSON ONLY):
{
  "datasetName": "string (cleaned filename without extension)",
  "fields": [
    {
      "fieldName": "string (original column name)",
      "semanticType": "string (semantic type from list above)",
      "detectedUnit": "string | null (detected original unit: actual unit, 'unknown', 'none', or 'formatted')",
      "suggestedUnits": ["string"] (array of valid unit options for this semantic type),
      "recommendedUnit": "string | null (your recommended final unit from suggestedUnits, or null if no unit)",
      "confidence": 0.0-1.0 (confidence in recommendedUnit),
      "reasoning": "string (1-2 sentence explanation for recommendation)",
      "description": "string (brief description of field)"
    }
  ],
  "rows": [original rows unchanged - return all rows from sample_rows]
}

IMPORTANT:
- Return ALL rows from sample_rows in the "rows" array (unchanged)
- Do NOT convert any values
- Do NOT modify row data
- suggestedUnits must be valid options for the semanticType
- recommendedUnit must be one of suggestedUnits or null
- If semanticType has only one valid unit, recommendedUnit should be that unit
- If field has no unit (identifiers, types), detectedUnit = "none", suggestedUnits = [], recommendedUnit = null
- Be scientifically conservative - if uncertain, set confidence < 0.7`

    // Call Ollama API
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.2, // Low temperature for deterministic output (≤0.2)
          num_predict: 3000, // Schema should be small
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
    const parsed = safeParseJSON<{
      datasetName: string
      fields: FieldAnalysis[]
      rows?: Record<string, any>[] // LLM may return rows, but we'll use all parsed rows
    }>(responseText, "LLM Analysis JSON")

    if (!parsed) {
      console.error("Failed to parse LLM JSON response")
      return null
    }

    // Validate response structure
    if (
      !parsed.datasetName ||
      !Array.isArray(parsed.fields) ||
      parsed.fields.length === 0
    ) {
      console.error("Invalid LLM response structure")
      return null
    }

    // Validate fields structure
    for (const field of parsed.fields) {
      if (
        !field.fieldName ||
        !field.semanticType ||
        !Array.isArray(field.suggestedUnits) ||
        typeof field.confidence !== "number" ||
        field.confidence < 0 ||
        field.confidence > 1 ||
        typeof field.reasoning !== "string"
      ) {
        console.error("Invalid field structure:", field)
        return null
      }
      
      // Validate recommendedUnit is in suggestedUnits or null
      if (
        field.recommendedUnit !== null &&
        !field.suggestedUnits.includes(field.recommendedUnit)
      ) {
        console.warn(`Recommended unit ${field.recommendedUnit} not in suggestedUnits, setting to null`)
        field.recommendedUnit = null
      }
    }

    // Return analysis with ALL original rows (not just samples from LLM)
    // We use all parsed rows from the file parser, not the LLM's sample rows
    return {
      datasetName: parsed.datasetName,
      fields: parsed.fields,
      rawRows: input.parsedPreview.sampleRows, // Return all parsed rows from file parser
    }
  } catch (error) {
    console.error("Error calling Ollama for analysis:", error)
    return null
  }
}

/**
 * Main analysis function - returns field analysis and raw rows
 * NO conversion is performed
 */
export async function analyzeDatasetWithLLM(input: LLMIngestionInput): Promise<LLMAnalysisResult> {
  const result = await callOllamaForAnalysis(input)

  if (!result) {
    // Retry once with fewer sample rows if first attempt fails
    if (input.parsedPreview.sampleRows.length > 5) {
      console.warn("Retrying analysis with fewer sample rows...")
      const retryResult = await callOllamaForAnalysis({
        ...input,
        parsedPreview: {
          ...input.parsedPreview,
          sampleRows: input.parsedPreview.sampleRows.slice(0, 5),
        },
      })
      if (retryResult) {
        return retryResult
      }
    }
    throw new Error("LLM analysis failed. Please ensure Ollama is running and the model is available.")
  }

  return result
}
