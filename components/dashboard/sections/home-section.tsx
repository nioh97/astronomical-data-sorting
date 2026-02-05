"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Database, 
  BarChart3, 
  ArrowRight,
  FileInput,
  Ruler,
  Table2,
  LineChart,
  Sparkles,
  Telescope
} from "lucide-react"

interface HomeSectionProps {
  onNavigate: (section: string) => void
  datasetCount: number
  rowCount: number
}

export function HomeSection({ onNavigate, datasetCount, rowCount }: HomeSectionProps) {
  return (
    <div className="space-y-8">
      {/* ========================================
          HERO SECTION
          ======================================== */}
      <section className="pb-6 border-b border-zinc-800">
        <div className="flex items-center gap-3 mb-3">
          <Telescope className="h-7 w-7 text-blue-400/80" />
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-100">
            SKYSCRIBE Data Fusion
          </h1>
        </div>
        <p className="text-zinc-400 max-w-2xl leading-relaxed">
          A unified platform for astronomical data ingestion, standardization, and analysis.
          Process heterogeneous datasets from multiple space agencies into a single repository.
        </p>
      </section>

      {/* ========================================
          LIVE STATISTICS
          ======================================== */}
      <section>
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">
          Current Session
        </h2>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Datasets</CardTitle>
              <Database className="h-4 w-4 text-zinc-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-zinc-100">{datasetCount}</div>
              <p className="text-xs text-zinc-600">Loaded in repository</p>
            </CardContent>
          </Card>
          
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Records</CardTitle>
              <BarChart3 className="h-4 w-4 text-zinc-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-zinc-100">{rowCount.toLocaleString()}</div>
              <p className="text-xs text-zinc-600">Total data rows</p>
            </CardContent>
          </Card>
          
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Formats</CardTitle>
              <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-500">Active</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-zinc-100">4</div>
              <p className="text-xs text-zinc-600">CSV, JSON, XML, FITS</p>
            </CardContent>
          </Card>
          
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Inference</CardTitle>
              <Sparkles className="h-4 w-4 text-zinc-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-zinc-100">LLaMA 3.1</div>
              <p className="text-xs text-zinc-600">Local via Ollama</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ========================================
          PLATFORM CAPABILITIES
          ======================================== */}
      <section>
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">
          Platform Capabilities
        </h2>
        
        <div className="grid gap-6 md:grid-cols-2">
          {/* Data Ingestion */}
          <Card className="bg-zinc-900/30 border-zinc-800/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-blue-950/50">
                  <FileInput className="h-5 w-5 text-blue-400/70" />
                </div>
                <CardTitle className="text-base font-medium text-zinc-200">
                  Data Ingestion
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-zinc-500 space-y-2">
              <p>
                Import astronomical datasets in multiple formats including CSV, FITS, JSON, and XML.
                The platform parses file structures, detects column types, and extracts embedded metadata.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-1 text-zinc-600">
                <li>NASA, ESA, and third-party catalog support</li>
                <li>FITS header and HDU extraction</li>
                <li>Automatic encoding and delimiter detection</li>
              </ul>
            </CardContent>
          </Card>

          {/* Unit Harmonization */}
          <Card className="bg-zinc-900/30 border-zinc-800/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-violet-950/50">
                  <Ruler className="h-5 w-5 text-violet-400/70" />
                </div>
                <CardTitle className="text-base font-medium text-zinc-200">
                  Unit Harmonization
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-zinc-500 space-y-2">
              <p>
                Standardize physical units across heterogeneous sources. AI-assisted field analysis 
                identifies measurement types and recommends canonical units for conversion.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-1 text-zinc-600">
                <li>Distance: parsec, AU, light-year conversions</li>
                <li>Angle: degrees, arcminutes, radians</li>
                <li>Time: Julian date, MJD, ISO timestamps</li>
              </ul>
            </CardContent>
          </Card>

          {/* Unified Repository */}
          <Card className="bg-zinc-900/30 border-zinc-800/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-emerald-950/50">
                  <Table2 className="h-5 w-5 text-emerald-400/70" />
                </div>
                <CardTitle className="text-base font-medium text-zinc-200">
                  Unified Repository
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-zinc-500 space-y-2">
              <p>
                Access all ingested data through a clean tabular interface. Filter, sort, and 
                export standardized records ready for downstream analysis.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-1 text-zinc-600">
                <li>Metadata-aware column headers</li>
                <li>Numeric, categorical, and spatial filters</li>
                <li>CSV and JSON export with preserved units</li>
              </ul>
            </CardContent>
          </Card>

          {/* Visualization */}
          <Card className="bg-zinc-900/30 border-zinc-800/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-cyan-950/50">
                  <LineChart className="h-5 w-5 text-cyan-400/70" />
                </div>
                <CardTitle className="text-base font-medium text-zinc-200">
                  Visualization and Analysis
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-zinc-500 space-y-2">
              <p>
                Generate scientific plots from unified data. Explore relationships between 
                distance, brightness, and object distributions across sources.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-1 text-zinc-600">
                <li>Distance vs brightness scatter plots</li>
                <li>Source agency distribution charts</li>
                <li>Cross-agency comparison views</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ========================================
          AI-ASSISTED DISCOVERY
          ======================================== */}
      <section>
        <Card className="bg-zinc-900/30 border-zinc-800/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-indigo-950/50">
                <Sparkles className="h-5 w-5 text-indigo-400/70" />
              </div>
              <div>
                <CardTitle className="text-base font-medium text-zinc-200">
                  AI-Assisted Discovery
                </CardTitle>
                <p className="text-xs text-zinc-600 mt-1">Powered by local LLM inference</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-zinc-500">
            <p className="mb-3">
              Run statistical analysis on your unified datasets. The AI engine examines actual 
              data values to detect patterns, correlations, and anomalies without relying solely 
              on field names or metadata.
            </p>
            <div className="grid gap-4 md:grid-cols-3 mt-4">
              <div className="p-3 rounded-md bg-zinc-900/50 border border-zinc-800/50">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Pattern Detection</p>
                <p className="text-zinc-400 text-sm">Identify clusters, outliers, and recurring structures in multi-source data</p>
              </div>
              <div className="p-3 rounded-md bg-zinc-900/50 border border-zinc-800/50">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Correlation Analysis</p>
                <p className="text-zinc-400 text-sm">Discover relationships between physical quantities across datasets</p>
              </div>
              <div className="p-3 rounded-md bg-zinc-900/50 border border-zinc-800/50">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Predictions</p>
                <p className="text-zinc-400 text-sm">Generate data-driven insights based on observed value distributions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ========================================
          QUICK NAVIGATION
          ======================================== */}
      <section>
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">
          Get Started
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <button
            onClick={() => onNavigate("upload")}
            className="group flex items-center justify-between p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/80 transition-colors text-left"
          >
            <div>
              <p className="font-medium text-zinc-200 group-hover:text-zinc-100 transition-colors">
                Upload Data
              </p>
              <p className="text-sm text-zinc-600">
                Import astronomical datasets
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          </button>
          
          <button
            onClick={() => onNavigate("repository")}
            className="group flex items-center justify-between p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/80 transition-colors text-left"
          >
            <div>
              <p className="font-medium text-zinc-200 group-hover:text-zinc-100 transition-colors">
                View Repository
              </p>
              <p className="text-sm text-zinc-600">
                Browse and filter unified data
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          </button>
          
          <button
            onClick={() => onNavigate("ai-discovery")}
            className="group flex items-center justify-between p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/80 transition-colors text-left"
          >
            <div>
              <p className="font-medium text-zinc-200 group-hover:text-zinc-100 transition-colors">
                AI Discovery
              </p>
              <p className="text-sm text-zinc-600">
                Run statistical analysis
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          </button>
        </div>
      </section>

      {/* ========================================
          FOOTER NOTE
          ======================================== */}
      <footer className="pt-6 pb-4 border-t border-zinc-800/50">
        <p className="text-xs text-zinc-600 text-center">
          SKYSCRIBE Data Fusion is designed for scientific research. 
          Data processing occurs locally. No external data transmission.
        </p>
      </footer>
    </div>
  )
}
