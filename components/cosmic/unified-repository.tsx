"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Download } from "lucide-react"
import { useDataContext, Dataset } from "@/lib/data-context"
import { StandardizedData } from "@/lib/standardization"

export default function UnifiedRepositorySection() {
  const { datasets } = useDataContext()

  // DEBUG: Verify datasets
  console.log("Datasets in repository:", datasets)
  console.log("Dataset count:", datasets.length)

  /**
   * Get display value for a field with proper formatting
   */
  const getDisplayValue = (row: StandardizedData, fieldName: string): string => {
    switch (fieldName) {
      case "object_id":
        return row.object_id || "—"
      case "object_type":
        return row.object_type || "—"
      case "right_ascension_deg":
        return row.right_ascension_deg !== null && row.right_ascension_deg !== undefined
          ? row.right_ascension_deg.toFixed(2)
          : "—"
      case "declination_deg":
        return row.declination_deg !== null && row.declination_deg !== undefined
          ? row.declination_deg.toFixed(2)
          : "—"
      case "distance_km":
        return row.distance_km !== null && row.distance_km !== undefined && row.distance_km > 0
          ? row.distance_km.toLocaleString()
          : "—"
      case "brightness":
        return row.brightness !== null && row.brightness !== undefined && row.brightness !== 0
          ? row.brightness.toFixed(1)
          : "—"
      case "observation_time":
        return row.observation_time || "—"
      case "source":
        return row.source || "Unknown"
      default:
        return "—"
    }
  }

  /**
   * Get header label with unit
   */
  const getHeaderLabel = (fieldName: string, unit: string): string => {
    const labels: Record<string, string> = {
      object_id: "Object ID",
      object_type: "Type",
      right_ascension_deg: "RA",
      declination_deg: "Dec",
      distance_km: "Distance",
      brightness: "Brightness",
      observation_time: "Observation Time",
      source: "Source",
    }
    const baseLabel = labels[fieldName] || fieldName
    if (unit && unit !== "none" && unit !== "") {
      return `${baseLabel} (${unit})`
    }
    return baseLabel
  }

  /**
   * Export all datasets to CSV
   */
  const handleExport = () => {
    const csvLines: string[] = []

    datasets.forEach((dataset) => {
      // Add dataset header
      csvLines.push(`Dataset: ${dataset.source}`)
      csvLines.push(`Schema: ${dataset.schemaKey}`)
      csvLines.push("")

      // Add column headers
      const headers = dataset.fields.map((f) => getHeaderLabel(f.name, f.unit))
      csvLines.push(headers.join(","))

      // Add rows
      dataset.rows.forEach((row) => {
        const values = dataset.fields.map((f) => getDisplayValue(row, f.name))
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
                  Source: {dataset.source}
                </h3>
                <p className="text-xs text-slate-500 font-mono">Schema: {dataset.schemaKey}</p>
                <p className="text-sm text-slate-600 mt-2">
                  {dataset.rows.length} object{dataset.rows.length !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      {dataset.fields.map((field) => (
                        <th
                          key={field.name}
                          className="text-left py-3 px-4 text-slate-900 font-semibold"
                        >
                          {getHeaderLabel(field.name, field.unit)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataset.rows.length === 0 ? (
                      <tr>
                        <td colSpan={dataset.fields.length} className="py-8 text-center text-slate-500">
                          No data rows
                        </td>
                      </tr>
                    ) : (
                      dataset.rows.map((row, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition">
                          {dataset.fields.map((field) => (
                            <td key={field.name} className="py-3 px-4 text-slate-600">
                              {field.name === "object_id" ? (
                                <span className="font-mono text-slate-800">
                                  {getDisplayValue(row, field.name)}
                                </span>
                              ) : field.name === "source" ? (
                                <span
                                  className={`px-2 py-1 rounded text-xs font-semibold ${
                                    getDisplayValue(row, field.name) === "NASA"
                                      ? "bg-orange-100 text-orange-800"
                                      : getDisplayValue(row, field.name) === "ESA"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-purple-100 text-purple-800"
                                  }`}
                                >
                                  {getDisplayValue(row, field.name)}
                                </span>
                              ) : (
                                getDisplayValue(row, field.name)
                              )}
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
