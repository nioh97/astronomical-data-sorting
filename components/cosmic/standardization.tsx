export default function StandardizationSection() {
  return (
    <section className="space-y-6 bg-white rounded-lg border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all duration-500 relative overflow-hidden group hover:scale-[1.01]">
      <div className="absolute inset-0 border border-transparent group-hover:border-slate-300/50 rounded-lg transition-all duration-300"></div>
      <div className="relative">
        <h2 className="text-2xl font-semibold text-slate-900 flex items-center gap-3 mb-6">
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-soft-pulse"></span>
          Standardization & Harmonization
        </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Before */}
        <div>
          <h3 className="text-lg font-semibold text-red-700 mb-4">Before Standardization</h3>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 overflow-x-auto hover:bg-red-100/50 transition-colors duration-300">
            <div className="space-y-2">
              <div className="text-xs text-slate-600 uppercase tracking-wide font-medium flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-soft-pulse"></span>
                Dataset A (NASA)
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-red-200">
                    <th className="text-left py-2 px-2 text-red-800 font-semibold">RA</th>
                    <th className="text-left py-2 px-2 text-red-800 font-semibold">DEC</th>
                    <th className="text-left py-2 px-2 text-red-800 font-semibold">MAG</th>
                    <th className="text-left py-2 px-2 text-red-800 font-semibold">DIST</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-red-100">
                    <td className="py-2 px-2 text-slate-700">245.5°</td>
                    <td className="py-2 px-2 text-slate-700">-45.2°</td>
                    <td className="py-2 px-2 text-slate-700">8.3</td>
                    <td className="py-2 px-2 text-slate-700">2.1 AU</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-4 border-t border-red-200">
              <div className="text-xs text-slate-600 uppercase tracking-wide font-medium mb-2">Dataset B (ESA)</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-red-200">
                    <th className="text-left py-2 px-2 text-red-800 font-semibold">right_ascension</th>
                    <th className="text-left py-2 px-2 text-red-800 font-semibold">declination</th>
                    <th className="text-left py-2 px-2 text-red-800 font-semibold">brightness</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-red-100">
                    <td className="py-2 px-2 text-slate-700">4.284 rad</td>
                    <td className="py-2 px-2 text-slate-700">-0.789 rad</td>
                    <td className="py-2 px-2 text-slate-700">8.3 mV</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded text-xs text-red-800">
            ⚠ Incompatible: Different field names, units, coordinate formats
          </div>
        </div>

        {/* After */}
        <div>
          <h3 className="text-lg font-semibold text-green-700 mb-4">After Standardization</h3>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 overflow-x-auto hover:bg-green-100/50 transition-colors duration-300">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-green-200">
                  <th className="text-left py-2 px-2 text-green-800 font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-soft-pulse"></span>
                      right_ascension_deg
                    </span>
                  </th>
                  <th className="text-left py-2 px-2 text-green-800 font-semibold">declination_deg</th>
                  <th className="text-left py-2 px-2 text-green-800 font-semibold">brightness</th>
                  <th className="text-left py-2 px-2 text-green-800 font-semibold">distance_km</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-green-100">
                  <td className="py-2 px-2 text-slate-800">245.5</td>
                  <td className="py-2 px-2 text-slate-800">-45.2</td>
                  <td className="py-2 px-2 text-slate-800">8.3</td>
                  <td className="py-2 px-2 text-slate-800">314,568,000</td>
                </tr>
                <tr>
                  <td className="py-2 px-2 text-slate-800">245.505</td>
                  <td className="py-2 px-2 text-slate-800">-45.201</td>
                  <td className="py-2 px-2 text-slate-800">8.3</td>
                  <td className="py-2 px-2 text-slate-800">314,570,000</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded text-xs text-green-800 hover:bg-green-200 transition-colors duration-300">
            ✓ Unified: Standardized fields, normalized units, consistent format
          </div>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 hover:bg-slate-100/50 transition-colors duration-300">
        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-soft-pulse"></span>
          Transformation Process
        </h3>
        <ul className="space-y-2 text-sm text-slate-700">
          <li className="flex gap-3 hover:translate-x-1 transition-transform duration-200 group/item">
            <span className="text-blue-600 font-bold animate-soft-pulse">•</span>
            <span>
              <strong>Metadata Harmonization:</strong> Field mapping, semantic alignment, validation rules
            </span>
          </li>
          <li className="flex gap-3 hover:translate-x-1 transition-transform duration-200 group/item stagger-1">
            <span className="text-blue-600 font-bold animate-soft-pulse stagger-1">•</span>
            <span>
              <strong>Unit Conversion:</strong> AU → km, radians → degrees, timestamp normalization
            </span>
          </li>
          <li className="flex gap-3 hover:translate-x-1 transition-transform duration-200 group/item stagger-2">
            <span className="text-blue-600 font-bold animate-soft-pulse stagger-2">•</span>
            <span>
              <strong>Coordinate Normalization:</strong> All coordinates mapped to standard WCS (World Coordinate
              System)
            </span>
          </li>
          <li className="flex gap-3 hover:translate-x-1 transition-transform duration-200 group/item stagger-3">
            <span className="text-blue-600 font-bold animate-soft-pulse stagger-3">•</span>
            <span>
              <strong>Quality Assurance:</strong> Range validation, null handling, outlier detection
            </span>
          </li>
        </ul>
      </div>
      </div>
    </section>
  )
}
