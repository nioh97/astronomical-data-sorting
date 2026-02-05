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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-zinc-900 border-zinc-700 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-zinc-100">
            <Brain className="w-5 h-5 text-blue-400" />
            AI Field Mapping Suggestions
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            The AI has analyzed your astronomical data and suggests field name mappings and units.
            Please review and confirm before applying.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {llmInferences.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h3 className="font-semibold text-zinc-100">LLM-Assisted Inferences</h3>
                <Badge variant="secondary" className="bg-purple-900/50 text-purple-300 border-purple-700">
                  {llmInferences.length} fields
                </Badge>
              </div>
              <div className="space-y-3">
                {llmInferences.map((inf, idx) => (
                  <div
                    key={idx}
                    className="p-4 border border-purple-800 rounded-lg bg-purple-900/20 hover:bg-purple-900/30 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-semibold text-zinc-100">
                            {inf.fieldName}
                          </span>
                          <span className="text-zinc-500">→</span>
                          {inf.suggestedCanonicalField ? (
                            <Badge variant="outline" className="bg-zinc-800 border-zinc-600 text-zinc-200">
                              {inf.suggestedCanonicalField}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-zinc-800 border-zinc-600 text-zinc-500">
                              (keep original)
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500">Unit:</span>
                          <Badge
                            variant="secondary"
                            className={
                              inf.suggestedUnit === "unknown"
                                ? "bg-yellow-900/50 text-yellow-300 border-yellow-700"
                                : "bg-blue-900/50 text-blue-300 border-blue-700"
                            }
                          >
                            {inf.suggestedUnit}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              inf.confidence >= 0.8
                                ? "bg-emerald-900/30 text-emerald-300 border-emerald-700"
                                : inf.confidence >= 0.6
                                ? "bg-yellow-900/30 text-yellow-300 border-yellow-700"
                                : "bg-red-900/30 text-red-300 border-red-700"
                            }
                          >
                            {(inf.confidence * 100).toFixed(0)}% confidence
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-400 mt-2 italic">{inf.reasoning}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ruleInferences.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-zinc-100">Rule-Based Mappings</h3>
                <Badge variant="secondary" className="bg-emerald-900/50 text-emerald-300 border-emerald-700">
                  {ruleInferences.length} fields
                </Badge>
              </div>
              <div className="space-y-2">
                {ruleInferences.map((inf, idx) => (
                  <div
                    key={idx}
                    className="p-3 border border-emerald-800 rounded-lg bg-emerald-900/20 hover:bg-emerald-900/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-zinc-300">{inf.fieldName}</span>
                      <span className="text-zinc-500">→</span>
                      {inf.suggestedCanonicalField ? (
                        <Badge variant="outline" className="bg-zinc-800 border-zinc-600 text-zinc-200">
                          {inf.suggestedCanonicalField}
                        </Badge>
                      ) : (
                        <span className="text-xs text-zinc-500">(no mapping)</span>
                      )}
                      <Badge variant="secondary" className="bg-blue-900/50 text-blue-300 border-blue-700 text-xs">
                        {inf.suggestedUnit}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {llmInferences.length > 0 && (
            <Alert className="bg-blue-900/30 border-blue-800">
              <AlertCircle className="h-4 w-4 text-blue-400" />
              <AlertDescription className="text-blue-300">
                <strong>Note:</strong> LLM suggestions require your validation. Review the field
                mappings and units carefully before confirming. You can modify or reject any
                suggestions.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex gap-2 border-t border-zinc-700 pt-4">
          <Button variant="outline" onClick={handleReject} className="border-zinc-600 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
            Reject All
          </Button>
          <Button onClick={handleConfirm} className="bg-blue-600 hover:bg-blue-700 text-white">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Confirm & Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

