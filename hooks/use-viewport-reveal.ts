"use client"

import { useEffect, useRef, useState } from "react"

interface UseViewportRevealOptions {
  threshold?: number
  rootMargin?: string
  once?: boolean
}

export function useViewportReveal(options: UseViewportRevealOptions = {}) {
  const { threshold = 0.1, rootMargin = "0px", once = true } = options
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          if (once) {
            observer.unobserve(element)
          }
        } else if (!once) {
          setIsVisible(false)
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [threshold, rootMargin, once])

  return { ref, isVisible }
}


