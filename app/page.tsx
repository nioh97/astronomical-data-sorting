import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-50 shadow-lg">
        <div className="container mx-auto px-4 py-4 max-w-7xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-white flex items-center justify-center">
                <span className="text-slate-900 text-lg font-bold">C</span>
              </div>
              <div>
                <h1 className="text-xl font-bold">COSMIC Data Fusion</h1>
                <p className="text-slate-300 text-xs">Unified Astronomical Data Processing</p>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="#" className="text-slate-300 hover:text-white transition-colors">
                Community
              </Link>
              <Link href="#" className="text-slate-300 hover:text-white transition-colors">
                Agencies
              </Link>
            </nav>
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" className="text-white hover:bg-slate-800">
                  Login
                </Button>
              </Link>
              <Link href="/login">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  Register
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-20 max-w-4xl text-center">
          <h2 className="text-5xl font-bold text-slate-900 mb-6">
            COSMIC
            <br />
            <span className="text-4xl text-slate-700">Unified Astronomical Data Fusion Platform</span>
          </h2>
          <p className="text-xl text-slate-600 mb-8 leading-relaxed">
            Standardize, analyze, and visualize fragmented astronomical datasets across agencies and
            observatories.
          </p>
          <Link href="/login">
            <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white text-lg px-8 py-6">
              Enter Platform
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Workflow Illustration Section */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4 max-w-6xl">
          <h3 className="text-3xl font-bold text-slate-900 text-center mb-12">
            How It Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Step 1 */}
            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <span className="text-blue-600 font-bold text-lg">1</span>
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Data Upload</h4>
              <p className="text-slate-600 text-sm">
                Upload astronomical datasets in CSV, JSON, or XML formats from any source.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <span className="text-blue-600 font-bold text-lg">2</span>
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">AI Standardization</h4>
              <p className="text-slate-600 text-sm">
                Intelligent field mapping and unit conversion using AI-assisted inference.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <span className="text-blue-600 font-bold text-lg">3</span>
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Unified Repository</h4>
              <p className="text-slate-600 text-sm">
                All standardized data stored in a centralized, schema-aware repository.
              </p>
            </div>

            {/* Step 4 */}
            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <span className="text-blue-600 font-bold text-lg">4</span>
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Scientific Insights</h4>
              <p className="text-slate-600 text-sm">
                Visualize relationships and analyze data across multiple datasets.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h4 className="font-semibold mb-4">Project</h4>
              <ul className="space-y-2 text-slate-300 text-sm">
                <li>
                  <Link href="/about" className="hover:text-white transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Documentation
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-slate-300 text-sm">
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Support
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Feedback
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-slate-300 text-sm">
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-700 pt-8 text-center text-slate-400 text-sm">
            <p>© 2024 COSMIC Data Fusion Platform. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
