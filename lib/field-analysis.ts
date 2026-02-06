/**
 * STAGE 1 — FIELD & METADATA ANALYSIS (fault-tolerant)
 *
 * Uses astronomy heuristics FIRST, then LLM for refinement.
 * Synthetic metadata is generated for datasets missing inline metadata.
 * Never throw; never fail pipeline.
 */

import { safeExtractJSONObject } from "@/lib/safeExtractJSON"
import { callOllamaWithRetry } from "@/lib/llm-retry"
import { FIELD_ANALYSIS_SYSTEM } from "@/lib/llm-field-analysis"
import {
  generateSyntheticMetadata,
  buildMetadataInjectionPrompt,
  type SyntheticMetadataResult,
  type SyntheticFieldMetadata,
} from "@/lib/synthetic-metadata"

export interface FieldAnalysisInput {
  filename: string
  fileType: "csv" | "json" | "xml"
  headers: string[]
  sampleRows: Record<string, any>[]
  metadata?: Record<string, any>
  /** Raw file text for metadata detection */
  rawText?: string
}

export interface StrictFieldForLLM {
  name: string
  sampleValues: string[]
  inferredType: "number" | "string" | "mixed"
  description?: string
}

function sanitizeHeaders(headers: string[]): string[] {
  const trimmed = headers
    .map((h) => (h != null ? String(h).trim() : ""))
    .filter((h) => h !== "")
    .filter((h) => !/^\d+$/.test(h))
  const seen = new Map<string, number>()
  return trimmed.map((h) => {
    const count = seen.get(h) ?? 0
    seen.set(h, count + 1)
    return count === 0 ? h : `${h}_${count}`
  })
}

function inferType(values: (string | number | null | undefined)[]): "number" | "string" | "mixed" {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "")
  if (nonNull.length === 0) return "string"
  const numeric = nonNull.filter((v) => typeof v === "number" || (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))))
  const allNumeric = numeric.length === nonNull.length
  const allString = nonNull.every((v) => typeof v === "string" && (v.trim() === "" || isNaN(Number(v))))
  if (allNumeric) return "number"
  if (allString) return "string"
  return "mixed"
}

function buildStrictFields(
  headers: string[],
  sampleRows: Record<string, any>[]
): StrictFieldForLLM[] {
  const sanitized = sanitizeHeaders(headers)
  const result: StrictFieldForLLM[] = []

  for (const name of sanitized) {
    const rawValues = sampleRows.map((row) => row[name])
    const sampleValues = rawValues
      .map((v) => (v === null || v === undefined ? "" : String(v).trim()))
      .filter((v) => v !== undefined)
    const nonEmpty = sampleValues.filter((s) => s.length > 0)
    if (!name || name.trim() === "") continue
    if (nonEmpty.length === 0) continue
    const inferredType = inferType(rawValues)
    const sampleValuesCapped = (nonEmpty.length >= 1 ? nonEmpty : sampleValues).slice(0, 10)
    result.push({
      name: name.trim(),
      sampleValues: sampleValuesCapped,
      inferredType,
    })
  }

  return result.filter(
    (f: StrictFieldForLLM) =>
      f != null &&
      typeof f === "object" &&
      f.name &&
      Array.isArray(f.sampleValues) &&
      f.sampleValues.length >= 1
  )
}

/** Encoding of the quantity for conversion rules. Logarithmic/sexagesimal/categorical must not be linearly converted. */
export type QuantityEncoding = "linear" | "logarithmic" | "sexagesimal" | "categorical" | "identifier"

/** Inference source for UI transparency */
export type InferenceSource = 'guard' | 'domain' | 'name' | 'value' | 'llm' | 'fallback'

export interface FieldAnalysisResult {
  field_name: string
  semantic_type: string
  unit_required: boolean
  allowed_units: string[]
  recommended_unit: string | null
  reason: string
  /** For unit popup: physicalQuantity for default suggestedUnits when empty. */
  physicalQuantity?: string
  /** Set from recommended_unit when unit_required; user can override in dialog. */
  finalUnit?: string | null
  /** When physicalQuantity is "time": "quantity" = duration (convertible), "calendar" = date/timestamp (passthrough). */
  timeKind?: "quantity" | "calendar"
  /** If "logarithmic", unit conversion is disabled (e.g. log g, magnitude, log flux). Hard rule: logarithmic ⇒ unit_required = false. */
  encoding?: QuantityEncoding
  /** Source of inference for UI transparency */
  inferenceSource?: InferenceSource
  /** Confidence score 0-1 */
  confidence?: number
  /** Warning message for UI */
  warning?: string
}

export interface FieldAnalysisOutput {
  fields: FieldAnalysisResult[]
  usedFallback?: boolean
  /** Synthetic metadata generated from heuristics */
  syntheticMetadata?: SyntheticMetadataResult
}

const QUANTITY_ENCODING_VALUES = ["linear", "logarithmic", "sexagesimal", "categorical", "identifier"] as const

function normalizeEncoding(raw: unknown): QuantityEncoding {
  const s = typeof raw === "string" ? raw.toLowerCase() : ""
  if ((QUANTITY_ENCODING_VALUES as readonly string[]).includes(s)) return s as QuantityEncoding
  return "linear"
}

/** Normalize and repair a raw LLM field. Never reject for schema differences. Hard rule: encoding === "logarithmic" ⇒ unit_required = false. */
function normalizeFieldResult(raw: unknown, index: number): FieldAnalysisResult | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const f = raw as Record<string, unknown>
  const field_name = String(f.field_name ?? f.name ?? "").trim()
  if (!field_name) return null
  const semantic_type = String(f.semantic_type ?? f.physicalQuantity ?? "other").toLowerCase()
  const pq = semantic_type || "dimensionless"
  const encoding = normalizeEncoding(f.encoding)
  let unit_required =
    typeof f.unit_required === "boolean"
      ? f.unit_required
      : typeof f.unitRequired === "boolean"
        ? f.unitRequired
        : pq !== "dimensionless" && pq !== "count"
  if (encoding === "logarithmic" || encoding === "sexagesimal") unit_required = false
  const recommended_unit =
    f.recommended_unit != null
      ? String(f.recommended_unit)
      : f.recommendedUnit != null
        ? String(f.recommendedUnit)
        : null
  const allowed_units = Array.isArray(f.allowed_units) ? (f.allowed_units as string[]) : []
  const reason = typeof f.reason === "string" ? f.reason : `Physical quantity: ${pq}`
  const confidence = typeof f.confidence === "number" ? f.confidence : 0.5
  const inferenceSource = (f.inferenceSource || f.source || 'llm') as InferenceSource
  const warning = typeof f.warning === "string" ? f.warning : undefined
  return {
    field_name,
    semantic_type: pq,
    unit_required,
    allowed_units,
    recommended_unit: recommended_unit || null,
    reason,
    physicalQuantity: pq,
    encoding,
    inferenceSource,
    confidence,
    warning,
  }
}

/** Normalize and repair: only return null when no fields array or zero length. */
function validateAndNormalizeFields(parsed: Record<string, unknown>): FieldAnalysisResult[] | null {
  if (!Array.isArray(parsed.fields) || parsed.fields.length === 0) return null
  const valid: FieldAnalysisResult[] = []
  for (let i = 0; i < parsed.fields.length; i++) {
    const field = normalizeFieldResult(parsed.fields[i], i)
    if (field) valid.push(field)
  }
  return valid.length > 0 ? valid : null
}

/** 
 * Fallback schema using synthetic metadata from heuristics.
 * Uses astronomy-specific rules instead of blanket "dimensionless".
 */
function buildFallbackFields(
  headers: string[], 
  sampleRows: Record<string, any>[],
  syntheticMeta?: SyntheticMetadataResult
): FieldAnalysisResult[] {
  const sanitized = sanitizeHeaders(headers)
  if (sanitized.length === 0) return []
  
  // Build a map from synthetic metadata for fast lookup
  const syntheticMap = new Map<string, SyntheticFieldMetadata>()
  if (syntheticMeta) {
    for (const field of syntheticMeta.fields) {
      syntheticMap.set(field.fieldName.toLowerCase(), field)
    }
  }
  
  return sanitized.map((name) => {
    const synField = syntheticMap.get(name.toLowerCase())
    
    // Use synthetic metadata if available
    if (synField) {
      // Determine inference source from rule
      let inferenceSource: InferenceSource = 'fallback'
      if (synField.source === 'heuristic') {
        if (synField.rule.startsWith('guard_')) inferenceSource = 'guard'
        else if (synField.rule.startsWith('gaia_')) inferenceSource = 'domain'
        else inferenceSource = 'name'
      } else if (synField.source === 'value_inference') {
        inferenceSource = 'value'
      }
      
      return {
        field_name: name,
        semantic_type: synField.physicalQuantity,
        unit_required: synField.unitRequired,
        allowed_units: synField.alternativeUnits,
        recommended_unit: synField.canonicalUnit !== 'unknown' ? synField.canonicalUnit : null,
        reason: `${synField.rule} [${synField.source}]`,
        physicalQuantity: synField.physicalQuantity,
        encoding: synField.encoding as QuantityEncoding,
        inferenceSource,
        confidence: synField.confidence,
        warning: synField.rule.includes('correlation') ? 'Correlation coefficients are dimensionless [-1, 1]' :
                 synField.encoding === 'logarithmic' ? 'Logarithmic quantities cannot be converted linearly' : undefined,
      }
    }
    
    // True fallback (should rarely happen now) - fail-safe default
    return {
      field_name: name,
      semantic_type: "dimensionless",
      unit_required: false,
      allowed_units: [] as string[],
      recommended_unit: null as string | null,
      reason: "Fail-safe: unclassified field",
      physicalQuantity: "dimensionless",
      encoding: "linear" as QuantityEncoding,
      inferenceSource: 'fallback' as InferenceSource,
      confidence: 0.1,
    }
  })
}

async function callLlamaForFieldAnalysis(params: {
  datasetName: string
  fileType: string
  strictFields: StrictFieldForLLM[]
  syntheticMeta?: SyntheticMetadataResult
}): Promise<FieldAnalysisOutput | null> {
  const { datasetName, fileType, strictFields, syntheticMeta } = params
  if (strictFields.length === 0) return null

  const llmPayload = {
    datasetName,
    fileType,
    fields: strictFields.map((f) => ({
      name: f.name,
      inferredType: f.inferredType,
      sampleValues: f.sampleValues.slice(0, 10),
      ...(f.description != null && f.description !== "" ? { description: f.description } : {}),
    })),
  }

  // Build the metadata injection prompt if we have synthetic metadata
  const metadataInjection = syntheticMeta 
    ? buildMetadataInjectionPrompt(syntheticMeta) + "\n\n"
    : ""

  const prompt = `${metadataInjection}Dataset: ${datasetName}, type: ${fileType}. Fields to analyze (name, inferredType, sampleValues only — no full rows):
${JSON.stringify(llmPayload)}

Return ONLY a JSON object with key "fields": array of { field_name, semantic_type, encoding, unit_required, allowed_units, recommended_unit, reason }.
encoding MUST be one of: linear, logarithmic, sexagesimal, categorical, identifier.
If a field is logarithmic (e.g. log(g), magnitude, log flux, st_logg), set encoding = "logarithmic" and unit_required = false.
If a field contains angle values as sexagesimal strings (e.g. "12h20m42.91s", "+17d47m35.71s", rastr, decstr, RA string, Dec string), set physicalQuantity = "angle", encoding = "sexagesimal", unit_required = false.
unit_required=false → allowed_units=[], recommended_unit=null.

CRITICAL: For fields marked HIGH CONFIDENCE above, you MUST use the exact physicalQuantity and recommended_unit shown. Do NOT override with "dimensionless".`

  const { parsed } = await callOllamaWithRetry({
    model: "llama3.1:8b",
    prompt,
    system: FIELD_ANALYSIS_SYSTEM,
    useRetryPrompt: true,
    options: { temperature: 0.2, top_p: 0.9, num_predict: 1024 },
  })

  if (!parsed || typeof parsed !== "object") return null
  const normalizedFields = validateAndNormalizeFields(parsed as Record<string, unknown>)
  return normalizedFields
    ? { fields: normalizedFields, syntheticMetadata: syntheticMeta }
    : null
}

/**
 * Main field analysis. 
 * 1. Generate synthetic metadata using astronomy heuristics
 * 2. Inject into LLM prompt
 * 3. Merge results, respecting confidence levels
 * 4. Fallback uses synthetic metadata, not blanket "dimensionless"
 */
export async function analyzeFieldsWithLLM(input: FieldAnalysisInput): Promise<FieldAnalysisOutput> {
  const sampleRows = input.sampleRows.slice(0, 5)
  const strictFields = buildStrictFields(input.headers, sampleRows)

  // STEP 1: Generate synthetic metadata using astronomy heuristics BEFORE LLM
  const syntheticMeta = generateSyntheticMetadata(
    input.headers,
    sampleRows,
    input.rawText,
    input.metadata
  )

  // Log synthetic metadata generation
  if (typeof console !== "undefined" && console.log) {
    const highConf = syntheticMeta.fields.filter(f => f.confidence >= 0.7).length
    const medConf = syntheticMeta.fields.filter(f => f.confidence >= 0.4 && f.confidence < 0.7).length
    const lowConf = syntheticMeta.fields.filter(f => f.confidence < 0.4).length
    console.log(`[Synthetic Metadata] Generated for ${syntheticMeta.fields.length} fields: ` +
      `${highConf} high confidence, ${medConf} medium, ${lowConf} low. ` +
      `Metadata present: ${syntheticMeta.metadataPresent} (${syntheticMeta.metadataType})`)
  }

  const validFields = strictFields.filter(
    (f) =>
      f != null &&
      typeof f === "object" &&
      (f as StrictFieldForLLM).name != null &&
      String((f as StrictFieldForLLM).name).trim() !== "" &&
      Array.isArray((f as StrictFieldForLLM).sampleValues) &&
      (f as StrictFieldForLLM).sampleValues.length >= 1
  )

  // STEP 2: Build fallback using synthetic metadata (not blanket dimensionless)
  const fallback = { 
    fields: buildFallbackFields(input.headers, sampleRows, syntheticMeta), 
    usedFallback: true as const,
    syntheticMetadata: syntheticMeta,
  }

  if (validFields.length === 0) {
    if (typeof console !== "undefined" && console.warn) 
      console.warn("Field analysis: no valid columns, using synthetic metadata fallback")
    return fallback
  }

  // STEP 3: Call LLM with synthetic metadata injection
  const payload = {
    datasetName: input.filename,
    fileType: input.fileType,
    strictFields: validFields,
    syntheticMeta,
  }

  let result = await callLlamaForFieldAnalysis(payload)
  if (!result) {
    if (typeof console !== "undefined" && console.warn) 
      console.warn("Field analysis: first attempt failed, retrying once")
    result = await callLlamaForFieldAnalysis(payload)
  }

  if (!result) {
    if (typeof console !== "undefined" && console.warn) 
      console.warn("Field analysis: using synthetic metadata fallback")
    return fallback
  }

  // STEP 4: Merge LLM results with synthetic metadata, respecting confidence
  const mergedFields = mergeWithSyntheticMetadata(result.fields, syntheticMeta)

  return {
    fields: mergedFields,
    usedFallback: false,
    syntheticMetadata: syntheticMeta,
  }
}

/**
 * Map synthetic source string to InferenceSource type
 */
function mapSyntheticSourceToInferenceSource(source: string): InferenceSource {
  if (source === 'heuristic') {
    // Heuristic could be guard, domain, or name - check rule for specifics
    return 'name'
  }
  if (source === 'value_inference') return 'value'
  if (source === 'fallback') return 'fallback'
  return 'llm'
}

/**
 * Determine inference source from rule name
 */
function inferSourceFromRule(rule: string): InferenceSource {
  if (rule.startsWith('guard_')) return 'guard'
  if (rule.startsWith('gaia_')) return 'domain'
  if (rule.includes('correlation')) return 'guard'
  if (rule.includes('identifier')) return 'guard'
  if (rule.includes('count')) return 'guard'
  return 'name'
}

/**
 * Merges LLM results with synthetic metadata.
 * High confidence synthetic metadata takes precedence.
 * Includes inferenceSource, confidence, and warning for UI transparency.
 */
function mergeWithSyntheticMetadata(
  llmFields: FieldAnalysisResult[],
  syntheticMeta: SyntheticMetadataResult
): FieldAnalysisResult[] {
  const syntheticMap = new Map<string, SyntheticFieldMetadata>()
  for (const field of syntheticMeta.fields) {
    syntheticMap.set(field.fieldName.toLowerCase(), field)
  }

  return llmFields.map((llmField) => {
    const synField = syntheticMap.get(llmField.field_name.toLowerCase())
    
    // No synthetic data → use LLM result with llm source
    if (!synField) {
      return {
        ...llmField,
        inferenceSource: 'llm' as InferenceSource,
        confidence: llmField.confidence ?? 0.5,
      }
    }
    
    // Determine inference source from synthetic field
    const inferenceSource = synField.source === 'heuristic' 
      ? inferSourceFromRule(synField.rule)
      : mapSyntheticSourceToInferenceSource(synField.source)
    
    // High confidence synthetic → override LLM
    if (synField.confidence >= 0.7) {
      return {
        ...llmField,
        semantic_type: synField.physicalQuantity,
        physicalQuantity: synField.physicalQuantity,
        unit_required: synField.unitRequired,
        allowed_units: synField.alternativeUnits,
        recommended_unit: synField.canonicalUnit !== 'unknown' ? synField.canonicalUnit : llmField.recommended_unit,
        encoding: synField.encoding as QuantityEncoding,
        reason: `${synField.rule} [${synField.source}]`,
        inferenceSource,
        confidence: synField.confidence,
        warning: getWarningForField(synField),
      }
    }
    
    // Medium confidence → prefer synthetic if LLM says dimensionless
    if (synField.confidence >= 0.4) {
      const llmSaysDimensionless = 
        llmField.physicalQuantity === 'dimensionless' || 
        llmField.semantic_type === 'other' ||
        llmField.semantic_type === 'dimensionless'
      
      if (llmSaysDimensionless && synField.physicalQuantity !== 'dimensionless') {
        return {
          ...llmField,
          semantic_type: synField.physicalQuantity,
          physicalQuantity: synField.physicalQuantity,
          unit_required: synField.unitRequired,
          allowed_units: synField.alternativeUnits,
          recommended_unit: synField.canonicalUnit !== 'unknown' ? synField.canonicalUnit : null,
          encoding: synField.encoding as QuantityEncoding,
          reason: `${synField.rule} (overriding LLM dimensionless)`,
          inferenceSource,
          confidence: synField.confidence,
          warning: getWarningForField(synField),
        }
      }
    }
    
    // Otherwise use LLM result but add source info
    return {
      ...llmField,
      inferenceSource: 'llm' as InferenceSource,
      confidence: llmField.confidence ?? 0.5,
    }
  })
}

/**
 * Generate warning message for special fields
 */
function getWarningForField(synField: SyntheticFieldMetadata): string | undefined {
  if (synField.rule.includes('correlation')) {
    return 'Correlation coefficients are dimensionless [-1, 1]'
  }
  if (synField.encoding === 'logarithmic') {
    return 'Logarithmic quantities cannot be converted linearly'
  }
  if (synField.rule.includes('gaia_x') || synField.rule.includes('gaia_y') || synField.rule.includes('gaia_z')) {
    return 'Gaia Cartesian coordinate (length, not angle)'
  }
  if (synField.rule.includes('gaia_v')) {
    return 'Gaia velocity component (not angular)'
  }
  return undefined
}
