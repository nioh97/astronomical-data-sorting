"use client"

/**
 * Filter Chips Component
 * 
 * Displays active filters as removable chips/badges.
 * Shows filter summary in a compact, scannable format.
 */

import { useCallback, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"
import type { Dataset } from "@/lib/data-context"
import type { Filter } from "@/lib/filters/filter-types"
import { useFilterContext, useDatasetFilters } from "@/lib/filters/filter-context"
import { describeFilter, isFilterActive } from "@/lib/filters/filter-utils"

// ============================================================================
// TYPES
// ============================================================================

interface FilterChipsProps {
  dataset: Dataset
  className?: string
  /** Show row count statistics */
  showStats?: boolean
}

interface FilterChipProps {
  filter: Filter
  onRemove: () => void
}

// ============================================================================
// FILTER CHIP
// ============================================================================

function FilterChip({ filter, onRemove }: FilterChipProps) {
  const description = describeFilter(filter)

  return (
    <Badge
      variant="secondary"
      className="flex items-center gap-1 pr-1 text-sm font-normal bg-blue-900/30 text-blue-300 border border-blue-800 hover:bg-blue-900/50 transition"
    >
      <span className="truncate max-w-[200px]" title={description}>
        {description}
      </span>
      <button
        onClick={onRemove}
        className="ml-1 p-0.5 rounded hover:bg-blue-800 transition"
        aria-label={`Remove filter: ${description}`}
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  )
}

// ============================================================================
// GLOBAL SEARCH CHIP
// ============================================================================

interface GlobalSearchChipProps {
  query: string
  onClear: () => void
}

function GlobalSearchChip({ query, onClear }: GlobalSearchChipProps) {
  return (
    <Badge
      variant="secondary"
      className="flex items-center gap-1 pr-1 text-sm font-normal bg-emerald-900/30 text-emerald-300 border border-emerald-800 hover:bg-emerald-900/50 transition"
    >
      <span className="truncate max-w-[150px]" title={`Search: "${query}"`}>
        Search: "{query}"
      </span>
      <button
        onClick={onClear}
        className="ml-1 p-0.5 rounded hover:bg-emerald-800 transition"
        aria-label="Clear search"
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FilterChips({
  dataset,
  className = "",
  showStats = true,
}: FilterChipsProps) {
  const { globalSearch, setGlobalSearch, getFilterResult } = useFilterContext()
  const { filters, removeFilter, clearFilters } = useDatasetFilters(dataset.id)

  // Get active filters
  const activeFilters = useMemo(
    () => filters.filter(isFilterActive),
    [filters]
  )

  // Get filter stats
  const result = useMemo(
    () => getFilterResult(dataset),
    [getFilterResult, dataset]
  )

  const hasGlobalSearch = globalSearch.trim().length > 0
  const hasAnyFilter = activeFilters.length > 0 || hasGlobalSearch
  const isFiltered = result.filteredRows < result.totalRows

  // Handlers
  const handleRemoveFilter = useCallback(
    (filterId: string) => {
      removeFilter(filterId)
    },
    [removeFilter]
  )

  const handleClearSearch = useCallback(() => {
    setGlobalSearch("")
  }, [setGlobalSearch])

  const handleClearAll = useCallback(() => {
    clearFilters()
    setGlobalSearch("")
  }, [clearFilters, setGlobalSearch])

  // Don't render if no active filters
  if (!hasAnyFilter) {
    return null
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* Stats */}
      {showStats && isFiltered && (
        <span className="text-sm text-zinc-500">
          Showing{" "}
          <span className="font-medium text-zinc-300">
            {result.filteredRows.toLocaleString()}
          </span>{" "}
          of{" "}
          <span className="font-medium text-zinc-300">
            {result.totalRows.toLocaleString()}
          </span>{" "}
          rows
        </span>
      )}

      {/* Separator */}
      {showStats && isFiltered && hasAnyFilter && (
        <span className="text-zinc-600">|</span>
      )}

      {/* Global search chip */}
      {hasGlobalSearch && (
        <GlobalSearchChip query={globalSearch} onClear={handleClearSearch} />
      )}

      {/* Filter chips */}
      {activeFilters.map((filter) => (
        <FilterChip
          key={filter.id}
          filter={filter}
          onRemove={() => handleRemoveFilter(filter.id)}
        />
      ))}

      {/* Clear all button */}
      {(activeFilters.length > 1 || (activeFilters.length > 0 && hasGlobalSearch)) && (
        <button
          onClick={handleClearAll}
          className="text-xs text-zinc-500 hover:text-red-400 hover:underline transition"
        >
          Clear all
        </button>
      )}
    </div>
  )
}

// ============================================================================
// COMPACT VARIANT
// ============================================================================

interface FilterSummaryProps {
  dataset: Dataset
  className?: string
}

/**
 * Compact summary of active filters.
 * Shows count and allows clearing all.
 */
export function FilterSummary({ dataset, className = "" }: FilterSummaryProps) {
  const { globalSearch, setGlobalSearch, getFilterResult } = useFilterContext()
  const { filters, clearFilters, activeFilterCount } = useDatasetFilters(dataset.id)

  const result = useMemo(
    () => getFilterResult(dataset),
    [getFilterResult, dataset]
  )

  const hasGlobalSearch = globalSearch.trim().length > 0
  const totalFilters = activeFilterCount

  const handleClearAll = useCallback(() => {
    clearFilters()
    setGlobalSearch("")
  }, [clearFilters, setGlobalSearch])

  if (totalFilters === 0) {
    return null
  }

  return (
    <div className={`flex items-center gap-3 text-sm ${className}`}>
      <Badge variant="secondary" className="font-normal bg-blue-900/50 text-blue-300 border-blue-700">
        {totalFilters} filter{totalFilters !== 1 ? "s" : ""} active
      </Badge>
      <span className="text-zinc-500">
        {result.filteredRows.toLocaleString()} / {result.totalRows.toLocaleString()} rows
      </span>
      <button
        onClick={handleClearAll}
        className="text-zinc-500 hover:text-red-400 transition"
        title="Clear all filters"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export default FilterChips
