import Header from "@/components/cosmic/header"
import OverviewSection from "@/components/cosmic/overview-section"
import CanonicalSchemaSection from "@/components/cosmic/canonical-schema"
import DataIngestionSection from "@/components/cosmic/data-ingestion"
import StandardizationSection from "@/components/cosmic/standardization"
import UnifiedRepositorySection from "@/components/cosmic/unified-repository"
import VisualizationSection from "@/components/cosmic/visualization"
import InsightsSection from "@/components/cosmic/insights"
import Footer from "@/components/cosmic/footer"
import { DataProvider } from "@/lib/data-context"

export default function Home() {
  return (
    <DataProvider>
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <Header />
        <div className="container mx-auto px-4 py-16 space-y-20 max-w-7xl">
          <OverviewSection />
          <CanonicalSchemaSection />
          <DataIngestionSection />
          <StandardizationSection />
          <UnifiedRepositorySection />
          <VisualizationSection />
          <InsightsSection />
        </div>
        <Footer />
      </main>
    </DataProvider>
  )
}
