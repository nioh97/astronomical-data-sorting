"use client"

import { ReactNode } from "react"
import { useViewportReveal } from "@/hooks/use-viewport-reveal"

interface SectionRevealProps {
  children: ReactNode
  delay?: number
  className?: string
}

export default function SectionReveal({ children, delay = 0, className = "" }: SectionRevealProps) {
  const { ref, isVisible } = useViewportReveal({ threshold: 0.1 })

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className={`reveal-on-scroll ${isVisible ? "revealed" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </section>
  )
}


