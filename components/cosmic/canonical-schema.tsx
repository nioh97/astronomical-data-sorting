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
    <section className="space-y-6 bg-white rounded-lg border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all duration-500 relative overflow-hidden group hover:scale-[1.01]">
      <div className="absolute inset-0 border border-transparent group-hover:border-slate-300/50 rounded-lg transition-all duration-300"></div>
      <div className="relative">
        <h2 className="text-2xl font-semibold text-slate-900 flex items-center gap-3 mb-6">
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-soft-pulse"></span>
          Canonical Astronomical Object Schema
        </h2>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left py-3 px-4 text-slate-900 font-semibold">Field Name</th>
                <th className="text-left py-3 px-4 text-slate-900 font-semibold">Description</th>
                <th className="text-left py-3 px-4 text-slate-900 font-semibold">Standard Unit / Format</th>
              </tr>
            </thead>
            <tbody>
              {schemaFields.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-all duration-200 hover:translate-x-1 group/row">
                  <td className="py-3 px-4 font-mono text-slate-800 group-hover/row:text-slate-900 transition-colors">
                    <span className="inline-block w-1.5 h-1.5 bg-slate-300 rounded-full mr-2 opacity-0 group-hover/row:opacity-100 transition-opacity"></span>
                    {row.field}
                  </td>
                  <td className="py-3 px-4 text-slate-700">{row.description}</td>
                  <td className="py-3 px-4 text-slate-600">{row.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6 hover:bg-blue-100/50 transition-colors duration-300 group/info">
        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-soft-pulse"></span>
          Why a Canonical Schema?
        </h3>
        <p className="text-slate-700 text-sm leading-relaxed">
          A canonical schema serves as the single source of truth for astronomical data. It eliminates naming
          ambiguities (e.g., "ra" vs "right_ascension"), standardizes units across all datasets, enforces consistent
          metadata, and enables deterministic data integration. Without this standard, each dataset requires custom
          transformation logic, introducing errors and making cross-agency analysis computationally expensive and
          error-prone.
        </p>
      </div>
      </div>
    </section>
  )
}
