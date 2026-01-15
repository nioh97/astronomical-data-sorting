import { Globe } from "lucide-react"

export default function OverviewSection() {
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-10 shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="flex items-center gap-3 mb-8">
        <Globe className="w-6 h-6 text-slate-600" strokeWidth={1.5} />
        <h2 className="text-3xl font-bold text-slate-900 section-header-underline">Platform Overview</h2>
      </div>
      <div className="prose prose-slate max-w-none">
        <p className="text-slate-700 leading-relaxed text-lg mb-6 mt-4">
          COSMIC Data Fusion is a cloud-enabled platform designed to unify astronomical datasets from multiple space agencies and observatories. 
          The system addresses the critical challenge of data fragmentation by providing automated ingestion, standardization, and harmonization 
          of heterogeneous astronomical data.
        </p>
        <p className="text-slate-700 leading-relaxed text-lg">
          Our platform enables researchers to seamlessly combine, compare, and analyze datasets from NASA, ESA, JAXA, and other sources 
          without extensive manual preprocessing, accelerating research outcomes and enabling collaborative AI-driven discoveries.
        </p>
      </div>
    </section>
  )
}
