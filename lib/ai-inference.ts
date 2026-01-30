import { ParsedData } from "./file-parsers"
import { FIELD_MAPPINGS } from "./standardization"

/**
 * Field inference result for a single field
 */
export interface FieldInference {
  fieldName: string
  suggestedCanonicalField: string | null
  suggestedUnit: string
  confidence: number
  reasoning: string
  source: "rule" | "llm"
}

/**
 * Complete inference result for all fields
 */
export interface InferenceResult {
  fields: FieldInference[]
  needsValidation: boolean
}

/**
 * LLM Response Interface (general)
 */
interface LLMInferenceResponse {
  canonical_field: string | null
  unit: string
  confidence: number
  reasoning: string
}

/**
 * LLM Response Interface (photometric only - no unit inference)
 */
interface LLMPhotometricResponse {
  canonical_field: "brightness" | "color_index" | null
  confidence: number
  reasoning: string
}

/**
 * Allowed canonical fields
 */
const ALLOWED_CANONICAL_FIELDS = [
  "right_ascension",
  "declination",
  "distance",
  "brightness",
  "color_index",
  "object_id",
  "object_type",
  "observation_time",
] as const

type CanonicalField = typeof ALLOWED_CANONICAL_FIELDS[number] | null

/**
 * Photometric canonical fields (for LLM fallback)
 */
const PHOTOMETRIC_CANONICAL_FIELDS = ["brightness", "color_index"] as const

/**
 * Field metadata from XML parsing
 */
interface FieldMetadata {
  name: string
  unit?: string
  datatype?: string
  ucd?: string
  xtype?: string
}

/**
 * Rule-based field mapping (existing logic)
 */
function ruleBasedFieldMapping(fieldName: string): { canonicalField: string | null; confidence: number } {
  const normalized = fieldName.toLowerCase().trim()
  const canonicalField = FIELD_MAPPINGS[normalized]
  
  if (canonicalField) {
    return { canonicalField, confidence: 0.9 }
  }
  
  return { canonicalField: null, confidence: 0.0 }
}

/**
 * Rule-based unit detection
 */
function ruleBasedUnitDetection(fieldName: string, canonicalField: string | null, metadata?: FieldMetadata): string {
  // If metadata has explicit unit, use it
  if (metadata?.unit && metadata.unit !== "unknown") {
    return metadata.unit
  }
  
  const normalized = fieldName.toLowerCase().trim()
  
  // Right Ascension / Declination
  if (canonicalField === "right_ascension" || canonicalField === "declination") {
    if (normalized.includes("rad")) return "radians"
    return "degrees"
  }
  
  // Distance
  if (canonicalField === "distance") {
    if (normalized.includes("au")) return "AU"
    if (normalized.includes("ly") || normalized.includes("light")) return "light years"
    if (normalized.includes("pc") || normalized.includes("parsec")) return "parsecs"
    if (normalized.includes("km")) return "km"
    return "AU"
  }
  
  // Brightness
  if (canonicalField === "brightness") {
    return "mag"
  }
  
  // Color Index
  if (canonicalField === "color_index") {
    return "mag"
  }
  
  // Time
  if (canonicalField === "observation_time") {
    return "ISO 8601"
  }
  
  // Parallax
  if (normalized.includes("parallax")) {
    return "arcseconds"
  }
  
  return "unknown"
}

/**
 * Extracts sample values from parsed data
 */
function getSampleValues(parsedData: ParsedData, fieldName: string, maxSamples: number = 10): any[] {
  return parsedData.rows
    .slice(0, Math.min(maxSamples, parsedData.rows.length))
    .map((row) => row[fieldName])
    .filter((v) => v !== null && v !== undefined && v !== "")
    .slice(0, maxSamples)
}

/**
 * Analyzes value range for numeric fields
 */
function analyzeValueRange(sampleValues: any[]): { min: number; max: number; avg: number } | null {
  const numericValues = sampleValues
    .map((v) => {
      const num = typeof v === "number" ? v : parseFloat(String(v))
      return isNaN(num) ? null : num
    })
    .filter((v): v is number => v !== null)

  if (numericValues.length === 0) {
    return null
  }

  const sum = numericValues.reduce((a, b) => a + b, 0)
  return {
    min: Math.min(...numericValues),
    max: Math.max(...numericValues),
    avg: sum / numericValues.length,
  }
}

/**
 * Checks if field is blocked by metadata rules
 */
function isBlockedByMetadataRules(metadata?: FieldMetadata): boolean {
  if (!metadata) return false
  
  // Rule: datatype="char" → no inference needed
  if (metadata.datatype === "char" || metadata.datatype === "string") {
    return true
  }
  
  // Rule: xtype="hms" or "dms" → formatted coordinate text
  if (metadata.xtype === "hms" || metadata.xtype === "dms") {
    return true
  }
  
  // Rule: UCD starts with "meta." or contains "ID" → identifier field
  if (metadata.ucd) {
    const ucdLower = metadata.ucd.toLowerCase()
    if (ucdLower.startsWith("meta.") || ucdLower.includes("id")) {
      return true
    }
  }
  
  return false
}

/**
 * Checks if field is photometric and eligible for LLM fallback
 */
function isPhotometricEligibleForLLM(
  fieldName: string,
  metadata: FieldMetadata | undefined,
  canonicalField: string | null,
  confidence: number
): boolean {
  // Must have metadata to check datatype
  if (!metadata) return false
  
  // Rule 1: datatype must be numeric (float, double, int)
  const numericTypes = ["float", "double", "int", "integer", "number"]
  if (!numericTypes.includes(metadata.datatype?.toLowerCase() || "")) {
    return false
  }
  
  // Rule 2: Field must not be blocked by metadata rules
  if (isBlockedByMetadataRules(metadata)) {
    return false
  }
  
  // Rule 3: Canonical field confidence < 0.7
  if (confidence >= 0.7) {
    return false
  }
  
  // Rule 4: Field name OR UCD must suggest photometry
  const fieldNameLower = fieldName.toLowerCase()
  const ucdLower = metadata.ucd?.toLowerCase() || ""
  
  const photometricNamePatterns = ["mag", "flux", "brightness", "lum", "color"]
  const hasPhotometricName = photometricNamePatterns.some((pattern) =>
    fieldNameLower.includes(pattern)
  )
  
  const hasPhotometricUCD = ucdLower.includes("phot.")
  
  if (!hasPhotometricName && !hasPhotometricUCD) {
    return false
  }
  
  return true
}

/**
 * Checks if field needs LLM inference (general case - non-photometric)
 */
function needsLLMInference(
  fieldName: string,
  canonicalField: string | null,
  unit: string,
  confidence: number
): boolean {
  // If rule-based succeeded with high confidence, skip LLM
  if (canonicalField && confidence >= 0.8 && unit !== "unknown") {
    return false
  }
  
  // If unit is unknown or confidence is low, use LLM (for non-photometric fields)
  if (unit === "unknown" || confidence < 0.6) {
    return true
  }
  
  return false
}

/**
 * Calls Ollama qwen2.5:3b for photometric field classification ONLY
 * LLM does NOT infer units - units are determined by canonical field type
 */
async function callOllamaForPhotometricField(
  fieldName: string,
  sampleValues: any[],
  valueRange: { min: number; max: number; avg: number } | null,
  metadata: FieldMetadata,
  currentCanonicalField?: string | null
): Promise<LLMPhotometricResponse | null> {
  try {
    // Prepare structured input (NO raw files, NO full datasets)
    const input = {
      field_name: fieldName,
      ucd: metadata.ucd || null,
      datatype: metadata.datatype || "unknown",
      sample_values: sampleValues.slice(0, 10).map(String),
      value_range: valueRange || null,
      current_guess: currentCanonicalField || null,
      allowed_canonical_fields: PHOTOMETRIC_CANONICAL_FIELDS,
    }

    // Construct prompt focused ONLY on photometric canonical field classification
    const prompt = `You are an astronomical data expert. Classify this photometric field's semantic meaning into one canonical field type.

Field Information:
- Name: ${input.field_name}
- UCD: ${input.ucd || "not provided"}
- Datatype: ${input.datatype}
- Sample values: ${input.sample_values.join(", ")}
- Value range: ${input.value_range ? `min=${input.value_range.min}, max=${input.value_range.max}, avg=${input.value_range.avg.toFixed(2)}` : "not available"}
- Current rule-based guess: ${input.current_guess || "none"}

Allowed Canonical Fields (PHOTOMETRIC ONLY):
- brightness: Magnitude, flux, or luminosity measurements (e.g., Vmag, Bmag, apparent magnitude)
- color_index: Color index measurements (e.g., B-V, U-B, color differences)

Rules:
- brightness: Single magnitude or flux value (typically negative to positive, e.g., 4.5, -1.2, 12.3)
- color_index: Difference between two magnitudes (can be negative or positive, typically -0.5 to 2.0, e.g., 0.5, -0.2, 1.1)
- If field name contains "color" or UCD contains "phot.color" → likely color_index
- If field name is a magnitude (Vmag, Bmag, etc.) or UCD contains "phot.mag" → likely brightness
- Be conservative - only suggest if confident (confidence >= 0.6)
- If uncertain, return null for canonical_field

IMPORTANT CONSTRAINTS:
- Do NOT suggest units (units are determined automatically by canonical field type)
- Do NOT override explicit metadata
- Do NOT suggest fields outside the allowed list
- brightness → unit is automatically "mag"
- color_index → unit is automatically "mag"

Respond with ONLY valid JSON:
{
  "canonical_field": "brightness | color_index | null",
  "confidence": 0.0-1.0,
  "reasoning": "1-2 sentence explanation"
}`

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
          temperature: 0.2, // Low temperature for deterministic output
          num_predict: 200, // Limit response length
        },
      }),
    })

    if (!response.ok) {
      console.warn("Ollama API call failed:", response.statusText)
      return null // Silent fallback
    }

    const data = await response.json()
    const responseText = data.response || ""

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.warn("No JSON found in LLM response")
      return null
    }

    let parsed: LLMPhotometricResponse
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch (e) {
      console.warn("Failed to parse LLM JSON response:", e)
      return null
    }

    // Validate response structure
    if (
      typeof parsed.confidence !== "number" ||
      parsed.confidence < 0 ||
      parsed.confidence > 1 ||
      (parsed.canonical_field !== null && !PHOTOMETRIC_CANONICAL_FIELDS.includes(parsed.canonical_field)) ||
      typeof parsed.reasoning !== "string"
    ) {
      console.warn("Invalid LLM response structure")
      return null
    }

    // Validate confidence threshold
    if (parsed.confidence < 0.6) {
      return null // Confidence too low
    }

    // Final validation: check if conflicts with metadata rules
    if (isBlockedByMetadataRules(metadata)) {
      return null // Conflicts with metadata rules
    }

    return parsed
  } catch (error) {
    console.warn("Error calling Ollama for photometric field:", error)
    return null // Silent fallback
  }
}

/**
 * Calls Ollama qwen2.5:3b for field and unit inference (non-photometric fields)
 */
async function callOllamaForInference(
  fieldName: string,
  sampleValues: any[],
  valueRange: { min: number; max: number; avg: number } | null,
  metadata?: FieldMetadata,
  currentCanonicalField?: string | null,
  currentUnit?: string
): Promise<LLMInferenceResponse | null> {
  try {
    // Prepare structured input
    const input = {
      field_name: fieldName,
      ucd: metadata?.ucd || null,
      datatype: metadata?.datatype || "unknown",
      xtype: metadata?.xtype || null,
      explicit_unit: metadata?.unit || null,
      sample_values: sampleValues.slice(0, 10).map(String),
      value_range: valueRange || null,
      current_canonical_field: currentCanonicalField || null,
      current_unit: currentUnit || null,
      allowed_canonical_fields: ALLOWED_CANONICAL_FIELDS,
    }

    // Construct comprehensive prompt
    const prompt = `You are an expert in astronomical data processing. An astronaut has received a cleaned space data XML file, and we need to identify and standardize field names and units.

Field Information:
- Name: ${input.field_name}
- UCD: ${input.ucd || "not provided"}
- Datatype: ${input.datatype}
- XType: ${input.xtype || "not provided"}
- Explicit Unit (from metadata): ${input.explicit_unit || "not provided"}
- Sample values: ${input.sample_values.join(", ")}
- Value range: ${input.value_range ? `min=${input.value_range.min}, max=${input.value_range.max}, avg=${input.value_range.avg.toFixed(2)}` : "not available"}
- Current rule-based canonical field: ${input.current_canonical_field || "none"}
- Current rule-based unit: ${input.current_unit || "unknown"}

Allowed Canonical Fields:
${ALLOWED_CANONICAL_FIELDS.map((f) => `- ${f}`).join("\n")}

Canonical Field Rules:
- right_ascension: Celestial coordinate (RA, alpha, longitude-like), typically 0-360 degrees or 0-24 hours
- declination: Celestial coordinate (DEC, delta, latitude-like), typically -90 to +90 degrees
- distance: Physical distance to object (parallax, distance measurements)
- brightness: Magnitude, flux, or luminosity measurements (typically negative to positive values)
- object_id: Identifier, name, or catalog number (HD, HR, variable IDs, etc.)
- object_type: Classification, spectral type, or category (e.g., "G2V", "M", "star", "galaxy")
- observation_time: Timestamp, epoch, or observation date

Unit Rules:
- right_ascension: "degrees" or "radians" (default: degrees)
- declination: "degrees" or "radians" (default: degrees)
- distance: "AU", "km", "light years", "parsecs" (default: AU)
- brightness: "magnitude" (always)
- observation_time: "ISO 8601" (always)
- object_id: "none" (identifiers have no units)
- object_type: "none" (classifications have no units)

IMPORTANT Constraints:
1. If explicit_unit is provided and not "unknown", respect it - do not override
2. If datatype="char" or xtype="hms" or xtype="dms", unit must be "none"
3. If UCD starts with "meta." or contains "ID", unit must be "none"
4. If field is clearly an identifier (name, HD, HR, varid), canonical_field should be "object_id" and unit "none"
5. If field is clearly a spectral type or classification, canonical_field should be "object_type" and unit "none"
6. Be conservative - only suggest if confident (confidence >= 0.6)
7. If uncertain, return null for canonical_field and "unknown" for unit

Analyze the field name, sample values, value ranges, and metadata to determine:
1. The most likely canonical field name
2. The appropriate unit
3. Your confidence level (0.0-1.0)
4. Brief reasoning (1-2 sentences)

Respond with ONLY valid JSON:
{
  "canonical_field": "field_name or null",
  "unit": "unit_name",
  "confidence": 0.0-1.0,
  "reasoning": "1-2 sentence explanation"
}`

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
          temperature: 0.2, // Low temperature for deterministic output
          num_predict: 300, // Limit response length
        },
      }),
    })

    if (!response.ok) {
      console.warn("Ollama API call failed:", response.statusText)
      return null // Silent fallback
    }

    const data = await response.json()
    const responseText = data.response || ""

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.warn("No JSON found in LLM response")
      return null
    }

    let parsed: LLMInferenceResponse
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch (e) {
      console.warn("Failed to parse LLM JSON response:", e)
      return null
    }

    // Validate response structure
    if (
      typeof parsed.confidence !== "number" ||
      parsed.confidence < 0 ||
      parsed.confidence > 1 ||
      (parsed.canonical_field !== null && !ALLOWED_CANONICAL_FIELDS.includes(parsed.canonical_field as any)) ||
      typeof parsed.unit !== "string" ||
      typeof parsed.reasoning !== "string"
    ) {
      console.warn("Invalid LLM response structure")
      return null
    }

    // Validate confidence threshold
    if (parsed.confidence < 0.6) {
      return null // Confidence too low
    }

    // Apply metadata constraints
    if (metadata) {
      // Rule: If explicit unit exists and is not "unknown", respect it
      if (metadata.unit && metadata.unit !== "unknown") {
        parsed.unit = metadata.unit
      }
      
      // Rule: datatype="char" or xtype="hms"/"dms" → unit must be "none"
      if (metadata.datatype === "char" || metadata.xtype === "hms" || metadata.xtype === "dms") {
        parsed.unit = "none"
      }
      
      // Rule: UCD starts with "meta." or contains "ID" → unit must be "none"
      if (metadata.ucd) {
        const ucdLower = metadata.ucd.toLowerCase()
        if (ucdLower.startsWith("meta.") || ucdLower.includes("id")) {
          parsed.unit = "none"
        }
      }
    }

    return parsed
  } catch (error) {
    console.warn("Error calling Ollama:", error)
    return null // Silent fallback
  }
}

/**
 * Main inference function - analyzes all fields and suggests mappings
 */
export async function inferFieldMappings(
  parsedData: ParsedData,
  fieldSchemas?: Array<FieldMetadata>
): Promise<InferenceResult> {
  const inferences: FieldInference[] = []
  let needsValidation = false

  for (const fieldName of parsedData.headers) {
    // Get field metadata if available
    const metadata = fieldSchemas?.find((fs) => fs.name === fieldName)

    // Step 1: Rule-based inference
    const ruleBased = ruleBasedFieldMapping(fieldName)
    let canonicalField = ruleBased.canonicalField
    let unit = ruleBasedUnitDetection(fieldName, canonicalField, metadata)
    let confidence = ruleBased.confidence
    let reasoning = ruleBased.canonicalField
      ? `Rule-based mapping: "${fieldName}" → "${canonicalField}"`
      : `Rule-based mapping: No match found for "${fieldName}"`
    let source: "rule" | "llm" = "rule"

    // Step 2: Check if photometric LLM inference is needed
    if (isPhotometricEligibleForLLM(fieldName, metadata, canonicalField, confidence)) {
      // Get sample values
      const sampleValues = getSampleValues(parsedData, fieldName, 10)
      
      if (sampleValues.length > 0 && metadata) {
        // Analyze value range
        const valueRange = analyzeValueRange(sampleValues)
        
        // Call specialized photometric LLM (only returns canonical field, not unit)
        const llmResponse = await callOllamaForPhotometricField(
          fieldName,
          sampleValues,
          valueRange,
          metadata,
          canonicalField
        )

        if (llmResponse && llmResponse.canonical_field) {
          // Use LLM canonical field suggestion
          canonicalField = llmResponse.canonical_field
          // Unit is determined by canonical field type (brightness/color_index → "mag")
          // BUT preserve explicit metadata unit if it exists
          if (metadata.unit && metadata.unit !== "unknown") {
            // Metadata has explicit unit - preserve it (respects metadata priority)
            unit = metadata.unit
          } else if (canonicalField === "brightness" || canonicalField === "color_index") {
            // No explicit metadata unit - set based on canonical field type
            unit = "mag"
          }
          confidence = llmResponse.confidence
          reasoning = `LLM photometric inference: ${llmResponse.reasoning}`
          source = "llm"
          needsValidation = true
        }
      }
    }
    // Step 3: Check if general LLM inference is needed (non-photometric fields)
    else if (needsLLMInference(fieldName, canonicalField, unit, confidence)) {
      // Get sample values
      const sampleValues = getSampleValues(parsedData, fieldName, 10)
      
      if (sampleValues.length > 0) {
        // Analyze value range
        const valueRange = analyzeValueRange(sampleValues)
        
        // Call general LLM (for non-photometric fields)
        const llmResponse = await callOllamaForInference(
          fieldName,
          sampleValues,
          valueRange,
          metadata,
          canonicalField,
          unit
        )

        if (llmResponse) {
          // Use LLM suggestions
          canonicalField = llmResponse.canonical_field
          unit = llmResponse.unit
          confidence = llmResponse.confidence
          reasoning = `LLM inference: ${llmResponse.reasoning}`
          source = "llm"
          needsValidation = true
        }
      }
    }

    inferences.push({
      fieldName,
      suggestedCanonicalField: canonicalField,
      suggestedUnit: unit,
      confidence,
      reasoning,
      source,
    })
  }

  return {
    fields: inferences,
    needsValidation,
  }
}


