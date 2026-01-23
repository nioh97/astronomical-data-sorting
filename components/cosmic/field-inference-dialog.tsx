"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, AlertCircle, Brain, Sparkles } from "lucide-react"
import { FieldInference } from "@/lib/ai-inference"

interface FieldInferenceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  inferences: FieldInference[]
  onConfirm: (inferences: FieldInference[]) => void
  onReject: () => void
}

export function FieldInferenceDialog({
  open,
  onOpenChange,
  inferences,
  onConfirm,
  onReject,
}: FieldInferenceDialogProps) {
  const [localInferences, setLocalInferences] = useState<FieldInference[]>(inferences)

  // Update local state when inferences prop changes
  useEffect(() => {
    setLocalInferences(inferences)
  }, [inferences])

  const handleConfirm = () => {
    onConfirm(localInferences)
    onOpenChange(false)
  }

  const handleReject = () => {
    onReject()
    onOpenChange(false)
  }

  const llmInferences = localInferences.filter((inf) => inf.source === "llm")
  const ruleInferences = localInferences.filter((inf) => inf.source === "rule")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Brain className="w-5 h-5 text-blue-600" />
            AI Field Mapping Suggestions
          </DialogTitle>
          <DialogDescription>
            The AI has analyzed your astronomical data and suggests field name mappings and units.
            Please review and confirm before applying.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {llmInferences.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <h3 className="font-semibold text-slate-900">LLM-Assisted Inferences</h3>
                <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                  {llmInferences.length} fields
                </Badge>
              </div>
              <div className="space-y-3">
                {llmInferences.map((inf, idx) => (
                  <div
                    key={idx}
                    className="p-4 border border-purple-200 rounded-lg bg-purple-50/50 hover:bg-purple-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-semibold text-slate-900">
                            {inf.fieldName}
                          </span>
                          <span className="text-slate-400">→</span>
                          {inf.suggestedCanonicalField ? (
                            <Badge variant="outline" className="bg-white">
                              {inf.suggestedCanonicalField}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-white text-slate-500">
                              (keep original)
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">Unit:</span>
                          <Badge
                            variant="secondary"
                            className={
                              inf.suggestedUnit === "unknown"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-blue-100 text-blue-700"
                            }
                          >
                            {inf.suggestedUnit}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              inf.confidence >= 0.8
                                ? "bg-green-50 text-green-700 border-green-300"
                                : inf.confidence >= 0.6
                                ? "bg-yellow-50 text-yellow-700 border-yellow-300"
                                : "bg-red-50 text-red-700 border-red-300"
                            }
                          >
                            {(inf.confidence * 100).toFixed(0)}% confidence
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 mt-2 italic">{inf.reasoning}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ruleInferences.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <h3 className="font-semibold text-slate-900">Rule-Based Mappings</h3>
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  {ruleInferences.length} fields
                </Badge>
              </div>
              <div className="space-y-2">
                {ruleInferences.map((inf, idx) => (
                  <div
                    key={idx}
                    className="p-3 border border-green-200 rounded-lg bg-green-50/30 hover:bg-green-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-slate-700">{inf.fieldName}</span>
                      <span className="text-slate-400">→</span>
                      {inf.suggestedCanonicalField ? (
                        <Badge variant="outline" className="bg-white">
                          {inf.suggestedCanonicalField}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-500">(no mapping)</span>
                      )}
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                        {inf.suggestedUnit}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {llmInferences.length > 0 && (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Note:</strong> LLM suggestions require your validation. Review the field
                mappings and units carefully before confirming. You can modify or reject any
                suggestions.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleReject}>
            Reject All
          </Button>
          <Button onClick={handleConfirm} className="bg-blue-600 hover:bg-blue-700">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Confirm & Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

