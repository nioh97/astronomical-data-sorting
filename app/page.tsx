'use client'

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Telescope } from "lucide-react"
import LandingSpline from "@/components/landing/LandingSpline"
import BlobCursor from "@/components/landing/BlobCursor"

export default function LandingPage() {
  return (
    <div id="landing-root" className="min-h-screen bg-black text-white relative">
      {/* Single solid blob cursor with text inversion - landing page only */}
      <BlobCursor size={140} />

      {/* Navigation Bar - excluded from blend */}
      <header className="fixed top-0 left-0 right-0 z-[100] bg-black/80 backdrop-blur-sm border-b border-zinc-800/50">
        <div className="container mx-auto px-4 py-4 max-w-7xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
                <Telescope className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-zinc-100">SKYSCRIBE</h1>
                <p className="text-zinc-500 text-xs hidden sm:block">Data Fusion Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
                  Login
                </Button>
              </Link>
              <Link href="/login">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Spline 3D Hero Section - isolated from blend */}
      <section className="pt-16 spline-container">
        <LandingSpline />
      </section>

      {/* Landing Content - text inversion applies here */}
      <div className="landing-content">
        {/* Textual Hero Content - Below Spline */}
        <section className="py-20 bg-black">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-6">
              Astronomical Data Platform
            </p>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight">
              SKYSCRIBE
            </h2>
            <p className="text-xl sm:text-2xl text-zinc-400 mb-6 font-light">
              Unified Astronomical Data Fusion Platform
            </p>
            <p className="text-base text-zinc-500 mb-10 max-w-2xl mx-auto leading-relaxed">
              SKYSCRIBE is a scientific data fusion platform designed to standardize,
              analyze, and visualize fragmented astronomical datasets originating
              from multiple space agencies, missions, and observatories.
            </p>
            <Link href="/login">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white text-base px-8 py-6 rounded-lg">
                Enter Platform
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </section>

        {/* What SKYSCRIBE Does */}
        <section className="py-20 bg-zinc-950 border-t border-zinc-900/50">
          <div className="container mx-auto px-4 max-w-5xl">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-600 mb-4 text-center">
              Platform Overview
            </p>
            <h3 className="text-2xl sm:text-3xl font-semibold text-zinc-100 mb-6 text-center">
              What SKYSCRIBE Does
            </h3>
            <p className="text-zinc-500 text-center max-w-2xl mx-auto mb-12">
              A comprehensive toolkit for unifying heterogeneous astronomical data into 
              analysis-ready formats.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="p-6 border border-zinc-800/50 rounded-lg bg-zinc-900/20">
                <h4 className="text-base font-medium text-zinc-200 mb-3">Multi-Source Ingestion</h4>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Import astronomical datasets in CSV, FITS, JSON, and XML formats from NASA, ESA, 
                  and third-party catalogs.
                </p>
              </div>
              
              <div className="p-6 border border-zinc-800/50 rounded-lg bg-zinc-900/20">
                <h4 className="text-base font-medium text-zinc-200 mb-3">Field Recognition</h4>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Automatic detection of column types, physical quantities, and measurement units 
                  across heterogeneous schemas.
                </p>
              </div>
              
              <div className="p-6 border border-zinc-800/50 rounded-lg bg-zinc-900/20">
                <h4 className="text-base font-medium text-zinc-200 mb-3">Unit Standardization</h4>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Normalize physical units to canonical forms for cross-agency compatibility. 
                  Supports SI, CGS, and astronomical conventions.
                </p>
              </div>
              
              <div className="p-6 border border-zinc-800/50 rounded-lg bg-zinc-900/20">
                <h4 className="text-base font-medium text-zinc-200 mb-3">Unified Repository</h4>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Store standardized data in an in-memory repository with schema awareness, 
                  ready for filtering and analysis.
                </p>
              </div>
              
              <div className="p-6 border border-zinc-800/50 rounded-lg bg-zinc-900/20">
                <h4 className="text-base font-medium text-zinc-200 mb-3">Visual Exploration</h4>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Generate scientific plots for distance-brightness relationships, object 
                  distributions, and cross-source comparisons.
                </p>
              </div>
              
              <div className="p-6 border border-zinc-800/50 rounded-lg bg-zinc-900/20">
                <h4 className="text-base font-medium text-zinc-200 mb-3">AI-Assisted Discovery</h4>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Local LLM inference for pattern detection, correlation analysis, and 
                  anomaly identification in numerical data.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Data Ingestion & Standardization */}
        <section className="py-20 bg-black border-t border-zinc-900/50">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="grid md:grid-cols-2 gap-12 items-start">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-600 mb-4">
                  Core Capability
                </p>
                <h3 className="text-2xl font-semibold text-zinc-100 mb-6">
                  Data Ingestion & Standardization
                </h3>
                <p className="text-zinc-400 mb-6 leading-relaxed">
                  SKYSCRIBE handles the complexity of heterogeneous astronomical data formats, 
                  allowing researchers to focus on analysis rather than preprocessing.
                </p>
                <ul className="space-y-4 text-sm text-zinc-500">
                  <li className="flex items-start gap-3">
                    <span className="w-1 h-1 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                    <span>Automatic schema detection and field type inference</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1 h-1 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                    <span>Unit normalization across distance, angle, time, and flux quantities</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1 h-1 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                    <span>Metadata preservation including source provenance and observation context</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1 h-1 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                    <span>Coordinate system awareness for RA/Dec and galactic coordinates</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1 h-1 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                    <span>FITS header and HDU extraction for binary table data</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-zinc-900/30 rounded-lg p-6 border border-zinc-800/50">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-600 mb-4">
                  Supported Conversions
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
                    <span className="text-zinc-500 text-sm">Distance</span>
                    <span className="text-zinc-400 text-sm">pc, AU, ly, kpc, Mpc</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
                    <span className="text-zinc-500 text-sm">Angle</span>
                    <span className="text-zinc-400 text-sm">deg, arcmin, arcsec, rad</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
                    <span className="text-zinc-500 text-sm">Time</span>
                    <span className="text-zinc-400 text-sm">JD, MJD, ISO, Unix</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
                    <span className="text-zinc-500 text-sm">Flux</span>
                    <span className="text-zinc-400 text-sm">Jy, mJy, W/m², erg/s/cm²</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-zinc-500 text-sm">Magnitude</span>
                    <span className="text-zinc-400 text-sm">AB, Vega, apparent, absolute</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 bg-zinc-950 border-t border-zinc-900/50">
          <div className="container mx-auto px-4 max-w-5xl">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-600 mb-4 text-center">
              Workflow
            </p>
            <h3 className="text-2xl sm:text-3xl font-semibold text-zinc-100 mb-6 text-center">
              How It Works
            </h3>
            <p className="text-zinc-500 text-center max-w-2xl mx-auto mb-12">
              A four-step pipeline transforms raw astronomical data into unified, 
              analysis-ready datasets.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-6 border border-zinc-800/50 rounded-lg bg-zinc-900/20">
                <div className="text-xs text-zinc-600 font-medium mb-3 uppercase tracking-wider">01</div>
                <h4 className="text-base font-medium text-zinc-200 mb-2">Upload</h4>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Import datasets in CSV, JSON, FITS, or XML. The parser detects structure, 
                  encoding, and delimiters automatically.
                </p>
              </div>

              <div className="p-6 border border-zinc-800/50 rounded-lg bg-zinc-900/20">
                <div className="text-xs text-zinc-600 font-medium mb-3 uppercase tracking-wider">02</div>
                <h4 className="text-base font-medium text-zinc-200 mb-2">Analyze</h4>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  AI examines field names, value distributions, and patterns to identify 
                  physical quantities and recommend unit conversions.
                </p>
              </div>

              <div className="p-6 border border-zinc-800/50 rounded-lg bg-zinc-900/20">
                <div className="text-xs text-zinc-600 font-medium mb-3 uppercase tracking-wider">03</div>
                <h4 className="text-base font-medium text-zinc-200 mb-2">Standardize</h4>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Convert units to canonical forms, normalize schemas, and prepare data 
                  for the unified repository.
                </p>
              </div>

              <div className="p-6 border border-zinc-800/50 rounded-lg bg-zinc-900/20">
                <div className="text-xs text-zinc-600 font-medium mb-3 uppercase tracking-wider">04</div>
                <h4 className="text-base font-medium text-zinc-200 mb-2">Explore</h4>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Query, filter, visualize, and analyze the unified dataset. Export results 
                  in standardized formats.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Visualization & Analysis */}
        <section className="py-20 bg-black border-t border-zinc-900/50">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="grid md:grid-cols-2 gap-12 items-start">
              <div className="bg-zinc-900/30 rounded-lg p-6 border border-zinc-800/50">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-600 mb-4">
                  Analysis Capabilities
                </p>
                <div className="space-y-4">
                  <div className="pb-4 border-b border-zinc-800/50">
                    <h4 className="text-sm font-medium text-zinc-300 mb-1">Unified Repository Tables</h4>
                    <p className="text-zinc-500 text-xs">
                      Browse all ingested data in a clean tabular interface with metadata-aware columns
                    </p>
                  </div>
                  <div className="pb-4 border-b border-zinc-800/50">
                    <h4 className="text-sm font-medium text-zinc-300 mb-1">Distance vs Brightness</h4>
                    <p className="text-zinc-500 text-xs">
                      Scatter plots correlating distance measurements with magnitude values
                    </p>
                  </div>
                  <div className="pb-4 border-b border-zinc-800/50">
                    <h4 className="text-sm font-medium text-zinc-300 mb-1">Source Distribution</h4>
                    <p className="text-zinc-500 text-xs">
                      Visualize object counts and data coverage across contributing agencies
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-zinc-300 mb-1">Cross-Dataset Comparison</h4>
                    <p className="text-zinc-500 text-xs">
                      Overlay data from multiple sources to identify discrepancies and patterns
                    </p>
                  </div>
                </div>
              </div>
              
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-600 mb-4">
                  Scientific Plotting
                </p>
                <h3 className="text-2xl font-semibold text-zinc-100 mb-6">
                  Visualization & Analysis
                </h3>
                <p className="text-zinc-400 mb-6 leading-relaxed">
                  SKYSCRIBE provides scientific plotting tools designed for astronomical data 
                  exploration, not dashboard metrics. Every visualization serves a research purpose.
                </p>
                <ul className="space-y-4 text-sm text-zinc-500">
                  <li className="flex items-start gap-3">
                    <span className="w-1 h-1 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                    <span>Interactive scatter plots with configurable axes and scales</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1 h-1 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                    <span>Histogram distributions for numerical columns</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1 h-1 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                    <span>Categorical breakdowns by source agency and object type</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1 h-1 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                    <span>Export-ready figures for publication and documentation</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* AI-Assisted Discovery */}
        <section className="py-20 bg-zinc-950 border-t border-zinc-900/50">
          <div className="container mx-auto px-4 max-w-5xl">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-600 mb-4 text-center">
              Intelligent Analysis
            </p>
            <h3 className="text-2xl sm:text-3xl font-semibold text-zinc-100 mb-6 text-center">
              AI-Assisted Discovery
            </h3>
            <p className="text-zinc-500 text-center max-w-2xl mx-auto mb-12">
              Local LLM inference examines actual data values to surface patterns and relationships 
              that may not be apparent from field names alone.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <div className="p-6 border border-zinc-800/50 rounded-lg bg-zinc-900/20">
                <h4 className="text-base font-medium text-zinc-200 mb-3">Pattern Detection</h4>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Identify clusters, outliers, and recurring structures across multi-source 
                  datasets. The AI examines value distributions, not just metadata.
                </p>
              </div>
              
              <div className="p-6 border border-zinc-800/50 rounded-lg bg-zinc-900/20">
                <h4 className="text-base font-medium text-zinc-200 mb-3">Correlation Analysis</h4>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Discover relationships between physical quantities across different datasets 
                  and measurement epochs.
                </p>
              </div>
              
              <div className="p-6 border border-zinc-800/50 rounded-lg bg-zinc-900/20">
                <h4 className="text-base font-medium text-zinc-200 mb-3">Anomaly Surfacing</h4>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Flag data points that deviate significantly from expected distributions, 
                  potentially indicating measurement errors or scientifically interesting objects.
                </p>
              </div>
              
              <div className="p-6 border border-zinc-800/50 rounded-lg bg-zinc-900/20">
                <h4 className="text-base font-medium text-zinc-200 mb-3">Statistical Summaries</h4>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Generate interpretable summaries of dataset characteristics, coverage gaps, 
                  and quality metrics. AI serves as an interpretive layer, not an authority.
                </p>
              </div>
            </div>
            
            <p className="text-zinc-600 text-xs text-center mt-8 max-w-xl mx-auto">
              All inference runs locally via Ollama. No data leaves your machine. 
              AI suggestions are advisory and require researcher validation.
            </p>
          </div>
        </section>

        {/* Why SKYSCRIBE Exists */}
        <section className="py-20 bg-black border-t border-zinc-900/50">
          <div className="container mx-auto px-4 max-w-4xl">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-600 mb-4 text-center">
              Motivation
            </p>
            <h3 className="text-2xl sm:text-3xl font-semibold text-zinc-100 mb-6 text-center">
              Why SKYSCRIBE Exists
            </h3>
            
            <div className="space-y-6 text-zinc-400 leading-relaxed">
              <p>
                Astronomical data is inherently fragmented. NASA, ESA, JAXA, and independent 
                observatories publish catalogs using different schemas, unit conventions, and 
                file formats. A researcher studying a single phenomenon may need to reconcile 
                data from a dozen sources, each with its own preprocessing requirements.
              </p>
              
              <p>
                This manual effort is repetitive, error-prone, and diverts time from actual 
                scientific analysis. Unit conversion mistakes, schema mismatches, and metadata 
                loss are common when researchers cobble together ad-hoc solutions.
              </p>
              
              <p>
                SKYSCRIBE provides a unification layer. It does not replace existing databases 
                or archives. Instead, it serves as a local preprocessing environment where 
                heterogeneous datasets can be standardized, merged, and analyzed together 
                before export or further processing.
              </p>
              
              <p className="text-zinc-500 text-sm">
                The goal is not to build another astronomical database, but to reduce the 
                friction of working with multiple existing ones.
              </p>
            </div>
          </div>
        </section>

        {/* Supported Data Types */}
        <section className="py-20 bg-zinc-950 border-t border-zinc-900/50">
          <div className="container mx-auto px-4 max-w-5xl">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-600 mb-4 text-center">
              Compatibility
            </p>
            <h3 className="text-2xl sm:text-3xl font-semibold text-zinc-100 mb-6 text-center">
              Supported Data Types
            </h3>
            <p className="text-zinc-500 text-center max-w-2xl mx-auto mb-12">
              Import data from common astronomical formats and agency-specific catalogs.
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 border border-zinc-800/50 rounded-lg bg-zinc-900/20 text-center">
                <p className="text-lg font-medium text-zinc-200 mb-1">CSV</p>
                <p className="text-zinc-600 text-xs">Tabular data with auto-delimiter detection</p>
              </div>
              <div className="p-4 border border-zinc-800/50 rounded-lg bg-zinc-900/20 text-center">
                <p className="text-lg font-medium text-zinc-200 mb-1">FITS</p>
                <p className="text-zinc-600 text-xs">Binary tables, images, and header metadata</p>
              </div>
              <div className="p-4 border border-zinc-800/50 rounded-lg bg-zinc-900/20 text-center">
                <p className="text-lg font-medium text-zinc-200 mb-1">JSON</p>
                <p className="text-zinc-600 text-xs">Structured data with nested object support</p>
              </div>
              <div className="p-4 border border-zinc-800/50 rounded-lg bg-zinc-900/20 text-center">
                <p className="text-lg font-medium text-zinc-200 mb-1">XML</p>
                <p className="text-zinc-600 text-xs">VOTable and agency-specific schemas</p>
              </div>
            </div>
            
            <div className="mt-8 p-6 border border-zinc-800/50 rounded-lg bg-zinc-900/20">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-zinc-400 text-sm mb-1">NASA Catalogs</p>
                  <p className="text-zinc-600 text-xs">Hubble, Chandra, Kepler</p>
                </div>
                <div>
                  <p className="text-zinc-400 text-sm mb-1">ESA Archives</p>
                  <p className="text-zinc-600 text-xs">Gaia, XMM-Newton, Herschel</p>
                </div>
                <div>
                  <p className="text-zinc-400 text-sm mb-1">Ground-Based</p>
                  <p className="text-zinc-600 text-xs">SDSS, 2MASS, Pan-STARRS</p>
                </div>
                <div>
                  <p className="text-zinc-400 text-sm mb-1">Custom Sources</p>
                  <p className="text-zinc-600 text-xs">User-provided datasets</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final Call To Action */}
        <section className="py-20 bg-black border-t border-zinc-900/50">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-600 mb-4">
              Get Started
            </p>
            <h3 className="text-2xl sm:text-3xl font-semibold text-zinc-100 mb-4">
              Ready to unify your astronomical data?
            </h3>
            <p className="text-zinc-500 mb-8 max-w-xl mx-auto">
              Import heterogeneous datasets, standardize units, and begin analysis 
              in a unified environment. All processing happens locally.
            </p>
            <Link href="/login">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white text-base px-8 py-6 rounded-lg">
                Enter Platform
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-black border-t border-zinc-900/50 py-12">
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Telescope className="w-4 h-4 text-white" />
                </div>
                <span className="text-zinc-400 text-sm">SKYSCRIBE Data Fusion Platform</span>
              </div>
              <div className="flex items-center gap-6 text-sm text-zinc-500">
                <Link href="#" className="hover:text-zinc-300 transition-colors">
                  Documentation
                </Link>
                <Link href="#" className="hover:text-zinc-300 transition-colors">
                  Privacy
                </Link>
                <Link href="#" className="hover:text-zinc-300 transition-colors">
                  Terms
                </Link>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t border-zinc-900/50 text-center">
              <p className="text-zinc-600 text-xs">
                Designed for scientific research. All data processing occurs locally.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
