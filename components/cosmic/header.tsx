"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const isActive = pathname === href
  
  return (
    <Link 
      href={href} 
      className={`relative font-medium transition-all duration-200 ${
        isActive 
          ? "text-slate-900" 
          : "text-slate-700 hover:text-slate-900"
      }`}
    >
      {children}
      {isActive && (
        <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
      )}
    </Link>
  )
}

export default function Header() {
  return (
    <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow duration-200">
              <span className="text-white text-lg font-bold">C</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                COSMIC Data Fusion
              </h1>
              <p className="text-slate-600 text-sm">Unified Astronomical Data Processing Platform</p>
            </div>
          </Link>
          <nav className="flex items-center gap-8">
            <NavLink href="/">Home</NavLink>
            <NavLink href="/about">About Us</NavLink>
          </nav>
        </div>
      </div>
    </header>
  )
}
