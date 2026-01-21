"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Download, Search } from "lucide-react"
import { useDataContext } from "@/lib/data-context"
import { StandardizedData } from "@/lib/standardization"

interface UnifiedData {
  object_id: string
  object_type: string
  ra: number
  dec: number
  distance: number
  brightness: number
  observation_time: string
  source: string
}

export default function UnifiedRepositorySection() {
  const { unifiedData: contextData } = useDataContext()
  const [selectedAgency, setSelectedAgency] = useState<string>("All")
  const [selectedType, setSelectedType] = useState<string>("All")
  const [searchQuery, setSearchQuery] = useState<string>("")

  // Convert StandardizedData to UnifiedData format for display
  const unifiedData: UnifiedData[] = useMemo(() => {
    return contextData.map((data) => ({
      object_id: data.object_id,
      object_type: data.object_type,
      ra: data.right_ascension_deg,
      dec: data.declination_deg,
      distance: data.distance_km,
      brightness: data.brightness,
      observation_time: data.observation_time,
      source: data.source,
    }))
  }, [contextData])

  const filteredData = useMemo(() => {
    return unifiedData.filter((row) => {
      const matchesAgency = selectedAgency === "All" || row.source === selectedAgency
      const matchesType = selectedType === "All" || row.object_type === selectedType
      const matchesSearch =
        searchQuery === "" ||
        row.object_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.object_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.source.toLowerCase().includes(searchQuery.toLowerCase())

      return matchesAgency && matchesType && matchesSearch
    })
  }, [selectedAgency, selectedType, searchQuery])

  const handleExport = () => {
    const csvContent = [
      ["Object ID", "Type", "RA (°)", "Dec (°)", "Distance (km)", "Brightness", "Source", "Observation Time"],
      ...filteredData.map((row) => [
        row.object_id,
        row.object_type,
        row.ra.toFixed(2),
        row.dec.toFixed(2),
        row.distance.toLocaleString(),
        row.brightness.toFixed(1),
        row.source,
        row.observation_time,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `cosmic_data_export_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Get unique agencies and types from the data
  const agencyOptions = useMemo(() => {
    const agencies = new Set(unifiedData.map((d) => d.source))
    return ["All", ...Array.from(agencies).sort()]
  }, [unifiedData])

  const typeOptions = useMemo(() => {
    const types = new Set(unifiedData.map((d) => d.object_type))
    return ["All", ...Array.from(types).sort()]
  }, [unifiedData])

  return (
    <section className="space-y-6 bg-white rounded-lg border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all duration-500 relative overflow-hidden group hover:scale-[1.01]">
      <div className="absolute inset-0 border border-transparent group-hover:border-slate-300/50 rounded-lg transition-all duration-300"></div>
      <div className="relative">
        <h2 className="text-2xl font-semibold text-slate-900 flex items-center gap-3 mb-6">
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-soft-pulse"></span>
          Unified Astronomical Dataset Repository
        </h2>

      <Card className="p-6 border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="text-sm text-slate-700 font-medium block mb-2">Filter by Agency</label>
            <Select value={selectedAgency} onValueChange={setSelectedAgency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {agencyOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-slate-700 font-medium block mb-2">Filter by Object Type</label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-slate-700 font-medium block mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 animate-float-gentle" />
              <Input
                type="text"
                placeholder="Search objects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <div className="mb-4 text-sm text-slate-600">
          Showing {filteredData.length} of {unifiedData.length} objects
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left py-3 px-4 text-slate-900 font-semibold">Object ID</th>
                <th className="text-left py-3 px-4 text-slate-900 font-semibold">Type</th>
                <th className="text-left py-3 px-4 text-slate-900 font-semibold">RA (°)</th>
                <th className="text-left py-3 px-4 text-slate-900 font-semibold">Dec (°)</th>
                <th className="text-left py-3 px-4 text-slate-900 font-semibold">Distance (km)</th>
                <th className="text-left py-3 px-4 text-slate-900 font-semibold">Brightness</th>
                <th className="text-left py-3 px-4 text-slate-900 font-semibold">Source</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No objects found matching your filters
                  </td>
                </tr>
              ) : (
                filteredData.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-all duration-200 hover:translate-x-1 group/row">
                    <td className="py-3 px-4 font-mono text-slate-800 group-hover/row:text-slate-900 transition-colors">
                      <span className="inline-block w-1.5 h-1.5 bg-slate-300 rounded-full mr-2 opacity-0 group-hover/row:opacity-100 transition-opacity"></span>
                      {row.object_id}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{row.object_type}</td>
                    <td className="py-3 px-4 text-slate-600">{row.ra.toFixed(2)}</td>
                    <td className="py-3 px-4 text-slate-600">{row.dec.toFixed(2)}</td>
                    <td className="py-3 px-4 text-slate-600">{row.distance.toLocaleString()}</td>
                    <td className="py-3 px-4 text-slate-600">{row.brightness.toFixed(1)}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          row.source === "NASA"
                            ? "bg-orange-100 text-orange-800"
                            : row.source === "ESA"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {row.source}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={handleExport} className="gap-2 hover:scale-[1.02] transition-transform duration-200">
            <Download className="w-4 h-4 animate-float-gentle" />
            Export Dataset (CSV)
          </Button>
        </div>
      </Card>
      </div>
    </section>
  )
}
