import { ParsedData } from "./file-parsers"

/**
 * Allowed canonical fields for LLM classification
 */
const ALLOWED_CANONICAL_FIELDS = [
  "right_ascension",
  "declination",
  "distance",
  "brightness",
  "object_id",
  "object_type",
  "observation_time",
] as const

type CanonicalField = typeof ALLOWED_CANONICAL_FIELDS[number] | null

/**
 * LLM Response Interface
 */
interface LLMCanonicalResponse {
  canonical_field: CanonicalField
  confidence: number
  reasoning: string
}

/**
 * Field metadata interface
 */
interface FieldMetadata {
  ucd?: string
  datatype?: string
  xtype?: string
  unit?: string
}

/**
 * Checks if UCD provides decisive semantic meaning
 */
function hasDecisiveUCD(ucd?: string): boolean {
  if (!ucd) return false
  const ucdLower = ucd.toLowerCase()
  
  // Decisive UCD patterns that clearly define field meaning
  const decisivePatterns = [
    "meta.id",
    "meta.record",
    "phot.color",
    "phot.mag",
    "pos.eq.ra",
    "pos.eq.dec",
    "pos.distance",
    "pos.parallax",
    "src.spType",
    "time.epoch",
  ]
  
  return decisivePatterns.some((pattern) => ucdLower.includes(pattern))
}

/**
 * Checks if field is blocked by hard metadata rules
 */
function isBlockedByMetadataRules(metadata?: FieldMetadata): boolean {
  if (!metadata) return false
  
  // Rule: datatype="char" → no canonical field inference needed
  if (metadata.datatype === "char" || metadata.datatype === "string") {
    return true
  }
  
  // Rule: xtype="hms" or "dms" → formatted coordinate text
  if (metadata.xtype === "hms" || metadata.xtype === "dms") {
    return true
  }
  
  // Rule: UCD starts with meta. or contains ID → identifier field
  if (metadata.ucd) {
    const ucdLower = metadata.ucd.toLowerCase()
    if (ucdLower.startsWith("meta.") || ucdLower.includes("id")) {
      return true
    }
  }
  
  return false
}

/**
 * Analyzes value pattern to extract range information
 */
function analyzeValueRange(sampleValues: any[]): { min: number; max: number } | null {
  const numericValues = sampleValues
    .filter((v) => v !== null && v !== undefined && v !== "")
    .map((v) => {
      const num = typeof v === "number" ? v : parseFloat(String(v))
      return isNaN(num) ? null : num
    })
    .filter((v): v is number => v !== null)
    .slice(0, 100)

  if (numericValues.length === 0) {
    return null
  }

  return {
    min: Math.min(...numericValues),
    max: Math.max(...numericValues),
  }
}

/**
 * Calls local Ollama LLM for canonical field classification
 * NEVER infers units - only classifies field semantic meaning
 */
async function callOllamaForCanonicalField(
  fieldName: string,
  ucd: string | undefined,
  datatype: string | undefined,
  xtype: string | undefined,
  sampleValues: any[],
  valueRange: { min: number; max: number } | null,
  currentGuess: string | null
): Promise<LLMCanonicalResponse | null> {
  try {
    // Prepare structured input (NO raw files, NO full datasets)
    const input = {
      field_name: fieldName,
      ucd: ucd || null,
      datatype: datatype || "unknown",
      xtype: xtype || null,
      sample_values: sampleValues.slice(0, 10).map(String),
      value_range: valueRange || null,
      current_guess: currentGuess || null,
      allowed_canonical_fields: ALLOWED_CANONICAL_FIELDS,
    }

    // Construct prompt focused ONLY on canonical field classification
    const prompt = `You are an astronomical data expert. Classify this field's semantic meaning into one canonical field type.

Field Information:
- Name: ${input.field_name}
- UCD: ${input.ucd || "not provided"}
- Datatype: ${input.datatype}
- XType: ${input.xtype || "not provided"}
- Sample values: ${input.sample_values.join(", ")}
- Value range: ${input.value_range ? `min=${input.value_range.min}, max=${input.value_range.max}` : "not available"}
- Current rule-based guess: ${input.current_guess || "none"}

Allowed Canonical Fields:
${ALLOWED_CANONICAL_FIELDS.map((f) => `- ${f}`).join("\n")}

Rules:
- right_ascension: Celestial coordinate (RA, alpha, longitude-like)
- declination: Celestial coordinate (DEC, delta, latitude-like)
- distance: Physical distance to object (parallax, distance measurements)
- brightness: Magnitude, flux, or luminosity measurements
- object_id: Identifier, name, or catalog number
- object_type: Classification, spectral type, or category
- observation_time: Timestamp, epoch, or observation date

IMPORTANT:
- Do NOT suggest units (this is only for field classification)
- If UCD is decisive (e.g., "pos.eq.ra", "phot.mag"), use it
- If uncertain, return null for canonical_field
- Be conservative - only suggest if confident

Respond with ONLY valid JSON:
{
  "canonical_field": "field_name or null",
  "confidence": 0.0-1.0,
  "reasoning": "1-2 sentence explanation"
}`

    // Call Ollama API (local HTTP endpoint)
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen2.5:3b", // Lightweight model
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.2, // Low temperature for deterministic output
          num_predict: 200, // Limit response length
        },
      }),
    })

    if (!response.ok) {
      return null // Silent fallback
    }

    const data = await response.json()
    const responseText = data.response || ""

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return null
    }

    const parsed: LLMCanonicalResponse = JSON.parse(jsonMatch[0])

    // Validate response structure
    if (
      typeof parsed.confidence !== "number" ||
      parsed.confidence < 0 ||
      parsed.confidence > 1 ||
      (parsed.canonical_field !== null && !ALLOWED_CANONICAL_FIELDS.includes(parsed.canonical_field as any)) ||
      typeof parsed.reasoning !== "string"
    ) {
      return null
    }

    return parsed
  } catch (error) {
    // Silent fallback - return null on any error
    return null
  }
}

/**
 * Determines if a field needs LLM classification based on trigger conditions
 */
function shouldUseLLM(
  fieldName: string,
  currentCanonicalField: string | null,
  currentConfidence: number,
  metadata?: FieldMetadata
): boolean {
  // Condition 1: canonicalFieldConfidence < 0.7
  if (currentConfidence >= 0.7) {
    return false
  }

  // Condition 2: metadata does NOT explicitly define semantic meaning
  if (hasDecisiveUCD(metadata?.ucd)) {
    return false
  }

  // Condition 3: field is NOT blocked by hard metadata rules
  if (isBlockedByMetadataRules(metadata)) {
    return false
  }

  return true
}

/**
 * LLM-assisted canonical field classification
 * Runs only when rule-based inference is insufficient
 * NEVER infers units - only classifies field semantic meaning
 */
export async function classifyCanonicalFieldWithLLM(
  fieldName: string,
  parsedData: ParsedData,
  currentCanonicalField: string | null,
  currentConfidence: number,
  metadata?: FieldMetadata
): Promise<{ canonicalField: string | null; confidence: number; reasoning: string; source: "llm" } | null> {
  // Check trigger conditions
  if (!shouldUseLLM(fieldName, currentCanonicalField, currentConfidence, metadata)) {
    return null // Skip LLM
  }

  // Extract sample values
  const sampleValues = parsedData.rows
    .slice(0, Math.min(100, parsedData.rows.length))
    .map((row) => row[fieldName])
    .filter((v) => v !== null && v !== undefined)

  if (sampleValues.length === 0) {
    return null // No samples available
  }

  // Analyze value range
  const valueRange = analyzeValueRange(sampleValues)

  // Call LLM
  const llmResponse = await callOllamaForCanonicalField(
    fieldName,
    metadata?.ucd,
    metadata?.datatype,
    metadata?.xtype,
    sampleValues,
    valueRange,
    currentCanonicalField
  )

  if (!llmResponse) {
    return null // LLM failed - silent fallback
  }

  // Validate LLM response
  const LLM_CONFIDENCE_THRESHOLD = 0.6
  if (llmResponse.confidence < LLM_CONFIDENCE_THRESHOLD) {
    return null // Confidence too low
  }

  // Validate canonical field is in allowed list
  if (llmResponse.canonical_field && !ALLOWED_CANONICAL_FIELDS.includes(llmResponse.canonical_field)) {
    return null // Invalid canonical field
  }

  // Final validation: check if conflicts with metadata rules
  if (isBlockedByMetadataRules(metadata)) {
    return null // Conflicts with metadata rules
  }

  return {
    canonicalField: llmResponse.canonical_field,
    confidence: llmResponse.confidence,
    reasoning: `LLM-assisted canonical inference: ${llmResponse.reasoning}`,
    source: "llm",
  }
}

