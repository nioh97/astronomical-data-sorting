'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'

interface BlobCursorProps {
  /** Blob diameter in pixels */
  size?: number
}

/**
 * BlobCursor - A single, solid blob cursor with text inversion
 * 
 * Features:
 * - ONE solid blob (no trails, no gradients, no blur)
 * - Clean solid edges
 * - mix-blend-mode: difference for text color inversion
 * - Smooth organic GSAP motion
 * - Landing page only
 */
export default function BlobCursor({ size = 140 }: BlobCursorProps) {
  const blobRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const blob = blobRef.current
    if (!blob) return

    // Set initial position off-screen
    gsap.set(blob, { 
      xPercent: -50, 
      yPercent: -50, 
      x: -200, 
      y: -200 
    })

    const handleMouseMove = (e: MouseEvent) => {
      // Smooth, organic follow with GSAP
      gsap.to(blob, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.45,
        ease: 'power3.out',
      })
    }

    const handleMouseLeave = () => {
      gsap.to(blob, {
        opacity: 0,
        scale: 0.8,
        duration: 0.3,
        ease: 'power2.out',
      })
    }

    const handleMouseEnter = () => {
      gsap.to(blob, {
        opacity: 1,
        scale: 1,
        duration: 0.3,
        ease: 'power2.out',
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('mouseenter', handleMouseEnter)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('mouseenter', handleMouseEnter)
    }
  }, [])

  return (
    <div
      ref={blobRef}
      className="fixed pointer-events-none z-[9999]"
      style={{
        width: size,
        height: size,
        // Solid neutral white/gray - no gradient
        backgroundColor: 'rgb(240, 240, 240)',
        // Perfect circle
        borderRadius: '50%',
        // KEY: Text inversion via blend mode
        mixBlendMode: 'difference',
        // Start hidden
        opacity: 0,
      }}
      aria-hidden="true"
    />
  )
}
