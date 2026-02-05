/**
 * STAGE 1 — FIELD & METADATA ANALYSIS (fault-tolerant)
 *
 * Uses ONLY llama-3.1-8b for semantic understanding. Safe JSON extract, retry, fallback.
 * Never throw; never fail pipeline. Fallback: all numeric → dimensionless, all string → passthrough.
 */

import { safeExtractJSONObject } from "@/lib/safeExtractJSON"
import { callOllamaWithRetry } from "@/lib/llm-retry"
import { FIELD_ANALYSIS_SYSTEM } from "@/lib/llm-field-analysis"

export interface FieldAnalysisInput {
  filename: string
  fileType: "csv" | "json" | "xml"
  headers: string[]
  sampleRows: Record<string, any>[]
  metadata?: Record<string, any>
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
}

export interface FieldAnalysisOutput {
  fields: FieldAnalysisResult[]
  usedFallback?: boolean
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
  return {
    field_name,
    semantic_type: pq,
    unit_required,
    allowed_units,
    recommended_unit: recommended_unit || null,
    reason,
    physicalQuantity: pq,
    encoding,
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

/** Fallback schema: all numeric → dimensionless, all string → passthrough. Never throw. */
function buildFallbackFields(headers: string[], sampleRows: Record<string, any>[]): FieldAnalysisResult[] {
  const sanitized = sanitizeHeaders(headers)
  if (sanitized.length === 0) return []
  return sanitized.map((name) => {
    const rawValues = sampleRows.map((row) => row[name])
    const inferredType = inferType(rawValues)
    return {
      field_name: name,
      semantic_type: "other",
      unit_required: false,
      allowed_units: [] as string[],
      recommended_unit: null as string | null,
      reason: "Fallback: dimensionless (LLM unavailable)",
      physicalQuantity: "dimensionless",
      encoding: "linear" as QuantityEncoding,
    }
  })
}

async function callLlamaForFieldAnalysis(params: {
  datasetName: string
  fileType: string
  strictFields: StrictFieldForLLM[]
}): Promise<FieldAnalysisOutput | null> {
  const { datasetName, fileType, strictFields } = params
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

  const prompt = `Dataset: ${datasetName}, type: ${fileType}. Fields to analyze (name, inferredType, sampleValues only — no full rows):
${JSON.stringify(llmPayload)}

Return ONLY a JSON object with key "fields": array of { field_name, semantic_type, encoding, unit_required, allowed_units, recommended_unit, reason }.
encoding MUST be one of: linear, logarithmic, sexagesimal, categorical, identifier.
If a field is logarithmic (e.g. log(g), magnitude, log flux, st_logg), set encoding = "logarithmic" and unit_required = false.
If a field contains angle values as sexagesimal strings (e.g. "12h20m42.91s", "+17d47m35.71s", rastr, decstr, RA string, Dec string), set physicalQuantity = "angle", encoding = "sexagesimal", unit_required = false.
unit_required=false → allowed_units=[], recommended_unit=null.`

  const { parsed } = await callOllamaWithRetry({
    model: "llama3.1:8b",
    prompt,
    system: FIELD_ANALYSIS_SYSTEM,
    useRetryPrompt: true,
    options: { temperature: 0.2, top_p: 0.9, num_predict: 1024 },
  })

  if (!parsed || typeof parsed !== "object") return null
  return validateAndNormalizeFields(parsed as Record<string, unknown>)
    ? { fields: validateAndNormalizeFields(parsed as Record<string, unknown>)! }
    : null
}

/**
 * Main field analysis. Retry once on failure; then fallback schema. Never throw.
 */
export async function analyzeFieldsWithLLM(input: FieldAnalysisInput): Promise<FieldAnalysisOutput> {
  const sampleRows = input.sampleRows.slice(0, 5)
  const strictFields = buildStrictFields(input.headers, sampleRows)

  const validFields = strictFields.filter(
    (f) =>
      f != null &&
      typeof f === "object" &&
      (f as StrictFieldForLLM).name != null &&
      String((f as StrictFieldForLLM).name).trim() !== "" &&
      Array.isArray((f as StrictFieldForLLM).sampleValues) &&
      (f as StrictFieldForLLM).sampleValues.length >= 1
  )

  const fallback = { fields: buildFallbackFields(input.headers, sampleRows), usedFallback: true as const }

  if (validFields.length === 0) {
    if (typeof console !== "undefined" && console.warn) console.warn("Field analysis: no valid columns, using fallback")
    return fallback
  }

  const payload = {
    datasetName: input.filename,
    fileType: input.fileType,
    strictFields: validFields,
  }

  let result = await callLlamaForFieldAnalysis(payload)
  if (!result) {
    if (typeof console !== "undefined" && console.warn) console.warn("Field analysis: first attempt failed, retrying once")
    result = await callLlamaForFieldAnalysis(payload)
  }

  if (!result) {
    if (typeof console !== "undefined" && console.warn) console.warn("Field analysis: using fallback schema")
    return fallback
  }

  return result
}
