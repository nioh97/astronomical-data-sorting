export default function OverviewSection() {
  return (
    <section className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all duration-500 relative overflow-hidden group hover:scale-[1.01]">
      <div className="absolute inset-0 border border-transparent group-hover:border-slate-300/50 rounded-lg transition-all duration-300"></div>
      <div className="relative">
        <h2 className="text-3xl font-bold text-slate-900 mb-6 flex items-center gap-3">
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-soft-pulse"></span>
          Platform Overview
        </h2>
        <div className="prose prose-slate max-w-none">
          <p className="text-slate-700 leading-relaxed text-lg mb-4">
            COSMIC Data Fusion is a cloud-enabled platform designed to unify astronomical datasets from multiple space agencies and observatories. 
            The system addresses the critical challenge of data fragmentation by providing automated ingestion, standardization, and harmonization 
            of heterogeneous astronomical data.
          </p>
          <p className="text-slate-700 leading-relaxed">
            Our platform enables researchers to seamlessly combine, compare, and analyze datasets from NASA, ESA, JAXA, and other sources 
            without extensive manual preprocessing, accelerating research outcomes and enabling collaborative AI-driven discoveries.
          </p>
        </div>
      </div>
    </section>
  )
}
