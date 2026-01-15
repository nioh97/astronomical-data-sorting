import { FileCode } from "lucide-react"

export default function CanonicalSchemaSection() {
  const schemaFields = [
    { field: "object_id", description: "Unique identifier for astronomical object", unit: "UUID / String" },
    { field: "object_type", description: "Classification (star, galaxy, quasar, etc.)", unit: "Categorical" },
    { field: "right_ascension_deg", description: "Right ascension coordinate", unit: "Degrees (0-360)" },
    { field: "declination_deg", description: "Declination coordinate", unit: "Degrees (-90 to +90)" },
    { field: "distance_km", description: "Distance from Earth", unit: "Kilometers" },
    { field: "brightness", description: "Apparent magnitude or luminosity", unit: "Magnitude (mV)" },
    { field: "observation_time", description: "Timestamp of observation", unit: "ISO 8601 / UTC" },
    { field: "source_agency", description: "Originating space agency", unit: "Categorical" },
  ]

  return (
    <section className="space-y-8 bg-white rounded-xl border border-slate-200 p-10 shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="flex items-center gap-3">
        <FileCode className="w-6 h-6 text-slate-600" strokeWidth={1.5} />
        <h2 className="text-3xl font-bold text-slate-900 section-header-underline">Canonical Astronomical Object Schema</h2>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
                <th className="text-left py-4 px-4 text-slate-900 font-semibold">Field Name</th>
                <th className="text-left py-4 px-4 text-slate-900 font-semibold">Description</th>
                <th className="text-left py-4 px-4 text-slate-900 font-semibold">Standard Unit / Format</th>
              </tr>
            </thead>
            <tbody>
              {schemaFields.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-100 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/50 transition-colors duration-150">
                  <td className="py-3 px-4 font-mono text-slate-800 font-medium">{row.field}</td>
                  <td className="py-3 px-4 text-slate-700">{row.description}</td>
                  <td className="py-3 px-4 text-slate-600">{row.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-3">Why a Canonical Schema?</h3>
        <p className="text-slate-700 text-sm leading-relaxed">
          A canonical schema serves as the single source of truth for astronomical data. It eliminates naming
          ambiguities (e.g., "ra" vs "right_ascension"), standardizes units across all datasets, enforces consistent
          metadata, and enables deterministic data integration. Without this standard, each dataset requires custom
          transformation logic, introducing errors and making cross-agency analysis computationally expensive and
          error-prone.
        </p>
      </div>
    </section>
  )
}
