"use client"

/**
 * UX4G canonical layout: Top Status Bar | Stage Navigator + Active Stage Panel | Evidence Drawer
 */

import Header from "@/components/cosmic/header"
import OverviewSection from "@/components/cosmic/overview-section"
import CanonicalSchemaSection from "@/components/cosmic/canonical-schema"
import DataIngestionSection from "@/components/cosmic/data-ingestion"
import StandardizationSection from "@/components/cosmic/standardization"
import UnifiedRepositorySection from "@/components/cosmic/unified-repository"
import VisualizationSection from "@/components/cosmic/visualization"
import InsightsSection from "@/components/cosmic/insights"
import Footer from "@/components/cosmic/footer"
import TopStatusBar from "@/components/cosmic/ux4g/top-status-bar"
import StageNavigator from "@/components/cosmic/ux4g/stage-navigator"
import EvidenceDrawer from "@/components/cosmic/ux4g/evidence-drawer"
import { DataProvider } from "@/lib/data-context"
import { FilterProvider } from "@/lib/filters/filter-context"
import { AppUIProvider } from "@/lib/app-ui-context"
import ProtectedRoute from "@/components/auth/protected-route"

export default function AppPage() {
  return (
    <ProtectedRoute>
      <DataProvider>
        <FilterProvider>
          <AppUIProvider>
            <main className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
              <div className="sticky top-0 z-40 bg-slate-50 shrink-0">
                <Header />
                <TopStatusBar />
              </div>
              <div className="flex flex-1 min-h-0">
                <StageNavigator />
                <div className="flex-1 overflow-auto">
                  <div className="container mx-auto px-4 py-8 space-y-12 max-w-5xl">
                    <OverviewSection />
                    <CanonicalSchemaSection />
                    <DataIngestionSection />
                    <StandardizationSection />
                    <UnifiedRepositorySection />
                    <VisualizationSection />
                    <InsightsSection />
                  </div>
                </div>
              </div>
              <EvidenceDrawer />
              <Footer />
            </main>
          </AppUIProvider>
        </FilterProvider>
      </DataProvider>
    </ProtectedRoute>
  )
}
