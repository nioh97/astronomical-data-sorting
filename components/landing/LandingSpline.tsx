'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import Spline with SSR disabled to prevent hydration issues
const Spline = dynamic(() => import('@splinetool/react-spline'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500/60 rounded-full animate-spin" />
        <p className="text-zinc-500 text-sm">Loading 3D scene...</p>
      </div>
    </div>
  ),
})

export default function LandingSpline() {
  return (
    <div className="relative w-full h-[60vh] sm:h-[65vh] lg:h-[70vh] bg-black overflow-hidden">
      {/* Spline 3D Scene - No text overlay */}
      <Suspense
        fallback={
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500/60 rounded-full animate-spin" />
              <p className="text-zinc-500 text-sm">Loading 3D scene...</p>
            </div>
          </div>
        }
      >
        <Spline 
          scene="https://prod.spline.design/92Yqj8kzsGBbrlVY/scene.splinecode"
          style={{ width: '100%', height: '100%' }}
        />
      </Suspense>
    </div>
  )
}
