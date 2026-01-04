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
    <section className="space-y-6 bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
      <h2 className="text-2xl font-semibold text-slate-900">AI-Assisted Discovery Insights</h2>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-slate-700">
          <span className="font-semibold">Note:</span> The insights below are generated using AI models that analyze
          patterns and anomalies in the unified dataset to assist researchers in discovery.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {insights.map((insight, idx) => (
          <div
            key={idx}
            className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition shadow-sm"
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900 pr-2">{insight.title}</h3>
              <span
                className={`text-xs font-semibold px-2 py-1 rounded whitespace-nowrap ${
                  insight.status === "Verified"
                    ? "bg-green-100 text-green-800 border border-green-200"
                    : insight.status === "Candidate"
                      ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
                      : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {insight.status}
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">{insight.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
