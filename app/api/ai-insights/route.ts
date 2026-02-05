/**
 * AI Insights API Route
 * 
 * Handles requests to generate AI-powered insights from astronomical data.
 * 
 * NEW ARCHITECTURE:
 * 1. Optionally run Python analytics for enhanced statistics (p-values, regressions)
 * 2. Pass COMPUTED results to LLaMA for interpretation only
 * 3. LLaMA explains what the numbers mean, does NOT compute anything
 */

import { NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import path from "path"

// Configure for longer running requests (LLaMA inference can take time)
export const maxDuration = 180 // 3 minutes max for serverless
export const dynamic = "force-dynamic"
import type { 
  DeterministicAnalysisResult, 
  AIInsightsRequest, 
  AIInsightsResponse,
  LLaMAInsightResponse,
  PythonAnalyticsResult,
} from "@/lib/ai-discovery/types"
import { 
  generateLLaMAInsights, 
  generateFallbackInsights,
  checkOllamaAvailability,
  clearOllamaStatusCache,
} from "@/lib/ai-discovery/llama-insights"
import { AI_CONFIG } from "@/lib/ai/config"
import type { OllamaStatus } from "@/lib/ai-discovery/llama-insights"

// ============================================================================
// EXTENDED TYPES
// ============================================================================

interface ExtendedAIInsightsRequest extends AIInsightsRequest {
  rawData?: {
    rows: Record<string, unknown>[]
    columns: string[]
  }
}

interface ExtendedAIInsightsResponse extends AIInsightsResponse {
  ollamaStatus?: OllamaStatus
  mode?: "llm" | "limited"
  fixInstructions?: string[]
  pythonAnalytics?: PythonAnalyticsResult
}

// ============================================================================
// JAVASCRIPT FALLBACK ANALYTICS (When Python is unavailable)
// ============================================================================

interface JSAnalyticsResult {
  correlations: Array<{
    x: string
    y: string
    pearson_r: number
    pearson_p: number
    n_samples: number
    is_significant: boolean
  }>
  field_statistics: Array<{
    field: string
    count: number
    mean: number
    std: number
    min: number
    max: number
  }>
  metadata: {
    rows_used: number
    fields_used: number
    analysis_method: "javascript"
  }
}

/**
 * Compute Pearson correlation coefficient (pure JS implementation)
 */
function computePearsonCorrelation(x: number[], y: number[]): { r: number; p: number } {
  const n = x.length
  if (n < 5) return { r: 0, p: 1 }
  
  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0)
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0)
  const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0)
  
  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
  
  if (denominator === 0) return { r: 0, p: 1 }
  
  const r = numerator / denominator
  
  // Approximate p-value using t-distribution (simplified)
  const t = r * Math.sqrt((n - 2) / (1 - r * r))
  // Simplified p-value approximation
  const p = n > 30 ? Math.exp(-0.5 * t * t) : Math.min(1, 2 / (1 + Math.exp(Math.abs(t))))
  
  return { r, p }
}

/**
 * Extract numeric values from rows for a specific column
 */
function extractNumericColumn(rows: Record<string, unknown>[], colName: string): number[] {
  const values: number[] = []
  for (const row of rows) {
    const val = row[colName]
    if (val === null || val === undefined || val === "") continue
    const num = typeof val === "number" ? val : parseFloat(String(val))
    if (!Number.isNaN(num) && Number.isFinite(num)) {
      values.push(num)
    }
  }
  return values
}

/**
 * JavaScript-based analytics fallback (no Python dependencies)
 */
function runJSAnalytics(
  rows: Record<string, unknown>[],
  columns: string[]
): JSAnalyticsResult {
  console.log(`[JS-Analytics] Starting analysis: ${rows.length} rows, ${columns.length} columns`)
  
  // Identify numeric columns
  const numericColumns: string[] = []
  const columnData: Map<string, number[]> = new Map()
  
  for (const col of columns) {
    const values = extractNumericColumn(rows, col)
    if (values.length >= 5) { // Need at least 5 values
      // Check for variance (not constant)
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length
      if (variance > 1e-10) {
        numericColumns.push(col)
        columnData.set(col, values)
      }
    }
  }
  
  console.log(`[JS-Analytics] Found ${numericColumns.length} numeric columns with variance`)
  
  // Compute correlations between all pairs
  const correlations: JSAnalyticsResult["correlations"] = []
  
  for (let i = 0; i < numericColumns.length; i++) {
    for (let j = i + 1; j < numericColumns.length; j++) {
      const col1 = numericColumns[i]
      const col2 = numericColumns[j]
      
      // Get paired values (both must be valid in same row)
      const pairedX: number[] = []
      const pairedY: number[] = []
      
      for (const row of rows) {
        const v1 = row[col1]
        const v2 = row[col2]
        if (v1 === null || v1 === undefined || v2 === null || v2 === undefined) continue
        
        const n1 = typeof v1 === "number" ? v1 : parseFloat(String(v1))
        const n2 = typeof v2 === "number" ? v2 : parseFloat(String(v2))
        
        if (!Number.isNaN(n1) && !Number.isNaN(n2) && Number.isFinite(n1) && Number.isFinite(n2)) {
          pairedX.push(n1)
          pairedY.push(n2)
        }
      }
      
      if (pairedX.length >= 5) {
        const { r, p } = computePearsonCorrelation(pairedX, pairedY)
        
        // Include if meaningful correlation
        if (Math.abs(r) > 0.2 || p < 0.1) {
          correlations.push({
            x: col1,
            y: col2,
            pearson_r: Math.round(r * 10000) / 10000,
            pearson_p: Math.round(p * 100000) / 100000,
            n_samples: pairedX.length,
            is_significant: p < 0.05 && Math.abs(r) > 0.3,
          })
        }
      }
    }
  }
  
  // Sort by absolute correlation
  correlations.sort((a, b) => Math.abs(b.pearson_r) - Math.abs(a.pearson_r))
  
  console.log(`[JS-Analytics] Computed ${correlations.length} correlations`)
  
  // Compute field statistics
  const field_statistics: JSAnalyticsResult["field_statistics"] = []
  for (const col of numericColumns) {
    const values = columnData.get(col) || []
    if (values.length === 0) continue
    
    const sorted = [...values].sort((a, b) => a - b)
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length
    
    field_statistics.push({
      field: col,
      count: values.length,
      mean: Math.round(mean * 1000000) / 1000000,
      std: Math.round(Math.sqrt(variance) * 1000000) / 1000000,
      min: sorted[0],
      max: sorted[sorted.length - 1],
    })
  }
  
  return {
    correlations: correlations.slice(0, 20),
    field_statistics,
    metadata: {
      rows_used: rows.length,
      fields_used: numericColumns.length,
      analysis_method: "javascript",
    },
  }
}

// ============================================================================
// PYTHON ANALYTICS (PRIMARY - WITH FALLBACK)
// ============================================================================

/**
 * Run Python analytics engine to compute:
 * - Correlations with p-values
 * - Regressions with confidence intervals
 * - Outliers with z-scores
 * - Numeric predictions
 * 
 * Falls back to JS analytics if Python fails.
 */
async function runPythonAnalytics(
  rows: Record<string, unknown>[],
  columns: string[]
): Promise<PythonAnalyticsResult | null> {
  return new Promise((resolve) => {
    try {
      const scriptPath = path.join(process.cwd(), "lib", "python-analytics", "analytics_engine.py")
      
      // Try python3 first, then python
      const pythonCommands = ["python3", "python"]
      let tried = 0
      
      function tryPython(cmd: string) {
        console.log(`[AI-Insights] Trying ${cmd}...`)
        
        const python = spawn(cmd, [scriptPath], {
          cwd: process.cwd(),
          env: { ...process.env, PYTHONIOENCODING: "utf-8" },
          shell: true,
        })
        
        let stdout = ""
        let stderr = ""
        
        // Set timeout to 30 seconds
        const timeout = setTimeout(() => {
          python.kill()
          console.warn(`[AI-Insights] Python (${cmd}) timed out`)
          tried++
          if (tried < pythonCommands.length) {
            tryPython(pythonCommands[tried])
          } else {
            console.warn("[AI-Insights] All Python commands failed, using JS fallback")
            const jsResult = runJSAnalytics(rows, columns)
            resolve(convertJSToFullResult(jsResult))
          }
        }, 30000)
        
        python.stdout.on("data", (data: Buffer) => {
          stdout += data.toString()
        })
        
        python.stderr.on("data", (data: Buffer) => {
          stderr += data.toString()
        })
        
        python.on("close", (code: number | null) => {
          clearTimeout(timeout)
          
          if (code !== 0) {
            console.warn(`[AI-Insights] Python (${cmd}) error (code ${code}):`, stderr || "(no stderr)")
            console.warn(`[AI-Insights] Python stdout:`, stdout.slice(0, 500))
            tried++
            if (tried < pythonCommands.length) {
              tryPython(pythonCommands[tried])
            } else {
              console.warn("[AI-Insights] All Python commands failed, using JS fallback")
              const jsResult = runJSAnalytics(rows, columns)
              resolve(convertJSToFullResult(jsResult))
            }
            return
          }
          
          try {
            const result = JSON.parse(stdout) as PythonAnalyticsResult
            console.log("[AI-Insights] Python analytics complete:", {
              correlations: result.correlations?.length ?? 0,
              regressions: result.regressions?.length ?? 0,
              predictions: result.computed_predictions?.length ?? 0,
            })
            
            // Validate result structure
            if (!result.correlations || !result.field_statistics) {
              console.warn("[AI-Insights] Invalid Python result structure, using JS fallback")
              const jsResult = runJSAnalytics(rows, columns)
              resolve(convertJSToFullResult(jsResult))
              return
            }
            
            resolve(result)
          } catch (parseErr) {
            console.warn("[AI-Insights] Failed to parse Python output:", parseErr)
            console.warn("[AI-Insights] Stdout was:", stdout.slice(0, 500))
            const jsResult = runJSAnalytics(rows, columns)
            resolve(convertJSToFullResult(jsResult))
          }
        })
        
        python.on("error", (err: Error) => {
          clearTimeout(timeout)
          console.warn(`[AI-Insights] Python (${cmd}) spawn error:`, err.message)
          tried++
          if (tried < pythonCommands.length) {
            tryPython(pythonCommands[tried])
          } else {
            console.warn("[AI-Insights] All Python commands failed, using JS fallback")
            const jsResult = runJSAnalytics(rows, columns)
            resolve(convertJSToFullResult(jsResult))
          }
        })
        
        // Send data to Python via stdin
        const inputData = JSON.stringify({ rows, columns })
        console.log(`[AI-Insights] Sending ${inputData.length} bytes to Python`)
        python.stdin.write(inputData)
        python.stdin.end()
      }
      
      tryPython(pythonCommands[0])
      
    } catch (err) {
      console.warn("[AI-Insights] Python analytics setup failed:", err)
      const jsResult = runJSAnalytics(rows, columns)
      resolve(convertJSToFullResult(jsResult))
    }
  })
}

/**
 * Convert JS analytics result to full PythonAnalyticsResult format
 */
function convertJSToFullResult(jsResult: JSAnalyticsResult): PythonAnalyticsResult {
  return {
    summary: {
      total_rows: jsResult.metadata.rows_used,
      total_columns: jsResult.metadata.fields_used,
      numeric_columns: jsResult.metadata.fields_used,
      numeric_column_names: jsResult.field_statistics.map(f => f.field),
    },
    field_statistics: jsResult.field_statistics.map(f => ({
      field: f.field,
      count: f.count,
      null_count: 0,
      mean: f.mean,
      median: f.mean, // Approximation
      std: f.std,
      min: f.min,
      max: f.max,
      range: f.max - f.min,
      q1: f.min + (f.max - f.min) * 0.25,
      q3: f.min + (f.max - f.min) * 0.75,
      iqr: (f.max - f.min) * 0.5,
      skewness: 0,
      kurtosis: 0,
      is_normal_distribution: false,
      normality_p_value: 0,
      coefficient_of_variation: f.mean !== 0 ? f.std / Math.abs(f.mean) : 0,
    })),
    correlations: jsResult.correlations.map(c => ({
      x: c.x,
      y: c.y,
      pearson_r: c.pearson_r,
      pearson_p: c.pearson_p,
      spearman_r: c.pearson_r, // Use Pearson as approximation
      spearman_p: c.pearson_p,
      n_samples: c.n_samples,
      is_significant: c.is_significant,
    })),
    regressions: [], // JS fallback doesn't compute regressions
    outliers: [], // JS fallback doesn't compute outliers
    computed_predictions: [], // JS fallback doesn't compute predictions
    analysis_complete: true,
  }
}

// ============================================================================
// API HANDLERS
// ============================================================================

/**
 * POST /api/ai-insights
 * 
 * Generate AI insights from astronomical data.
 * 
 * NEW FLOW:
 * 1. Run Python analytics to compute statistics with p-values
 * 2. Pass COMPUTED results to LLaMA for interpretation
 * 3. Return both computed results and AI interpretations
 */
export async function POST(request: NextRequest): Promise<NextResponse<ExtendedAIInsightsResponse>> {
  const startTime = Date.now()
  
  try {
    // Parse request body
    const body: ExtendedAIInsightsRequest = await request.json()
    const { analysis, options, rawData } = body
    
    // Check for force refresh flag
    const forceRefresh = body.options?.forceRefresh === true
    if (forceRefresh) {
      clearOllamaStatusCache()
    }
    
    // Validate analysis data
    if (!analysis || !analysis.datasets || analysis.datasets.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Invalid analysis data: no datasets provided",
      }, { status: 400 })
    }
    
    console.log(`[AI-Insights] Starting analysis for ${analysis.datasets.length} dataset(s)`)
    
    // STEP 1: Run Python analytics if raw data is provided
    // This computes correlations with p-values, regressions, etc.
    let pythonAnalytics: PythonAnalyticsResult | null = null
    
    if (rawData && rawData.rows && rawData.rows.length > 0) {
      console.log(`[AI-Insights] Running Python analytics on ${rawData.rows.length} rows...`)
      pythonAnalytics = await runPythonAnalytics(rawData.rows, rawData.columns)
      
      if (pythonAnalytics?.analysis_complete) {
        console.log(`[AI-Insights] Python analytics complete:`, {
          correlations: pythonAnalytics.correlations?.length ?? 0,
          regressions: pythonAnalytics.regressions?.length ?? 0,
          predictions: pythonAnalytics.computed_predictions?.length ?? 0,
        })
      }
    }
    
    // STEP 2: VALIDATE STATISTICS BEFORE LLM
    // If no correlations AND no regressions, don't waste LLM tokens
    const hasCorrelations = (pythonAnalytics?.correlations?.length ?? 0) > 0
    const hasRegressions = (pythonAnalytics?.regressions?.length ?? 0) > 0
    const hasNumericFields = (pythonAnalytics?.summary?.numeric_columns ?? 0) >= 2
    
    console.log(`[AI-Insights] Statistics validation:`, {
      hasCorrelations,
      correlationsCount: pythonAnalytics?.correlations?.length ?? 0,
      hasRegressions,
      regressionsCount: pythonAnalytics?.regressions?.length ?? 0,
      hasNumericFields,
      numericFieldsCount: pythonAnalytics?.summary?.numeric_columns ?? 0,
    })
    
    // If we have less than 2 numeric fields, correlations are impossible
    if (!hasNumericFields) {
      console.warn("[AI-Insights] Not enough numeric fields for statistical analysis")
      return NextResponse.json({
        success: true,
        insights: {
          insights: [{
            id: "no-numeric-data",
            type: "summary" as const,
            title: "Insufficient Numeric Data",
            explanation: "The selected datasets do not contain at least 2 numeric columns with sufficient variance for correlation analysis. Statistical comparisons require multiple numeric fields.",
            confidence: "high" as const,
            relatedFields: [],
            relatedDatasets: analysis.datasets.map(d => d.datasetName),
          }],
          predictions: [],
          summary: "Unable to compute statistical relationships - insufficient numeric data.",
          modelUsed: "validation",
          generatedAt: new Date().toISOString(),
          disclaimer: "No AI analysis was performed due to insufficient data.",
        },
        mode: "limited",
        pythonAnalytics,
        fallbackMessage: "Not enough numeric columns with variance for statistical analysis. Need at least 2 numeric fields.",
      })
    }
    
    // If we have numeric fields but no correlations, warn but continue with basic stats
    if (!hasCorrelations && !hasRegressions) {
      console.warn("[AI-Insights] No significant correlations or regressions found")
    }
    
    // STEP 3: Check if Ollama is available for LLM interpretation
    const ollamaStatus = await checkOllamaAvailability(forceRefresh)
    
    console.log(`[AI-Insights] Ollama status:`, {
      available: ollamaStatus.available,
      serverRunning: ollamaStatus.serverRunning,
      modelInstalled: ollamaStatus.modelInstalled,
      modelName: ollamaStatus.modelName,
      errorCode: ollamaStatus.errorCode,
    })
    
    let insights: LLaMAInsightResponse
    let mode: "llm" | "limited"
    
    if (ollamaStatus.available) {
      // STEP 4: Pass computed results to LLaMA for interpretation
      mode = "llm"
      
      try {
        console.log(`[AI-Insights] Running LLaMA inference with model: ${ollamaStatus.modelName}`)
        console.log(`[AI-Insights] Passing ${pythonAnalytics ? "Python" : "basic JS"} analytics to LLaMA`)
        console.log(`[AI-Insights] Analytics summary:`, {
          correlations: pythonAnalytics?.correlations?.length ?? 0,
          regressions: pythonAnalytics?.regressions?.length ?? 0,
          predictions: pythonAnalytics?.computed_predictions?.length ?? 0,
          fields: pythonAnalytics?.field_statistics?.length ?? 0,
        })
        
        // Pass Python analytics to LLaMA so it can interpret actual numbers
        insights = await generateLLaMAInsights(analysis, {
          ...options,
          pythonAnalytics: pythonAnalytics || undefined,
        })
        
        const elapsed = Date.now() - startTime
        console.log(`[AI-Insights] LLaMA inference complete in ${elapsed}ms`)
        
        return NextResponse.json({
          success: true,
          insights,
          mode,
          ollamaStatus,
          // Include Python analytics in response for UI to display computed results
          pythonAnalytics: pythonAnalytics || undefined,
        })
        
      } catch (llamaError) {
        const errorMessage = llamaError instanceof Error ? llamaError.message : "Unknown error"
        const isTimeout = errorMessage.includes("timed out") || errorMessage.includes("aborted")
        
        console.error(`[AI-Insights] LLaMA generation error:`, errorMessage)
        
        // Fall back to deterministic insights
        mode = "limited"
        insights = generateFallbackInsights(analysis)
        
        // Provide specific fix instructions based on error type
        const instructions = isTimeout ? [
          "LLaMA inference timed out.",
          "This often happens on first run while the model loads.",
          "",
          "Try these solutions:",
          "  1. Click 'Retry AI Analysis' - the model may be loaded now",
          "  2. Wait a few seconds and try again",
          "  3. If using a large dataset, try selecting fewer datasets",
        ] : [
          "LLaMA inference failed.",
          "",
          "Try these solutions:",
          "  1. Click 'Retry AI Analysis'",
          "  2. Restart Ollama: ollama serve",
          `  3. Re-pull the model: ollama pull ${AI_CONFIG.model}`,
        ]
        
        return NextResponse.json({
          success: true,
          insights,
          mode,
          ollamaStatus,
          // Still include Python analytics - computed results are valid even if LLM fails
          pythonAnalytics: pythonAnalytics || undefined,
          fallbackMessage: isTimeout 
            ? "LLaMA took too long to respond. This often happens on first run. Try again - the model may be loaded now."
            : `LLaMA encountered an error: ${errorMessage}. Showing statistical insights instead.`,
          fixInstructions: instructions,
        })
      }
    } else {
      // Generate fallback insights - Limited Mode
      mode = "limited"
      insights = generateFallbackInsights(analysis)
      
      console.log(`[AI-Insights] Running in Limited Mode - ${ollamaStatus.errorCode}`)
      
      return NextResponse.json({
        success: true,
        insights,
        mode,
        ollamaStatus,
        // Still include Python analytics - computed results work without LLM
        pythonAnalytics: pythonAnalytics || undefined,
        fallbackMessage: buildFallbackMessage(ollamaStatus),
        fixInstructions: ollamaStatus.fixInstructions,
      })
    }
    
  } catch (error) {
    console.error("[AI-Insights] API error:", error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      mode: "limited",
    }, { status: 500 })
  }
}

/**
 * GET /api/ai-insights
 * 
 * Check API status and Ollama availability.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Check for force refresh
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get("refresh") === "true"
    
    if (forceRefresh) {
      clearOllamaStatusCache()
    }
    
    const ollamaStatus = await checkOllamaAvailability(forceRefresh)
    
    return NextResponse.json({
      status: "ok",
      ollama: ollamaStatus,
      config: {
        modelName: AI_CONFIG.model,
        alternateNames: AI_CONFIG.alternateModels,
      },
      endpoints: {
        POST: "Generate AI insights from analysis data",
        GET: "Check API and Ollama status (add ?refresh=true to force refresh)",
      },
    })
  } catch (error) {
    return NextResponse.json({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 })
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build a user-friendly fallback message based on the Ollama status.
 */
function buildFallbackMessage(status: OllamaStatus): string {
  if (!status.serverRunning) {
    return `Ollama is not running. Start Ollama and pull ${AI_CONFIG.model} to enable AI insights.`
  }
  
  if (!status.modelInstalled) {
    return `Model "${AI_CONFIG.model}" is not installed. Run 'ollama pull ${AI_CONFIG.model}' to enable AI insights.`
  }
  
  return status.error || "LLaMA is not available. Showing statistical insights instead."
}
