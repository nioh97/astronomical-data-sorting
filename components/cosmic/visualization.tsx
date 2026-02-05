"use client"

import { useMemo } from "react"
import {
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Badge } from "@/components/ui/badge"
import { useDataContext } from "@/lib/data-context"
import { useFilterContext } from "@/lib/filters/filter-context"

/**
 * Custom tooltip for scatter plot
 */
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-zinc-100 mb-2">
          {data.object_id ? `Object: ${data.object_id}` : "Object"}
        </p>
        <p className="text-sm text-zinc-300">
          <span className="font-medium">Distance:</span>{" "}
          {data.distance !== null && data.distance !== undefined
            ? `${data.distance.toExponential(2)} km`
            : "—"}
        </p>
        <p className="text-sm text-zinc-300">
          <span className="font-medium">Brightness:</span>{" "}
          {data.brightness !== null && data.brightness !== undefined
            ? `${data.brightness.toFixed(2)} mag`
            : "—"}
        </p>
      </div>
    )
  }
  return null
}

/**
 * Format tick values for logarithmic scale (scientific notation)
 */
const formatLogTick = (value: number) => {
  if (value === 0) return "0"
  return value.toExponential(0)
}

export default function VisualizationSection() {
  const { datasets } = useDataContext()
  const { getFilterResult } = useFilterContext()

  // Get filtered rows for each dataset
  const filteredDatasets = useMemo(() => {
    return datasets.map((dataset) => {
      const result = getFilterResult(dataset)
      const filteredRows = result.passingIndices.map((i) => dataset.rows[i])
      return {
        ...dataset,
        rows: filteredRows,
        isFiltered: result.filteredRows < result.totalRows,
      }
    })
  }, [datasets, getFilterResult])

  // Check if any data is filtered
  const isFiltered = useMemo(() => {
    return filteredDatasets.some((d) => d.isFiltered)
  }, [filteredDatasets])

  // Aggregate and filter data from all datasets (using filtered rows)
  const distanceBrightnessData = useMemo(() => {
    const allData: Array<{
      distance: number
      brightness: number
      object_id?: string
    }> = []

    // Aggregate data from all filtered datasets
    filteredDatasets.forEach((dataset) => {
      dataset.rows.forEach((row) => {
        // Only include rows where BOTH distance and brightness are valid
        // Look for distance in various canonical names
        const distance = row.distance_km ?? row.distance ?? row.dist ?? row.sy_dist
        const brightness = row.brightness ?? row.magnitude ?? row.mag ?? row.sy_vmag

        // Parse to number if needed
        const distNum = typeof distance === "number" ? distance : parseFloat(String(distance))
        const brightNum = typeof brightness === "number" ? brightness : parseFloat(String(brightness))

        // Check for valid values (not null, undefined, NaN, or zero for distance)
        if (
          !Number.isNaN(distNum) &&
          distNum > 0 &&
          !Number.isNaN(brightNum) &&
          brightNum !== 0
        ) {
          allData.push({
            distance: distNum,
            brightness: brightNum,
            object_id: (row.object_id ?? row.id ?? row.name ?? row.pl_name ?? row.hostname) as string | undefined,
          })
        }
      })
    })

    return allData
  }, [filteredDatasets])

  // Agency count data (for bar chart) - using filtered rows
  const agencyCountData = useMemo(() => {
    const agencyMap = new Map<string, number>()

    filteredDatasets.forEach((dataset) => {
      const count = dataset.rows.length
      const source = dataset.sourceFile || dataset.name || "Unknown"
      agencyMap.set(source, (agencyMap.get(source) || 0) + count)
    })

    return Array.from(agencyMap.entries()).map(([agency, count]) => ({
      agency,
      count,
    }))
  }, [filteredDatasets])

  return (
    <section className="space-y-6 bg-zinc-900 rounded-lg border border-zinc-700 p-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-zinc-100">Data Visualization & Analysis</h2>
        {isFiltered && (
          <Badge variant="secondary" className="bg-blue-900/30 text-blue-300 border border-blue-800">
            Showing filtered data
          </Badge>
        )}
      </div>

      <div className="text-sm text-zinc-300 bg-blue-900/20 border border-blue-800/50 rounded-lg p-4 mb-6">
        {isFiltered
          ? "Visualizations reflect your active filters. Clear filters in the Repository to see all data."
          : "These visualizations demonstrate the power of unified data fusion: cross-agency comparison is now possible because all data is standardized and harmonized."}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scatter Chart - Distance vs Brightness */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-zinc-100 mb-4">Distance vs Brightness</h3>
          {distanceBrightnessData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-zinc-500">
              <p>Not enough data to plot Distance vs Brightness</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(82, 82, 91, 0.5)" />
                <XAxis
                  dataKey="distance"
                  type="number"
                  scale="log"
                  domain={["auto", "auto"]}
                  stroke="#a1a1aa"
                  tickFormatter={formatLogTick}
                  label={{
                    value: "Distance (km)",
                    position: "insideBottom",
                    offset: -10,
                    fill: "#a1a1aa",
                    style: { textAnchor: "middle" },
                  }}
                />
                <YAxis
                  dataKey="brightness"
                  type="number"
                  domain={["auto", "auto"]}
                  reversed
                  stroke="#a1a1aa"
                  label={{
                    value: "Apparent Magnitude",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#a1a1aa",
                  }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3" }} />
                <Scatter name="Objects" data={distanceBrightnessData} fill="#60a5fa" />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bar Chart */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-zinc-100 mb-4">Objects per Source Agency</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={agencyCountData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(82, 82, 91, 0.5)" />
              <XAxis dataKey="agency" stroke="#a1a1aa" />
              <YAxis stroke="#a1a1aa" label={{ value: "Count", angle: -90, position: "insideLeft", fill: "#a1a1aa" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#27272a",
                  border: "1px solid #3f3f46",
                  borderRadius: "6px",
                  color: "#fafafa",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3)",
                }}
              />
              <Bar dataKey="count" fill="#60a5fa" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}
