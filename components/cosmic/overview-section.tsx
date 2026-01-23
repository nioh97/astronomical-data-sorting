export default function OverviewSection() {
  return (
    <section className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
      <h2 className="text-3xl font-bold text-slate-900 mb-6">Platform Overview</h2>
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
    </section>
  )
}
