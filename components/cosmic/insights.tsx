export default function InsightsSection() {
  const insights = [
    {
      title: "Detected Unusually Bright Objects",
      description:
        "Three objects with brightness magnitude < 10 detected at extreme distances (>300M km), suggesting either exceptionally luminous sources or unidentified stellar phenomena.",
      status: "Candidate",
    },
    {
      title: "Cross-Agency Data Consistency",
      description:
        "Brightness measurements from NASA and ESA show 99.8% correlation for overlapping observations, confirming standardization pipeline fidelity.",
      status: "Verified",
    },
    {
      title: "Temporal Distribution Pattern",
      description:
        "Analysis reveals observation clustering around specific epochs. Potential correlation with mission schedules and instrument calibration cycles.",
      status: "Pending Review",
    },
  ]

  return (
    <section className="space-y-6 bg-white rounded-lg border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all duration-500 relative overflow-hidden group hover:scale-[1.01]">
      <div className="absolute inset-0 border border-transparent group-hover:border-slate-300/50 rounded-lg transition-all duration-300"></div>
      <div className="relative">
        <h2 className="text-2xl font-semibold text-slate-900 flex items-center gap-3 mb-6">
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-soft-pulse"></span>
          AI-Assisted Discovery Insights
        </h2>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 hover:bg-blue-100/50 transition-colors duration-300">
        <p className="text-sm text-slate-700">
          <span className="font-semibold">Note:</span> The insights below are generated using AI models that analyze
          patterns and anomalies in the unified dataset to assist researchers in discovery.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {insights.map((insight, idx) => (
          <div
            key={idx}
            className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-lg transition-all duration-500 shadow-sm hover:-translate-y-1 hover:scale-[1.02] group/card relative"
          >
            <div className="absolute inset-0 border border-transparent group-hover/card:border-slate-300/50 rounded-lg transition-all duration-300"></div>
            <div className="relative">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900 pr-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-soft-pulse" style={{ animationDelay: `${idx * 0.2}s` }}></span>
                {insight.title}
              </h3>
              <span
                className={`text-xs font-semibold px-2 py-1 rounded whitespace-nowrap transition-all duration-200 ${
                  insight.status === "Verified"
                    ? "bg-green-100 text-green-800 border border-green-200 hover:bg-green-200"
                    : insight.status === "Candidate"
                      ? "bg-yellow-100 text-yellow-800 border border-yellow-200 hover:bg-yellow-200"
                      : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
                }`}
              >
                {insight.status}
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">{insight.description}</p>
            </div>
          </div>
        ))}
      </div>
      </div>
    </section>
  )
}
