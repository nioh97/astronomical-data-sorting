/**
 * Filter Types for Unified Repository Query System
 * 
 * Domain-aware, composable filter definitions for astronomical data.
 * Designed for client-side filtering with future backend persistence support.
 */

// ============================================================================
// COLUMN METADATA
// ============================================================================

/**
 * Detected data type for a column. Used to determine applicable filter types.
 * Astronomy-aware: includes angle, distance, brightness as first-class types.
 */
export type ColumnDataType =
  | "number"
  | "string"
  | "boolean"
  | "date"
  | "angle"      // RA, Dec, angular distances
  | "distance"   // parsec, AU, km, etc.
  | "brightness" // magnitudes (note: lower = brighter)
  | "mass"
  | "temperature"
  | "time"       // orbital periods, durations
  | "unknown"

/**
 * Extended column metadata computed once after ingestion.
 * Non-breaking: derived from existing DatasetColumn + row analysis.
 */
export interface ColumnMeta {
  name: string
  /** Inferred from sample values */
  detectedType: ColumnDataType
  /** Reused from DatasetColumn.semanticType if present */
  physicalQuantity: string | null
  /** Reused from DatasetColumn.unit */
  unit: string | null
  /** Description from DatasetColumn */
  description: string
  /** True if column can be filtered (false for complex objects, arrays) */
  isFilterable: boolean
  /** For numeric columns: observed min value (for range slider defaults) */
  minValue?: number
  /** For numeric columns: observed max value */
  maxValue?: number
  /** For categorical columns: unique values (limited to first N for perf) */
  uniqueValues?: string[]
  /** Count of unique values (even if uniqueValues is truncated) */
  uniqueCount?: number
  /** Count of null/undefined values in this column */
  nullCount: number
  /** Whether this looks like RA (right ascension) */
  isRA?: boolean
  /** Whether this looks like Dec (declination) */
  isDec?: boolean
}

/**
 * Dataset with computed metadata for filtering.
 * Extends the base Dataset without modifying it.
 */
export interface DatasetMeta {
  datasetId: string
  rowCount: number
  columnMeta: ColumnMeta[]
  /** Quick lookup: does this dataset have RA/Dec for spatial filtering? */
  hasSpatialColumns: boolean
  /** Column name detected as RA (if any) */
  raColumn?: string
  /** Column name detected as Dec (if any) */
  decColumn?: string
}

// ============================================================================
// FILTER DEFINITIONS
// ============================================================================

/**
 * Base filter interface. All filters extend this.
 */
export interface BaseFilter {
  /** Unique ID for this filter instance */
  id: string
  /** Type discriminator */
  type: FilterType
  /** Column this filter applies to (null for global filters) */
  column: string | null
  /** Whether filter is currently active */
  enabled: boolean
}

export type FilterType =
  | "numeric_range"
  | "categorical"
  | "text_search"
  | "temporal"
  | "spatial_ra"
  | "spatial_dec"
  | "spatial_box"

/**
 * Numeric range filter (min/max).
 * Applies to: distance, mass, radius, brightness, temperature, etc.
 */
export interface NumericRangeFilter extends BaseFilter {
  type: "numeric_range"
  column: string
  min: number | null
  max: number | null
  /** If true, use log scale for comparison (useful for distance, brightness) */
  useLogScale?: boolean
  /** Include null values in results? Default: false */
  includeNulls?: boolean
}

/**
 * Categorical multi-select filter.
 * Applies to: discovery_method, facility, mission, flags, etc.
 */
export interface CategoricalFilter extends BaseFilter {
  type: "categorical"
  column: string
  /** Selected values (OR logic within column) */
  selectedValues: string[]
  /** Include null values? */
  includeNulls?: boolean
}

/**
 * Global text search filter.
 * Searches across all string columns.
 */
export interface TextSearchFilter extends BaseFilter {
  type: "text_search"
  column: null // Global filter
  /** Search query */
  query: string
  /** Case-sensitive? Default: false */
  caseSensitive?: boolean
  /** Columns to search (null = all string columns) */
  searchColumns?: string[]
}

/**
 * Temporal filter for date/year columns.
 */
export interface TemporalFilter extends BaseFilter {
  type: "temporal"
  column: string
  /** Start of range (ISO date string or year number) */
  from: string | number | null
  /** End of range */
  to: string | number | null
}

/**
 * Spatial filter for RA (Right Ascension).
 * Range: 0-360 degrees.
 */
export interface SpatialRAFilter extends BaseFilter {
  type: "spatial_ra"
  column: string
  min: number | null // 0-360
  max: number | null // 0-360
  /** Handle wraparound (e.g., 350-10 deg)? */
  wraparound?: boolean
}

/**
 * Spatial filter for Dec (Declination).
 * Range: -90 to +90 degrees.
 */
export interface SpatialDecFilter extends BaseFilter {
  type: "spatial_dec"
  column: string
  min: number | null // -90 to 90
  max: number | null // -90 to 90
}

/**
 * Spatial box filter (RA + Dec combined).
 * For cone search or rectangular region selection.
 */
export interface SpatialBoxFilter extends BaseFilter {
  type: "spatial_box"
  column: null // Uses raColumn and decColumn from DatasetMeta
  raMin: number | null
  raMax: number | null
  decMin: number | null
  decMax: number | null
  /** If true, treat as cone search with center and radius */
  isConeSearch?: boolean
  centerRA?: number
  centerDec?: number
  radiusDeg?: number
}

/**
 * Union type of all filter types.
 */
export type Filter =
  | NumericRangeFilter
  | CategoricalFilter
  | TextSearchFilter
  | TemporalFilter
  | SpatialRAFilter
  | SpatialDecFilter
  | SpatialBoxFilter

// ============================================================================
// FILTER STATE
// ============================================================================

/**
 * Filter state for a single dataset.
 */
export interface DatasetFilterState {
  datasetId: string
  filters: Filter[]
  /** Computed: IDs of rows that pass all filters */
  filteredRowIndices?: number[]
  /** Computed: count of rows passing filters */
  filteredCount?: number
}

/**
 * Global filter state across all datasets.
 */
export interface FilterState {
  /** Per-dataset filter states */
  datasets: Record<string, DatasetFilterState>
  /** Global text search (applies to all datasets) */
  globalSearch: string
  /** Global search enabled? */
  globalSearchEnabled: boolean
}

// ============================================================================
// FILTER RESULT
// ============================================================================

/**
 * Result of applying filters to a dataset.
 */
export interface FilterResult {
  datasetId: string
  /** Original row count */
  totalRows: number
  /** Rows passing all filters */
  filteredRows: number
  /** Indices of rows that pass (for efficient access) */
  passingIndices: number[]
  /** Per-column match info (for highlighting) */
  matchInfo?: Record<string, Set<number>>
}

// ============================================================================
// FILTER PRESETS (for common astronomy queries)
// ============================================================================

export interface FilterPreset {
  id: string
  name: string
  description: string
  /** Factory function to create filters for a dataset */
  createFilters: (meta: DatasetMeta) => Filter[]
}

/**
 * Built-in presets for common astronomical queries.
 */
export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: "bright_objects",
    name: "Bright Objects",
    description: "Objects with magnitude < 10",
    createFilters: (meta) => {
      const magCol = meta.columnMeta.find(
        (c) => c.detectedType === "brightness" || c.name.toLowerCase().includes("mag")
      )
      if (!magCol) return []
      return [
        {
          id: `preset_bright_${Date.now()}`,
          type: "numeric_range",
          column: magCol.name,
          enabled: true,
          min: null,
          max: 10,
        },
      ]
    },
  },
  {
    id: "nearby",
    name: "Nearby Objects",
    description: "Objects within 100 parsec",
    createFilters: (meta) => {
      const distCol = meta.columnMeta.find(
        (c) => c.detectedType === "distance" || c.physicalQuantity === "distance"
      )
      if (!distCol) return []
      return [
        {
          id: `preset_nearby_${Date.now()}`,
          type: "numeric_range",
          column: distCol.name,
          enabled: true,
          min: null,
          max: 100,
        },
      ]
    },
  },
  {
    id: "recent_discoveries",
    name: "Recent Discoveries",
    description: "Discovered in last 5 years",
    createFilters: (meta) => {
      const yearCol = meta.columnMeta.find(
        (c) =>
          c.name.toLowerCase().includes("disc_year") ||
          c.name.toLowerCase().includes("discovery_year")
      )
      if (!yearCol) return []
      const currentYear = new Date().getFullYear()
      return [
        {
          id: `preset_recent_${Date.now()}`,
          type: "temporal",
          column: yearCol.name,
          enabled: true,
          from: currentYear - 5,
          to: currentYear,
        },
      ]
    },
  },
]

// ============================================================================
// SERIALIZATION (for future persistence / URL sharing)
// ============================================================================

/**
 * Serialized filter for storage or URL.
 * Minimal representation to reduce size.
 */
export interface SerializedFilter {
  t: FilterType // type
  c: string | null // column
  v: Record<string, unknown> // values (filter-specific)
}

/**
 * Serialize a filter for storage.
 */
export function serializeFilter(filter: Filter): SerializedFilter {
  const base = { t: filter.type, c: filter.column }
  switch (filter.type) {
    case "numeric_range":
      return { ...base, v: { min: filter.min, max: filter.max, log: filter.useLogScale } }
    case "categorical":
      return { ...base, v: { sel: filter.selectedValues } }
    case "text_search":
      return { ...base, v: { q: filter.query, cs: filter.caseSensitive } }
    case "temporal":
      return { ...base, v: { from: filter.from, to: filter.to } }
    case "spatial_ra":
    case "spatial_dec":
      return { ...base, v: { min: filter.min, max: filter.max } }
    case "spatial_box":
      return {
        ...base,
        v: {
          ra: [filter.raMin, filter.raMax],
          dec: [filter.decMin, filter.decMax],
        },
      }
    default:
      return { ...base, v: {} }
  }
}

/**
 * Deserialize a filter from storage.
 */
export function deserializeFilter(s: SerializedFilter): Filter | null {
  const id = `filter_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const base = { id, enabled: true, column: s.c }

  switch (s.t) {
    case "numeric_range":
      return {
        ...base,
        type: "numeric_range",
        column: s.c!,
        min: (s.v.min as number) ?? null,
        max: (s.v.max as number) ?? null,
        useLogScale: s.v.log as boolean,
      }
    case "categorical":
      return {
        ...base,
        type: "categorical",
        column: s.c!,
        selectedValues: (s.v.sel as string[]) ?? [],
      }
    case "text_search":
      return {
        ...base,
        type: "text_search",
        column: null,
        query: (s.v.q as string) ?? "",
        caseSensitive: s.v.cs as boolean,
      }
    case "temporal":
      return {
        ...base,
        type: "temporal",
        column: s.c!,
        from: (s.v.from as string | number) ?? null,
        to: (s.v.to as string | number) ?? null,
      }
    case "spatial_ra":
      return {
        ...base,
        type: "spatial_ra",
        column: s.c!,
        min: (s.v.min as number) ?? null,
        max: (s.v.max as number) ?? null,
      }
    case "spatial_dec":
      return {
        ...base,
        type: "spatial_dec",
        column: s.c!,
        min: (s.v.min as number) ?? null,
        max: (s.v.max as number) ?? null,
      }
    case "spatial_box": {
      const ra = s.v.ra as [number | null, number | null]
      const dec = s.v.dec as [number | null, number | null]
      return {
        ...base,
        type: "spatial_box",
        column: null,
        raMin: ra?.[0] ?? null,
        raMax: ra?.[1] ?? null,
        decMin: dec?.[0] ?? null,
        decMax: dec?.[1] ?? null,
      }
    }
    default:
      return null
  }
}
