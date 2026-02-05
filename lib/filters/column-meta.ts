/**
 * Column Metadata Inference for Filter System
 * 
 * Analyzes dataset columns to determine:
 * - Data types (numeric, string, date, etc.)
 * - Physical quantities (angle, distance, brightness, etc.)
 * - Value ranges (for numeric filters)
 * - Unique values (for categorical filters)
 * - Spatial columns (RA/Dec detection)
 * 
 * Computed ONCE after ingestion and cached.
 */

import type { Dataset, DatasetColumn } from "@/lib/data-context"
import type { ColumnMeta, DatasetMeta, ColumnDataType } from "./filter-types"

// ============================================================================
// CONSTANTS
// ============================================================================

/** Max unique values to store for categorical filters (performance) */
const MAX_UNIQUE_VALUES = 100

/** Sample size for type detection (perf: don't scan all rows) */
const TYPE_DETECTION_SAMPLE_SIZE = 500

/** Patterns to detect RA columns */
const RA_PATTERNS = [
  /^ra$/i,
  /^ra_?deg$/i,
  /^right_?ascension/i,
  /^alpha$/i,
  /^ra_j2000/i,
  /_ra$/i,
]

/** Patterns to detect Dec columns */
const DEC_PATTERNS = [
  /^dec$/i,
  /^dec_?deg$/i,
  /^declination/i,
  /^delta$/i,
  /^dec_j2000/i,
  /_dec$/i,
]

/** Patterns for brightness/magnitude columns */
const BRIGHTNESS_PATTERNS = [
  /^mag/i,
  /magnitude/i,
  /^[ugrizy]_?mag/i,
  /^[BVRI]$/,
  /^st_.*mag/i,
  /^sy_.*mag/i,
]

/** Patterns for distance columns */
const DISTANCE_PATTERNS = [
  /^dist/i,
  /distance/i,
  /^sy_dist/i,
  /^parallax/i,
  /^plx$/i,
]

/** Patterns for mass columns */
const MASS_PATTERNS = [
  /mass/i,
  /^pl_.*mass/i,
  /^st_mass/i,
]

/** Patterns for radius columns */
const RADIUS_PATTERNS = [
  /radius/i,
  /^pl_rad/i,
  /^st_rad/i,
]

/** Patterns for temperature columns */
const TEMPERATURE_PATTERNS = [
  /temp/i,
  /^pl_eqt/i,
  /^st_teff/i,
]

/** Patterns for time/period columns (duration, not calendar) */
const TIME_DURATION_PATTERNS = [
  /^pl_orb.*per/i,
  /period/i,
  /duration/i,
]

/** Patterns for date/year columns */
const DATE_PATTERNS = [
  /date/i,
  /year/i,
  /^disc_year/i,
  /^rowupdate/i,
  /^release/i,
  /^pub.*date/i,
]

// ============================================================================
// TYPE DETECTION
// ============================================================================

/**
 * Detect if a value looks like an ISO date string.
 */
function isISODate(value: unknown): boolean {
  if (typeof value !== "string") return false
  // ISO 8601 patterns
  return /^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{4}\/\d{2}\/\d{2}/.test(value)
}

/**
 * Detect the data type from a sample of values.
 */
function detectTypeFromValues(values: unknown[]): ColumnDataType {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "")
  if (nonNull.length === 0) return "unknown"

  // Check for booleans
  const boolCount = nonNull.filter(
    (v) => v === true || v === false || v === "true" || v === "false" || v === 0 || v === 1
  ).length
  if (boolCount / nonNull.length > 0.9) return "boolean"

  // Check for dates (string format)
  const dateCount = nonNull.filter(isISODate).length
  if (dateCount / nonNull.length > 0.8) return "date"

  // Check for numbers
  const numericValues = nonNull.filter((v) => {
    if (typeof v === "number") return !Number.isNaN(v)
    if (typeof v === "string") {
      const parsed = parseFloat(v)
      return !Number.isNaN(parsed) && v.trim() !== ""
    }
    return false
  })
  if (numericValues.length / nonNull.length > 0.8) return "number"

  // Default to string
  return "string"
}

/**
 * Infer the physical/astronomical type from column name and semanticType.
 */
function inferAstroType(
  name: string,
  semanticType: string | null,
  unit: string | null,
  baseType: ColumnDataType
): ColumnDataType {
  const n = name.toLowerCase()
  const st = (semanticType ?? "").toLowerCase()

  // Check RA
  if (RA_PATTERNS.some((p) => p.test(name))) return "angle"
  // Check Dec
  if (DEC_PATTERNS.some((p) => p.test(name))) return "angle"
  // Check brightness
  if (BRIGHTNESS_PATTERNS.some((p) => p.test(name)) || st === "brightness") return "brightness"
  // Check distance
  if (DISTANCE_PATTERNS.some((p) => p.test(name)) || st === "distance") return "distance"
  // Check mass
  if (MASS_PATTERNS.some((p) => p.test(name)) || st === "mass") return "mass"
  // Check radius (treat as distance for filtering)
  if (RADIUS_PATTERNS.some((p) => p.test(name)) || st === "length") return "distance"
  // Check temperature
  if (TEMPERATURE_PATTERNS.some((p) => p.test(name)) || st === "temperature") return "temperature"
  // Check time duration
  if (TIME_DURATION_PATTERNS.some((p) => p.test(name)) || st === "time") {
    // Distinguish duration from calendar date
    if (DATE_PATTERNS.some((p) => p.test(name))) return "date"
    return "time"
  }
  // Check date
  if (DATE_PATTERNS.some((p) => p.test(name))) return "date"

  // Check by unit
  if (unit) {
    const u = unit.toLowerCase()
    if (u.includes("deg") || u.includes("rad") || u.includes("arcsec") || u.includes("arcmin")) {
      return "angle"
    }
    if (u.includes("pc") || u.includes("au") || u === "m" || u === "km" || u.includes("radius")) {
      return "distance"
    }
    if (u.includes("mag")) return "brightness"
    if (u === "k" || u.includes("kelvin")) return "temperature"
    if (u.includes("mass") || u === "kg") return "mass"
    if (u.includes("day") || u.includes("year") || u.includes("second")) return "time"
  }

  return baseType
}

/**
 * Detect if column is RA (right ascension).
 */
function isRAColumn(name: string, semanticType: string | null): boolean {
  if (RA_PATTERNS.some((p) => p.test(name))) return true
  if (semanticType?.toLowerCase().includes("right_ascension")) return true
  return false
}

/**
 * Detect if column is Dec (declination).
 */
function isDecColumn(name: string, semanticType: string | null): boolean {
  if (DEC_PATTERNS.some((p) => p.test(name))) return true
  if (semanticType?.toLowerCase().includes("declination")) return true
  return false
}

// ============================================================================
// COLUMN ANALYSIS
// ============================================================================

/**
 * Analyze a single column to produce ColumnMeta.
 */
function analyzeColumn(
  column: DatasetColumn,
  rows: Record<string, unknown>[],
  sampleSize: number = TYPE_DETECTION_SAMPLE_SIZE
): ColumnMeta {
  const name = column.name
  const semanticType = column.semanticType || null
  const unit = column.unit || null
  const description = column.description || name

  // Sample values for analysis
  const sampleIndices = rows.length <= sampleSize
    ? rows.map((_, i) => i)
    : Array.from({ length: sampleSize }, () => Math.floor(Math.random() * rows.length))
  
  const sampleValues = sampleIndices.map((i) => rows[i]?.[name])

  // Detect base type from values
  const baseType = detectTypeFromValues(sampleValues)
  
  // Infer astro-specific type
  const detectedType = inferAstroType(name, semanticType, unit, baseType)

  // Count nulls
  let nullCount = 0
  for (const row of rows) {
    const v = row[name]
    if (v === null || v === undefined || v === "") nullCount++
  }

  // Initialize meta
  const meta: ColumnMeta = {
    name,
    detectedType,
    physicalQuantity: semanticType,
    unit,
    description,
    isFilterable: true,
    nullCount,
    isRA: isRAColumn(name, semanticType),
    isDec: isDecColumn(name, semanticType),
  }

  // Compute type-specific metadata
  if (detectedType === "number" || detectedType === "angle" || detectedType === "distance" ||
      detectedType === "brightness" || detectedType === "mass" || detectedType === "temperature" ||
      detectedType === "time") {
    // Numeric: compute min/max
    let min = Infinity
    let max = -Infinity
    for (const row of rows) {
      const v = row[name]
      if (v === null || v === undefined || v === "") continue
      const n = typeof v === "number" ? v : parseFloat(String(v))
      if (Number.isNaN(n)) continue
      if (n < min) min = n
      if (n > max) max = n
    }
    if (min !== Infinity) meta.minValue = min
    if (max !== -Infinity) meta.maxValue = max
  } else if (detectedType === "string" || detectedType === "date") {
    // Categorical/string: collect unique values
    const uniqueSet = new Set<string>()
    for (const row of rows) {
      const v = row[name]
      if (v === null || v === undefined || v === "") continue
      uniqueSet.add(String(v))
      if (uniqueSet.size > MAX_UNIQUE_VALUES * 2) break // Stop early if too many
    }
    meta.uniqueCount = uniqueSet.size
    // Store up to MAX_UNIQUE_VALUES sorted
    meta.uniqueValues = Array.from(uniqueSet).slice(0, MAX_UNIQUE_VALUES).sort()
    // If too many unique values, might not be good for categorical filter
    if (uniqueSet.size > MAX_UNIQUE_VALUES && detectedType === "string") {
      meta.isFilterable = true // Still filterable via text search
    }
  } else if (detectedType === "boolean") {
    meta.uniqueValues = ["true", "false"]
    meta.uniqueCount = 2
  }

  return meta
}

// ============================================================================
// DATASET METADATA
// ============================================================================

/**
 * Compute metadata for an entire dataset.
 * Call this ONCE after ingestion; results are cached.
 */
export function computeDatasetMeta(dataset: Dataset): DatasetMeta {
  const columnMeta: ColumnMeta[] = dataset.columns.map((col) =>
    analyzeColumn(col, dataset.rows)
  )

  // Detect spatial columns
  const raCol = columnMeta.find((c) => c.isRA)
  const decCol = columnMeta.find((c) => c.isDec)

  return {
    datasetId: dataset.id,
    rowCount: dataset.rows.length,
    columnMeta,
    hasSpatialColumns: !!(raCol && decCol),
    raColumn: raCol?.name,
    decColumn: decCol?.name,
  }
}

/**
 * Get columns suitable for numeric range filter.
 */
export function getNumericColumns(meta: DatasetMeta): ColumnMeta[] {
  return meta.columnMeta.filter((c) =>
    c.isFilterable &&
    (c.detectedType === "number" ||
     c.detectedType === "angle" ||
     c.detectedType === "distance" ||
     c.detectedType === "brightness" ||
     c.detectedType === "mass" ||
     c.detectedType === "temperature" ||
     c.detectedType === "time")
  )
}

/**
 * Get columns suitable for categorical filter.
 * Prefers columns with reasonable number of unique values.
 */
export function getCategoricalColumns(meta: DatasetMeta): ColumnMeta[] {
  return meta.columnMeta.filter((c) =>
    c.isFilterable &&
    (c.detectedType === "string" || c.detectedType === "boolean") &&
    c.uniqueCount !== undefined &&
    c.uniqueCount > 0 &&
    c.uniqueCount <= MAX_UNIQUE_VALUES
  )
}

/**
 * Get columns suitable for text search.
 */
export function getTextSearchableColumns(meta: DatasetMeta): ColumnMeta[] {
  return meta.columnMeta.filter((c) =>
    c.isFilterable && c.detectedType === "string"
  )
}

/**
 * Get columns suitable for temporal filter.
 */
export function getTemporalColumns(meta: DatasetMeta): ColumnMeta[] {
  return meta.columnMeta.filter((c) =>
    c.isFilterable &&
    (c.detectedType === "date" ||
     (c.detectedType === "number" && DATE_PATTERNS.some((p) => p.test(c.name))))
  )
}

/**
 * Get a default filter label for display.
 */
export function getFilterLabel(column: ColumnMeta): string {
  if (column.unit) {
    return `${column.name} (${column.unit})`
  }
  return column.name
}
