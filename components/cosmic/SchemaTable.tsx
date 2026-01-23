"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Select, SelectItem } from "@/components/ui/select"
import { DATA_TYPES, UNITS_BY_TYPE } from "@/lib/schema-options"

interface SchemaTableProps {
  fileName: string
  fields: string[]
}

export default function SchemaTable({ fileName, fields }: SchemaTableProps) {
  const [schema, setSchema] = useState<Record<string, { type: string; unit: string }>>(
    Object.fromEntries(fields.map(f => [f, { type: "", unit: "" }]))
  )

  const handleTypeChange = (field: string, type: string) => {
    setSchema(prev => ({
      ...prev,
      [field]: { type, unit: "" },
    }))
  }

  const handleUnitChange = (field: string, unit: string) => {
    setSchema(prev => ({
      ...prev,
      [field]: { ...prev[field], unit },
    }))
  }

  return (
    <Card className="p-6 space-y-4">
      <h3 className="text-lg font-semibold">{fileName}</h3>

      <table className="w-full text-sm border">
        <thead className="bg-slate-100">
          <tr>
            <th className="border px-3 py-2 text-left">Field Name</th>
            <th className="border px-3 py-2 text-left">Type of Data</th>
            <th className="border px-3 py-2 text-left">Unit</th>
          </tr>
        </thead>
        <tbody>
          {fields.map(field => (
            <tr key={field}>
              <td className="border px-3 py-2 font-mono">{field}</td>

              <td className="border px-3 py-2">
                <select
                  className="w-full border rounded px-2 py-1"
                  value={schema[field].type}
                  onChange={e => handleTypeChange(field, e.target.value)}
                >
                  <option value="">Select type</option>
                  {DATA_TYPES.map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </td>

              <td className="border px-3 py-2">
                <select
                  className="w-full border rounded px-2 py-1"
                  value={schema[field].unit}
                  disabled={!schema[field].type || UNITS_BY_TYPE[schema[field].type].length === 0}
                  onChange={e => handleUnitChange(field, e.target.value)}
                >
                  <option value="">Select unit</option>
                  {(UNITS_BY_TYPE[schema[field].type] || []).map(unit => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
