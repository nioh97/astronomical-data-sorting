"use client"

/**
 * AI Discovery Panel Component
 * 
 * Provides a complete UI for the AI-Assisted Discovery & Prediction system.
 * Features:
 * - Dataset selection from Unified Repository
 * - Run AI Insights button
 * - Real-time progress display
 * - Insight and prediction rendering
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { useDataContext } from "@/lib/data-context"
import type { Dataset } from "@/lib/data-context"
import { 
  runDeterministicAnalysis,
  type DeterministicAnalysisResult,
  type LLaMAInsightResponse,
  type AIInsight,
  type AIPrediction,
  type DiscoveryPipelineState,
  type DatasetSelection,
  type OllamaStatus,
  type PythonAnalyticsResult,
  type ComputedPrediction,
  type EnhancedCorrelation,
  type RegressionResult,
} from "@/lib/ai-discovery"

// Default model name for client-side display when not available from API
const DEFAULT_MODEL_NAME = "llama3.1"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Brain,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Loader2,
  Download,
  RefreshCw,
  Database,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Target,
  GitCompare,
  FileText,
  Terminal,
  Server,
  Info,
  Copy,
  Check,
} from "lucide-react"

// ============================================================================
// TYPES
// ============================================================================

type AIMode = "llm" | "limited"

interface ProgressStep {
  id: string
  label: string
  status: "pending" | "active" | "complete" | "error"
}

// ============================================================================
// PROGRESS COMPONENT
// ============================================================================

interface ProgressStepsProps {
  steps: ProgressStep[]
}

function ProgressSteps({ steps }: ProgressStepsProps) {
  return (
    <div className="space-y-2">
      {steps.map((step, idx) => (
        <div
          key={`progress-step-${step.id}-${idx}`}
          className={`flex items-center gap-3 p-2 rounded transition-colors ${
            step.status === "active" 
              ? "bg-indigo-50 border border-indigo-200" 
              : step.status === "complete"
                ? "bg-green-50/50"
                : step.status === "error"
                  ? "bg-red-50/50"
                  : "bg-slate-50/50"
          }`}
        >
          <div className="w-5 h-5 flex items-center justify-center">
            {step.status === "active" && (
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
            )}
            {step.status === "complete" && (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            )}
            {step.status === "error" && (
              <XCircle className="w-4 h-4 text-red-600" />
            )}
            {step.status === "pending" && (
              <div className="w-2 h-2 rounded-full bg-slate-300" />
            )}
          </div>
          <span className={`text-sm ${
            step.status === "active" 
              ? "text-indigo-700 font-medium" 
              : step.status === "complete"
                ? "text-green-700"
                : step.status === "error"
                  ? "text-red-700"
                  : "text-slate-500"
          }`}>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// LIMITED MODE BANNER
// ============================================================================

interface LimitedModeBannerProps {
  ollamaStatus?: OllamaStatus
  fallbackMessage: string
  fixInstructions?: string[]
  onRetry: () => void
  isRetrying: boolean
}

function LimitedModeBanner({ 
  ollamaStatus, 
  fallbackMessage, 
  fixInstructions,
  onRetry,
  isRetrying,
}: LimitedModeBannerProps) {
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)
  
  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedCommand(text)
    setTimeout(() => setCopiedCommand(null), 2000)
  }
  
  // Extract terminal commands from fix instructions
  const commands = fixInstructions?.filter(line => 
    line.trim().startsWith("ollama ") || line.trim().startsWith("Run:")
  ).map(line => line.trim().replace(/^Run:\s*/, "")) || []
  
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-amber-200">
        <div className="p-2 bg-amber-100 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-amber-900">Limited Mode</h4>
          <p className="text-sm text-amber-800 mt-1">{fallbackMessage}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={isRetrying}
          className="gap-1.5 border-amber-300 hover:bg-amber-100"
        >
          {isRetrying ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          Retry AI Analysis
        </Button>
      </div>
      
      {/* Status Details */}
      {ollamaStatus && (
        <div className="px-4 py-3 bg-amber-50/50 border-b border-amber-200">
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <Server className={`w-3.5 h-3.5 ${ollamaStatus.serverRunning ? "text-green-600" : "text-red-500"}`} />
              <span className="text-slate-600">
                Ollama Server: {ollamaStatus.serverRunning ? "Running" : "Not Running"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Brain className={`w-3.5 h-3.5 ${ollamaStatus.modelInstalled ? "text-green-600" : "text-red-500"}`} />
              <span className="text-slate-600">
                Model: {ollamaStatus.modelInstalled ? ollamaStatus.modelName : "Not Installed"}
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Fix Instructions */}
      {(fixInstructions && fixInstructions.length > 0) && (
        <div className="p-4">
          {/* Show different UI based on whether Ollama is working */}
          {ollamaStatus?.serverRunning && ollamaStatus?.modelInstalled ? (
            // Inference failed but Ollama is working - show simpler instructions
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-700" />
                <span className="text-sm font-medium text-amber-900">Troubleshooting:</span>
              </div>
              <ul className="text-sm text-amber-800 space-y-1 ml-6 list-disc">
                {fixInstructions
                  .filter(line => line.trim() && !line.trim().startsWith("ollama"))
                  .map((instruction, idx) => (
                    <li key={`instruction-${idx}`}>{instruction.trim()}</li>
                  ))}
              </ul>
              <p className="text-xs text-amber-700 mt-2">
                The model is loaded. Retrying usually works after the first attempt.
              </p>
            </div>
          ) : (
            // Ollama not running or model not installed - show terminal commands
            <>
              <div className="flex items-center gap-2 mb-3">
                <Terminal className="w-4 h-4 text-amber-700" />
                <span className="text-sm font-medium text-amber-900">To enable AI insights:</span>
              </div>
              
              {/* Command boxes */}
              <div className="space-y-2">
                {!ollamaStatus?.serverRunning && (
                  <CommandBox 
                    command="ollama serve" 
                    description="Start the Ollama server"
                    onCopy={handleCopy}
                    copied={copiedCommand === "ollama serve"}
                  />
                )}
                {!ollamaStatus?.modelInstalled && (
                  <CommandBox 
                    command={`ollama pull ${ollamaStatus?.modelName || DEFAULT_MODEL_NAME}`}
                    description="Download the LLaMA model"
                    onCopy={handleCopy}
                    copied={copiedCommand === `ollama pull ${ollamaStatus?.modelName || DEFAULT_MODEL_NAME}`}
                  />
                )}
              </div>
              
              {/* Additional info */}
              <div className="mt-4 flex items-start gap-2 text-xs text-amber-700">
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  Statistical insights are still available. AI-powered interpretation requires Ollama.
                  <a 
                    href="https://ollama.ai" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="ml-1 underline hover:text-amber-900"
                  >
                    Download Ollama
                  </a>
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

interface CommandBoxProps {
  command: string
  description: string
  onCopy: (command: string) => void
  copied: boolean
}

function CommandBox({ command, description, onCopy, copied }: CommandBoxProps) {
  return (
    <div className="bg-slate-900 rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800">
        <span className="text-xs text-slate-400">{description}</span>
        <button
          onClick={() => onCopy(command)}
          className="text-slate-400 hover:text-white transition p-1"
          title="Copy command"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
      <div className="px-3 py-2">
        <code className="text-sm text-green-400 font-mono">$ {command}</code>
      </div>
    </div>
  )
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface DatasetSelectorProps {
  selections: DatasetSelection[]
  onToggle: (datasetId: string) => void
  onSelectAll: () => void
  onClearAll: () => void
  disabled: boolean
}

function DatasetSelector({
  selections,
  onToggle,
  onSelectAll,
  onClearAll,
  disabled,
}: DatasetSelectorProps) {
  const selectedCount = selections.filter(s => s.selected).length
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">
          Select Datasets ({selectedCount} of {selections.length})
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSelectAll}
            disabled={disabled || selectedCount === selections.length}
          >
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onClearAll}
            disabled={disabled || selectedCount === 0}
          >
            Clear
          </Button>
        </div>
      </div>
      
      <div className="grid gap-2 max-h-60 overflow-y-auto pr-2">
        {selections.map((selection, index) => (
          <div
            key={`ai-select-${selection.datasetId}-${index}`}
            className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
              selection.selected 
                ? "bg-indigo-50 border-indigo-200" 
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
          >
            <Checkbox
              id={`ai-checkbox-${selection.datasetId}`}
              checked={selection.selected}
              onCheckedChange={() => onToggle(selection.datasetId)}
              disabled={disabled}
            />
            <div className="flex-1 min-w-0">
              <label
                htmlFor={`ai-checkbox-${selection.datasetId}`}
                className="text-sm font-medium text-slate-900 cursor-pointer truncate block"
              >
                {selection.datasetName}
              </label>
              <div className="flex gap-3 mt-1">
                <span className="text-xs text-slate-500">
                  {selection.rowCount.toLocaleString()} rows
                </span>
                <span className="text-xs text-slate-500">
                  {selection.numericColumns} numeric fields
                </span>
              </div>
            </div>
          </div>
        ))}
        
        {selections.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Database className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No datasets available</p>
            <p className="text-xs mt-1">Upload data to the Unified Repository first</p>
          </div>
        )}
      </div>
    </div>
  )
}

interface InsightCardProps {
  insight: AIInsight
  isExpanded: boolean
  onToggleExpand: () => void
}

function InsightCard({ insight, isExpanded, onToggleExpand }: InsightCardProps) {
  const iconMap: Record<string, React.ReactNode> = {
    pattern: <TrendingUp className="w-4 h-4" />,
    anomaly: <AlertTriangle className="w-4 h-4" />,
    correlation: <GitCompare className="w-4 h-4" />,
    summary: <FileText className="w-4 h-4" />,
    comparison: <BarChart3 className="w-4 h-4" />,
  }
  
  const confidenceColors: Record<string, string> = {
    high: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800",
    low: "bg-slate-100 text-slate-600",
  }
  
  const typeColors: Record<string, string> = {
    pattern: "bg-purple-100 text-purple-800 border-purple-200",
    anomaly: "bg-amber-100 text-amber-800 border-amber-200",
    correlation: "bg-blue-100 text-blue-800 border-blue-200",
    summary: "bg-slate-100 text-slate-800 border-slate-200",
    comparison: "bg-teal-100 text-teal-800 border-teal-200",
  }
  
  return (
    <Card className={`border ${typeColors[insight.type] || "border-slate-200"}`}>
      <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-slate-50/50 transition-colors py-3">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${typeColors[insight.type]?.split(" ")[0] || "bg-slate-100"}`}>
                  {iconMap[insight.type] || <Lightbulb className="w-4 h-4" />}
                </div>
                <div>
                  <CardTitle className="text-sm font-medium leading-tight">
                    {insight.title}
                  </CardTitle>
                  <div className="flex gap-2 mt-1.5">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {insight.type}
                    </Badge>
                    <Badge className={`text-[10px] ${confidenceColors[insight.confidence]}`}>
                      {insight.confidence} confidence
                    </Badge>
                  </div>
                </div>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              {insight.explanation}
            </p>
            
            {insight.scientificContext && (
              <div className="mt-3 p-2 bg-indigo-50 rounded text-xs text-indigo-700">
                <strong>Scientific Context:</strong> {insight.scientificContext}
              </div>
            )}
            
            {insight.relatedFields.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                <span className="text-xs text-slate-500 mr-1">Related fields:</span>
                {insight.relatedFields.map((field, idx) => (
                  <Badge key={`field-${insight.id}-${field}-${idx}`} variant="secondary" className="text-[10px]">
                    {field}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

interface PredictionCardProps {
  prediction: AIPrediction
}

function PredictionCard({ prediction }: PredictionCardProps) {
  const confidenceColors: Record<string, string> = {
    high: "border-green-300 bg-green-50",
    medium: "border-yellow-300 bg-yellow-50",
    low: "border-slate-300 bg-slate-50",
  }
  
  return (
    <Card className={`border-2 ${confidenceColors[prediction.confidence]}`}>
      <CardHeader className="py-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-indigo-600" />
          <CardTitle className="text-sm font-medium">
            Prediction: {prediction.targetField}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        <p className="text-sm text-slate-700 mb-3">{prediction.description}</p>
        
        <div className="space-y-2 text-xs">
          <div className="flex gap-2">
            <span className="font-medium text-slate-600">Based on:</span>
            <span className="text-slate-500">{prediction.basis}</span>
          </div>
          
          <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-700">
            <strong>⚠️ Caveat:</strong> {prediction.caveat}
          </div>
        </div>
        
        <Badge className="mt-3 text-[10px]" variant="outline">
          {prediction.confidence} confidence
        </Badge>
      </CardContent>
    </Card>
  )
}

interface AnalysisStatsProps {
  analysis: DeterministicAnalysisResult | null
}

function AnalysisStats({ analysis }: AnalysisStatsProps) {
  if (!analysis) return null
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <div className="bg-slate-50 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-indigo-600">
          {analysis.datasets.length}
        </div>
        <div className="text-xs text-slate-500">Datasets</div>
      </div>
      <div className="bg-slate-50 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-indigo-600">
          {analysis.totalRows.toLocaleString()}
        </div>
        <div className="text-xs text-slate-500">Total Rows</div>
      </div>
      <div className="bg-slate-50 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-indigo-600">
          {analysis.totalNumericFields}
        </div>
        <div className="text-xs text-slate-500">Numeric Fields</div>
      </div>
      <div className="bg-slate-50 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-indigo-600">
          {analysis.crossDatasetComparisons.length}
        </div>
        <div className="text-xs text-slate-500">Comparisons</div>
      </div>
    </div>
  )
}

// ============================================================================
// COMPUTED RESULTS COMPONENTS (NOT FROM LLM - ACTUAL STATISTICS)
// ============================================================================

interface ComputedResultsProps {
  analytics: PythonAnalyticsResult
}

function ComputedResults({ analytics }: ComputedResultsProps) {
  const [activeTab, setActiveTab] = useState<"correlations" | "regressions" | "predictions" | "outliers">("correlations")
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
        <BarChart3 className="w-4 h-4" />
        <span>Computed Results</span>
        <Badge variant="outline" className="ml-auto text-[10px] bg-emerald-50 border-emerald-200">
          Statistical Analysis
        </Badge>
      </div>
      
      {/* Tab Navigation */}
      <div className="flex gap-1 border-b">
        {[
          { id: "correlations", label: "Correlations", count: analytics.correlations?.length ?? 0 },
          { id: "regressions", label: "Regressions", count: analytics.regressions?.length ?? 0 },
          { id: "predictions", label: "Predictions", count: analytics.computed_predictions?.length ?? 0 },
          { id: "outliers", label: "Outliers", count: analytics.outliers?.length ?? 0 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      <div className="min-h-[200px]">
        {activeTab === "correlations" && (
          <CorrelationsTable correlations={analytics.correlations ?? []} />
        )}
        {activeTab === "regressions" && (
          <RegressionsTable regressions={analytics.regressions ?? []} />
        )}
        {activeTab === "predictions" && (
          <ComputedPredictionsTable predictions={analytics.computed_predictions ?? []} />
        )}
        {activeTab === "outliers" && (
          <OutliersTable outliers={analytics.outliers ?? []} />
        )}
      </div>
    </div>
  )
}

function CorrelationsTable({ correlations }: { correlations: EnhancedCorrelation[] }) {
  if (correlations.length === 0) {
    return <p className="text-sm text-slate-500 py-4">No significant correlations found.</p>
  }
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-slate-50">
            <th className="text-left py-2 px-2 font-medium">Field X</th>
            <th className="text-left py-2 px-2 font-medium">Field Y</th>
            <th className="text-right py-2 px-2 font-medium">Pearson r</th>
            <th className="text-right py-2 px-2 font-medium">p-value</th>
            <th className="text-center py-2 px-2 font-medium">Significant</th>
          </tr>
        </thead>
        <tbody>
          {correlations.slice(0, 10).map((corr, i) => (
            <tr key={`corr-${i}`} className="border-b hover:bg-slate-50">
              <td className="py-2 px-2 font-mono">{corr.x}</td>
              <td className="py-2 px-2 font-mono">{corr.y}</td>
              <td className={`py-2 px-2 text-right font-mono ${
                Math.abs(corr.pearson_r) > 0.7 ? "text-emerald-700 font-bold" :
                Math.abs(corr.pearson_r) > 0.5 ? "text-amber-700" : ""
              }`}>
                {corr.pearson_r.toFixed(3)}
              </td>
              <td className={`py-2 px-2 text-right font-mono ${
                corr.pearson_p < 0.001 ? "text-emerald-700" :
                corr.pearson_p < 0.05 ? "text-amber-700" : "text-slate-400"
              }`}>
                {corr.pearson_p < 0.001 ? "<0.001" : corr.pearson_p.toFixed(4)}
              </td>
              <td className="py-2 px-2 text-center">
                {corr.is_significant ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                ) : (
                  <XCircle className="w-4 h-4 text-slate-300 mx-auto" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RegressionsTable({ regressions }: { regressions: RegressionResult[] }) {
  if (regressions.length === 0) {
    return <p className="text-sm text-slate-500 py-4">No regression models with R² &gt; 0.4 found.</p>
  }
  
  return (
    <div className="space-y-3">
      {regressions.slice(0, 5).map((reg, i) => (
        <Card key={`reg-${i}`} className="border-emerald-200">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between mb-2">
              <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                {reg.target} = {reg.slope.toFixed(4)} × {reg.feature} + {reg.intercept.toFixed(4)}
              </code>
              <Badge className={reg.r2 > 0.7 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
                R² = {reg.r2.toFixed(3)}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs text-slate-600">
              <div>p-value: <span className="font-mono">{reg.p_value < 0.001 ? "<0.001" : reg.p_value.toFixed(4)}</span></div>
              <div>Samples: <span className="font-mono">{reg.n_samples}</span></div>
              <div>Std Error: <span className="font-mono">{reg.std_error.toFixed(4)}</span></div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ComputedPredictionsTable({ predictions }: { predictions: ComputedPrediction[] }) {
  if (predictions.length === 0) {
    return <p className="text-sm text-slate-500 py-4">No predictions computed (requires strong correlations R² &gt; 0.5).</p>
  }
  
  return (
    <div className="space-y-3">
      {predictions.map((pred, i) => (
        <Card key={`pred-${i}`} className="border-indigo-200 bg-indigo-50/30">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-indigo-600" />
              <span className="font-medium text-sm">{pred.target_field}</span>
              <Badge variant="outline" className={`ml-auto ${
                pred.confidence === "high" ? "border-emerald-300 text-emerald-700" : "border-amber-300 text-amber-700"
              }`}>
                {pred.confidence} confidence
              </Badge>
            </div>
            
            <code className="text-xs bg-white px-2 py-1 rounded border block mb-3">
              {pred.model_equation}
            </code>
            
            <div className="text-xs text-slate-600 mb-2">{pred.interpretation_hint}</div>
            
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-white rounded p-2 border">
                <div className="text-slate-500">At Min</div>
                <div className="font-mono font-bold">{pred.predictions_at_boundaries.at_min.predicted.toFixed(2)}</div>
                <div className="text-[10px] text-slate-400">
                  [{pred.predictions_at_boundaries.at_min.ci_lower.toFixed(2)}, {pred.predictions_at_boundaries.at_min.ci_upper.toFixed(2)}]
                </div>
              </div>
              <div className="bg-white rounded p-2 border border-indigo-200">
                <div className="text-slate-500">At Mean</div>
                <div className="font-mono font-bold text-indigo-700">{pred.predictions_at_boundaries.at_mean.predicted.toFixed(2)}</div>
                <div className="text-[10px] text-slate-400">
                  [{pred.predictions_at_boundaries.at_mean.ci_lower.toFixed(2)}, {pred.predictions_at_boundaries.at_mean.ci_upper.toFixed(2)}]
                </div>
              </div>
              <div className="bg-white rounded p-2 border">
                <div className="text-slate-500">At Max</div>
                <div className="font-mono font-bold">{pred.predictions_at_boundaries.at_max.predicted.toFixed(2)}</div>
                <div className="text-[10px] text-slate-400">
                  [{pred.predictions_at_boundaries.at_max.ci_lower.toFixed(2)}, {pred.predictions_at_boundaries.at_max.ci_upper.toFixed(2)}]
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function OutliersTable({ outliers }: { outliers: PythonAnalyticsResult["outliers"] }) {
  if (!outliers || outliers.length === 0) {
    return <p className="text-sm text-slate-500 py-4">No outliers detected.</p>
  }
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-slate-50">
            <th className="text-left py-2 px-2 font-medium">Field</th>
            <th className="text-right py-2 px-2 font-medium">Outliers</th>
            <th className="text-right py-2 px-2 font-medium">Ratio</th>
            <th className="text-right py-2 px-2 font-medium">Bounds</th>
          </tr>
        </thead>
        <tbody>
          {outliers.slice(0, 10).map((out, i) => (
            <tr key={`out-${i}`} className="border-b hover:bg-slate-50">
              <td className="py-2 px-2 font-mono">{out.field}</td>
              <td className="py-2 px-2 text-right font-mono text-amber-700">
                {out.total_outliers}
              </td>
              <td className="py-2 px-2 text-right font-mono">
                {(out.outlier_ratio * 100).toFixed(1)}%
              </td>
              <td className="py-2 px-2 text-right font-mono text-slate-500">
                [{out.lower_bound.toPrecision(3)}, {out.upper_bound.toPrecision(3)}]
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AIDiscoveryPanel() {
  // Access unified repository data
  const { datasets } = useDataContext()
  
  // Pipeline state
  const [pipelineState, setPipelineState] = useState<DiscoveryPipelineState>("idle")
  const [analysis, setAnalysis] = useState<DeterministicAnalysisResult | null>(null)
  const [insights, setInsights] = useState<LLaMAInsightResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null)
  
  // NEW: AI Mode and Ollama status
  const [aiMode, setAiMode] = useState<AIMode | null>(null)
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null)
  const [fixInstructions, setFixInstructions] = useState<string[] | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  
  // NEW: Python analytics results (COMPUTED, not from LLM)
  const [pythonAnalytics, setPythonAnalytics] = useState<PythonAnalyticsResult | null>(null)
  
  // NEW: Progress steps
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([
    { id: "prepare", label: "Preparing data", status: "pending" },
    { id: "check", label: "Checking AI engine", status: "pending" },
    { id: "stats", label: "Running statistical analysis", status: "pending" },
    { id: "llm", label: "Running LLaMA inference (may take 1-2 min)", status: "pending" },
  ])
  
  // Dataset selection state
  const [selections, setSelections] = useState<DatasetSelection[]>([])
  
  // Track previous dataset IDs to detect changes
  const prevDatasetIdsRef = useRef<Set<string>>(new Set())
  
  // Insight expansion state
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set())
  
  // Helper to update progress step
  const updateStep = useCallback((stepId: string, status: ProgressStep["status"]) => {
    setProgressSteps(prev => 
      prev.map(s => s.id === stepId ? { ...s, status } : s)
    )
  }, [])
  
  // Reset progress steps
  const resetProgressSteps = useCallback(() => {
    setProgressSteps([
      { id: "prepare", label: "Preparing data", status: "pending" },
      { id: "check", label: "Checking AI engine", status: "pending" },
      { id: "stats", label: "Running statistical analysis", status: "pending" },
      { id: "llm", label: "Running LLaMA inference (may take 1-2 min)", status: "pending" },
    ])
  }, [])
  
  // Sync selections with datasets using useEffect (NOT useMemo)
  // This prevents state updates during render
  useEffect(() => {
    const currentDatasetIds = new Set(datasets.map(d => d.id))
    const prevDatasetIds = prevDatasetIdsRef.current
    
    // Check if datasets changed
    const added = datasets.filter(d => !prevDatasetIds.has(d.id))
    const removed = [...prevDatasetIds].filter(id => !currentDatasetIds.has(id))
    
    if (added.length > 0 || removed.length > 0) {
      setSelections(prev => {
        // Keep existing selections that still exist
        const kept = prev.filter(s => currentDatasetIds.has(s.datasetId))
        
        // Add new datasets
        const newSelections = added.map(d => ({
          datasetId: d.id,
          datasetName: d.name,
          rowCount: d.rows.length,
          numericColumns: d.columns.filter(c => 
            c.semanticType && ["number", "distance", "mass", "brightness", "time", "angle", "temperature", "velocity"].includes(c.semanticType.toLowerCase())
          ).length || d.columns.length,
          selected: false,
        }))
        
        // Deduplicate by datasetId
        const combined = [...kept, ...newSelections]
        const seen = new Set<string>()
        const deduped = combined.filter(s => {
          if (seen.has(s.datasetId)) return false
          seen.add(s.datasetId)
          return true
        })
        
        return deduped
      })
    }
    
    // Update ref for next comparison
    prevDatasetIdsRef.current = currentDatasetIds
  }, [datasets])
  
  // Derived state
  const selectedDatasets = useMemo(() => 
    datasets.filter(d => selections.find(s => s.datasetId === d.id && s.selected)),
    [datasets, selections]
  )
  
  const canRunAnalysis = selectedDatasets.length > 0 && pipelineState === "idle"
  
  // Handlers
  const handleToggleDataset = useCallback((datasetId: string) => {
    setSelections(prev =>
      prev.map(s =>
        s.datasetId === datasetId ? { ...s, selected: !s.selected } : s
      )
    )
  }, [])
  
  const handleSelectAll = useCallback(() => {
    setSelections(prev => prev.map(s => ({ ...s, selected: true })))
  }, [])
  
  const handleClearAll = useCallback(() => {
    setSelections(prev => prev.map(s => ({ ...s, selected: false })))
  }, [])
  
  const handleToggleInsightExpand = useCallback((insightId: string) => {
    setExpandedInsights(prev => {
      const next = new Set(prev)
      if (next.has(insightId)) {
        next.delete(insightId)
      } else {
        next.add(insightId)
      }
      return next
    })
  }, [])
  
  // Run the AI Discovery pipeline with progress tracking
  const runAIInsights = useCallback(async (forceRefresh = false) => {
    if (selectedDatasets.length === 0) return
    
    // Reset state
    setError(null)
    setFallbackMessage(null)
    setAiMode(null)
    setOllamaStatus(null)
    setFixInstructions(null)
    resetProgressSteps()
    setPipelineState("analyzing")
    
    try {
      // Step 1: Prepare data
      updateStep("prepare", "active")
      await new Promise(resolve => setTimeout(resolve, 300)) // Brief delay for UX
      updateStep("prepare", "complete")
      
      // Step 2: Check AI engine (done server-side, but show progress)
      updateStep("check", "active")
      
      // Step 3: Run statistical analysis
      updateStep("stats", "active")
      const analysisResult = runDeterministicAnalysis(selectedDatasets)
      setAnalysis(analysisResult)
      updateStep("stats", "complete")
      
      // Step 4: LLaMA Insight Generation
      updateStep("llm", "active")
      setPipelineState("generating_insights")
      
      // Combine all raw data rows for Python analytics
      const allRows: Record<string, unknown>[] = []
      const allColumns = new Set<string>()
      
      for (const dataset of selectedDatasets) {
        for (const row of dataset.rows) {
          allRows.push(row)
        }
        for (const col of dataset.columns) {
          allColumns.add(col.name)
        }
      }
      
      const response = await fetch("/api/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysis: analysisResult,
          options: {
            maxInsights: 10,
            maxPredictions: 5,
            forceRefresh,
          },
          // Send raw data for Python analytics (enhanced stats with p-values)
          rawData: {
            rows: allRows,
            columns: Array.from(allColumns),
          },
        }),
      })
      
      const result = await response.json()
      
      // Update check step based on result
      updateStep("check", "complete")
      
      if (!result.success) {
        updateStep("llm", "error")
        throw new Error(result.error || "Failed to generate insights")
      }
      
      // Store Ollama status and mode
      setOllamaStatus(result.ollamaStatus || null)
      setAiMode(result.mode || "limited")
      setFixInstructions(result.fixInstructions || null)
      
      // Store Python analytics (computed results with p-values, regressions, etc.)
      if (result.pythonAnalytics?.analysis_complete) {
        setPythonAnalytics(result.pythonAnalytics)
      }
      
      // Update LLM step based on mode
      if (result.mode === "llm") {
        updateStep("llm", "complete")
      } else {
        // Limited mode - mark as complete but with different label
        setProgressSteps(prev => 
          prev.map(s => s.id === "llm" 
            ? { ...s, label: "Statistical analysis (AI unavailable)", status: "complete" }
            : s
          )
        )
      }
      
      setInsights(result.insights)
      
      if (result.fallbackMessage) {
        setFallbackMessage(result.fallbackMessage)
      }
      
      // Expand first insight by default
      if (result.insights?.insights?.length > 0) {
        setExpandedInsights(new Set([result.insights.insights[0].id]))
      }
      
      setPipelineState("complete")
      
    } catch (err) {
      console.error("AI Discovery error:", err)
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
      updateStep("llm", "error")
      setPipelineState("error")
    }
  }, [selectedDatasets, updateStep, resetProgressSteps])
  
  // Retry with force refresh
  const handleRetryAnalysis = useCallback(async () => {
    setIsRetrying(true)
    try {
      await runAIInsights(true) // Force refresh Ollama status cache
    } finally {
      setIsRetrying(false)
    }
  }, [runAIInsights])
  
  // Reset the panel
  const handleReset = useCallback(() => {
    setPipelineState("idle")
    setAnalysis(null)
    setInsights(null)
    setError(null)
    setFallbackMessage(null)
    setAiMode(null)
    setOllamaStatus(null)
    setFixInstructions(null)
    setExpandedInsights(new Set())
    setPythonAnalytics(null)
    resetProgressSteps()
  }, [resetProgressSteps])
  
  // Download insights
  const handleDownload = useCallback((format: "json" | "md") => {
    if (!insights) return
    
    let content: string
    let filename: string
    let mimeType: string
    
    if (format === "json") {
      content = JSON.stringify({ analysis, insights }, null, 2)
      filename = `ai-insights-${new Date().toISOString().slice(0, 10)}.json`
      mimeType = "application/json"
    } else {
      // Markdown format
      const lines: string[] = [
        "# AI Discovery Insights",
        "",
        `*Generated: ${insights.generatedAt}*`,
        "",
        `**Model:** ${insights.modelUsed}`,
        "",
        "---",
        "",
        "## Summary",
        "",
        insights.summary,
        "",
        "---",
        "",
        "## Insights",
        "",
      ]
      
      for (const insight of insights.insights) {
        lines.push(`### ${insight.title}`)
        lines.push(`**Type:** ${insight.type} | **Confidence:** ${insight.confidence}`)
        lines.push("")
        lines.push(insight.explanation)
        if (insight.scientificContext) {
          lines.push("")
          lines.push(`*Scientific Context:* ${insight.scientificContext}`)
        }
        lines.push("")
      }
      
      if (insights.predictions.length > 0) {
        lines.push("---")
        lines.push("")
        lines.push("## Predictions")
        lines.push("")
        
        for (const pred of insights.predictions) {
          lines.push(`### ${pred.targetField}`)
          lines.push(pred.description)
          lines.push("")
          lines.push(`*Basis:* ${pred.basis}`)
          lines.push("")
          lines.push(`> ⚠️ **Caveat:** ${pred.caveat}`)
          lines.push("")
        }
      }
      
      lines.push("---")
      lines.push("")
      lines.push(`*${insights.disclaimer}*`)
      
      content = lines.join("\n")
      filename = `ai-insights-${new Date().toISOString().slice(0, 10)}.md`
      mimeType = "text/markdown"
    }
    
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [analysis, insights])
  
  // Render
  return (
    <Card className="w-full border-indigo-200">
      <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Brain className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <CardTitle className="text-lg">AI-Assisted Discovery</CardTitle>
              <CardDescription>
                Select datasets and run AI-powered insights
              </CardDescription>
            </div>
          </div>
          
          {pipelineState === "complete" && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload("json")}
                className="gap-1"
              >
                <Download className="w-3 h-3" />
                JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload("md")}
                className="gap-1"
              >
                <Download className="w-3 h-3" />
                Markdown
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                New Analysis
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-4 space-y-4">
        {/* Dataset Selection (shown when idle or selecting) */}
        {(pipelineState === "idle" || pipelineState === "selecting") && (
          <>
            <DatasetSelector
              selections={selections}
              onToggle={handleToggleDataset}
              onSelectAll={handleSelectAll}
              onClearAll={handleClearAll}
              disabled={pipelineState !== "idle"}
            />
            
            <div className="flex justify-center pt-2">
              <Button
                onClick={() => runAIInsights(false)}
                disabled={!canRunAnalysis}
                className="gap-2 bg-indigo-600 hover:bg-indigo-700"
              >
                <Sparkles className="w-4 h-4" />
                Run AI Insights
              </Button>
            </div>
          </>
        )}
        
        {/* Loading States with Progress Steps */}
        {(pipelineState === "analyzing" || pipelineState === "generating_insights") && (
          <div className="py-8 space-y-6">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
              <p className="font-medium text-slate-800">
                Running AI Discovery...
              </p>
              <p className="text-sm text-slate-500 mt-1">
                This may take a moment
              </p>
            </div>
            
            <div className="max-w-sm mx-auto">
              <ProgressSteps steps={progressSteps} />
            </div>
          </div>
        )}
        
        {/* Error State */}
        {pipelineState === "error" && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="p-3 bg-red-100 rounded-full">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <div className="text-center">
              <p className="font-medium text-red-800">Analysis Failed</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
          </div>
        )}
        
        {/* Results */}
        {pipelineState === "complete" && insights && (
          <div className="space-y-6">
            {/* Mode Badge */}
            {aiMode && (
              <div className="flex items-center gap-2">
                <Badge 
                  variant={aiMode === "llm" ? "default" : "secondary"}
                  className={aiMode === "llm" 
                    ? "bg-green-100 text-green-800 hover:bg-green-100" 
                    : "bg-amber-100 text-amber-800 hover:bg-amber-100"
                  }
                >
                  {aiMode === "llm" ? (
                    <>
                      <Brain className="w-3 h-3 mr-1" />
                      AI-Powered Insights
                    </>
                  ) : (
                    <>
                      <BarChart3 className="w-3 h-3 mr-1" />
                      Statistical Insights Only
                    </>
                  )}
                </Badge>
                {aiMode === "llm" && ollamaStatus?.modelName && (
                  <span className="text-xs text-slate-500">
                    using {ollamaStatus.modelName}
                  </span>
                )}
              </div>
            )}
            
            {/* Analysis Stats */}
            <AnalysisStats analysis={analysis} />
            
            {/* COMPUTED RESULTS (ACTUAL STATISTICS - NOT FROM LLM) */}
            {pythonAnalytics?.analysis_complete && (
              <Card className="border-emerald-200 bg-emerald-50/30">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-600" />
                    Computed Statistical Results
                    <Badge variant="outline" className="ml-auto text-[10px] bg-white border-emerald-300 text-emerald-700">
                      {pythonAnalytics.correlations?.length ?? 0} correlations • 
                      {pythonAnalytics.regressions?.length ?? 0} regressions • 
                      {pythonAnalytics.computed_predictions?.length ?? 0} predictions
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs text-emerald-700">
                    These are deterministic statistics computed from your data (not generated by AI)
                  </CardDescription>
                  
                  {/* Metadata */}
                  <div className="flex gap-4 mt-2 text-xs text-slate-600">
                    <span>Rows analyzed: <strong>{pythonAnalytics.summary?.total_rows ?? 0}</strong></span>
                    <span>Numeric fields: <strong>{pythonAnalytics.summary?.numeric_columns ?? 0}</strong></span>
                  </div>
                  
                  {/* Warning if no correlations */}
                  {(pythonAnalytics.correlations?.length ?? 0) === 0 && (pythonAnalytics.summary?.numeric_columns ?? 0) >= 2 && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                      <AlertTriangle className="w-3 h-3 inline mr-1" />
                      No significant correlations found between numeric fields. 
                      This may indicate the variables are independent or have insufficient variance.
                    </div>
                  )}
                  
                  {/* Warning if not enough numeric fields */}
                  {(pythonAnalytics.summary?.numeric_columns ?? 0) < 2 && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                      <AlertTriangle className="w-3 h-3 inline mr-1" />
                      Not enough numeric fields for correlation analysis. 
                      Need at least 2 numeric columns with variance.
                    </div>
                  )}
                </CardHeader>
                <CardContent className="py-3">
                  <ComputedResults analytics={pythonAnalytics} />
                </CardContent>
              </Card>
            )}
            
            {/* Limited Mode Banner with Fix Instructions */}
            {aiMode === "limited" && fallbackMessage && (
              <LimitedModeBanner
                ollamaStatus={ollamaStatus || undefined}
                fallbackMessage={fallbackMessage}
                fixInstructions={fixInstructions || undefined}
                onRetry={handleRetryAnalysis}
                isRetrying={isRetrying}
              />
            )}
            
            {/* AI INTERPRETATION SECTION */}
            <div className="pt-4 border-t">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-indigo-900">AI Interpretation</h3>
                <Badge variant="outline" className="text-[10px] bg-indigo-50 border-indigo-200 text-indigo-700">
                  {aiMode === "llm" ? "LLaMA 3.1" : "Template-based"}
                </Badge>
              </div>
              
              {/* Summary */}
              <div className={`p-4 rounded-lg border mb-4 ${
                aiMode === "llm" 
                  ? "bg-indigo-50 border-indigo-200" 
                  : "bg-slate-50 border-slate-200"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className={`w-4 h-4 ${aiMode === "llm" ? "text-indigo-600" : "text-slate-600"}`} />
                  <span className={`font-medium ${aiMode === "llm" ? "text-indigo-900" : "text-slate-900"}`}>
                    Analysis Summary
                  </span>
                </div>
                <p className={`text-sm ${aiMode === "llm" ? "text-indigo-800" : "text-slate-700"}`}>
                  {insights.summary}
                </p>
              </div>
            </div>
            
            {/* AI Insights (Interpretations of computed results) */}
            {insights.insights.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  AI Insights ({insights.insights.length})
                  <span className="text-xs font-normal text-slate-500">
                    (interpretations of computed statistics)
                  </span>
                </h3>
                <div className="space-y-2">
                  {insights.insights.map((insight, index) => (
                    <InsightCard
                      key={`ai-insight-${insight.id}-${index}`}
                      insight={insight}
                      isExpanded={expandedInsights.has(insight.id)}
                      onToggleExpand={() => handleToggleInsightExpand(insight.id)}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Predictions */}
            {insights.predictions.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Predictions ({insights.predictions.length})
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {insights.predictions.map((prediction, index) => (
                    <PredictionCard key={`ai-prediction-${prediction.id}-${index}`} prediction={prediction} />
                  ))}
                </div>
              </div>
            )}
            
            {/* Disclaimer */}
            <div className="text-center text-xs text-slate-500 pt-4 border-t">
              <p>{insights.disclaimer}</p>
              <p className="mt-1">Model: {insights.modelUsed} • Generated: {new Date(insights.generatedAt).toLocaleString()}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
