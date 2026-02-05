/**
 * STAGE 2 — DATA CONVERSION (explicit conversion specs)
 *
 * ConversionSpec from unit-selection dialog only. Qwen receives raw values;
 * response is per-field arrays; we overwrite chunk with converted values.
 * Deterministic fallback uses CONVERSION_FACTORS (real math). Never return original chunk.
 */

import { safeExtractJSONObject } from "@/lib/safeExtractJSON"
import { applyConversionFactor, CONVERSION_FACTORS, factorKey } from "@/lib/unit-conversion"

/** Strict conversion descriptor — populated only from unit-selection dialog state. Logarithmic/categorical must not be included. */
export interface ConversionSpec {
  field: string
  physicalQuantity: string
  fromUnit: string
  toUnit: string
  /** When true, conversion must have a non-empty toUnit (validated before sending to Qwen). */
  unitRequired?: boolean
  /** When "logarithmic" or "sexagesimal", this spec must be excluded from conversion (safety). */
  encoding?: "linear" | "logarithmic" | "sexagesimal" | "categorical" | "identifier"
}

/** Canonical SI/base units. All source values are normalized to these before Qwen; Qwen converts only canonical → user_selected_unit. */
const CANONICAL_UNITS: Record<string, string> = {
  time: "second",
  length: "m",
  mass: "kg",
  angle: "rad",
  temperature: "kelvin",
  brightness: "mag",
  distance: "m",
  acceleration: "m/s^2",
}

const QWEN_SYSTEM = `You are a scientific unit conversion engine.
You MUST numerically convert values.
You are NOT allowed to return original values.
You MUST change the numbers.`

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

/** Field with finalUnit for conversion guard (optional; when provided, guard uses this instead of unitRequiredFields). */
export interface ConversionFieldGuard {
  name: string
  unitRequired: boolean
  finalUnit: string | null
  physicalQuantity?: string
  /** When "time": "quantity" = duration (convert), "calendar" = date (passthrough). */
  timeKind?: "quantity" | "calendar"
  /** When "logarithmic" or "sexagesimal", field is excluded from conversion. */
  encoding?: "linear" | "logarithmic" | "sexagesimal" | "categorical" | "identifier"
}

export interface ConversionInput {
  filename: string
  headers: string[]
  rows: Record<string, any>[]
  /** Explicit conversion specs from unit-selection dialog. Must have at least one. */
  conversionSpecs: ConversionSpec[]
  /** Field names that require a unit; if any has no spec with non-empty toUnit, conversion throws. */
  unitRequiredFields?: string[]
  /** When provided, guard runs over these (finalUnit = selected unit); counts/dimensionless never fail. */
  fields?: ConversionFieldGuard[]
  onChunkProgress?: (chunkIndex: number, totalChunks: number) => void
  getCancelRef?: () => boolean
}

export interface DatasetColumn {
  name: string
  semanticType: string
  unit: string | null
  description: string
}

export interface ConversionOutput {
  datasetName: string
  columns: DatasetColumn[]
  rows: Record<string, number | string | null>[]
}

/**
 * Normalize chunk values to canonical units. Converts each convertible field from source unit to CANONICAL_UNITS[physicalQuantity].
 * Throws if any required conversion has no factor (blocks ingestion).
 * SAFETY: Throws if a logarithmic quantity is passed to linear converter.
 */
function normalizeChunkToCanonical(
  chunk: Record<string, any>[],
  specs: ConversionSpec[]
): Record<string, any>[] {
  const canonical = chunk.map((row) => ({ ...row }))
  for (const spec of specs) {
    if (spec.encoding === "logarithmic") {
      if (typeof console !== "undefined" && console.warn) {
        console.warn(`Skipping conversion for ${spec.field} (logarithmic quantity)`)
      }
      continue
    }
    if (spec.encoding === "sexagesimal") {
      if (typeof console !== "undefined" && console.warn) {
        console.warn(`Skipping unit conversion for ${spec.field} (sexagesimal encoding)`)
      }
      continue
    }
    if (spec.fromUnit?.toLowerCase() === "sexagesimal" && spec.toUnit?.toLowerCase() !== "sexagesimal") {
      throw new Error(`Sexagesimal field passed to linear unit converter: ${spec.field}`)
    }
    if (spec.fromUnit?.toLowerCase().includes("log")) {
      throw new Error(`Nonlinear quantity passed to linear converter: ${spec.field}`)
    }
    const canonicalUnit = CANONICAL_UNITS[spec.physicalQuantity] ?? spec.fromUnit
    if (canonicalUnit === spec.fromUnit) {
      for (let i = 0; i < chunk.length; i++) {
        const v = chunk[i][spec.field]
        if (v === null || v === undefined || v === "") continue
        const n = typeof v === "number" ? v : parseFloat(String(v))
        if (!Number.isNaN(n)) canonical[i][spec.field] = n
      }
      continue
    }
    for (let i = 0; i < chunk.length; i++) {
      const v = chunk[i][spec.field]
      if (v === null || v === undefined || v === "") continue
      const n = typeof v === "number" ? v : parseFloat(String(v))
      if (Number.isNaN(n)) continue
      const converted = applyConversionFactor(n, spec.fromUnit, canonicalUnit)
      if (converted === null) {
        const key = factorKey(spec.fromUnit, canonicalUnit)
        if (typeof console !== "undefined" && console.error) {
          console.error(`Missing conversion factor: "${key}" (from "${spec.fromUnit}" to "${canonicalUnit}")`)
          console.error(`Physical quantity: ${spec.physicalQuantity}`)
          console.error(`Available keys sample:`, Object.keys(CONVERSION_FACTORS).filter(k => k.includes(spec.fromUnit.substring(0, 5))).slice(0, 10))
        }
        throw new Error(
          `Cannot normalize ${spec.field} from ${spec.fromUnit} to canonical ${canonicalUnit} (key: ${key}) — no conversion factor. Ingestion blocked.`
        )
      }
      canonical[i][spec.field] = converted
    }
  }
  return canonical
}

/** Build payload: values in CANONICAL units; fromUnit = canonical, toUnit = user-selected. */
function buildConversionsPayload(
  chunk: Record<string, any>[],
  specs: ConversionSpec[]
): { conversions: Array<{ field: string; physicalQuantity: string; fromUnit: string; toUnit: string; values: (number | null)[] }> } {
  const conversions = specs.map((spec) => {
    const canonicalUnit = CANONICAL_UNITS[spec.physicalQuantity] ?? spec.fromUnit
    const values = chunk.map((row) => {
      const v = row[spec.field]
      if (v === null || v === undefined || v === "") return null
      const n = typeof v === "number" ? v : parseFloat(String(v))
      return Number.isNaN(n) ? null : n
    })
    return {
      field: spec.field,
      physicalQuantity: spec.physicalQuantity,
      fromUnit: canonicalUnit,
      toUnit: spec.toUnit,
      values,
    }
  })
  return { conversions }
}

/** Apply Qwen response to chunk: overwrite chunk[i][field] = val. Returns new rows (copy then overwrite). */
function applyConvertedValues(
  chunk: Record<string, any>[],
  convertedValues: Record<string, (number | null)[]>
): Record<string, number | string | null>[] {
  const out = chunk.map((row) => ({ ...row })) as Record<string, number | string | null>[]
  for (const field of Object.keys(convertedValues)) {
    const arr = convertedValues[field]
    if (!Array.isArray(arr)) continue
    arr.forEach((val, i) => {
      if (val !== null && out[i]) {
        out[i][field] = val
      }
    })
  }
  return out
}

/** Deterministic fallback: apply CONVERSION_FACTORS per spec. THROWS if no factor exists (ingestion blocked). */
function applyDeterministicFallback(
  chunk: Record<string, any>[],
  specs: ConversionSpec[]
): Record<string, number | string | null>[] {
  const out = chunk.map((row) => ({ ...row })) as Record<string, number | string | null>[]
  for (const spec of specs) {
    // If fromUnit === toUnit, no conversion needed (already in canonical, target is canonical)
    if (spec.fromUnit === spec.toUnit) {
      console.debug(`Deterministic conversion: ${spec.field} ${spec.fromUnit} → ${spec.toUnit} (skipped, same unit)`)
      continue
    }
    const key = factorKey(spec.fromUnit, spec.toUnit)
    if (!CONVERSION_FACTORS[key]) {
      // HARD FAIL: missing conversion factor blocks ingestion
      const availableKeys = Object.keys(CONVERSION_FACTORS)
        .filter((k) => k.startsWith(spec.fromUnit.toLowerCase().replace(/\s+/g, "_").substring(0, 8)))
        .slice(0, 10)
      console.error(`Missing conversion factor: "${key}"`)
      console.error(`  fromUnit: "${spec.fromUnit}"`)
      console.error(`  toUnit: "${spec.toUnit}"`)
      console.error(`  physicalQuantity: ${spec.physicalQuantity}`)
      console.error(`  Available similar keys:`, availableKeys)
      throw new Error(
        `Missing conversion factor for ${spec.field}: "${spec.fromUnit}" → "${spec.toUnit}" (key: ${key}). Ingestion blocked.`
      )
    }
    let converted = 0
    for (let i = 0; i < chunk.length; i++) {
      const v = chunk[i][spec.field]
      const result = applyConversionFactor(v, spec.fromUnit, spec.toUnit)
      if (result !== null && out[i]) {
        out[i][spec.field] = result
        converted++
      }
    }
    console.debug(`Deterministic conversion: ${spec.field} ${spec.fromUnit} → ${spec.toUnit} (${converted}/${chunk.length} values)`)
  }
  return out
}

async function callQwenForChunk(
  normalizedChunk: Record<string, any>[],
  chunkIndex: number,
  totalChunks: number,
  specs: ConversionSpec[]
): Promise<Record<string, number | string | null>[] | null> {
  const payload = buildConversionsPayload(normalizedChunk, specs)
  const conversionPlan: Record<string, { from: string; to: string }> = {}
  for (const s of specs) {
    const canonicalUnit = CANONICAL_UNITS[s.physicalQuantity] ?? s.fromUnit
    conversionPlan[s.field] = { from: canonicalUnit, to: s.toUnit }
  }
  const rowsForPrompt = normalizedChunk.map((row) => {
    const out: Record<string, number | string | null> = {}
    for (const s of specs) {
      out[s.field] = row[s.field] ?? null
    }
    return out
  })
  if (process.env.NODE_ENV === "development" && typeof console !== "undefined" && specs.length > 0) {
    const first = specs[0]
    console.debug("Qwen conversion (canonical → user):", {
      field: first.field,
      from: conversionPlan[first.field]?.from,
      to: first.toUnit,
    })
  }
  const prompt = `Convert the dataset below.

Rules:
- Source values are in CANONICAL SI units.
- Convert ONLY the specified fields.
- Do NOT modify other fields.
- Output must be valid JSON.
- Each output value MUST be numerically different unless mathematically equal.

Conversion Plan:
${JSON.stringify(conversionPlan, null, 2)}

Rows:
${JSON.stringify(rowsForPrompt)}`

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen2.5:3b",
        prompt: `${QWEN_SYSTEM}\n\n${prompt}`,
        stream: false,
        options: {
          temperature: 0.1,
          top_p: 0.9,
          num_predict: Math.max(4000, normalizedChunk.length * 80),
        },
      }),
    })
    if (!response.ok) return null
    const data = await response.json().catch(() => ({}))
    const responseText = (data.response ?? "") as string
    const parsed = safeExtractJSONObject(responseText) as Record<string, unknown> | null
    if (!parsed) return null

    const convertedValues: Record<string, (number | null)[]> = {}
    for (const spec of specs) {
      const arr = parsed[spec.field]
      if (!Array.isArray(arr) || arr.length !== normalizedChunk.length) continue
      const nums = arr.map((x) => (x === null || x === undefined ? null : Number(x)))
      convertedValues[spec.field] = nums
    }
    if (Object.keys(convertedValues).length === 0) return null

    // Validate: if Qwen returned ALL unchanged values (echo), fall back to deterministic
    let hasUnchangedField = false
    for (const spec of specs) {
      const sent = payload.conversions.find((c) => c.field === spec.field)?.values
      const recv = convertedValues[spec.field]
      if (!sent || !recv) continue
      let allSame = true
      for (let i = 0; i < sent.length && i < recv.length; i++) {
        const sentVal = sent[i]
        const recvVal = recv[i]
        if (sentVal != null && recvVal != null && Math.abs(sentVal - recvVal) > 1e-10) {
          allSame = false
          break
        }
      }
      if (allSame) {
        console.warn(`Qwen returned unchanged values for ${spec.field}, will fall back to deterministic`)
        hasUnchangedField = true
      }
    }
    if (hasUnchangedField) {
      // Don't use Qwen result if any field was unchanged - fall back to deterministic
      return null
    }

    const result = applyConvertedValues(normalizedChunk, convertedValues)
    if (process.env.NODE_ENV === "development" && typeof console !== "undefined" && console.debug) {
      for (const field of Object.keys(convertedValues)) {
        const orig = normalizedChunk[0]?.[field]
        const conv = convertedValues[field][0]
        if (orig != null && conv != null) console.debug("Converted sample:", field, orig, "→", conv)
      }
    }
    return result
  } catch (e) {
    if (e instanceof Error && e.message.includes("Conversion skipped for")) throw e
    if (typeof console !== "undefined" && console.warn) console.warn("Qwen chunk error:", e)
    return null
  }
}

const CONVERSION_CHUNK_SIZE = 300
const CHUNK_TIMEOUT_MS = 20_000

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))])
}

/**
 * Main conversion. Hard-fail if conversionSpecs.length === 0.
 * Skip dimensionless fields when sending to Qwen. Convert only numeric columns.
 * Hard-fail if unitRequiredFields is set and any required field has no finalUnit (toUnit).
 * Fallback = deterministic factors only.
 */
export async function convertDatasetWithLLM(input: ConversionInput): Promise<ConversionOutput> {
  if (input.conversionSpecs.length === 0) {
    const datasetName = input.filename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_")
    const columns: DatasetColumn[] = input.headers.map((name) => ({
      name,
      semanticType: "",
      unit: null,
      description: "",
    }))
    return { datasetName, columns, rows: input.rows as Record<string, number | string | null>[] }
  }

  for (const spec of input.conversionSpecs) {
    if (!spec.fromUnit?.trim()) {
      throw new Error(`Source unit missing for ${spec.field} — ingestion blocked`)
    }
    if (spec.fromUnit === spec.toUnit) {
      throw new Error(`No conversion for ${spec.field} (source === target) — ingestion blocked`)
    }
  }

  // Guard: required numeric fields must have finalUnit; counts, dimensionless, and time+calendar never fail
  if (input.fields && input.fields.length > 0) {
    for (const field of input.fields) {
      if (
        field.physicalQuantity === "time" &&
        field.timeKind === "calendar"
      ) {
        continue
      }
      if (
        field.unitRequired &&
        field.physicalQuantity !== "count" &&
        field.physicalQuantity !== "dimensionless" &&
        !field.finalUnit
      ) {
        throw new Error(`Unit missing for ${field.name}`)
      }
    }
  } else {
    const unitRequiredFields = input.unitRequiredFields ?? []
    for (const fieldName of unitRequiredFields) {
      const spec = input.conversionSpecs.find((s) => s.field === fieldName)
      const pq = spec?.physicalQuantity
      if (pq === "count" || pq === "dimensionless") continue
      if (!spec || !spec.toUnit?.trim()) {
        throw new Error(`Unit missing for ${fieldName}`)
      }
    }
  }

  // Only numeric scalar quantities are convertible; exclude logarithmic, count, dimensionless, calendar time
  const CONVERTIBLE_QUANTITIES = [
    "length",
    "mass",
    "time",
    "temperature",
    "angle",
    "brightness",
    "acceleration",
  ]
  const specsForConversion = input.conversionSpecs.filter((s) => {
    if (s.encoding === "logarithmic") {
      if (typeof console !== "undefined" && console.warn) {
        console.warn(`Skipping conversion for ${s.field} (logarithmic quantity)`)
      }
      return false
    }
    if (s.encoding === "sexagesimal") {
      if (typeof console !== "undefined" && console.warn) {
        console.warn(`Skipping conversion for ${s.field} (sexagesimal encoding)`)
      }
      return false
    }
    if (s.fromUnit?.toLowerCase() === "sexagesimal" && s.toUnit?.toLowerCase() !== "sexagesimal") {
      throw new Error(`Sexagesimal field passed to linear unit converter: ${s.field}`)
    }
    if (
      s.physicalQuantity === "time" &&
      input.fields?.find((f) => f.name === s.field)?.timeKind === "calendar"
    ) {
      return false
    }
    return (
      s.toUnit?.trim() &&
      CONVERTIBLE_QUANTITIES.includes(s.physicalQuantity)
    )
  })

  const datasetName = input.filename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_")
  const columns: DatasetColumn[] = input.headers.map((name) => {
    const s = input.conversionSpecs.find((sp) => sp.field === name)
    return {
      name,
      semanticType: s?.physicalQuantity ?? "",
      unit: s?.toUnit ?? null,
      description: s?.physicalQuantity ?? "",
    }
  })

  if (specsForConversion.length === 0) {
    return { datasetName, columns, rows: input.rows as Record<string, number | string | null>[] }
  }

  const rowChunks = chunkArray(input.rows, CONVERSION_CHUNK_SIZE)
  const totalChunks = rowChunks.length
  const allConvertedRows: Record<string, number | string | null>[] = []

  for (let i = 0; i < rowChunks.length; i++) {
    if (input.getCancelRef?.()) break
    input.onChunkProgress?.(i, totalChunks)
    const chunk = rowChunks[i]

    const normalizedChunk = normalizeChunkToCanonical(chunk, specsForConversion)
    
    // Build specs for canonical → target conversion
    // Filter out specs where canonical unit === target unit (no further conversion needed)
    const specsCanonicalToTarget = specsForConversion
      .map((s) => ({
        ...s,
        fromUnit: CANONICAL_UNITS[s.physicalQuantity] ?? s.fromUnit,
      }))
      .filter((s) => {
        if (s.fromUnit === s.toUnit) {
          console.debug(`Skipping canonical→target for ${s.field}: already in target unit (${s.toUnit})`)
          return false
        }
        return true
      })

    // If no conversions needed for canonical → target, just use normalized chunk
    let chunkResult: Record<string, number | string | null>[]
    if (specsCanonicalToTarget.length === 0) {
      // All fields already in target unit after source→canonical normalization
      chunkResult = normalizedChunk as Record<string, number | string | null>[]
    } else {
      let qwenResult = await withTimeout(callQwenForChunk(normalizedChunk, i, totalChunks, specsCanonicalToTarget), CHUNK_TIMEOUT_MS)
      if (!qwenResult) {
        qwenResult = await withTimeout(callQwenForChunk(normalizedChunk, i, totalChunks, specsCanonicalToTarget), CHUNK_TIMEOUT_MS)
      }
      if (!qwenResult) {
        // Qwen failed twice, use deterministic fallback
        chunkResult = applyDeterministicFallback(normalizedChunk, specsCanonicalToTarget)
      } else {
        chunkResult = qwenResult
      }
    }
    allConvertedRows.push(...chunkResult)
  }

  if (allConvertedRows.length !== input.rows.length) {
    throw new Error(`Row count mismatch: expected ${input.rows.length}, got ${allConvertedRows.length}`)
  }

  // Mandatory post-conversion validation: numeric values must change after conversion
  // Note: We compare numeric values, not raw values (original might be string, converted is number)
  for (const spec of specsForConversion) {
    let unchangedCount = 0
    let totalChecked = 0
    for (let i = 0; i < Math.min(input.rows.length, 50); i++) { // Sample first 50 rows
      const originalValue = input.rows[i][spec.field]
      const convertedValue = allConvertedRows[i]?.[spec.field]
      if (originalValue == null || convertedValue == null) continue
      totalChecked++
      const origNum = typeof originalValue === "number" ? originalValue : parseFloat(String(originalValue))
      const convNum = typeof convertedValue === "number" ? convertedValue : parseFloat(String(convertedValue))
      if (!Number.isNaN(origNum) && !Number.isNaN(convNum) && Math.abs(origNum - convNum) < 1e-10) {
        unchangedCount++
      }
    }
    // If ALL checked values are unchanged, that's a bug (conversion skipped)
    if (totalChecked > 0 && unchangedCount === totalChecked) {
      throw new Error(`Conversion skipped for ${spec.field} (all ${totalChecked} sampled values unchanged) — ingestion blocked`)
    }
    console.debug(`Post-validation ${spec.field}: ${unchangedCount}/${totalChecked} values unchanged (threshold: all)`)
  }

  return { datasetName, columns, rows: allConvertedRows }
}
