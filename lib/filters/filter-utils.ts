/**
 * Pure Filter Functions for Unified Repository
 * 
 * These functions apply filters to dataset rows WITHOUT mutating the original data.
 * Designed for:
 * - Composability (filters can be combined)
 * - Performance (memoizable, early exit)
 * - Safety (never throws, handles bad data gracefully)
 */

import type { Dataset } from "@/lib/data-context"
import type {
  Filter,
  NumericRangeFilter,
  CategoricalFilter,
  TextSearchFilter,
  TemporalFilter,
  SpatialRAFilter,
  SpatialDecFilter,
  SpatialBoxFilter,
  FilterResult,
  DatasetMeta,
} from "./filter-types"

// ============================================================================
// INDIVIDUAL FILTER MATCHERS
// ============================================================================

/**
 * Check if a row passes a numeric range filter.
 */
function matchNumericRange(
  row: Record<string, unknown>,
  filter: NumericRangeFilter
): boolean {
  const value = row[filter.column]
  
  // Handle null/undefined
  if (value === null || value === undefined || value === "") {
    return filter.includeNulls ?? false
  }

  // Parse to number
  const num = typeof value === "number" ? value : parseFloat(String(value))
  if (Number.isNaN(num)) {
    return filter.includeNulls ?? false
  }

  // Apply log scale if requested
  const compareValue = filter.useLogScale && num > 0 ? Math.log10(num) : num
  const min = filter.min !== null
    ? (filter.useLogScale && filter.min > 0 ? Math.log10(filter.min) : filter.min)
    : null
  const max = filter.max !== null
    ? (filter.useLogScale && filter.max > 0 ? Math.log10(filter.max) : filter.max)
    : null

  // Check range (inclusive)
  if (min !== null && compareValue < min) return false
  if (max !== null && compareValue > max) return false
  return true
}

/**
 * Check if a row passes a categorical filter.
 */
function matchCategorical(
  row: Record<string, unknown>,
  filter: CategoricalFilter
): boolean {
  const value = row[filter.column]

  // Handle null/undefined
  if (value === null || value === undefined || value === "") {
    return filter.includeNulls ?? false
  }

  // If no values selected, pass all (filter not active)
  if (filter.selectedValues.length === 0) {
    return true
  }

  // Check if value is in selected values (OR logic)
  const strValue = String(value)
  return filter.selectedValues.includes(strValue)
}

/**
 * Check if a row passes a text search filter.
 * Returns true if ANY searchable column contains the query.
 */
function matchTextSearch(
  row: Record<string, unknown>,
  filter: TextSearchFilter,
  searchColumns: string[]
): boolean {
  if (!filter.query || filter.query.trim() === "") {
    return true // Empty search matches all
  }

  const query = filter.caseSensitive ? filter.query : filter.query.toLowerCase()
  const columnsToSearch = filter.searchColumns ?? searchColumns

  for (const col of columnsToSearch) {
    const value = row[col]
    if (value === null || value === undefined) continue
    
    const strValue = filter.caseSensitive ? String(value) : String(value).toLowerCase()
    if (strValue.includes(query)) {
      return true
    }
  }

  return false
}

/**
 * Check if a row passes a temporal filter.
 */
function matchTemporal(
  row: Record<string, unknown>,
  filter: TemporalFilter
): boolean {
  const value = row[filter.column]

  // Handle null/undefined
  if (value === null || value === undefined || value === "") {
    return false // Temporal filters exclude nulls by default
  }

  // Parse value
  let numValue: number
  if (typeof value === "number") {
    numValue = value
  } else if (typeof value === "string") {
    // Try to parse as date or year
    if (/^\d{4}$/.test(value.trim())) {
      numValue = parseInt(value, 10)
    } else {
      const date = new Date(value)
      if (!Number.isNaN(date.getTime())) {
        numValue = date.getFullYear() // Use year for comparison
      } else {
        return false
      }
    }
  } else {
    return false
  }

  // Parse filter bounds
  const fromValue = filter.from !== null
    ? (typeof filter.from === "number" ? filter.from : new Date(filter.from).getFullYear())
    : null
  const toValue = filter.to !== null
    ? (typeof filter.to === "number" ? filter.to : new Date(filter.to).getFullYear())
    : null

  // Check range
  if (fromValue !== null && numValue < fromValue) return false
  if (toValue !== null && numValue > toValue) return false
  return true
}

/**
 * Check if a row passes a spatial RA filter.
 * Handles wraparound (e.g., 350-10 deg crosses 0).
 */
function matchSpatialRA(
  row: Record<string, unknown>,
  filter: SpatialRAFilter
): boolean {
  const value = row[filter.column]

  if (value === null || value === undefined || value === "") {
    return false
  }

  const num = typeof value === "number" ? value : parseFloat(String(value))
  if (Number.isNaN(num)) return false

  // Normalize to 0-360
  let ra = num % 360
  if (ra < 0) ra += 360

  const min = filter.min ?? 0
  const max = filter.max ?? 360

  // Handle wraparound
  if (filter.wraparound && min > max) {
    // Range crosses 0, e.g., 350-10
    return ra >= min || ra <= max
  }

  return ra >= min && ra <= max
}

/**
 * Check if a row passes a spatial Dec filter.
 */
function matchSpatialDec(
  row: Record<string, unknown>,
  filter: SpatialDecFilter
): boolean {
  const value = row[filter.column]

  if (value === null || value === undefined || value === "") {
    return false
  }

  const num = typeof value === "number" ? value : parseFloat(String(value))
  if (Number.isNaN(num)) return false

  // Clamp to valid range
  const dec = Math.max(-90, Math.min(90, num))

  const min = filter.min ?? -90
  const max = filter.max ?? 90

  return dec >= min && dec <= max
}

/**
 * Check if a row passes a spatial box filter.
 * Combines RA and Dec filtering.
 */
function matchSpatialBox(
  row: Record<string, unknown>,
  filter: SpatialBoxFilter,
  meta: DatasetMeta
): boolean {
  if (!meta.raColumn || !meta.decColumn) {
    return true // No spatial columns, pass all
  }

  // Check RA
  if (filter.raMin !== null || filter.raMax !== null) {
    const raFilter: SpatialRAFilter = {
      id: filter.id + "_ra",
      type: "spatial_ra",
      column: meta.raColumn,
      enabled: true,
      min: filter.raMin,
      max: filter.raMax,
    }
    if (!matchSpatialRA(row, raFilter)) return false
  }

  // Check Dec
  if (filter.decMin !== null || filter.decMax !== null) {
    const decFilter: SpatialDecFilter = {
      id: filter.id + "_dec",
      type: "spatial_dec",
      column: meta.decColumn,
      enabled: true,
      min: filter.decMin,
      max: filter.decMax,
    }
    if (!matchSpatialDec(row, decFilter)) return false
  }

  return true
}

// ============================================================================
// FILTER APPLICATION
// ============================================================================

/**
 * Apply a single filter to a row.
 */
export function applyFilter(
  row: Record<string, unknown>,
  filter: Filter,
  meta: DatasetMeta,
  stringColumns: string[]
): boolean {
  if (!filter.enabled) return true // Disabled filters pass all

  switch (filter.type) {
    case "numeric_range":
      return matchNumericRange(row, filter)
    case "categorical":
      return matchCategorical(row, filter)
    case "text_search":
      return matchTextSearch(row, filter, stringColumns)
    case "temporal":
      return matchTemporal(row, filter)
    case "spatial_ra":
      return matchSpatialRA(row, filter)
    case "spatial_dec":
      return matchSpatialDec(row, filter)
    case "spatial_box":
      return matchSpatialBox(row, filter, meta)
    default:
      return true
  }
}

/**
 * Apply all filters to a dataset.
 * Returns indices of rows that pass ALL filters (AND logic).
 */
export function applyFilters(
  dataset: Dataset,
  filters: Filter[],
  meta: DatasetMeta,
  globalSearch: string = ""
): FilterResult {
  const enabledFilters = filters.filter((f) => f.enabled)
  const stringColumns = meta.columnMeta
    .filter((c) => c.detectedType === "string")
    .map((c) => c.name)

  // Add global search as a filter if present
  const allFilters: Filter[] = [...enabledFilters]
  if (globalSearch.trim()) {
    allFilters.push({
      id: "__global_search__",
      type: "text_search",
      column: null,
      enabled: true,
      query: globalSearch,
      caseSensitive: false,
    })
  }

  // If no filters, return all rows
  if (allFilters.length === 0) {
    return {
      datasetId: dataset.id,
      totalRows: dataset.rows.length,
      filteredRows: dataset.rows.length,
      passingIndices: dataset.rows.map((_, i) => i),
    }
  }

  // Apply filters
  const passingIndices: number[] = []
  for (let i = 0; i < dataset.rows.length; i++) {
    const row = dataset.rows[i]
    let passes = true

    for (const filter of allFilters) {
      if (!applyFilter(row, filter, meta, stringColumns)) {
        passes = false
        break // Early exit on first failure
      }
    }

    if (passes) {
      passingIndices.push(i)
    }
  }

  return {
    datasetId: dataset.id,
    totalRows: dataset.rows.length,
    filteredRows: passingIndices.length,
    passingIndices,
  }
}

/**
 * Get filtered rows from a dataset.
 * Returns a new array (does not mutate original).
 */
export function getFilteredRows(
  dataset: Dataset,
  result: FilterResult
): Record<string, unknown>[] {
  return result.passingIndices.map((i) => dataset.rows[i])
}

// ============================================================================
// FILTER HELPERS
// ============================================================================

/**
 * Create a new numeric range filter.
 */
export function createNumericFilter(
  column: string,
  min: number | null = null,
  max: number | null = null,
  useLogScale: boolean = false
): NumericRangeFilter {
  return {
    id: `numeric_${column}_${Date.now()}`,
    type: "numeric_range",
    column,
    enabled: true,
    min,
    max,
    useLogScale,
  }
}

/**
 * Create a new categorical filter.
 */
export function createCategoricalFilter(
  column: string,
  selectedValues: string[] = []
): CategoricalFilter {
  return {
    id: `categorical_${column}_${Date.now()}`,
    type: "categorical",
    column,
    enabled: true,
    selectedValues,
  }
}

/**
 * Create a new text search filter.
 */
export function createTextSearchFilter(query: string = ""): TextSearchFilter {
  return {
    id: `text_search_${Date.now()}`,
    type: "text_search",
    column: null,
    enabled: true,
    query,
    caseSensitive: false,
  }
}

/**
 * Create a new temporal filter.
 */
export function createTemporalFilter(
  column: string,
  from: string | number | null = null,
  to: string | number | null = null
): TemporalFilter {
  return {
    id: `temporal_${column}_${Date.now()}`,
    type: "temporal",
    column,
    enabled: true,
    from,
    to,
  }
}

/**
 * Create a new spatial RA filter.
 */
export function createSpatialRAFilter(
  column: string,
  min: number | null = 0,
  max: number | null = 360
): SpatialRAFilter {
  return {
    id: `spatial_ra_${column}_${Date.now()}`,
    type: "spatial_ra",
    column,
    enabled: true,
    min,
    max,
  }
}

/**
 * Create a new spatial Dec filter.
 */
export function createSpatialDecFilter(
  column: string,
  min: number | null = -90,
  max: number | null = 90
): SpatialDecFilter {
  return {
    id: `spatial_dec_${column}_${Date.now()}`,
    type: "spatial_dec",
    column,
    enabled: true,
    min,
    max,
  }
}

// ============================================================================
// FILTER DESCRIPTION (for display)
// ============================================================================

/**
 * Get a human-readable description of a filter.
 */
export function describeFilter(filter: Filter): string {
  switch (filter.type) {
    case "numeric_range": {
      const parts: string[] = []
      if (filter.min !== null) parts.push(`≥ ${filter.min}`)
      if (filter.max !== null) parts.push(`≤ ${filter.max}`)
      const range = parts.join(" and ") || "any"
      return `${filter.column}: ${range}`
    }
    case "categorical": {
      if (filter.selectedValues.length === 0) return `${filter.column}: any`
      if (filter.selectedValues.length === 1) return `${filter.column}: ${filter.selectedValues[0]}`
      return `${filter.column}: ${filter.selectedValues.length} selected`
    }
    case "text_search":
      return filter.query ? `Search: "${filter.query}"` : "Search: (empty)"
    case "temporal": {
      const parts: string[] = []
      if (filter.from !== null) parts.push(`from ${filter.from}`)
      if (filter.to !== null) parts.push(`to ${filter.to}`)
      return `${filter.column}: ${parts.join(" ") || "any"}`
    }
    case "spatial_ra": {
      return `RA: ${filter.min ?? 0}° - ${filter.max ?? 360}°`
    }
    case "spatial_dec": {
      return `Dec: ${filter.min ?? -90}° - ${filter.max ?? 90}°`
    }
    case "spatial_box": {
      return `Sky region: RA [${filter.raMin ?? 0}, ${filter.raMax ?? 360}], Dec [${filter.decMin ?? -90}, ${filter.decMax ?? 90}]`
    }
    default:
      return "Unknown filter"
  }
}

/**
 * Check if a filter has any active constraints.
 */
export function isFilterActive(filter: Filter): boolean {
  if (!filter.enabled) return false

  switch (filter.type) {
    case "numeric_range":
      return filter.min !== null || filter.max !== null
    case "categorical":
      return filter.selectedValues.length > 0
    case "text_search":
      return filter.query.trim().length > 0
    case "temporal":
      return filter.from !== null || filter.to !== null
    case "spatial_ra":
    case "spatial_dec":
      return filter.min !== null || filter.max !== null
    case "spatial_box":
      return (
        filter.raMin !== null ||
        filter.raMax !== null ||
        filter.decMin !== null ||
        filter.decMax !== null
      )
    default:
      return false
  }
}

/**
 * Count active filters.
 */
export function countActiveFilters(filters: Filter[]): number {
  return filters.filter(isFilterActive).length
}
