"use client"

import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2, Lock, AlertTriangle, Pencil, ShieldCheck, Database, FileText, Activity, Bot } from "lucide-react"
import { FieldAnalysisResult } from "@/lib/field-analysis"
import type { ColumnMetadataEntry } from "@/lib/file-parsers"
import { UNIT_TAXONOMY } from "@/lib/units/unitTaxonomy"

/**
 * Get effective units for a field. ALWAYS uses UNIT_TAXONOMY for the physicalQuantity,
 * merged with any additional units from allowed_units or recommended_unit.
 * This ensures dropdowns show ALL valid options, not just detected units.
 */
function getEffectiveUnits(field: FieldAnalysisResult): { units: string[] } {
  const pq = field.physicalQuantity ?? ""
  // Start with taxonomy units (comprehensive list)
  const taxonomyUnits = UNIT_TAXONOMY[pq] ?? []
  // Merge with any detected/allowed units (dedup)
  const merged = new Set<string>(taxonomyUnits)
  if (Array.isArray(field.allowed_units)) {
    field.allowed_units.forEach((u) => merged.add(u))
  }
  if (field.recommended_unit) {
    merged.add(field.recommended_unit)
  }
  // For count/dimensionless, return empty (no conversion)
  if (pq === "count" || pq === "dimensionless") {
    return { units: [] }
  }
  return { units: Array.from(merged) }
}

interface UnitSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fields: FieldAnalysisResult[]
  onConfirm: (selectedUnits: Record<string, string | null>) => void
  onCancel: () => void
  /** When present (e.g. NASA Exoplanet), show human description instead of raw field name */
  columnMetadata?: Record<string, ColumnMetadataEntry>
  /** When true (e.g. fallback schema), Confirm & Convert is disabled */
  conversionDisabled?: boolean
  /** When true, show conversion progress inside dialog */
  isProcessing?: boolean
  processingStep?: string
  processingProgress?: number
}

export function UnitSelectionDialog({
  open,
  onOpenChange,
  fields,
  onConfirm,
  onCancel,
  columnMetadata,
  conversionDisabled = false,
  isProcessing = false,
  processingStep = "",
  processingProgress = 0,
}: UnitSelectionDialogProps) {
  const effectiveByField = useMemo(() => {
    const m = new Map<string, { units: string[] }>()
    fields.forEach((f) => m.set(f.field_name, getEffectiveUnits(f)))
    return m
  }, [fields])

  // Deduplicate by field_name (first occurrence wins) so React keys are unique
  const visibleFields = useMemo(() => {
    const filtered = fields.filter(
      (field) => !(field.physicalQuantity === "time" && field.timeKind === "calendar")
    )
    const seen = new Set<string>()
    return filtered.filter((field) => {
      if (seen.has(field.field_name)) return false
      seen.add(field.field_name)
      return true
    })
  }, [fields])

  const [selectedUnits, setSelectedUnits] = useState<Record<string, string | null>>(() => {
    const initial: Record<string, string | null> = {}
    fields.forEach((field) => {
      const { units } = effectiveByField.get(field.field_name) ?? { units: [] }
      // Bind to finalUnit when set (auto-set from recommended_unit); else recommended_unit or first option
      initial[field.field_name] =
        field.finalUnit && (field.allowed_units?.includes(field.finalUnit) || units.includes(field.finalUnit))
          ? field.finalUnit
          : field.recommended_unit && (field.allowed_units?.includes(field.recommended_unit) || units.includes(field.recommended_unit))
            ? field.recommended_unit
            : units.length > 0
              ? units[0]
              : null
    })
    return initial
  })

  const handleUnitChange = (fieldName: string, unit: string | null) => {
    setSelectedUnits((prev) => ({
      ...prev,
      [fieldName]: unit,
    }))
  }

  const handleConfirm = () => {
    onConfirm(selectedUnits)
    // Do not close here — parent closes only on successful conversion + ingest (or on cancel)
  }

  const handleCancel = () => {
    onCancel()
    onOpenChange(false)
  }

  // Lock if dimensionless, count, logarithmic, or sexagesimal (no linear conversion).
  const isFieldLocked = (field: FieldAnalysisResult): boolean => {
    const pq = field.physicalQuantity ?? ""
    if (pq === "dimensionless" || pq === "count") return true
    if (field.encoding === "logarithmic" || field.encoding === "sexagesimal" || field.encoding === "categorical" || field.encoding === "identifier") return true
    if (!field.unit_required) return true
    return false
  }

  const isLogarithmic = (field: FieldAnalysisResult): boolean => field.encoding === "logarithmic"
  const isSexagesimal = (field: FieldAnalysisResult): boolean => field.encoding === "sexagesimal"

  // Get inference source display info
  const getInferenceSource = (field: FieldAnalysisResult): { label: string; icon: React.ReactNode; color: string } => {
    const source = (field as any).inferenceSource || 'llm'
    switch (source) {
      case 'guard':
        return { label: 'Guard', icon: <ShieldCheck className="h-3 w-3" />, color: 'text-red-400' }
      case 'domain':
        return { label: 'Domain', icon: <Database className="h-3 w-3" />, color: 'text-purple-400' }
      case 'name':
        return { label: 'Name', icon: <FileText className="h-3 w-3" />, color: 'text-blue-400' }
      case 'value':
        return { label: 'Value', icon: <Activity className="h-3 w-3" />, color: 'text-yellow-400' }
      case 'llm':
        return { label: 'LLM', icon: <Bot className="h-3 w-3" />, color: 'text-zinc-400' }
      default:
        return { label: 'Fallback', icon: <AlertTriangle className="h-3 w-3" />, color: 'text-orange-400' }
    }
  }

  // Get confidence level
  const getConfidenceLevel = (field: FieldAnalysisResult): { label: string; color: string } => {
    const confidence = (field as any).confidence || 0.5
    if (confidence >= 0.8) return { label: 'High', color: 'text-emerald-400' }
    if (confidence >= 0.5) return { label: 'Medium', color: 'text-yellow-400' }
    return { label: 'Low', color: 'text-orange-400' }
  }

  // Get lock status
  const getLockStatus = (field: FieldAnalysisResult): { label: string; icon: React.ReactNode; color: string } => {
    if (isFieldLocked(field)) {
      return { label: 'Locked', icon: <Lock className="h-3 w-3" />, color: 'text-zinc-500' }
    }
    const confidence = (field as any).confidence || 0.5
    if (confidence < 0.5) {
      return { label: 'Needs Confirmation', icon: <AlertTriangle className="h-3 w-3" />, color: 'text-amber-400' }
    }
    return { label: 'Editable', icon: <Pencil className="h-3 w-3" />, color: 'text-blue-400' }
  }

  // Get warning message for field
  const getFieldWarning = (field: FieldAnalysisResult): string | null => {
    if ((field as any).warning) return (field as any).warning
    if (field.physicalQuantity === 'dimensionless' && field.reason?.includes('correlation')) {
      return 'Correlation coefficients are dimensionless [-1, 1]'
    }
    if (field.encoding === 'logarithmic') {
      return 'Logarithmic quantities cannot be converted linearly'
    }
    if (field.reason?.includes('cartesian') || field.reason?.includes('gaia_x') || field.reason?.includes('gaia_y') || field.reason?.includes('gaia_z')) {
      return 'Cartesian coordinate (length, not angle)'
    }
    return null
  }

  return (
    <Dialog open={open} onOpenChange={(open) => {
      // Block closing - user must confirm or cancel
      if (!open) {
        onCancel()
      }
    }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-zinc-900 border-zinc-700 text-zinc-100" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Select Final Units for Dataset Fields</DialogTitle>
          <p className="text-sm text-zinc-400 mt-2">
            Review the field analysis and AI recommendations. The unit selector is shown only for quantitative fields (Unit Required: Yes); non-quantitative fields are locked. Conversion will only occur after you confirm.
          </p>
        </DialogHeader>

        {isProcessing && (
          <div className="space-y-2 py-4">
            <div className="flex items-center gap-3 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{processingStep || "Converting…"}</span>
            </div>
            <Progress value={processingProgress} className="h-2" />
          </div>
        )}

        <div className="space-y-4 mt-4">
          <div className="overflow-x-auto rounded-lg border border-zinc-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700 bg-zinc-800">
                  <th className="text-left py-3 px-4 text-zinc-200 font-semibold whitespace-nowrap">Field Name</th>
                  <th className="text-left py-3 px-4 text-zinc-200 font-semibold whitespace-nowrap">Physical Quantity</th>
                  <th className="text-left py-3 px-4 text-zinc-200 font-semibold whitespace-nowrap">Source</th>
                  <th className="text-left py-3 px-4 text-zinc-200 font-semibold whitespace-nowrap">Confidence</th>
                  <th className="text-left py-3 px-4 text-zinc-200 font-semibold whitespace-nowrap">Status</th>
                  <th className="text-left py-3 px-4 text-zinc-200 font-semibold whitespace-nowrap">Recommended</th>
                  <th className="text-left py-3 px-4 text-zinc-200 font-semibold whitespace-nowrap">Final Unit</th>
                </tr>
              </thead>
              <tbody>
                {visibleFields.map((field) => {
                  const isLocked = isFieldLocked(field)
                  const currentUnit = selectedUnits[field.field_name] ?? field.finalUnit ?? null
                  const { units: effectiveUnits } = effectiveByField.get(field.field_name) ?? { units: [] }
                  const inferenceSource = getInferenceSource(field)
                  const confidenceLevel = getConfidenceLevel(field)
                  const lockStatus = getLockStatus(field)
                  const warning = getFieldWarning(field)

                  const displayName = columnMetadata?.[field.field_name]?.description ?? field.field_name
                  return (
                    <tr key={field.field_name} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-zinc-100">{displayName}</span>
                          {columnMetadata?.[field.field_name] && (
                            <span className="font-mono text-xs text-zinc-500">{field.field_name}</span>
                          )}
                          {warning && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-xs text-amber-400 flex items-center gap-1 mt-1 cursor-help">
                                    <AlertTriangle className="h-3 w-3" />
                                    Warning
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-sm bg-amber-900 border-amber-700 text-amber-100">
                                  <p className="text-sm">{warning}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-xs border-zinc-600 text-zinc-300">
                            {field.physicalQuantity ?? field.semantic_type}
                          </Badge>
                          {isLogarithmic(field) && (
                            <Badge variant="secondary" className="text-xs bg-amber-900/50 text-amber-300 border-amber-700">
                              log
                            </Badge>
                          )}
                          {isSexagesimal(field) && (
                            <Badge variant="secondary" className="text-xs bg-purple-900/50 text-purple-300 border-purple-700">
                              sex
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className={`flex items-center gap-1.5 ${inferenceSource.color}`}>
                          {inferenceSource.icon}
                          <span className="text-xs font-medium">{inferenceSource.label}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-medium ${confidenceLevel.color}`}>
                          {confidenceLevel.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className={`flex items-center gap-1.5 ${lockStatus.color}`}>
                          {lockStatus.icon}
                          <span className="text-xs">{lockStatus.label}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {field.recommended_unit ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-sm font-medium text-zinc-100 cursor-help">
                                  {field.recommended_unit}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-md bg-zinc-800 border-zinc-700 text-zinc-200">
                                <p className="text-sm font-medium mb-1">Reason:</p>
                                <p className="text-sm text-zinc-300">{field.reason}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-zinc-500 text-sm">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {isLocked ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-zinc-500 italic text-sm">
                                  {isLogarithmic(field)
                                    ? (field.recommended_unit || "log unit")
                                    : isSexagesimal(field)
                                      ? "sexagesimal"
                                      : (effectiveUnits.length > 0 ? effectiveUnits[0] : "none")}{" "}
                                  (locked)
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm bg-zinc-800 border-zinc-700 text-zinc-200">
                                {isLogarithmic(field) ? (
                                  <p className="text-sm">
                                    This field stores a logarithmic value (e.g. log₁₀). Converting units would require nonlinear transformation and is intentionally disabled.
                                  </p>
                                ) : isSexagesimal(field) ? (
                                  <p className="text-sm">
                                    This field uses astronomical sexagesimal notation (e.g. hh:mm:ss). It must be parsed before numeric unit conversion.
                                  </p>
                                ) : (
                                  <p className="text-sm">This field is not available for unit conversion.</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <Select
                            value={currentUnit || ""}
                            onValueChange={(value) => handleUnitChange(field.field_name, value || null)}
                          >
                            <SelectTrigger className="w-36 bg-zinc-800 border-zinc-600 text-zinc-100">
                              <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-800 border-zinc-700">
                              {effectiveUnits.length === 0 ? (
                                <SelectItem value="none" className="text-zinc-300">none</SelectItem>
                              ) : (
                                effectiveUnits.map((unit) => (
                                  <SelectItem key={unit} value={unit} className="text-zinc-300 focus:bg-zinc-700 focus:text-zinc-100">
                                    {unit}
                                    {unit === field.recommended_unit && (
                                      <span className="ml-2 text-xs text-blue-400">(AI)</span>
                                    )}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter className="border-t border-zinc-700 pt-4 mt-4">
          <Button variant="outline" onClick={handleCancel} disabled={isProcessing} className="border-zinc-600 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={conversionDisabled || isProcessing}
          >
            Confirm & Convert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

