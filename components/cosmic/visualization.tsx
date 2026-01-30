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
import { useDataContext } from "@/lib/data-context"

/**
 * Custom tooltip for scatter plot
 */
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-slate-900 mb-2">
          {data.object_id ? `Object: ${data.object_id}` : "Object"}
        </p>
        <p className="text-sm text-slate-700">
          <span className="font-medium">Distance:</span>{" "}
          {data.distance !== null && data.distance !== undefined
            ? `${data.distance.toExponential(2)} km`
            : "—"}
        </p>
        <p className="text-sm text-slate-700">
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

  // Aggregate and filter data from all datasets
  const distanceBrightnessData = useMemo(() => {
    const allData: Array<{
      distance: number
      brightness: number
      object_id?: string
    }> = []

    // Aggregate data from all datasets
    datasets.forEach((dataset) => {
      dataset.rows.forEach((row) => {
        // Only include rows where BOTH distance and brightness are valid
        // Look for distance in various canonical names
        const distance = row.distance_km || row.distance || row.dist
        const brightness = row.brightness || row.magnitude || row.mag

        // Check for valid values (not null, undefined, NaN, or zero for distance)
        if (
          distance !== null &&
          distance !== undefined &&
          !isNaN(distance) &&
          distance > 0 &&
          brightness !== null &&
          brightness !== undefined &&
          !isNaN(brightness) &&
          brightness !== 0
        ) {
          allData.push({
            distance,
            brightness,
            object_id: row.object_id || row.id || row.name || undefined,
          })
        }
      })
    })

    return allData
  }, [datasets])

  // Agency count data (for bar chart)
  const agencyCountData = useMemo(() => {
    const agencyMap = new Map<string, number>()

    datasets.forEach((dataset) => {
      dataset.rows.forEach((row) => {
        const source = dataset.sourceFile || dataset.name || "Unknown"
        agencyMap.set(source, (agencyMap.get(source) || 0) + 1)
      })
    })

    return Array.from(agencyMap.entries()).map(([agency, count]) => ({
      agency,
      count,
    }))
  }, [datasets])

  return (
    <section className="space-y-6 bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
      <h2 className="text-2xl font-semibold text-slate-900">Data Visualization & Analysis</h2>

      <div className="text-sm text-slate-700 bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        These visualizations demonstrate the power of unified data fusion: cross-agency comparison is now possible
        because all data is standardized and harmonized.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scatter Chart - Distance vs Brightness */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Distance vs Brightness</h3>
          {distanceBrightnessData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-slate-500">
              <p>Not enough data to plot Distance vs Brightness</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.3)" />
                <XAxis
                  dataKey="distance"
                  type="number"
                  scale="log"
                  domain={["auto", "auto"]}
                  stroke="#64748b"
                  tickFormatter={formatLogTick}
                  label={{
                    value: "Distance (km)",
                    position: "insideBottom",
                    offset: -10,
                    fill: "#64748b",
                    style: { textAnchor: "middle" },
                  }}
                />
                <YAxis
                  dataKey="brightness"
                  type="number"
                  domain={["auto", "auto"]}
                  reversed
                  stroke="#64748b"
                  label={{
                    value: "Apparent Magnitude",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#64748b",
                  }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3" }} />
                <Scatter name="Objects" data={distanceBrightnessData} fill="#3b82f6" />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bar Chart */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Objects per Source Agency</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={agencyCountData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.3)" />
              <XAxis dataKey="agency" stroke="#64748b" />
              <YAxis stroke="#64748b" label={{ value: "Count", angle: -90, position: "insideLeft", fill: "#64748b" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  color: "#1e293b",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}
