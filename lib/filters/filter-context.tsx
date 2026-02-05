"use client"

/**
 * Filter Context for Unified Repository
 * 
 * Manages filter state across the application:
 * - Per-dataset filter configurations
 * - Global search state
 * - Computed filter results (memoized)
 * - Filter CRUD operations
 * 
 * Designed to work alongside existing DataContext without modification.
 * 
 * CRITICAL: All getter functions (getDatasetMeta, getFilterResult) are PURE.
 * They do NOT call setState. Caching is done via useRef to avoid render-time state updates.
 */

import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useRef,
  ReactNode,
} from "react"
import type { Dataset } from "@/lib/data-context"
import type {
  Filter,
  FilterResult,
  DatasetMeta,
  DatasetFilterState,
} from "./filter-types"
import { computeDatasetMeta } from "./column-meta"
import { applyFilters, isFilterActive } from "./filter-utils"

// ============================================================================
// CONTEXT TYPE
// ============================================================================

interface FilterContextType {
  // === Metadata ===
  /** Get or compute metadata for a dataset */
  getDatasetMeta: (dataset: Dataset) => DatasetMeta
  
  // === Filter State ===
  /** Get filters for a dataset */
  getFilters: (datasetId: string) => Filter[]
  /** Add a filter to a dataset */
  addFilter: (datasetId: string, filter: Filter) => void
  /** Update an existing filter */
  updateFilter: (datasetId: string, filterId: string, updates: Partial<Filter>) => void
  /** Remove a filter */
  removeFilter: (datasetId: string, filterId: string) => void
  /** Clear all filters for a dataset */
  clearFilters: (datasetId: string) => void
  /** Clear all filters for all datasets */
  clearAllFilters: () => void
  
  // === Global Search ===
  /** Global search query */
  globalSearch: string
  /** Set global search query */
  setGlobalSearch: (query: string) => void
  
  // === Filter Results ===
  /** Get filter result for a dataset (cached) */
  getFilterResult: (dataset: Dataset) => FilterResult
  /** Get filtered row indices for a dataset */
  getFilteredIndices: (dataset: Dataset) => number[]
  /** Check if a dataset has active filters */
  hasActiveFilters: (datasetId: string) => boolean
  /** Count active filters for a dataset */
  countActiveFilters: (datasetId: string) => number
}

// ============================================================================
// CONTEXT
// ============================================================================

const FilterContext = createContext<FilterContextType | undefined>(undefined)

// ============================================================================
// PROVIDER
// ============================================================================

interface FilterProviderProps {
  children: ReactNode
}

export function FilterProvider({ children }: FilterProviderProps) {
  // Per-dataset filter state
  const [filterState, setFilterState] = useState<Record<string, DatasetFilterState>>({})
  
  // Global search
  const [globalSearch, setGlobalSearch] = useState("")
  
  // Metadata cache (dataset.id -> DatasetMeta)
  // CRITICAL: Using useRef instead of useState to allow synchronous cache updates
  // without triggering React's "setState during render" error
  const metaCacheRef = useRef<Record<string, DatasetMeta>>({})
  
  // Filter result cache (cache key -> FilterResult)
  // CRITICAL: Using useRef for same reason as above
  const resultCacheRef = useRef<Record<string, FilterResult>>({})

  // ========== Metadata ==========
  
  /**
   * Get or compute metadata for a dataset.
   * PURE FUNCTION: Does not call setState. Uses ref-based cache for performance.
   */
  const getDatasetMeta = useCallback((dataset: Dataset): DatasetMeta => {
    // Check cache (synchronous read from ref)
    const cached = metaCacheRef.current[dataset.id]
    if (cached) {
      return cached
    }
    
    // Compute and cache (synchronous write to ref - no setState!)
    const meta = computeDatasetMeta(dataset)
    metaCacheRef.current[dataset.id] = meta
    return meta
  }, []) // No dependencies - ref is stable

  // ========== Filter State ==========
  
  const getFilters = useCallback((datasetId: string): Filter[] => {
    return filterState[datasetId]?.filters ?? []
  }, [filterState])

  const addFilter = useCallback((datasetId: string, filter: Filter) => {
    setFilterState((prev) => {
      const existing = prev[datasetId] ?? { datasetId, filters: [] }
      return {
        ...prev,
        [datasetId]: {
          ...existing,
          filters: [...existing.filters, filter],
        },
      }
    })
    // Invalidate result cache (ref-based, synchronous)
    Object.keys(resultCacheRef.current).forEach((key) => {
      if (key.startsWith(datasetId)) delete resultCacheRef.current[key]
    })
  }, [])

  const updateFilter = useCallback((
    datasetId: string,
    filterId: string,
    updates: Partial<Filter>
  ) => {
    setFilterState((prev) => {
      const existing = prev[datasetId]
      if (!existing) return prev

      const updatedFilters = existing.filters.map((f) =>
        f.id === filterId ? { ...f, ...updates } as Filter : f
      )

      return {
        ...prev,
        [datasetId]: {
          ...existing,
          filters: updatedFilters,
        },
      }
    })
    // Invalidate result cache (ref-based, synchronous)
    Object.keys(resultCacheRef.current).forEach((key) => {
      if (key.startsWith(datasetId)) delete resultCacheRef.current[key]
    })
  }, [])

  const removeFilter = useCallback((datasetId: string, filterId: string) => {
    setFilterState((prev) => {
      const existing = prev[datasetId]
      if (!existing) return prev

      return {
        ...prev,
        [datasetId]: {
          ...existing,
          filters: existing.filters.filter((f) => f.id !== filterId),
        },
      }
    })
    // Invalidate result cache (ref-based, synchronous)
    Object.keys(resultCacheRef.current).forEach((key) => {
      if (key.startsWith(datasetId)) delete resultCacheRef.current[key]
    })
  }, [])

  const clearFilters = useCallback((datasetId: string) => {
    setFilterState((prev) => {
      const newState = { ...prev }
      delete newState[datasetId]
      return newState
    })
    // Invalidate result cache (ref-based, synchronous)
    Object.keys(resultCacheRef.current).forEach((key) => {
      if (key.startsWith(datasetId)) delete resultCacheRef.current[key]
    })
  }, [])

  const clearAllFilters = useCallback(() => {
    setFilterState({})
    // Clear result cache (ref-based, synchronous)
    resultCacheRef.current = {}
  }, [])

  // ========== Filter Results ==========

  /**
   * Create a cache key from dataset ID, filters, and global search.
   */
  const getCacheKey = useCallback((datasetId: string, filters: Filter[], search: string): string => {
    const filterHash = filters
      .filter(isFilterActive)
      .map((f) => `${f.id}:${JSON.stringify(f)}`)
      .join("|")
    return `${datasetId}::${filterHash}::${search}`
  }, [])

  /**
   * Get filter result for a dataset.
   * PURE FUNCTION: Does not call setState. Uses ref-based cache for performance.
   */
  const getFilterResult = useCallback((dataset: Dataset): FilterResult => {
    const filters = getFilters(dataset.id)
    const cacheKey = getCacheKey(dataset.id, filters, globalSearch)

    // Check cache (synchronous read from ref)
    const cached = resultCacheRef.current[cacheKey]
    if (cached) {
      return cached
    }

    // Compute result (pure computation)
    const meta = getDatasetMeta(dataset)
    const result = applyFilters(dataset, filters, meta, globalSearch)

    // Cache result (synchronous write to ref - no setState!)
    resultCacheRef.current[cacheKey] = result

    return result
  }, [getFilters, globalSearch, getDatasetMeta, getCacheKey]) // Removed resultCache dependency

  const getFilteredIndices = useCallback((dataset: Dataset): number[] => {
    const result = getFilterResult(dataset)
    return result.passingIndices
  }, [getFilterResult])

  const hasActiveFiltersForDataset = useCallback((datasetId: string): boolean => {
    const filters = getFilters(datasetId)
    return filters.some(isFilterActive) || globalSearch.trim().length > 0
  }, [getFilters, globalSearch])

  const countActiveFiltersForDataset = useCallback((datasetId: string): number => {
    const filters = getFilters(datasetId)
    let count = filters.filter(isFilterActive).length
    if (globalSearch.trim().length > 0) count++
    return count
  }, [getFilters, globalSearch])

  // ========== Context Value ==========

  const value: FilterContextType = useMemo(() => ({
    getDatasetMeta,
    getFilters,
    addFilter,
    updateFilter,
    removeFilter,
    clearFilters,
    clearAllFilters,
    globalSearch,
    setGlobalSearch,
    getFilterResult,
    getFilteredIndices,
    hasActiveFilters: hasActiveFiltersForDataset,
    countActiveFilters: countActiveFiltersForDataset,
  }), [
    getDatasetMeta,
    getFilters,
    addFilter,
    updateFilter,
    removeFilter,
    clearFilters,
    clearAllFilters,
    globalSearch,
    setGlobalSearch,
    getFilterResult,
    getFilteredIndices,
    hasActiveFiltersForDataset,
    countActiveFiltersForDataset,
  ])

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  )
}

// ============================================================================
// HOOK
// ============================================================================

export function useFilterContext() {
  const context = useContext(FilterContext)
  if (context === undefined) {
    throw new Error("useFilterContext must be used within a FilterProvider")
  }
  return context
}

// ============================================================================
// CONVENIENCE HOOKS
// ============================================================================

/**
 * Hook to get filtered rows for a dataset.
 */
export function useFilteredRows(dataset: Dataset | null): {
  rows: Record<string, unknown>[]
  totalRows: number
  filteredRows: number
  hasFilters: boolean
} {
  const { getFilterResult, hasActiveFilters } = useFilterContext()

  return useMemo(() => {
    if (!dataset) {
      return { rows: [], totalRows: 0, filteredRows: 0, hasFilters: false }
    }

    const result = getFilterResult(dataset)
    const rows = result.passingIndices.map((i) => dataset.rows[i])

    return {
      rows,
      totalRows: result.totalRows,
      filteredRows: result.filteredRows,
      hasFilters: hasActiveFilters(dataset.id),
    }
  }, [dataset, getFilterResult, hasActiveFilters])
}

/**
 * Hook to manage filters for a specific dataset.
 */
export function useDatasetFilters(datasetId: string) {
  const {
    getFilters,
    addFilter,
    updateFilter,
    removeFilter,
    clearFilters,
    hasActiveFilters,
    countActiveFilters,
  } = useFilterContext()

  return useMemo(() => ({
    filters: getFilters(datasetId),
    addFilter: (filter: Filter) => addFilter(datasetId, filter),
    updateFilter: (filterId: string, updates: Partial<Filter>) =>
      updateFilter(datasetId, filterId, updates),
    removeFilter: (filterId: string) => removeFilter(datasetId, filterId),
    clearFilters: () => clearFilters(datasetId),
    hasActiveFilters: hasActiveFilters(datasetId),
    activeFilterCount: countActiveFilters(datasetId),
  }), [
    datasetId,
    getFilters,
    addFilter,
    updateFilter,
    removeFilter,
    clearFilters,
    hasActiveFilters,
    countActiveFilters,
  ])
}
