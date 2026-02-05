/**
 * Python Analytics API Route
 * 
 * Calls the Python analytics engine to compute:
 * - Correlations with p-values
 * - Regressions with coefficients and confidence intervals
 * - Outlier detection with z-scores
 * - Numeric predictions
 * 
 * ALL MATH IS DONE IN PYTHON. This route just orchestrates the call.
 */

import { NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import path from "path"

// Configure for longer running requests
export const maxDuration = 60 // 1 minute max
export const dynamic = "force-dynamic"

// Types for analytics results
export interface FieldStatistic {
  field: string
  count: number
  null_count: number
  mean: number
  median: number
  std: number
  min: number
  max: number
  range: number
  q1: number
  q3: number
  iqr: number
  skewness: number
  kurtosis: number
  is_normal_distribution: boolean
  normality_p_value: number
  coefficient_of_variation: number
}

export interface Correlation {
  x: string
  y: string
  pearson_r: number
  pearson_p: number
  spearman_r: number
  spearman_p: number
  n_samples: number
  is_significant: boolean
}

export interface Regression {
  target: string
  feature: string
  slope: number
  intercept: number
  r2: number
  correlation: number
  p_value: number
  std_error: number
  n_samples: number
  sample_predictions: Array<{
    input_value: number
    predicted_value: number
    confidence_interval: [number, number]
  }>
}

export interface OutlierInfo {
  field: string
  total_outliers: number
  outlier_ratio: number
  mean: number
  std: number
  lower_bound: number
  upper_bound: number
  outlier_details: Array<{
    row_index: number
    value: number
    z_score: number
    is_extreme: boolean
  }>
}

export interface ComputedPrediction {
  type: "regression_based"
  target_field: string
  predictor_field: string
  model_r2: number
  model_equation: string
  predictions_at_boundaries: {
    at_min: { input: number; predicted: number; ci_lower: number; ci_upper: number }
    at_mean: { input: number; predicted: number; ci_lower: number; ci_upper: number }
    at_max: { input: number; predicted: number; ci_lower: number; ci_upper: number }
  }
  interpretation_hint: string
  confidence: "high" | "medium" | "low"
}

export interface AnalyticsResult {
  summary: {
    total_rows: number
    total_columns: number
    numeric_columns: number
    numeric_column_names: string[]
  }
  field_statistics: FieldStatistic[]
  correlations: Correlation[]
  regressions: Regression[]
  outliers: OutlierInfo[]
  computed_predictions: ComputedPrediction[]
  analysis_complete: boolean
  error?: string
}

interface AnalyticsRequest {
  datasetId: string
  datasetName: string
  rows: Record<string, unknown>[]
  columns: string[]
}

/**
 * Run Python analytics engine
 */
async function runPythonAnalytics(data: AnalyticsRequest): Promise<AnalyticsResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "lib", "python-analytics", "analytics_engine.py")
    
    const python = spawn("python", [scriptPath], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    })
    
    let stdout = ""
    let stderr = ""
    
    python.stdout.on("data", (data: Buffer) => {
      stdout += data.toString()
    })
    
    python.stderr.on("data", (data: Buffer) => {
      stderr += data.toString()
    })
    
    python.on("close", (code: number) => {
      if (code !== 0) {
        console.error("[Analytics] Python error:", stderr)
        reject(new Error(`Python analytics failed with code ${code}: ${stderr}`))
        return
      }
      
      try {
        const result = JSON.parse(stdout) as AnalyticsResult
        resolve(result)
      } catch (parseError) {
        reject(new Error(`Failed to parse Python output: ${stdout}`))
      }
    })
    
    python.on("error", (err: Error) => {
      reject(new Error(`Failed to start Python: ${err.message}`))
    })
    
    // Send data to Python via stdin
    python.stdin.write(JSON.stringify({
      rows: data.rows,
      columns: data.columns,
    }))
    python.stdin.end()
  })
}

/**
 * POST /api/analytics
 * 
 * Run scientific analytics on dataset
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()
  
  try {
    const body: AnalyticsRequest = await request.json()
    
    if (!body.rows || body.rows.length === 0) {
      return NextResponse.json({
        error: "No data rows provided",
        analysis_complete: false,
      }, { status: 400 })
    }
    
    console.log(`[Analytics] Starting analysis for ${body.datasetName} (${body.rows.length} rows)`)
    
    const result = await runPythonAnalytics(body)
    
    const elapsedMs = Date.now() - startTime
    console.log(`[Analytics] Complete in ${elapsedMs}ms`)
    
    return NextResponse.json({
      ...result,
      datasetId: body.datasetId,
      datasetName: body.datasetName,
      processingTimeMs: elapsedMs,
    })
    
  } catch (error) {
    console.error("[Analytics] Error:", error)
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error",
      analysis_complete: false,
    }, { status: 500 })
  }
}
