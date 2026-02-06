"use client"

import * as React from "react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"

// Section metadata for breadcrumbs
const sectionMeta: Record<string, { title: string; description: string }> = {
  home: {
    title: "Home",
    description: "Platform overview and quick actions",
  },
  upload: {
    title: "Upload Data",
    description: "Import astronomical datasets",
  },
  repository: {
    title: "Data Repository",
    description: "Browse and manage unified datasets",
  },
  visualization: {
    title: "Visualization",
    description: "Charts and data analysis",
  },
  "ai-discovery": {
    title: "AI-Assisted Discovery",
    description: "Statistical insights and predictions",
  },
  "university-observatory": {
    title: "University Live Observatory",
    description: "Simulated institutional observatory telemetry feed",
  },
}

interface DashboardLayoutProps {
  children: React.ReactNode
  activeSection: string
  onSectionChange: (section: string) => void
}

export function DashboardLayout({
  children,
  activeSection,
  onSectionChange,
}: DashboardLayoutProps) {
  const meta = sectionMeta[activeSection] || sectionMeta.home

  return (
    <SidebarProvider>
      <AppSidebar activeSection={activeSection} onSectionChange={onSectionChange} />
      <SidebarInset>
        {/* Header with breadcrumb */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/40 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="text-sm font-medium">
                  {meta.title}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <span className="ml-2 text-xs text-muted-foreground hidden sm:inline">
            {meta.description}
          </span>
        </header>
        
        {/* Main content area - scrollable */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
