/**
 * LLM Analysis Module (fault-tolerant)
 * LLM for semantic understanding and unit detection only. safeExtractJSONObject + retry; never throw.
 */

import { safeExtractJSONObject } from "@/lib/safeExtractJSON"
import { LLM_SYSTEM_JSON_ONLY, LLM_USER_NO_TEXT_AROUND } from "@/lib/llm-retry"

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
    const prompt = `${LLM_SYSTEM_JSON_ONLY}

Your task is to analyze a dataset and infer the semantic meaning of each column, detect units, and recommend final units. Return field analysis and raw rows - NO unit conversion. ${LLM_USER_NO_TEXT_AROUND}

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

    const data = await response.json().catch(() => ({}))
    const responseText = (data.response ?? "") as string
    const parsed = safeExtractJSONObject(responseText) as Record<string, unknown> | null
    if (!parsed || !Array.isArray(parsed.fields) || parsed.fields.length === 0) {
      if (typeof console !== "undefined" && console.warn) console.warn("LLM ingestion: invalid or empty response")
      return null
    }
    if (!parsed.datasetName || typeof parsed.datasetName !== "string") {
      parsed.datasetName = input.filename.replace(/\.[^/.]+$/, "")
    }

    const validFields: FieldAnalysis[] = []
    for (const field of parsed.fields as Record<string, unknown>[]) {
      if (
        !field ||
        typeof field.fieldName !== "string" ||
        !field.fieldName ||
        typeof field.semanticType !== "string" ||
        !Array.isArray(field.suggestedUnits) ||
        (typeof field.confidence !== "number") || (field.confidence < 0 || field.confidence > 1) ||
        typeof field.reasoning !== "string"
      ) continue
      let recommendedUnit = field.recommendedUnit as string | null
      const suggestedUnits = field.suggestedUnits as string[]
      if (recommendedUnit != null && !suggestedUnits.includes(recommendedUnit)) recommendedUnit = null
      validFields.push({
        fieldName: field.fieldName as string,
        semanticType: field.semanticType as string,
        detectedUnit: (field.detectedUnit as string | null) ?? null,
        suggestedUnits,
        recommendedUnit,
        confidence: field.confidence as number,
        reasoning: field.reasoning as string,
        description: (field.description as string) ?? "",
      })
    }
    if (validFields.length === 0) return null
    return {
      datasetName: String(parsed.datasetName),
      fields: validFields,
      rawRows: input.parsedPreview.sampleRows,
    }
  } catch (error) {
    if (typeof console !== "undefined" && console.warn) console.warn("LLM ingestion error:", error)
    return null
  }
}

function buildFallbackAnalysisResult(input: LLMIngestionInput): LLMAnalysisResult {
  const datasetName = input.filename.replace(/\.[^/.]+$/, "")
  const fields: FieldAnalysis[] = (input.parsedPreview.headers || []).map((name) => ({
    fieldName: name,
    semanticType: "other",
    detectedUnit: null,
    suggestedUnits: [],
    recommendedUnit: null,
    confidence: 0,
    reasoning: "Fallback: dimensionless (LLM unavailable)",
    description: name,
  }))
  return { datasetName, fields, rawRows: input.parsedPreview.sampleRows || [] }
}

/**
 * Main analysis function. Retry once on failure; then fallback schema. Never throw.
 */
export async function analyzeDatasetWithLLM(input: LLMIngestionInput): Promise<LLMAnalysisResult> {
  let result = await callOllamaForAnalysis(input)
  if (!result && input.parsedPreview.sampleRows.length > 5) {
    if (typeof console !== "undefined" && console.warn) console.warn("LLM ingestion: retrying with fewer rows")
    result = await callOllamaForAnalysis({
      ...input,
      parsedPreview: { ...input.parsedPreview, sampleRows: input.parsedPreview.sampleRows.slice(0, 5) },
    })
  }
  if (!result) {
    if (typeof console !== "undefined" && console.warn) console.warn("LLM ingestion: using fallback schema")
    return buildFallbackAnalysisResult(input)
  }
  return result
}
