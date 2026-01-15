import { Badge } from "@/components/ui/badge"
import { Sparkles } from "lucide-react"

export default function InsightsSection() {
  const insights = [
    {
      title: "Detected Unusually Bright Objects",
      description:
        "Three objects with brightness magnitude < 10 detected at extreme distances (>300M km), suggesting either exceptionally luminous sources or unidentified stellar phenomena.",
      status: "Candidate" as const,
    },
    {
      title: "Cross-Agency Data Consistency",
      description:
        "Brightness measurements from NASA and ESA show 99.8% correlation for overlapping observations, confirming standardization pipeline fidelity.",
      status: "Verified" as const,
    },
    {
      title: "Temporal Distribution Pattern",
      description:
        "Analysis reveals observation clustering around specific epochs. Potential correlation with mission schedules and instrument calibration cycles.",
      status: "Pending Review" as const,
    },
  ]

  const getStatusBadge = (status: string) => {
    if (status === "Verified") {
      return <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200">Verified</Badge>
    }
    if (status === "Candidate") {
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">Candidate</Badge>
    }
    return <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">Pending Review</Badge>
  }

  return (
    <section className="space-y-8 bg-white rounded-xl border border-slate-200 p-10 shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="flex items-center gap-3">
        <Sparkles className="w-6 h-6 text-slate-600" strokeWidth={1.5} />
        <h2 className="text-3xl font-bold text-slate-900 section-header-underline">AI-Assisted Discovery Insights</h2>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-5">
        <p className="text-sm text-slate-700 leading-relaxed">
          <span className="font-semibold">Note:</span> The insights below are generated using AI models that analyze
          patterns and anomalies in the unified dataset to assist researchers in discovery.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {insights.map((insight, idx) => (
          <div
            key={idx}
            className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900 pr-2 leading-tight">{insight.title}</h3>
              {getStatusBadge(insight.status)}
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{insight.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
