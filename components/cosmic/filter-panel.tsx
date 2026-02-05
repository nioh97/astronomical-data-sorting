"use client"

/**
 * Filter Panel Component
 * 
 * Collapsible panel for filtering dataset rows.
 * Supports:
 * - Numeric range filters (with optional log scale)
 * - Categorical multi-select filters
 * - Temporal filters
 * - Spatial filters (RA/Dec)
 * - Global text search
 */

import { useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ChevronDown,
  ChevronUp,
  Filter,
  X,
  Search,
  Plus,
  Trash2,
} from "lucide-react"
import type { Dataset } from "@/lib/data-context"
import type {
  Filter as FilterType,
  NumericRangeFilter,
  CategoricalFilter,
  TemporalFilter,
  SpatialRAFilter,
  SpatialDecFilter,
  DatasetMeta,
  ColumnMeta,
} from "@/lib/filters/filter-types"
import {
  useFilterContext,
  useDatasetFilters,
} from "@/lib/filters/filter-context"
import {
  getNumericColumns,
  getCategoricalColumns,
  getTemporalColumns,
} from "@/lib/filters/column-meta"
import {
  createNumericFilter,
  createCategoricalFilter,
  createTemporalFilter,
  createSpatialRAFilter,
  createSpatialDecFilter,
  describeFilter,
  isFilterActive,
} from "@/lib/filters/filter-utils"

// ============================================================================
// TYPES
// ============================================================================

interface FilterPanelProps {
  dataset: Dataset
  className?: string
}

type FilterCategory = "numeric" | "categorical" | "temporal" | "spatial"

// ============================================================================
// FILTER EDITORS
// ============================================================================

interface NumericFilterEditorProps {
  filter: NumericRangeFilter
  column: ColumnMeta
  onUpdate: (updates: Partial<NumericRangeFilter>) => void
  onRemove: () => void
}

function NumericFilterEditor({
  filter,
  column,
  onUpdate,
  onRemove,
}: NumericFilterEditorProps) {
  const [minInput, setMinInput] = useState(filter.min?.toString() ?? "")
  const [maxInput, setMaxInput] = useState(filter.max?.toString() ?? "")

  const handleMinChange = useCallback((value: string) => {
    setMinInput(value)
    const num = value.trim() === "" ? null : parseFloat(value)
    if (value.trim() === "" || !Number.isNaN(num)) {
      onUpdate({ min: num })
    }
  }, [onUpdate])

  const handleMaxChange = useCallback((value: string) => {
    setMaxInput(value)
    const num = value.trim() === "" ? null : parseFloat(value)
    if (value.trim() === "" || !Number.isNaN(num)) {
      onUpdate({ max: num })
    }
  }, [onUpdate])

  const label = column.unit ? `${column.name} (${column.unit})` : column.name

  return (
    <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-slate-700">{label}</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          placeholder={column.minValue?.toFixed(2) ?? "Min"}
          value={minInput}
          onChange={(e) => handleMinChange(e.target.value)}
          className="h-8 text-sm"
        />
        <span className="text-slate-400">–</span>
        <Input
          type="number"
          placeholder={column.maxValue?.toFixed(2) ?? "Max"}
          value={maxInput}
          onChange={(e) => handleMaxChange(e.target.value)}
          className="h-8 text-sm"
        />
      </div>
      {column.minValue !== undefined && column.maxValue !== undefined && (
        <p className="text-xs text-slate-500">
          Range: {column.minValue.toExponential(2)} – {column.maxValue.toExponential(2)}
        </p>
      )}
    </div>
  )
}

interface CategoricalFilterEditorProps {
  filter: CategoricalFilter
  column: ColumnMeta
  onUpdate: (updates: Partial<CategoricalFilter>) => void
  onRemove: () => void
}

function CategoricalFilterEditor({
  filter,
  column,
  onUpdate,
  onRemove,
}: CategoricalFilterEditorProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredValues = useMemo(() => {
    const values = column.uniqueValues ?? []
    if (!searchQuery.trim()) return values
    const query = searchQuery.toLowerCase()
    return values.filter((v) => v.toLowerCase().includes(query))
  }, [column.uniqueValues, searchQuery])

  const handleToggle = useCallback((value: string, checked: boolean) => {
    const newValues = checked
      ? [...filter.selectedValues, value]
      : filter.selectedValues.filter((v) => v !== value)
    onUpdate({ selectedValues: newValues })
  }, [filter.selectedValues, onUpdate])

  const handleSelectAll = useCallback(() => {
    onUpdate({ selectedValues: [...(column.uniqueValues ?? [])] })
  }, [column.uniqueValues, onUpdate])

  const handleSelectNone = useCallback(() => {
    onUpdate({ selectedValues: [] })
  }, [onUpdate])

  return (
    <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-slate-700">{column.name}</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {(column.uniqueValues?.length ?? 0) > 10 && (
        <Input
          type="text"
          placeholder="Search values..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 text-sm"
        />
      )}

      <div className="flex gap-2 text-xs">
        <button
          onClick={handleSelectAll}
          className="text-blue-600 hover:underline"
        >
          Select all
        </button>
        <span className="text-slate-300">|</span>
        <button
          onClick={handleSelectNone}
          className="text-blue-600 hover:underline"
        >
          Clear
        </button>
        <span className="text-slate-400 ml-auto">
          {filter.selectedValues.length} / {column.uniqueCount ?? 0}
        </span>
      </div>

      <div className="max-h-40 overflow-y-auto space-y-1">
        {filteredValues.map((value) => (
          <div key={value} className="flex items-center gap-2">
            <Checkbox
              id={`${filter.id}_${value}`}
              checked={filter.selectedValues.includes(value)}
              onCheckedChange={(checked) => handleToggle(value, !!checked)}
            />
            <label
              htmlFor={`${filter.id}_${value}`}
              className="text-sm text-slate-600 cursor-pointer truncate"
              title={value}
            >
              {value}
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}

interface TemporalFilterEditorProps {
  filter: TemporalFilter
  column: ColumnMeta
  onUpdate: (updates: Partial<TemporalFilter>) => void
  onRemove: () => void
}

function TemporalFilterEditor({
  filter,
  column,
  onUpdate,
  onRemove,
}: TemporalFilterEditorProps) {
  const [fromInput, setFromInput] = useState(filter.from?.toString() ?? "")
  const [toInput, setToInput] = useState(filter.to?.toString() ?? "")

  const handleFromChange = useCallback((value: string) => {
    setFromInput(value)
    const num = value.trim() === "" ? null : parseInt(value, 10)
    if (value.trim() === "" || !Number.isNaN(num)) {
      onUpdate({ from: num })
    }
  }, [onUpdate])

  const handleToChange = useCallback((value: string) => {
    setToInput(value)
    const num = value.trim() === "" ? null : parseInt(value, 10)
    if (value.trim() === "" || !Number.isNaN(num)) {
      onUpdate({ to: num })
    }
  }, [onUpdate])

  const currentYear = new Date().getFullYear()

  return (
    <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-slate-700">{column.name}</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          placeholder="From year"
          value={fromInput}
          onChange={(e) => handleFromChange(e.target.value)}
          className="h-8 text-sm"
        />
        <span className="text-slate-400">–</span>
        <Input
          type="number"
          placeholder="To year"
          value={toInput}
          onChange={(e) => handleToChange(e.target.value)}
          className="h-8 text-sm"
        />
      </div>
      <div className="flex gap-2 text-xs">
        <button
          onClick={() => {
            onUpdate({ from: currentYear - 5, to: currentYear })
            setFromInput((currentYear - 5).toString())
            setToInput(currentYear.toString())
          }}
          className="text-blue-600 hover:underline"
        >
          Last 5 years
        </button>
        <button
          onClick={() => {
            onUpdate({ from: currentYear - 10, to: currentYear })
            setFromInput((currentYear - 10).toString())
            setToInput(currentYear.toString())
          }}
          className="text-blue-600 hover:underline"
        >
          Last decade
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// SPATIAL FILTER EDITOR
// ============================================================================

interface SpatialFilterEditorProps {
  filter: SpatialRAFilter | SpatialDecFilter
  column: ColumnMeta
  onUpdate: (updates: Partial<SpatialRAFilter> | Partial<SpatialDecFilter>) => void
  onRemove: () => void
}

function SpatialFilterEditor({
  filter,
  column,
  onUpdate,
  onRemove,
}: SpatialFilterEditorProps) {
  const isRA = filter.type === "spatial_ra"
  const defaultMin = isRA ? 0 : -90
  const defaultMax = isRA ? 360 : 90

  const [minInput, setMinInput] = useState(filter.min?.toString() ?? "")
  const [maxInput, setMaxInput] = useState(filter.max?.toString() ?? "")

  const handleMinChange = useCallback((value: string) => {
    setMinInput(value)
    const num = value.trim() === "" ? null : parseFloat(value)
    if (value.trim() === "" || !Number.isNaN(num)) {
      onUpdate({ min: num })
    }
  }, [onUpdate])

  const handleMaxChange = useCallback((value: string) => {
    setMaxInput(value)
    const num = value.trim() === "" ? null : parseFloat(value)
    if (value.trim() === "" || !Number.isNaN(num)) {
      onUpdate({ max: num })
    }
  }, [onUpdate])

  const label = isRA ? "Right Ascension (RA)" : "Declination (Dec)"
  const rangeLabel = isRA ? "0° – 360°" : "−90° – +90°"

  return (
    <div className="space-y-2 p-3 bg-green-50 rounded-lg border border-green-200">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-green-800">
          {label}
          <Badge variant="outline" className="ml-2 text-xs bg-green-100 text-green-700">
            Spatial
          </Badge>
        </Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          placeholder={`Min (${defaultMin})`}
          value={minInput}
          onChange={(e) => handleMinChange(e.target.value)}
          className="h-8 text-sm"
          min={defaultMin}
          max={defaultMax}
        />
        <span className="text-slate-400">–</span>
        <Input
          type="number"
          placeholder={`Max (${defaultMax})`}
          value={maxInput}
          onChange={(e) => handleMaxChange(e.target.value)}
          className="h-8 text-sm"
          min={defaultMin}
          max={defaultMax}
        />
        <span className="text-xs text-slate-500">deg</span>
      </div>
      <p className="text-xs text-green-700">
        Valid range: {rangeLabel}
      </p>
    </div>
  )
}

// ============================================================================
// ADD FILTER DROPDOWN
// ============================================================================

interface AddFilterDropdownProps {
  meta: DatasetMeta
  onAdd: (filter: FilterType) => void
  existingColumns: Set<string>
}

function AddFilterDropdown({ meta, onAdd, existingColumns }: AddFilterDropdownProps) {
  const [category, setCategory] = useState<FilterCategory | "">("")
  const [selectedColumn, setSelectedColumn] = useState<string>("")

  const numericCols = useMemo(() => 
    getNumericColumns(meta).filter(c => !existingColumns.has(`numeric_${c.name}`)),
    [meta, existingColumns]
  )
  const categoricalCols = useMemo(() => 
    getCategoricalColumns(meta).filter(c => !existingColumns.has(`categorical_${c.name}`)),
    [meta, existingColumns]
  )
  const temporalCols = useMemo(() => 
    getTemporalColumns(meta).filter(c => !existingColumns.has(`temporal_${c.name}`)),
    [meta, existingColumns]
  )

  const handleAddFilter = useCallback(() => {
    if (!selectedColumn || !category) return

    const col = meta.columnMeta.find(c => c.name === selectedColumn)
    if (!col) return

    let filter: FilterType
    switch (category) {
      case "numeric":
        filter = createNumericFilter(selectedColumn, null, null)
        break
      case "categorical":
        filter = createCategoricalFilter(selectedColumn, [])
        break
      case "temporal":
        filter = createTemporalFilter(selectedColumn, null, null)
        break
      case "spatial":
        if (col.isRA) {
          filter = createSpatialRAFilter(selectedColumn)
        } else if (col.isDec) {
          filter = createSpatialDecFilter(selectedColumn)
        } else {
          return
        }
        break
      default:
        return
    }

    onAdd(filter)
    setCategory("")
    setSelectedColumn("")
  }, [category, selectedColumn, meta.columnMeta, onAdd])

  const availableColumns = useMemo(() => {
    switch (category) {
      case "numeric":
        return numericCols
      case "categorical":
        return categoricalCols
      case "temporal":
        return temporalCols
      case "spatial":
        return meta.columnMeta.filter(c => c.isRA || c.isDec)
      default:
        return []
    }
  }, [category, numericCols, categoricalCols, temporalCols, meta.columnMeta])

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 bg-white rounded-lg border border-dashed border-slate-300">
      <Select value={category} onValueChange={(v) => {
        setCategory(v as FilterCategory)
        setSelectedColumn("")
      }}>
        <SelectTrigger className="h-8 w-32 text-sm">
          <SelectValue placeholder="Filter type" />
        </SelectTrigger>
        <SelectContent>
          {numericCols.length > 0 && (
            <SelectItem value="numeric">Numeric</SelectItem>
          )}
          {categoricalCols.length > 0 && (
            <SelectItem value="categorical">Category</SelectItem>
          )}
          {temporalCols.length > 0 && (
            <SelectItem value="temporal">Time/Year</SelectItem>
          )}
          {meta.hasSpatialColumns && (
            <SelectItem value="spatial">Spatial</SelectItem>
          )}
        </SelectContent>
      </Select>

      {category && (
        <Select value={selectedColumn} onValueChange={setSelectedColumn}>
          <SelectTrigger className="h-8 w-40 text-sm">
            <SelectValue placeholder="Select column" />
          </SelectTrigger>
          <SelectContent>
            {availableColumns.map((col) => (
              <SelectItem key={col.name} value={col.name}>
                {col.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {selectedColumn && (
        <Button size="sm" onClick={handleAddFilter} className="h-8">
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      )}
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FilterPanel({ dataset, className = "" }: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(true)
  const { getDatasetMeta, globalSearch, setGlobalSearch } = useFilterContext()
  const {
    filters,
    addFilter,
    updateFilter,
    removeFilter,
    clearFilters,
    activeFilterCount,
  } = useDatasetFilters(dataset.id)

  const meta = useMemo(() => getDatasetMeta(dataset), [getDatasetMeta, dataset])

  // Track which columns already have filters
  const existingFilterColumns = useMemo(() => {
    const set = new Set<string>()
    filters.forEach(f => {
      if (f.column) {
        set.add(`${f.type.split("_")[0]}_${f.column}`)
      }
    })
    return set
  }, [filters])

  const handleAddFilter = useCallback((filter: FilterType) => {
    addFilter(filter)
  }, [addFilter])

  const handleClearAll = useCallback(() => {
    clearFilters()
    setGlobalSearch("")
  }, [clearFilters, setGlobalSearch])

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={`bg-white rounded-lg border border-slate-200 shadow-sm ${className}`}
    >
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="font-medium text-slate-700">Filters</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {activeFilterCount} active
              </Badge>
            )}
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-4 pb-4 space-y-4">
          {/* Global Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search all columns..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="pl-9 h-9"
            />
            {globalSearch && (
              <button
                onClick={() => setGlobalSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Active Filters */}
          {filters.length > 0 && (
            <div className="space-y-2">
              {filters.map((filter) => {
                const col = meta.columnMeta.find((c) => c.name === filter.column)
                if (!col) return null

                switch (filter.type) {
                  case "numeric_range":
                    return (
                      <NumericFilterEditor
                        key={filter.id}
                        filter={filter as NumericRangeFilter}
                        column={col}
                        onUpdate={(updates) => updateFilter(filter.id, updates)}
                        onRemove={() => removeFilter(filter.id)}
                      />
                    )
                  case "categorical":
                    return (
                      <CategoricalFilterEditor
                        key={filter.id}
                        filter={filter as CategoricalFilter}
                        column={col}
                        onUpdate={(updates) => updateFilter(filter.id, updates)}
                        onRemove={() => removeFilter(filter.id)}
                      />
                    )
                  case "temporal":
                    return (
                      <TemporalFilterEditor
                        key={filter.id}
                        filter={filter as TemporalFilter}
                        column={col}
                        onUpdate={(updates) => updateFilter(filter.id, updates)}
                        onRemove={() => removeFilter(filter.id)}
                      />
                    )
                  case "spatial_ra":
                  case "spatial_dec":
                    return (
                      <SpatialFilterEditor
                        key={filter.id}
                        filter={filter as SpatialRAFilter | SpatialDecFilter}
                        column={col}
                        onUpdate={(updates) => updateFilter(filter.id, updates)}
                        onRemove={() => removeFilter(filter.id)}
                      />
                    )
                  default:
                    return null
                }
              })}
            </div>
          )}

          {/* Add Filter */}
          <AddFilterDropdown
            meta={meta}
            onAdd={handleAddFilter}
            existingColumns={existingFilterColumns}
          />

          {/* Clear All */}
          {activeFilterCount > 0 && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="text-slate-500 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export default FilterPanel
