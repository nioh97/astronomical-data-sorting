export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-slate-100 border-t border-slate-200 mt-20">
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Project</h3>
            <p className="text-slate-700 text-sm">COSMIC Data Fusion</p>
            <p className="text-slate-600 text-sm">Unified Astronomical Data Processing Platform</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Platform</h3>
            <p className="text-slate-700 text-sm">Cloud-Enabled Data Fusion</p>
            <p className="text-slate-600 text-sm">Multi-Agency Integration</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Status</h3>
            <p className="text-slate-700 text-sm">Active Development</p>
            <p className="text-slate-600 text-sm">Research Platform</p>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-6">
          <p className="text-xs text-slate-600 text-center">
            COSMIC Data Fusion Platform - Enabling unified analysis of astronomical datasets from multiple space agencies.
          </p>
          <p className="text-xs text-slate-500 text-center mt-3">
            © {currentYear} COSMIC Data Fusion Platform. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
