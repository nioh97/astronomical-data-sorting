import Link from "next/link"

export default function Header() {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center">
              <span className="text-white text-lg font-bold">C</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                COSMIC Data Fusion
              </h1>
              <p className="text-slate-600 text-sm">Unified Astronomical Data Processing Platform</p>
            </div>
          </Link>
          <nav className="flex items-center gap-6">
            <Link 
              href="/" 
              className="text-slate-700 hover:text-slate-900 font-medium transition-colors"
            >
              Home
            </Link>
            <Link 
              href="/about" 
              className="text-slate-700 hover:text-slate-900 font-medium transition-colors"
            >
              About Us
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
