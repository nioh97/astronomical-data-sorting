"use client"

import { useState, useCallback } from "react"
import { DashboardLayout } from "@/components/dashboard"
import { HomeSection } from "@/components/dashboard/sections/home-section"
import DataIngestionSection from "@/components/cosmic/data-ingestion"
import UnifiedRepositorySection from "@/components/cosmic/unified-repository"
import VisualizationSection from "@/components/cosmic/visualization"
import InsightsSection from "@/components/cosmic/insights"
import { DataProvider, useDataContext } from "@/lib/data-context"
import { FilterProvider } from "@/lib/filters/filter-context"
import { AppUIProvider } from "@/lib/app-ui-context"
import ProtectedRoute from "@/components/auth/protected-route"

function DashboardContent() {
  const [activeSection, setActiveSection] = useState("home")
  const { datasets } = useDataContext()
  
  // Compute total row count from all datasets
  const totalRowCount = datasets.reduce((sum, ds) => sum + ds.rows.length, 0)
  
  const handleSectionChange = useCallback((section: string) => {
    setActiveSection(section)
  }, [])

  // Helper to determine visibility - component stays mounted but hidden
  const sectionClass = (section: string) => 
    activeSection === section ? "block" : "hidden"

  return (
    <DashboardLayout
      activeSection={activeSection}
      onSectionChange={handleSectionChange}
    >
      {/* Home section - conditionally rendered (no persistent state needed) */}
      {activeSection === "home" && (
        <HomeSection 
          onNavigate={handleSectionChange}
          datasetCount={datasets.length}
          rowCount={totalRowCount}
        />
      )}
      
      {/* Upload section - ALWAYS MOUNTED to persist upload/processing state */}
      <div className={sectionClass("upload")}>
        <div className="space-y-6">
          <DataIngestionSection />
        </div>
      </div>
      
      {/* Repository section - conditionally rendered */}
      {activeSection === "repository" && (
        <div className="space-y-6">
          <UnifiedRepositorySection />
        </div>
      )}
      
      {/* Visualization section - conditionally rendered */}
      {activeSection === "visualization" && (
        <div className="space-y-6">
          <VisualizationSection />
        </div>
      )}
      
      {/* AI Discovery section - conditionally rendered */}
      {activeSection === "ai-discovery" && (
        <div className="space-y-6">
          <InsightsSection />
        </div>
      )}
    </DashboardLayout>
  )
}

export default function AppPage() {
  return (
    <ProtectedRoute>
      <DataProvider>
        <FilterProvider>
          <AppUIProvider>
            <DashboardContent />
          </AppUIProvider>
        </FilterProvider>
      </DataProvider>
    </ProtectedRoute>
  )
}
