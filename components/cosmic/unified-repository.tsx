"use client"

import { useMemo, useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Download, ChevronDown, FileJson, FileText } from "lucide-react"
import { useDataContext, Dataset } from "@/lib/data-context"
import { useFilterContext } from "@/lib/filters/filter-context"
import { FilterPanel } from "./filter-panel"
import { FilterChips } from "./filter-chips"
import { VisualizationPanel } from "./visualization-panel"
import { ColumnHeaderTooltip } from "@/components/ui/field-tooltip"

// ============================================================================
// DATASET TABLE WITH FILTERS
// ============================================================================

interface DatasetTableProps {
  dataset: Dataset
  getDisplayValue: (
    row: Record<string, any>,
    columnName: string,
    column?: { name: string; semanticType: string; unit: string | null }
  ) => string
  getHeaderLabel: (column: { name: string; semanticType: string; unit: string | null }) => string
  onExportFiltered: (dataset: Dataset, format: "csv" | "json") => void
}

function DatasetTable({
  dataset,
  getDisplayValue,
  getHeaderLabel,
  onExportFiltered,
}: DatasetTableProps) {
  const { getFilterResult, hasActiveFilters } = useFilterContext()
  const [showAllRows, setShowAllRows] = useState(false)

  // Get filter result for this dataset
  const filterResult = useMemo(
    () => getFilterResult(dataset),
    [getFilterResult, dataset]
  )

  // Get filtered rows
  const filteredRows = useMemo(() => {
    return filterResult.passingIndices.map((i) => dataset.rows[i])
  }, [filterResult, dataset.rows])

  // Pagination: show first 100 rows by default for performance
  const MAX_VISIBLE_ROWS = 100
  const displayRows = useMemo(() => {
    if (showAllRows || filteredRows.length <= MAX_VISIBLE_ROWS) {
      return filteredRows
    }
    return filteredRows.slice(0, MAX_VISIBLE_ROWS)
  }, [filteredRows, showAllRows])

  const hasFilters = hasActiveFilters(dataset.id)
  const isFiltered = filterResult.filteredRows < filterResult.totalRows

  return (
    <Card className="border-zinc-700 bg-zinc-900 overflow-hidden">
      {/* Dataset Header */}
      <div className="p-4 border-b border-zinc-700 bg-zinc-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">{dataset.name}</h3>
            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400 mt-1">
              <span>
                {isFiltered ? (
                  <>
                    <span className="font-medium text-blue-400">
                      {filterResult.filteredRows.toLocaleString()}
                    </span>
                    {" / "}
                    {filterResult.totalRows.toLocaleString()} rows
                  </>
                ) : (
                  <>{filterResult.totalRows.toLocaleString()} rows</>
                )}
              </span>
              <span className="text-zinc-600">•</span>
              <span>{dataset.columns.length} columns</span>
              <span className="text-zinc-600">•</span>
              <span className="text-xs text-zinc-500">Source: {dataset.sourceFile}</span>
            </div>
          </div>

          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 border-zinc-600 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100">
                <Download className="h-4 w-4" />
                Export
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-800 border-zinc-700">
              <DropdownMenuItem onClick={() => onExportFiltered(dataset, "csv")} className="text-zinc-300 focus:bg-zinc-700 focus:text-zinc-100">
                <FileText className="h-4 w-4 mr-2" />
                {isFiltered ? "Export Filtered (CSV)" : "Export All (CSV)"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExportFiltered(dataset, "json")} className="text-zinc-300 focus:bg-zinc-700 focus:text-zinc-100">
                <FileJson className="h-4 w-4 mr-2" />
                {isFiltered ? "Export Filtered (JSON)" : "Export All (JSON)"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="p-4 border-b border-zinc-800">
        <FilterPanel dataset={dataset} />
      </div>

      {/* Active Filter Chips */}
      {hasFilters && (
        <div className="px-4 py-2 border-b border-zinc-800 bg-blue-900/20">
          <FilterChips dataset={dataset} showStats={false} />
        </div>
      )}

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700 bg-zinc-800">
              <th className="text-left py-2 px-3 text-zinc-500 font-medium w-12">#</th>
              {dataset.columns.map((column, colIdx) => (
                <th
                  key={`col-header-${dataset.id}-${column.name}-${colIdx}`}
                  className="text-left py-2 px-3 text-zinc-200 font-semibold"
                >
                  <div className="flex flex-col gap-1">
                    <ColumnHeaderTooltip
                      name={column.name}
                      semanticType={column.semanticType}
                      unit={column.unit}
                      description={column.description}
                      displayText={getHeaderLabel(column)}
                    />
                    <Badge variant="outline" className="text-xs w-fit border-zinc-600 text-zinc-400">
                      {column.semanticType || "unknown"}
                    </Badge>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td
                  colSpan={dataset.columns.length + 1}
                  className="py-12 text-center text-zinc-500"
                >
                  {isFiltered
                    ? "No rows match the current filters"
                    : "No data rows"}
                </td>
              </tr>
            ) : (
              displayRows.map((row, idx) => {
                const rowKey = filterResult.passingIndices[idx] ?? idx
                return (
                  <tr
                    key={`row-${dataset.id}-${rowKey}`}
                    className="border-b border-zinc-800 hover:bg-zinc-800/50 transition"
                  >
                    <td className="py-2 px-3 text-zinc-500 text-xs">
                      {rowKey + 1}
                    </td>
                    {dataset.columns.map((column, colIdx) => (
                      <td key={`cell-${dataset.id}-${rowKey}-${column.name}-${colIdx}`} className="py-2 px-3 text-zinc-300">
                        {getDisplayValue(row, column.name, column)}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Show more rows button */}
      {!showAllRows && filteredRows.length > MAX_VISIBLE_ROWS && (
        <div className="p-4 border-t border-zinc-800 text-center">
          <Button
            variant="ghost"
            onClick={() => setShowAllRows(true)}
            className="text-sm text-zinc-400 hover:text-zinc-100"
          >
            Show all {filteredRows.length.toLocaleString()} rows
            <span className="ml-1 text-zinc-500">
              (currently showing {MAX_VISIBLE_ROWS})
            </span>
          </Button>
        </div>
      )}

      {/* Advanced Visualizations Panel */}
      <VisualizationPanel dataset={dataset} />
    </Card>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function UnifiedRepositorySection() {
  const { datasets } = useDataContext()
  const { getFilterResult } = useFilterContext()

  /**
   * Get display value for a field with proper formatting.
   */
  const getDisplayValue = useCallback(
    (
      row: Record<string, any>,
      columnName: string,
      column?: { name: string; semanticType: string; unit: string | null }
    ): string => {
      const value = row[columnName]
      if (value === null || value === undefined) {
        return "—"
      }
      let formatted: string
      if (typeof value === "number") {
        if (value === 0) formatted = "0"
        else if (Math.abs(value) < 0.01 || Math.abs(value) > 1e6) {
          formatted = value.toExponential(2)
        } else {
          formatted = value.toLocaleString(undefined, { maximumFractionDigits: 3 })
        }
      } else {
        formatted = String(value)
      }
      if (column?.unit && column.unit !== "none" && column.unit !== "" && column.unit !== "ISO_DATE") {
        return `${formatted} ${column.unit}`
      }
      return formatted
    },
    []
  )

  /**
   * Get header label with unit
   */
  const getHeaderLabel = useCallback(
    (column: { name: string; semanticType: string; unit: string | null }): string => {
      const unitLabel = column.unit && column.unit !== "none" && column.unit !== "" ? ` (${column.unit})` : ""
      return `${column.name}${unitLabel}`
    },
    []
  )

  /**
   * Export a single dataset (filtered or full)
   */
  const handleExportDataset = useCallback(
    (dataset: Dataset, format: "csv" | "json") => {
      const filterResult = getFilterResult(dataset)
      const rows = filterResult.passingIndices.map((i) => dataset.rows[i])
      const isFiltered = filterResult.filteredRows < filterResult.totalRows

      const filename = `${dataset.name}_${isFiltered ? "filtered_" : ""}${new Date().toISOString().split("T")[0]}`

      if (format === "json") {
        // JSON export
        const exportData = {
          dataset: dataset.name,
          source: dataset.sourceFile,
          exportedAt: new Date().toISOString(),
          totalRows: filterResult.totalRows,
          filteredRows: filterResult.filteredRows,
          columns: dataset.columns.map((c) => ({
            name: c.name,
            type: c.semanticType,
            unit: c.unit,
          })),
          data: rows,
        }
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: "application/json",
        })
        downloadBlob(blob, `${filename}.json`)
      } else {
        // CSV export
        const csvLines: string[] = []
        
        // Metadata as comments
        csvLines.push(`# Dataset: ${dataset.name}`)
        csvLines.push(`# Source: ${dataset.sourceFile}`)
        csvLines.push(`# Exported: ${new Date().toISOString()}`)
        csvLines.push(`# Rows: ${filterResult.filteredRows} of ${filterResult.totalRows}`)
        csvLines.push("")

        // Headers
        const headers = dataset.columns.map((col) => getHeaderLabel(col))
        csvLines.push(headers.join(","))

        // Data rows
        rows.forEach((row) => {
          const values = dataset.columns.map((col) => {
            const val = row[col.name]
            if (val === null || val === undefined) return ""
            // Escape commas and quotes in string values
            const str = String(val)
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
              return `"${str.replace(/"/g, '""')}"`
            }
            return str
          })
          csvLines.push(values.join(","))
        })

        const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" })
        downloadBlob(blob, `${filename}.csv`)
      }
    },
    [getFilterResult, getHeaderLabel]
  )

  /**
   * Export all datasets
   */
  const handleExportAll = useCallback(() => {
    const csvLines: string[] = []

    datasets.forEach((dataset, index) => {
      const filterResult = getFilterResult(dataset)
      const rows = filterResult.passingIndices.map((i) => dataset.rows[i])

      if (index > 0) {
        csvLines.push("")
        csvLines.push("")
      }

      csvLines.push(`# Dataset: ${dataset.name}`)
      csvLines.push(`# Rows: ${filterResult.filteredRows} of ${filterResult.totalRows}`)
      csvLines.push("")

      const headers = dataset.columns.map((col) => getHeaderLabel(col))
      csvLines.push(headers.join(","))

      rows.forEach((row) => {
        const values = dataset.columns.map((col) => {
          const val = row[col.name]
          if (val === null || val === undefined) return ""
          const str = String(val)
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        })
        csvLines.push(values.join(","))
      })
    })

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" })
    downloadBlob(blob, `cosmic_export_${new Date().toISOString().split("T")[0]}.csv`)
  }, [datasets, getFilterResult, getHeaderLabel])

  // Summary statistics
  const stats = useMemo(() => {
    let totalRows = 0
    let filteredRows = 0

    datasets.forEach((dataset) => {
      const result = getFilterResult(dataset)
      totalRows += result.totalRows
      filteredRows += result.filteredRows
    })

    return { totalRows, filteredRows, isFiltered: filteredRows < totalRows }
  }, [datasets, getFilterResult])

  return (
    <section
      className="space-y-6 bg-zinc-900 rounded-lg border border-zinc-700 p-6"
      aria-labelledby="stage-repository-title"
    >
      <div>
        <h2 id="stage-repository-title" className="text-xl font-semibold text-zinc-100 mb-1">
          Repository
        </h2>
        <p className="text-sm text-zinc-400 mb-4">
          Query and filter your unified datasets. Export filtered results when needed.
        </p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">
            {datasets.length} dataset{datasets.length !== 1 ? "s" : ""}
            {stats.isFiltered ? (
              <>
                {" • "}
                <span className="text-blue-400 font-medium">
                  {stats.filteredRows.toLocaleString()}
                </span>
                {" / "}
                {stats.totalRows.toLocaleString()} total rows
              </>
            ) : (
              <> • {stats.totalRows.toLocaleString()} total rows</>
            )}
          </span>
          {datasets.length > 1 && (
            <Button variant="outline" size="sm" onClick={handleExportAll} className="gap-2 border-zinc-600 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100">
              <Download className="w-4 h-4" />
              Export All
            </Button>
          )}
        </div>
      </div>

      {datasets.length === 0 ? (
        <Card className="p-12 border-zinc-700 bg-zinc-800 text-center">
          <p className="text-zinc-400">No datasets uploaded yet. Upload a file to get started.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {datasets.map((dataset, index) => (
            <DatasetTable
              key={`repo-table-${dataset.id}-${index}`}
              dataset={dataset}
              getDisplayValue={getDisplayValue}
              getHeaderLabel={getHeaderLabel}
              onExportFiltered={handleExportDataset}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// ============================================================================
// HELPER
// ============================================================================

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
