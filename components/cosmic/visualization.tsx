"use client"

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

export default function VisualizationSection() {
  const distanceBrightnessData = [
    { distance: 42560000, brightness: 5.2, name: "OBJ-004" },
    { distance: 314568000, brightness: 8.3, name: "OBJ-001" },
    { distance: 314570000, brightness: 8.3, name: "OBJ-002" },
    { distance: 1245890000, brightness: 15.7, name: "OBJ-003" },
    { distance: 89350000, brightness: 6.8, name: "OBJ-005" },
    { distance: 567800000, brightness: 12.1, name: "OBJ-006" },
    { distance: 234560000, brightness: 9.5, name: "OBJ-007" },
  ]

  const agencyCountData = [
    { agency: "NASA", count: 4 },
    { agency: "ESA", count: 3 },
    { agency: "JAXA", count: 1 },
  ]

  return (
    <section className="space-y-6 bg-white rounded-lg border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all duration-500 relative overflow-hidden group hover:scale-[1.01]">
      <div className="absolute inset-0 border border-transparent group-hover:border-slate-300/50 rounded-lg transition-all duration-300"></div>
      <div className="relative">
        <h2 className="text-2xl font-semibold text-slate-900 flex items-center gap-3 mb-6">
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-soft-pulse"></span>
          Data Visualization & Analysis
        </h2>

      <div className="text-sm text-slate-700 bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 hover:bg-blue-100/50 transition-colors duration-300">
        These visualizations demonstrate the power of unified data fusion: cross-agency comparison is now possible
        because all data is standardized and harmonized.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scatter Chart */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300 group/chart">
          <div className="absolute inset-0 border border-transparent group-hover/chart:border-slate-300/50 rounded-lg transition-all duration-300"></div>
          <div className="relative">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-soft-pulse"></span>
              Distance vs Brightness
            </h3>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.3)" />
              <XAxis
                dataKey="distance"
                stroke="#64748b"
                type="number"
                label={{ value: "Distance (km)", position: "insideBottomRight", offset: -10, fill: "#64748b" }}
              />
              <YAxis
                stroke="#64748b"
                label={{ value: "Brightness (mV)", angle: -90, position: "insideLeft", fill: "#64748b" }}
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  color: "#1e293b",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
              />
              <Scatter name="Objects" data={distanceBrightnessData} fill="#3b82f6" />
            </ScatterChart>
          </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300 group/chart">
          <div className="absolute inset-0 border border-transparent group-hover/chart:border-slate-300/50 rounded-lg transition-all duration-300"></div>
          <div className="relative">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-soft-pulse stagger-1"></span>
              Objects per Source Agency
            </h3>
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
      </div>
      </div>
    </section>
  )
}
