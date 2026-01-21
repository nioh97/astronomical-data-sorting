"use client"

import { useEffect, useRef } from "react"

interface DataFlowVisualizationProps {
  className?: string
}

export default function DataFlowVisualization({ className = "" }: DataFlowVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    // Create flowing connector lines animation
    const paths = svg.querySelectorAll("path.connector")
    paths.forEach((path, index) => {
      const pathElement = path as SVGPathElement
      const length = pathElement.getTotalLength()
      
      pathElement.style.strokeDasharray = `${length} ${length}`
      pathElement.style.strokeDashoffset = `${length}`
      pathElement.style.animation = `flow-line 3s ease-in-out infinite`
      pathElement.style.animationDelay = `${index * 0.5}s`
    })
  }, [])

  return (
    <svg
      ref={svgRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(148, 163, 184, 0)" />
          <stop offset="50%" stopColor="rgba(148, 163, 184, 0.4)" />
          <stop offset="100%" stopColor="rgba(148, 163, 184, 0)" />
        </linearGradient>
        <style>{`
          @keyframes flow-line {
            0% {
              stroke-dashoffset: 200;
              opacity: 0;
            }
            50% {
              opacity: 0.6;
            }
            100% {
              stroke-dashoffset: -200;
              opacity: 0;
            }
          }
        `}</style>
      </defs>
      
      {/* Connector lines */}
      <path
        className="connector"
        d="M 50 150 Q 150 100, 200 120 T 350 150"
        stroke="url(#flowGradient)"
        strokeWidth="1.5"
        fill="none"
        opacity="0.3"
      />
      <path
        className="connector"
        d="M 50 180 Q 150 200, 200 180 T 350 180"
        stroke="url(#flowGradient)"
        strokeWidth="1.5"
        fill="none"
        opacity="0.3"
      />
      
      {/* Data nodes with pulse */}
      <circle cx="50" cy="150" r="4" fill="rgba(148, 163, 184, 0.5)" className="animate-soft-pulse" />
      <circle cx="200" cy="120" r="4" fill="rgba(148, 163, 184, 0.5)" className="animate-soft-pulse" style={{ animationDelay: '0.5s' }} />
      <circle cx="350" cy="150" r="4" fill="rgba(148, 163, 184, 0.5)" className="animate-soft-pulse" style={{ animationDelay: '1s' }} />
    </svg>
  )
}

