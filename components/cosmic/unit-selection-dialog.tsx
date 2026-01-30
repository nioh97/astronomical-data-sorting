"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { FieldAnalysisResult } from "@/lib/field-analysis"

interface UnitSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fields: FieldAnalysisResult[]
  onConfirm: (selectedUnits: Record<string, string | null>) => void
  onCancel: () => void
}

export function UnitSelectionDialog({
  open,
  onOpenChange,
  fields,
  onConfirm,
  onCancel,
}: UnitSelectionDialogProps) {
  // Initialize selected units with AI recommended units
  const [selectedUnits, setSelectedUnits] = useState<Record<string, string | null>>(() => {
    const initial: Record<string, string | null> = {}
    fields.forEach((field) => {
      // Pre-select AI recommended unit, or first allowed unit
      initial[field.field_name] =
        field.recommended_unit ||
        (field.allowed_units.length > 0 ? field.allowed_units[0] : null)
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
    onOpenChange(false)
  }

  const handleCancel = () => {
    onCancel()
    onOpenChange(false)
  }

  const isFieldLocked = (field: FieldAnalysisResult): boolean => {
    // Lock if unit_required=false (unitless fields) OR if only one allowed unit
    return !field.unit_required || field.allowed_units.length <= 1
  }

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
            Review the field analysis and AI recommendations, then select the final units for each field. Fields marked as "Unit Required: No" are locked. Conversion will only occur after you confirm.
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 text-slate-900 font-semibold">Field Name</th>
                  <th className="text-left py-3 px-4 text-slate-900 font-semibold">Semantic Meaning</th>
                  <th className="text-left py-3 px-4 text-slate-900 font-semibold">Unit Required</th>
                  <th className="text-left py-3 px-4 text-slate-900 font-semibold">AI Recommended Unit</th>
                  <th className="text-left py-3 px-4 text-slate-900 font-semibold">Final Unit</th>
                  <th className="text-left py-3 px-4 text-slate-900 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => {
                  const isLocked = isFieldLocked(field)
                  const currentUnit = selectedUnits[field.field_name] || null

                  return (
                    <tr key={field.field_name} className="border-b border-slate-100">
                      <td className="py-3 px-4 font-mono text-slate-800">{field.field_name}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs">
                          {field.semantic_type}
                        </Badge>
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
                          <span className="text-slate-500 italic text-sm">
                            {field.unit_required && field.allowed_units.length > 0
                              ? field.allowed_units[0]
                              : "none"} (locked)
                          </span>
                        ) : (
                          <Select
                            value={currentUnit || ""}
                            onValueChange={(value) => handleUnitChange(field.field_name, value || null)}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                            <SelectContent>
                              {field.allowed_units.length === 0 ? (
                                <SelectItem value="none">none</SelectItem>
                              ) : (
                                field.allowed_units.map((unit) => (
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
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="bg-slate-900 hover:bg-slate-800">
            Confirm & Convert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

