"use client"

/**
 * Field Tooltip Component
 * 
 * Displays contextual metadata about astronomical fields/columns.
 * Shows human-readable name, description, physical quantity, units, and notes.
 * 
 * Usage:
 *   <FieldTooltip fieldName="pl_orbper" unit="days">
 *     <span>pl_orbper</span>
 *   </FieldTooltip>
 * 
 * Features:
 * - 300ms hover delay to avoid accidental triggers
 * - No layout shift (uses absolute positioning)
 * - Accessible (aria-label, role="tooltip")
 * - Reusable across tables, filters, visualizations
 */

import { useState, useRef, useCallback, useMemo, ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Info, HelpCircle } from "lucide-react"
import {
  getFieldMetadata,
  mergeFieldMetadata,
  formatFieldName,
  type FieldMetadata,
} from "@/lib/field-metadata"

// ============================================================================
// TYPES
// ============================================================================

interface FieldTooltipProps {
  /** The field/column name to look up */
  fieldName: string
  /** Children to wrap (the trigger element) */
  children: ReactNode
  /** Optional unit override (from column metadata) */
  unit?: string | null
  /** Optional semantic type override */
  semanticType?: string | null
  /** Optional description override (from LLM analysis) */
  description?: string | null
  /** Show a small info icon next to children */
  showIcon?: boolean
  /** Position of tooltip */
  position?: "top" | "bottom" | "left" | "right"
  /** Additional class for the wrapper */
  className?: string
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FieldTooltip({
  fieldName,
  children,
  unit,
  semanticType,
  description,
  showIcon = false,
  position = "top",
  className = "",
}: FieldTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  // Get metadata from registry, merge with any overrides
  const metadata: FieldMetadata = useMemo(() => {
    const registryMeta = getFieldMetadata(fieldName)
    
    // Build override object from props
    const overrides: Partial<FieldMetadata> = {}
    if (description) overrides.description = description
    if (semanticType) overrides.physicalQuantity = semanticType
    if (unit) overrides.defaultUnit = unit
    
    // Merge registry + overrides
    if (registryMeta) {
      return {
        ...registryMeta,
        ...Object.fromEntries(
          Object.entries(overrides).filter(([_, v]) => v != null)
        ),
      } as FieldMetadata
    }
    
    // No registry entry - create from overrides/defaults
    return mergeFieldMetadata(fieldName, overrides)
  }, [fieldName, unit, semanticType, description])

  // Handle hover with delay
  const handleMouseEnter = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, 300) // 300ms delay
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsVisible(false)
  }, [])

  // Position classes
  const positionClasses: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  }

  // Arrow classes
  const arrowClasses: Record<string, string> = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-slate-800 border-l-transparent border-r-transparent border-b-transparent",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-slate-800 border-l-transparent border-r-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-slate-800 border-t-transparent border-b-transparent border-r-transparent",
    right: "right-full top-1/2 -translate-y-1/2 border-r-slate-800 border-t-transparent border-b-transparent border-l-transparent",
  }

  return (
    <div
      ref={triggerRef}
      className={`relative inline-flex items-center gap-1 ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {/* Trigger content */}
      <span className="cursor-help">{children}</span>
      
      {/* Optional info icon */}
      {showIcon && (
        <HelpCircle className="w-3 h-3 text-slate-400 flex-shrink-0" />
      )}

      {/* Tooltip */}
      {isVisible && (
        <div
          role="tooltip"
          aria-label={`Information about ${fieldName}`}
          className={`
            absolute z-50 w-72 max-w-sm
            bg-slate-800 text-white text-sm
            rounded-lg shadow-xl
            p-3 space-y-2
            pointer-events-none
            animate-in fade-in-0 zoom-in-95 duration-150
            ${positionClasses[position]}
          `}
        >
          {/* Arrow */}
          <div
            className={`
              absolute w-0 h-0
              border-[6px] border-solid
              ${arrowClasses[position]}
            `}
          />

          {/* Header: Display Name */}
          <div className="font-semibold text-white border-b border-slate-600 pb-1.5 mb-1.5">
            {metadata.displayName}
          </div>

          {/* Description */}
          <p className="text-slate-200 text-xs leading-relaxed">
            {metadata.description}
          </p>

          {/* Metadata badges */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {/* Physical Quantity */}
            {metadata.physicalQuantity && (
              <Badge 
                variant="secondary" 
                className="text-xs bg-slate-700 text-slate-200 border-slate-600"
              >
                {metadata.physicalQuantity}
              </Badge>
            )}

            {/* Original Unit */}
            {metadata.defaultUnit && (
              <Badge 
                variant="outline" 
                className="text-xs bg-transparent text-blue-300 border-blue-400"
              >
                Unit: {metadata.defaultUnit}
              </Badge>
            )}

            {/* Canonical Unit (if different) */}
            {metadata.canonicalUnit && metadata.canonicalUnit !== metadata.defaultUnit && (
              <Badge 
                variant="outline" 
                className="text-xs bg-transparent text-green-300 border-green-400"
              >
                Canonical: {metadata.canonicalUnit}
              </Badge>
            )}
          </div>

          {/* Notes (if any) */}
          {metadata.notes && (
            <p className="text-slate-400 text-xs italic pt-1 border-t border-slate-700">
              {metadata.notes}
            </p>
          )}

          {/* Raw field name */}
          <div className="pt-1 border-t border-slate-700">
            <span className="text-slate-500 text-xs font-mono">{fieldName}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SIMPLE VERSION (Inline, minimal)
// ============================================================================

interface SimpleFieldTooltipProps {
  fieldName: string
  children: ReactNode
  className?: string
}

/**
 * Simplified tooltip that only shows on title attribute.
 * Use when you need minimal overhead.
 */
export function SimpleFieldTooltip({ 
  fieldName, 
  children,
  className = "" 
}: SimpleFieldTooltipProps) {
  const metadata = useMemo(() => getFieldMetadata(fieldName), [fieldName])
  
  const title = metadata
    ? `${metadata.displayName}: ${metadata.description}`
    : formatFieldName(fieldName)

  return (
    <span 
      title={title}
      className={`cursor-help ${className}`}
      aria-label={title}
    >
      {children}
    </span>
  )
}

// ============================================================================
// COLUMN HEADER WRAPPER
// ============================================================================

interface ColumnHeaderTooltipProps {
  /** Column name */
  name: string
  /** Column semantic type */
  semanticType?: string
  /** Column unit */
  unit?: string | null
  /** Column description (from LLM) */
  description?: string
  /** What to display (defaults to column name) */
  displayText?: string
}

/**
 * Pre-configured tooltip for table column headers.
 */
export function ColumnHeaderTooltip({
  name,
  semanticType,
  unit,
  description,
  displayText,
}: ColumnHeaderTooltipProps) {
  return (
    <FieldTooltip
      fieldName={name}
      semanticType={semanticType}
      unit={unit}
      description={description}
      showIcon={false}
      position="bottom"
    >
      <span className="whitespace-nowrap">{displayText || name}</span>
    </FieldTooltip>
  )
}

export default FieldTooltip
