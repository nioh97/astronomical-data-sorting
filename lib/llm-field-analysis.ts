/**
 * NASA / scientific CSV field analysis. LLaMA 3.1 ONLY.
 * Phase A: Field discovery LOCAL (headers from parser; NASA # lines ignored).
 * Phase B: Semantics in batches of max 4; physicalQuantity enum enforced; fallback dimensionless.
 */

import { callOllamaWithRetry } from "@/lib/llm-retry"
import type { ColumnMetadataEntry } from "@/lib/file-parsers"
import { ASTRO_FIELD_OVERRIDES } from "@/lib/domain/astro-field-map"

/** Allowed physicalQuantity values. Disallow "unknown", "none", null. */
export const PHYSICAL_QUANTITY_VALUES = [
  "length",
  "mass",
  "time",
  "temperature",
  "angle",
  "distance",
  "brightness",
  "count",
  "dimensionless",
  "acceleration",
  "velocity",
  "frequency",
] as const

export type PhysicalQuantity = (typeof PHYSICAL_QUANTITY_VALUES)[number]

/** Canonical physical quantity mapping. Unknown → dimensionless. Never reject. */
const CANONICAL_QUANTITIES: Record<string, PhysicalQuantity | "dimensionless"> = {
  length: "length",
  distance: "length",
  radius: "length",
  mass: "mass",
  time: "time",
  year: "time",
  temperature: "temperature",
  angle: "angle",
  brightness: "brightness",
  acceleration: "acceleration",
  count: "count",
  dimensionless: "dimensionless",
  velocity: "velocity",
  frequency: "frequency",
}

/** Local unit registry for dropdown options. LLM must NOT define these. */
export const UNIT_REGISTRY: Record<string, string[]> = {
  length: ["m", "km", "AU", "R_earth", "R_jupiter"],
  mass: ["kg", "M_earth", "M_jupiter", "M_sun"],
  time: ["s", "min", "hour", "day", "year"],
  temperature: ["K", "C"],
  angle: ["deg", "rad", "arcsec"],
  distance: ["pc", "kpc", "AU", "ly"],
  brightness: ["mag"],
  acceleration: ["m/s^2", "cm/s^2"],
  count: ["count"],
  dimensionless: [],
  velocity: [],
  frequency: [],
}

const MAX_FIELDS_PER_REQUEST = 4
const SAMPLES_PER_FIELD = 3

function isDateLikeColumn(headerName: string): boolean {
  const lower = String(headerName || "").trim().toLowerCase()
  return (
    /rowupdate|releasedate|pl_pubdate|pubdate|pub_date|disc_year|discovery_year|year|date|timestamp|released|updated/i.test(
      lower
    ) || lower.endsWith("_date") || lower.endsWith("date")
  )
}

/** Encoding of quantity for conversion. Logarithmic/sexagesimal MUST NOT be linearly converted. */
export type QuantityEncoding = "linear" | "logarithmic" | "sexagesimal" | "categorical" | "identifier"

/** Hard system prompt for field semantics. NEVER throw for invalid LLM output. */
export const FIELD_ANALYSIS_SYSTEM = `
You are a scientific data schema analyzer.

RULES (MANDATORY):
1. You MUST choose physicalQuantity ONLY from:
   count, dimensionless, time, length, mass, distance, angle, temperature, brightness, acceleration
2. You MUST NOT invent new physical quantities.
3. You MUST NOT infer time from distance or vice versa.
4. You MUST set "encoding" for each field. Allowed: linear, logarithmic, sexagesimal, categorical, identifier.
   - If a field represents a LOGARITHMIC quantity (e.g. log(g), magnitude, log flux, log10(...)), you MUST set encoding = "logarithmic", unitRequired = false.
   - If a field contains angle values encoded as SEXAGESIMAL strings (e.g. "12h20m42.91s", "+17d47m35.71s"), you MUST set physicalQuantity = "angle", encoding = "sexagesimal", unitRequired = false.
   Examples of sexagesimal: rastr, decstr, RA string, Dec string, any column with values like "12h20m42.91s" or "+17d47m35.71s".
   Hard rule: sexagesimal ⇒ unitRequired = false. Logarithmic ⇒ unitRequired = false.
5. If a column represents:
   - counts → count, encoding: linear or categorical
   - identifiers / flags / names → dimensionless, encoding: identifier or categorical
   - orbital period → time, encoding: linear
   - semi-major axis → length, encoding: linear
   - radius → length, encoding: linear
   - mass → mass, encoding: linear
   - log(g), st_logg, magnitude → encoding: logarithmic, unitRequired: false
   - rastr, decstr, RA/Dec strings (e.g. "12h20m42.91s") → physicalQuantity: angle, encoding: sexagesimal, unitRequired: false
6. If physicalQuantity = "time", you MUST ALSO decide timeKind:
   - "quantity" → measurable duration (orbital period, exposure time)
   - "calendar" → date or timestamp (publication date, discovery year, release date)
   Rules for time:
   - Calendar dates MUST NOT be converted.
   - Calendar dates MUST NOT require units.
   - Calendar dates MUST be stored as ISO strings or year numbers.
   Examples:
   - disc_year → time + calendar
   - pl_pubdate → time + calendar
   - releasedate → time + calendar
   - pl_orbper → time + quantity
   - st_logg → encoding: logarithmic, unitRequired: false (log quantity)
7. Output JSON ONLY.

For each field return:
{
  "name": string,
  "physicalQuantity": one of the allowed values,
  "encoding": "linear" | "logarithmic" | "sexagesimal" | "categorical" | "identifier",
  "timeKind": "quantity" or "calendar" (REQUIRED when physicalQuantity is "time"),
  "unitRequired": boolean (MUST be false when encoding is "logarithmic" or "sexagesimal"),
  "recommendedUnit": one valid unit for that physicalQuantity (null for calendar time, logarithmic, or sexagesimal)
}

Example for calendar: { "name": "pl_pubdate", "physicalQuantity": "time", "timeKind": "calendar", "encoding": "linear", "unitRequired": false }
Example for logarithmic: { "name": "st_logg", "physicalQuantity": "acceleration", "encoding": "logarithmic", "unitRequired": false, "recommendedUnit": null }
Example for sexagesimal: { "name": "rastr", "physicalQuantity": "angle", "encoding": "sexagesimal", "unitRequired": false, "recommendedUnit": null }
Output shape: { "fields": [ ... ] }. Optionally include "confidence": "high" or "medium" per field.
`

export interface NASAFieldAnalysisColumnInput {
  name: string
  description?: string
  sampleValues: (string | number | null)[]
  detectedUnitHint?: string
}

export interface NASAFieldAnalysisInput {
  datasetName: string
  columns: NASAFieldAnalysisColumnInput[]
}

export interface NASAFieldAnalysisFieldOutput {
  name: string
  semanticType: string
  physicalQuantity: PhysicalQuantity | "dimensionless"
  suggestedUnits: string[]
  recommendedUnit: string | null
  unitRequired: boolean
  confidence: "high" | "medium"
  /** When physicalQuantity is "time": "quantity" = duration, "calendar" = date/timestamp (no conversion). */
  timeKind?: "quantity" | "calendar"
  /** linear = convertible; logarithmic/categorical/identifier = conversion disabled. */
  encoding?: QuantityEncoding
}

export interface NASAFieldAnalysisOutput {
  fields: NASAFieldAnalysisFieldOutput[]
  usedFallback?: boolean
  /** Only "fallback" when JSON failed or zero fields; never when LLM output was normalized. */
  analysisSource?: "llm" | "fallback"
}

function sanitizeSampleValue(v: string | number | null | undefined): string | number | null {
  if (v === undefined || v === null) return null
  if (typeof v === "number" && !Number.isNaN(v)) return v
  const s = String(v).trim()
  if (s.length > 200) return s.slice(0, 200)
  if (/<[a-z][\s\S]*>/i.test(s)) return "[HTML stripped]"
  return s
}

/** Field discovery is LOCAL only. Headers + max 3 sample values per column. No full data to LLM. */
function buildColumnsForLLM(
  headers: string[],
  sampleRows: Record<string, any>[],
  columnMetadata?: Record<string, ColumnMetadataEntry>
): NASAFieldAnalysisColumnInput[] {
  const rows = sampleRows.slice(0, 3)
  const result: NASAFieldAnalysisColumnInput[] = []
  for (const name of headers) {
    if (!name || String(name).trim() === "") continue
    const meta = columnMetadata?.[name]
    const sampleValues = rows.map((row) => sanitizeSampleValue(row[name])).slice(0, SAMPLES_PER_FIELD) as (string | number | null)[]
    result.push({
      name: name.trim(),
      description: meta?.description,
      sampleValues: sampleValues.length > 0 ? sampleValues : [null],
      detectedUnitHint: meta?.detectedUnit,
    })
  }
  return result.filter((c) => c.name)
}

function normalizePhysicalQuantity(raw: string): PhysicalQuantity | "dimensionless" {
  const lower = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
  if (lower === "unknown" || lower === "none" || lower === "" || lower === "null") return "dimensionless"
  const canonical = CANONICAL_QUANTITIES[lower] ?? CANONICAL_QUANTITIES[lower.replace(/_/g, " ")]
  if (canonical) return canonical
  if ((PHYSICAL_QUANTITY_VALUES as readonly string[]).includes(lower)) return lower as PhysicalQuantity
  return "dimensionless"
}

function normalizeEncoding(raw: unknown): QuantityEncoding {
  const s = typeof raw === "string" ? raw.toLowerCase() : ""
  if (["linear", "logarithmic", "sexagesimal", "categorical", "identifier"].includes(s)) return s as QuantityEncoding
  return "linear"
}

function inferUnitRequired(raw: Record<string, unknown>, pq: PhysicalQuantity | "dimensionless", encoding: QuantityEncoding): boolean {
  if (encoding === "logarithmic" || encoding === "sexagesimal") return false
  const explicit = raw.unitRequired ?? raw.unit_required
  if (typeof explicit === "boolean") return explicit
  if (pq === "dimensionless" || pq === "count") return false
  return true
}

/**
 * Normalize and repair a single raw LLM field. Never reject for schema differences.
 * Use headerName when raw name is missing. Attach allowed_units from registry later.
 */
function normalizeField(
  rawField: unknown,
  headerName: string
): NASAFieldAnalysisFieldOutput | null {
  if (!rawField || typeof rawField !== "object" || Array.isArray(rawField)) return null
  const raw = rawField as Record<string, unknown>
  const name = String(raw.name ?? raw.field_name ?? headerName).trim()
  if (!name) return null

  if (isDateLikeColumn(name)) {
    return {
      name,
      semanticType: "dimensionless",
      physicalQuantity: "dimensionless",
      suggestedUnits: [],
      recommendedUnit: null,
      unitRequired: false,
      confidence: "high",
      encoding: "linear",
    }
  }

  const pq = normalizePhysicalQuantity(String(raw.physicalQuantity ?? raw.semantic_type ?? ""))
  const encoding = normalizeEncoding(raw.encoding)
  const unitRequired = inferUnitRequired(raw, pq, encoding)
  const recommendedUnit = raw.recommended_unit ?? raw.recommendedUnit ?? null
  const timeKind =
    raw.timeKind === "quantity" || raw.timeKind === "calendar" ? raw.timeKind : undefined
  const confidence =
    raw.confidence === "high" || raw.confidence === "medium" ? (raw.confidence as "high" | "medium") : "medium"

  const suggestedUnits = (encoding === "logarithmic" || encoding === "sexagesimal") ? [] : (UNIT_REGISTRY[pq] ?? []).slice()

  return {
    name,
    semanticType: pq,
    physicalQuantity: pq,
    suggestedUnits,
    recommendedUnit: typeof recommendedUnit === "string" ? recommendedUnit : null,
    unitRequired,
    confidence,
    encoding,
    ...(timeKind && { timeKind }),
  }
}

function fallbackFieldForColumn(col: NASAFieldAnalysisColumnInput): NASAFieldAnalysisFieldOutput {
  return {
    name: col.name,
    semanticType: "other",
    physicalQuantity: "dimensionless",
    suggestedUnits: [],
    recommendedUnit: null,
    unitRequired: false,
    confidence: "medium",
    encoding: "linear",
  }
}

async function analyzeBatchWithRetry(
  datasetName: string,
  batch: NASAFieldAnalysisColumnInput[]
): Promise<NASAFieldAnalysisFieldOutput[] | null> {
  const requestPayload = {
    fields: batch.map((c) => ({
      name: c.name,
      sampleValues: c.sampleValues.slice(0, SAMPLES_PER_FIELD),
    })),
  }
  const userPrompt = `Analyze these columns (max 4 fields per call). Request format:
${JSON.stringify(requestPayload)}

Return ONLY a JSON object with key "fields": array of objects with:
- name (string, exact column name)
- physicalQuantity (ONLY: count, dimensionless, time, length, mass, distance, angle, temperature, brightness, acceleration)
- encoding (REQUIRED: "linear" | "logarithmic" | "sexagesimal" | "categorical" | "identifier"). If field is log(g), magnitude, st_logg → encoding = "logarithmic", unitRequired = false. If field is sexagesimal angle strings (e.g. "12h20m42.91s", rastr, decstr) → encoding = "sexagesimal", physicalQuantity = "angle", unitRequired = false.
- timeKind (REQUIRED when physicalQuantity is "time": "quantity" for duration e.g. orbital period, "calendar" for dates e.g. pl_pubdate, disc_year)
- unitRequired (boolean; MUST be false for encoding=logarithmic, encoding=sexagesimal, count, dimensionless, and time+calendar)
- recommendedUnit (one valid unit, or null for count/dimensionless/calendar/logarithmic/sexagesimal)

Semi-major axis → length. Orbital period → time+quantity. st_logg / log g / magnitude → encoding=logarithmic. rastr/decstr/RA Dec strings → encoding=sexagesimal. Output JSON only.`

  const { parsed } = await callOllamaWithRetry({
    model: "llama3.1:8b",
    prompt: userPrompt,
    system: FIELD_ANALYSIS_SYSTEM,
    useRetryPrompt: true,
    options: { temperature: 0.2, top_p: 0.9, num_predict: 1024 },
  })

  if (!parsed) return null
  const raw = parsed as Record<string, unknown>
  if (!Array.isArray(raw.fields) || raw.fields.length === 0) return null

  const normalizedFields: NASAFieldAnalysisFieldOutput[] = []
  for (let i = 0; i < raw.fields.length; i++) {
    const headerName = batch[i]?.name ?? (raw.fields[i] && (raw.fields[i] as Record<string, unknown>).name as string) ?? ""
    const field = normalizeField(raw.fields[i], headerName)
    if (field && field.name) normalizedFields.push(field)
  }
  if (normalizedFields.length === 0) return null

  // Enforce domain overrides so LLM cannot hallucinate physics
  let validFields = normalizedFields.map((f) => {
    const override = ASTRO_FIELD_OVERRIDES[f.name]
    if (!override) return f
    const encoding = override.encoding ?? f.encoding ?? "linear"
    return {
      ...f,
      physicalQuantity: override.physicalQuantity as PhysicalQuantity | "dimensionless",
      recommendedUnit: override.recommendedUnit ?? null,
      unitRequired: (encoding === "logarithmic" || encoding === "sexagesimal") ? false : override.unitRequired,
      confidence: "high" as const,
      suggestedUnits: (encoding === "logarithmic" || encoding === "sexagesimal") ? [] : (override.recommendedUnit ? [override.recommendedUnit] : f.suggestedUnits),
      encoding,
    }
  })
  return validFields
}

export async function analyzeNASAFieldsWithLLM(
  input: NASAFieldAnalysisInput
): Promise<NASAFieldAnalysisOutput> {
  const allFields: NASAFieldAnalysisFieldOutput[] = []
  let usedFallback = false
  let batchSize = Math.min(MAX_FIELDS_PER_REQUEST, input.columns.length)
  let i = 0

  while (i < input.columns.length) {
    const batch = input.columns.slice(i, i + batchSize)
    let result = await analyzeBatchWithRetry(input.datasetName, batch)

    if (!result && batchSize > 1) {
      batchSize = Math.max(1, Math.floor(batchSize / 2))
      result = await analyzeBatchWithRetry(input.datasetName, batch)
    }

    if (result && result.length > 0) {
      allFields.push(...result)
      i += batch.length
      batchSize = Math.min(MAX_FIELDS_PER_REQUEST, input.columns.length - i)
    } else {
      for (const col of batch) {
        allFields.push(fallbackFieldForColumn(col))
        usedFallback = true
      }
      i += batch.length
      batchSize = Math.min(MAX_FIELDS_PER_REQUEST, input.columns.length - i)
    }
  }

  // Apply domain overrides to all fields (including fallbacks) so LLM cannot hallucinate physics
  const fieldsWithOverrides = allFields.map((f) => {
    const override = ASTRO_FIELD_OVERRIDES[f.name]
    if (!override) return f
    const encoding = override.encoding ?? f.encoding ?? "linear"
    return {
      ...f,
      physicalQuantity: override.physicalQuantity as PhysicalQuantity | "dimensionless",
      recommendedUnit: override.recommendedUnit ?? null,
      unitRequired: (encoding === "logarithmic" || encoding === "sexagesimal") ? false : override.unitRequired,
      confidence: "high" as const,
      suggestedUnits: (encoding === "logarithmic" || encoding === "sexagesimal") ? [] : (override.recommendedUnit ? [override.recommendedUnit] : f.suggestedUnits),
      encoding,
    }
  })

  // Hard rule after LLM output: counts and dimensionless never require units; time+calendar never convert; logarithmic/sexagesimal never convert
  const fields = fieldsWithOverrides.map((f) => {
    if (f.physicalQuantity === "count") {
      return { ...f, unitRequired: false, recommendedUnit: null, encoding: f.encoding ?? "linear" }
    }
    if (f.physicalQuantity === "dimensionless") {
      return { ...f, unitRequired: false, recommendedUnit: null, encoding: f.encoding ?? "linear" }
    }
    if (f.physicalQuantity === "time" && f.timeKind === "calendar") {
      return { ...f, unitRequired: false, recommendedUnit: null, suggestedUnits: [], encoding: f.encoding ?? "linear" }
    }
    if (f.encoding === "logarithmic" || f.encoding === "sexagesimal") {
      return { ...f, unitRequired: false, recommendedUnit: null, suggestedUnits: [] }
    }
    return { ...f, encoding: f.encoding ?? "linear" }
  })

  return {
    fields,
    usedFallback,
    analysisSource: usedFallback ? "fallback" : "llm",
  }
}

export function buildNASAFieldAnalysisInput(
  datasetName: string,
  headers: string[],
  sampleRows: Record<string, any>[],
  columnMetadata?: Record<string, ColumnMetadataEntry>
): NASAFieldAnalysisInput {
  const columns = buildColumnsForLLM(headers, sampleRows, columnMetadata)
  return { datasetName, columns }
}
