"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Download } from "lucide-react"
import { useDataContext, Dataset } from "@/lib/data-context"

export default function UnifiedRepositorySection() {
  const { datasets } = useDataContext()

  /**
   * Get display value for a field with proper formatting
   */
  const getDisplayValue = (row: Record<string, any>, columnName: string): string => {
    const value = row[columnName]
    if (value === null || value === undefined) {
      return "—"
    }
    if (typeof value === "number") {
      // Format numbers appropriately
      if (value === 0) return "0"
      if (Math.abs(value) < 0.01 || Math.abs(value) > 1e6) {
        return value.toExponential(2)
      }
      return value.toLocaleString(undefined, { maximumFractionDigits: 3 })
    }
    return String(value)
  }

  /**
   * Get header label with semantic type and unit
   */
  const getHeaderLabel = (column: { name: string; semanticType: string; unit: string | null }): string => {
    const unitLabel = column.unit && column.unit !== "none" && column.unit !== "" ? ` (${column.unit})` : ""
    return `${column.name}${unitLabel}`
  }

  /**
   * Export all datasets to CSV
   */
  const handleExport = () => {
    const csvLines: string[] = []

    datasets.forEach((dataset) => {
      // Add dataset header
      csvLines.push(`Dataset: ${dataset.name}`)
      csvLines.push("")

      // Add column headers
      const headers = dataset.columns.map((col) => getHeaderLabel(col))
      csvLines.push(headers.join(","))

      // Add rows
      dataset.rows.forEach((row) => {
        const values = dataset.columns.map((col) => getDisplayValue(row, col.name))
        csvLines.push(values.join(","))
      })

      csvLines.push("")
      csvLines.push("")
    })

    const csvContent = csvLines.join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `cosmic_datasets_export_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const totalRows = useMemo(() => {
    return datasets.reduce((sum, ds) => sum + ds.rows.length, 0)
  }, [datasets])

  return (
    <section className="space-y-6 bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-slate-900">Unified Astronomical Dataset Repository</h2>
        <div className="text-sm text-slate-600">
          {datasets.length} dataset{datasets.length !== 1 ? "s" : ""} • {totalRows} total objects
        </div>
      </div>

      {datasets.length === 0 ? (
        <Card className="p-12 border-slate-200 text-center">
          <p className="text-slate-500">No datasets uploaded yet. Upload a file to get started.</p>
        </Card>
      ) : (
        <div className="space-y-8">
          {datasets.map((dataset) => (
            <Card key={dataset.id} className="p-6 border-slate-200">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-slate-900 mb-1">
                  {dataset.name}
                </h3>
                <div className="flex items-center gap-4 text-sm text-slate-600 mt-2">
                  <span>
                    {dataset.rows.length} row{dataset.rows.length !== 1 ? "s" : ""} • {dataset.columns.length} column{dataset.columns.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-xs text-slate-500">
                    Source: {dataset.sourceFile}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(dataset.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      {dataset.columns.map((column) => (
                        <th
                          key={column.name}
                          className="text-left py-3 px-4 text-slate-900 font-semibold"
                          title={`${column.description || ""} | Type: ${column.semanticType}`}
                        >
                          <div className="flex flex-col gap-1">
                            <span>{getHeaderLabel(column)}</span>
                            <Badge variant="outline" className="text-xs w-fit">
                              {column.semanticType}
                            </Badge>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataset.rows.length === 0 ? (
                      <tr>
                        <td colSpan={dataset.columns.length} className="py-8 text-center text-slate-500">
                          No data rows
                        </td>
                      </tr>
                    ) : (
                      dataset.rows.map((row, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition">
                          {dataset.columns.map((column) => (
                            <td key={column.name} className="py-3 px-4 text-slate-600">
                              {getDisplayValue(row, column.name)}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}

          <div className="flex justify-end">
            <Button onClick={handleExport} className="gap-2">
              <Download className="w-4 h-4" />
              Export All Datasets (CSV)
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
