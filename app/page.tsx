import Header from "@/components/cosmic/header"
import OverviewSection from "@/components/cosmic/overview-section"
import CanonicalSchemaSection from "@/components/cosmic/canonical-schema"
import DataIngestionSection from "@/components/cosmic/data-ingestion"
import StandardizationSection from "@/components/cosmic/standardization"
import UnifiedRepositorySection from "@/components/cosmic/unified-repository"
import VisualizationSection from "@/components/cosmic/visualization"
import InsightsSection from "@/components/cosmic/insights"
import Footer from "@/components/cosmic/footer"
import Starfield from "@/components/cosmic/starfield"
import SectionReveal from "@/components/cosmic/section-reveal"
import { DataProvider } from "@/lib/data-context"

export default function Home() {
  return (
    <DataProvider>
      <main className="min-h-screen bg-slate-50 text-slate-900 relative overflow-hidden">
        <Starfield />
        <Header />
        <div className="container mx-auto px-4 py-12 space-y-16 max-w-7xl relative z-10">
          <SectionReveal>
            <OverviewSection />
          </SectionReveal>
          <SectionReveal delay={100}>
            <CanonicalSchemaSection />
          </SectionReveal>
          <SectionReveal delay={200}>
            <DataIngestionSection />
          </SectionReveal>
          <SectionReveal delay={300}>
            <StandardizationSection />
          </SectionReveal>
          <SectionReveal delay={400}>
            <UnifiedRepositorySection />
          </SectionReveal>
          <SectionReveal delay={500}>
            <VisualizationSection />
          </SectionReveal>
          <SectionReveal delay={600}>
            <InsightsSection />
          </SectionReveal>
        </div>
        <Footer />
      </main>
    </DataProvider>
  )
}
