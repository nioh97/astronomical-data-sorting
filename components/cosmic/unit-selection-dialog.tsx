"use client"

import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2 } from "lucide-react"
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

  return (
    <Dialog open={open} onOpenChange={(open) => {
      // Block closing - user must confirm or cancel
      if (!open) {
        onCancel()
      }
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Select Final Units for Dataset Fields</DialogTitle>
          <p className="text-sm text-slate-600 mt-2">
            Review the field analysis and AI recommendations. The unit selector is shown only for quantitative fields (Unit Required: Yes); non-quantitative fields are locked. Conversion will only occur after you confirm.
          </p>
        </DialogHeader>

        {isProcessing && (
          <div className="space-y-2 py-4">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{processingStep || "Converting…"}</span>
            </div>
            <Progress value={processingProgress} className="h-2" />
          </div>
        )}

        <div className="space-y-4 mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 text-slate-900 font-semibold">Field Name</th>
                  <th className="text-left py-3 px-4 text-slate-900 font-semibold">Physical Quantity</th>
                  <th className="text-left py-3 px-4 text-slate-900 font-semibold">Unit Required</th>
                  <th className="text-left py-3 px-4 text-slate-900 font-semibold">AI Recommended Unit</th>
                  <th className="text-left py-3 px-4 text-slate-900 font-semibold">Final Unit</th>
                  <th className="text-left py-3 px-4 text-slate-900 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {visibleFields.map((field) => {
                  const isLocked = isFieldLocked(field)
                  const currentUnit = selectedUnits[field.field_name] ?? field.finalUnit ?? null
                  const { units: effectiveUnits } = effectiveByField.get(field.field_name) ?? { units: [] }
                  const needsConfirmation =
                    field.unit_required &&
                    (field.allowed_units?.length ?? 0) > 1 &&
                    currentUnit === field.recommended_unit

                  const displayName = columnMetadata?.[field.field_name]?.description ?? field.field_name
                  return (
                    <tr key={field.field_name} className="border-b border-slate-100">
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-900">{displayName}</span>
                        {columnMetadata?.[field.field_name] && (
                          <span className="ml-2 font-mono text-xs text-slate-500">{field.field_name}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {field.physicalQuantity ?? field.semantic_type}
                          </Badge>
                          {isLogarithmic(field) && (
                            <Badge variant="secondary" className="text-xs bg-slate-200 text-slate-700">
                              Logarithmic quantity (conversion disabled)
                            </Badge>
                          )}
                          {isSexagesimal(field) && (
                            <Badge variant="secondary" className="text-xs bg-slate-200 text-slate-700">
                              Sexagesimal coordinate (locked)
                            </Badge>
                          )}
                          {needsConfirmation && !isLogarithmic(field) && !isSexagesimal(field) && (
                            <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                              Needs confirmation
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {field.unit_required ? (
                          <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            No (locked)
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {field.recommended_unit ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-medium text-slate-900">
                              {field.recommended_unit}
                            </span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-xs text-slate-500 italic cursor-help underline decoration-dotted">
                                    {field.reason.length > 50
                                      ? field.reason.substring(0, 50) + "..."
                                      : field.reason}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-md">
                                  <p className="text-sm">{field.reason}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {isLocked ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-slate-500 italic text-sm">
                                  {isLogarithmic(field)
                                    ? (field.recommended_unit || "log unit")
                                    : isSexagesimal(field)
                                      ? "sexagesimal"
                                      : (effectiveUnits.length > 0 ? effectiveUnits[0] : "none")}{" "}
                                  (locked)
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm">
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
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                            <SelectContent>
                              {effectiveUnits.length === 0 ? (
                                <SelectItem value="none">none</SelectItem>
                              ) : (
                                effectiveUnits.map((unit) => (
                                  <SelectItem key={unit} value={unit}>
                                    {unit}
                                    {unit === field.recommended_unit && (
                                      <span className="ml-2 text-xs text-blue-600">(AI recommended)</span>
                                    )}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-xs">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help underline decoration-dotted">
                                {field.reason.length > 60
                                  ? field.reason.substring(0, 60) + "..."
                                  : field.reason}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md">
                              <p className="text-sm">{field.reason}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-slate-900 hover:bg-slate-800"
            disabled={conversionDisabled || isProcessing}
          >
            Confirm & Convert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

