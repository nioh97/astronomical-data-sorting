"use client"

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
import ProtectedRoute from "@/components/auth/protected-route"

export default function AppPage() {
  return (
    <ProtectedRoute>
      <DataProvider>
        <main className="min-h-screen bg-slate-50 text-slate-900">
          <Header />
          <div className="container mx-auto px-4 py-12 space-y-16 max-w-7xl">
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
    </ProtectedRoute>
  )
}


