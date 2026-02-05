/**
 * LLaMA 3.1 Insight Generation Module
 * 
 * Uses LLaMA 3.1 (via Ollama) to generate human-readable insights
 * based on pre-computed deterministic statistics.
 * 
 * IMPORTANT: LLaMA is ONLY used for reasoning and interpretation.
 * It NEVER performs numeric calculations or creates new data.
 */

import type {
  DeterministicAnalysisResult,
  AIInsight,
  AIPrediction,
  LLaMAInsightResponse,
  InsightType,
  ConfidenceLevel,
  PythonAnalyticsResult,
} from "./types"
import { getAnalysisSummaryForLLaMA } from "./analysis"
import { AI_CONFIG, OLLAMA_ENDPOINTS } from "../ai/config"

// ============================================================================
// RE-EXPORT CONFIG FOR BACKWARD COMPATIBILITY
// ============================================================================

/**
 * @deprecated Use AI_CONFIG from lib/ai/config.ts instead
 */
export const LLAMA_CONFIG = {
  modelName: AI_CONFIG.model,
  alternateNames: AI_CONFIG.alternateModels,
  temperature: AI_CONFIG.temperature,
  maxTokens: AI_CONFIG.maxTokens,
  timeoutMs: AI_CONFIG.inferenceTimeoutMs,
  healthCheckTimeoutMs: AI_CONFIG.healthCheckTimeoutMs,
}

// ============================================================================
// OLLAMA STATUS TYPES
// ============================================================================

export interface OllamaStatus {
  available: boolean
  serverRunning: boolean
  modelInstalled: boolean
  modelName: string | null
  installedModels: string[]
  error?: string
  errorCode?: "SERVER_UNREACHABLE" | "MODEL_NOT_FOUND" | "TIMEOUT" | "UNKNOWN"
  fixInstructions?: string[]
}

// Session cache for Ollama status
let cachedOllamaStatus: OllamaStatus | null = null
let cacheTimestamp: number = 0
const CACHE_TTL_MS = 30000 // 30 seconds

// ============================================================================
// SYSTEM PROMPT (INTERPRETATION ONLY - NO COMPUTATION)
// ============================================================================

const SYSTEM_PROMPT = `You are an astrophysics data interpreter. Your job is to EXPLAIN pre-computed statistics, NOT to compute anything new.

CRITICAL RULES:
1. ALL numbers below are ALREADY COMPUTED. Do NOT invent or modify any values.
2. ONLY interpret what the provided statistics mean scientifically.
3. Reference ACTUAL r-values, p-values, slopes, and predictions from the data.
4. Explain physical significance in astronomy context.
5. State uncertainty honestly - if p > 0.05, the correlation is NOT significant.
6. NEVER claim causation - only describe observed relationships.

Your response must be JSON with these exact fields:
{
  "insights": [
    {
      "type": "pattern|anomaly|correlation|summary",
      "title": "Brief descriptive title",
      "explanation": "Interpretation citing actual numbers (e.g., 'r=0.73, p<0.001')",
      "confidence": "low|medium|high",
      "relatedFields": ["field1", "field2"],
      "numericEvidence": "The specific computed values this insight is based on"
    }
  ],
  "interpretations": [
    {
      "targetField": "field name",
      "computedResult": "What was actually computed (e.g., 'slope=2.3, R²=0.81')",
      "scientificMeaning": "What this means in astronomy context",
      "confidence": "low|medium|high",
      "limitations": "Caveats about the prediction"
    }
  ],
  "summary": "1-2 sentence summary of the key findings"
}`

// ============================================================================
// FORMAT PYTHON ANALYTICS FOR LLM
// ============================================================================

/**
 * Format Python analytics results for LLM prompt.
 * This provides the actual computed numbers for interpretation.
 */
function formatPythonAnalyticsForLLM(analytics: PythonAnalyticsResult): string {
  const lines: string[] = []
  
  lines.push(`=== COMPUTED STATISTICS (ACTUAL VALUES - DO NOT MODIFY) ===`)
  lines.push(`Total: ${analytics.summary.total_rows} rows, ${analytics.summary.numeric_columns} numeric fields`)
  lines.push(`Numeric columns: ${analytics.summary.numeric_column_names?.join(", ") || "none"}`)
  lines.push(``)
  
  // Check if we have any meaningful statistics
  const hasCorrelations = (analytics.correlations?.length ?? 0) > 0
  const hasRegressions = (analytics.regressions?.length ?? 0) > 0
  const hasOutliers = (analytics.outliers?.length ?? 0) > 0
  
  if (!hasCorrelations && !hasRegressions) {
    lines.push(`IMPORTANT: No statistically significant correlations were found between the numeric fields.`)
    lines.push(`This means the numeric columns do not have strong linear relationships.`)
    lines.push(`Do NOT invent or assume any correlations that are not explicitly listed below.`)
    lines.push(``)
  }
  
  // Top correlations with p-values
  if (analytics.correlations && analytics.correlations.length > 0) {
    lines.push(`CORRELATIONS (with statistical significance):`)
    for (const corr of analytics.correlations.slice(0, 8)) {
      const sig = corr.is_significant ? "SIGNIFICANT" : "not significant"
      lines.push(`  ${corr.x} ↔ ${corr.y}: r=${corr.pearson_r.toFixed(3)}, p=${corr.pearson_p.toFixed(4)} (${sig}, n=${corr.n_samples})`)
    }
    lines.push(``)
  } else {
    lines.push(`CORRELATIONS: None found (no pairs with |r| > 0.2 or p < 0.1)`)
    lines.push(``)
  }
  
  // Regressions with predictions
  if (analytics.regressions.length > 0) {
    lines.push(`REGRESSION MODELS (with actual predictions):`)
    for (const reg of analytics.regressions.slice(0, 5)) {
      lines.push(`  Model: ${reg.target} = ${reg.slope.toFixed(4)} × ${reg.feature} + ${reg.intercept.toFixed(4)}`)
      lines.push(`    R² = ${reg.r2.toFixed(3)}, p = ${reg.p_value.toFixed(4)}, std_error = ${reg.std_error.toFixed(4)}`)
      
      // Show actual predictions
      const pred = reg.sample_predictions[Math.floor(reg.sample_predictions.length / 2)]
      if (pred) {
        lines.push(`    Example: When ${reg.feature}=${pred.input_value.toFixed(2)}, predicted ${reg.target}=${pred.predicted_value.toFixed(2)} [95% CI: ${pred.confidence_interval[0].toFixed(2)} to ${pred.confidence_interval[1].toFixed(2)}]`)
      }
    }
    lines.push(``)
  }
  
  // Computed predictions
  if (analytics.computed_predictions.length > 0) {
    lines.push(`COMPUTED PREDICTIONS (regression-based):`)
    for (const pred of analytics.computed_predictions) {
      lines.push(`  ${pred.model_equation} (R²=${pred.model_r2.toFixed(3)})`)
      lines.push(`    At mean: ${pred.predictor_field}=${pred.predictions_at_boundaries.at_mean.input.toFixed(2)} → ${pred.target_field}=${pred.predictions_at_boundaries.at_mean.predicted.toFixed(2)}`)
      lines.push(`    95% CI: [${pred.predictions_at_boundaries.at_mean.ci_lower.toFixed(2)}, ${pred.predictions_at_boundaries.at_mean.ci_upper.toFixed(2)}]`)
    }
    lines.push(``)
  }
  
  // Outliers
  if (analytics.outliers.length > 0) {
    lines.push(`DETECTED OUTLIERS:`)
    for (const out of analytics.outliers.slice(0, 5)) {
      lines.push(`  ${out.field}: ${out.total_outliers} outliers (${(out.outlier_ratio * 100).toFixed(1)}%), bounds [${out.lower_bound.toFixed(2)}, ${out.upper_bound.toFixed(2)}]`)
      if (out.outlier_details.length > 0) {
        const extreme = out.outlier_details.filter(d => d.is_extreme)
        if (extreme.length > 0) {
          lines.push(`    Extreme values: ${extreme.slice(0, 3).map(d => `${d.value.toFixed(2)} (z=${d.z_score.toFixed(1)})`).join(", ")}`)
        }
      }
    }
    lines.push(``)
  }
  
  // Field statistics summary
  if (analytics.field_statistics.length > 0) {
    lines.push(`FIELD SUMMARIES:`)
    for (const stat of analytics.field_statistics.slice(0, 10)) {
      const dist = stat.is_normal_distribution ? "normal" : "non-normal"
      lines.push(`  ${stat.field}: mean=${stat.mean.toPrecision(4)}, std=${stat.std.toPrecision(4)}, range=[${stat.min.toPrecision(4)}, ${stat.max.toPrecision(4)}], distribution=${dist}`)
    }
  }
  
  lines.push(`=== END COMPUTED STATISTICS ===`)
  
  return lines.join("\n")
}

// ============================================================================
// PROMPT CONSTRUCTION
// ============================================================================

/**
 * Build the full prompt for LLaMA.
 * Now supports enhanced Python analytics results.
 */
function buildLLaMAPrompt(
  analysis: DeterministicAnalysisResult,
  options?: {
    maxInsights?: number
    maxPredictions?: number
    focusAreas?: string[]
    pythonAnalytics?: PythonAnalyticsResult
  }
): string {
  // Use Python analytics if available (more comprehensive)
  const analysisSummary = options?.pythonAnalytics
    ? formatPythonAnalyticsForLLM(options.pythonAnalytics)
    : getAnalysisSummaryForLLaMA(analysis)
  
  const focusInstructions = options?.focusAreas?.length
    ? `\n\nFOCUS AREAS: Pay special attention to: ${options.focusAreas.join(", ")}`
    : ""
  
  const limitInstructions = `
RESPONSE LIMITS:
- Maximum ${options?.maxInsights || 8} insights
- Maximum ${options?.maxPredictions || 3} interpretations
- Reference ACTUAL computed values in your explanations
- Explain what the numbers MEAN, do not recompute them`
  
  return `${SYSTEM_PROMPT}

${limitInstructions}
${focusInstructions}

${analysisSummary}

Based on the COMPUTED statistics above, provide scientific interpretation in JSON format.
Remember: ALL numbers are pre-computed. Your job is to EXPLAIN what they mean.`
}

// ============================================================================
// RESPONSE PARSING
// ============================================================================

/**
 * Extract JSON from LLaMA response (handles markdown code blocks).
 */
function extractJSON(response: string): string {
  // Try to find JSON in code block
  const codeBlockMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim()
  }
  
  // Try to find raw JSON
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    return jsonMatch[0]
  }
  
  return response
}

/**
 * Validate and parse LLaMA response.
 */
function parseLLaMAResponse(
  response: string,
  analysisDatasets: string[]
): LLaMAInsightResponse {
  const jsonStr = extractJSON(response)
  
  let parsed: {
    insights?: unknown[]
    predictions?: unknown[]
    summary?: string
  }
  
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    // If parsing fails, create a fallback response
    return {
      insights: [{
        id: "parse-error",
        type: "summary",
        title: "Analysis Complete",
        explanation: "The analysis was completed but the response format was unexpected. Please review the raw statistics.",
        confidence: "low",
        relatedFields: [],
        relatedDatasets: analysisDatasets,
      }],
      predictions: [],
      summary: "Analysis completed with parsing issues.",
      modelUsed: LLAMA_CONFIG.modelName,
      generatedAt: new Date().toISOString(),
      disclaimer: "AI insights are interpretive and based on selected datasets only.",
    }
  }
  
  // Validate and transform insights
  const insights: AIInsight[] = []
  if (Array.isArray(parsed.insights)) {
    for (let i = 0; i < parsed.insights.length; i++) {
      const raw = parsed.insights[i] as Record<string, unknown>
      if (raw && typeof raw === "object") {
        insights.push({
          id: `insight-${i}`,
          type: validateInsightType(raw.type),
          title: String(raw.title || "Untitled Insight"),
          explanation: String(raw.explanation || "No explanation provided."),
          confidence: validateConfidence(raw.confidence),
          relatedFields: Array.isArray(raw.relatedFields) 
            ? raw.relatedFields.map(String) 
            : [],
          relatedDatasets: Array.isArray(raw.relatedDatasets)
            ? raw.relatedDatasets.map(String)
            : analysisDatasets,
          scientificContext: raw.scientificContext 
            ? String(raw.scientificContext) 
            : undefined,
        })
      }
    }
  }
  
  // Validate and transform predictions
  const predictions: AIPrediction[] = []
  if (Array.isArray(parsed.predictions)) {
    for (let i = 0; i < parsed.predictions.length; i++) {
      const raw = parsed.predictions[i] as Record<string, unknown>
      if (raw && typeof raw === "object") {
        predictions.push({
          id: `prediction-${i}`,
          targetField: String(raw.targetField || "Unknown"),
          basis: String(raw.basis || "Observed trends"),
          description: String(raw.description || "No description provided."),
          confidence: validateConfidence(raw.confidence),
          caveat: String(raw.caveat || "Predictions are based on limited data and may not reflect future observations."),
          relatedDatasets: Array.isArray(raw.relatedDatasets)
            ? raw.relatedDatasets.map(String)
            : analysisDatasets,
        })
      }
    }
  }
  
  return {
    insights,
    predictions,
    summary: String(parsed.summary || "Analysis complete."),
    modelUsed: LLAMA_CONFIG.modelName,
    generatedAt: new Date().toISOString(),
    disclaimer: "AI insights are interpretive and based on selected datasets only.",
  }
}

/**
 * Validate insight type.
 */
function validateInsightType(type: unknown): InsightType {
  const validTypes: InsightType[] = ["pattern", "anomaly", "correlation", "summary", "comparison"]
  if (typeof type === "string" && validTypes.includes(type as InsightType)) {
    return type as InsightType
  }
  return "summary"
}

/**
 * Validate confidence level.
 */
function validateConfidence(confidence: unknown): ConfidenceLevel {
  const validLevels: ConfidenceLevel[] = ["low", "medium", "high"]
  if (typeof confidence === "string" && validLevels.includes(confidence as ConfidenceLevel)) {
    return confidence as ConfidenceLevel
  }
  return "medium"
}

// ============================================================================
// OLLAMA API CALL
// ============================================================================

/**
 * Call the Ollama API with the prompt.
 * Uses streaming to avoid timeout issues with long responses.
 */
async function callOllamaAPI(prompt: string, modelName?: string): Promise<string> {
  const model = modelName || LLAMA_CONFIG.modelName
  
  logDebug("Calling Ollama API", { 
    url: OLLAMA_ENDPOINTS.generate, 
    model,
    promptLength: prompt.length,
    timeoutMs: LLAMA_CONFIG.timeoutMs,
  })
  
  const startTime = Date.now()
  
  try {
    // Use AbortSignal.timeout for cleaner timeout handling
    const response = await fetch(OLLAMA_ENDPOINTS.generate, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: LLAMA_CONFIG.temperature,
          num_predict: LLAMA_CONFIG.maxTokens,
        },
      }),
      signal: AbortSignal.timeout(LLAMA_CONFIG.timeoutMs),
    })
    
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "")
      logDebug("Ollama API error response", { 
        status: response.status, 
        statusText: response.statusText,
        body: errorBody 
      })
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json() as { response?: string; error?: string }
    
    if (data.error) {
      logDebug("Ollama returned error in response", { error: data.error })
      throw new Error(`Ollama error: ${data.error}`)
    }
    
    if (!data.response) {
      throw new Error("Empty response from Ollama")
    }
    
    const elapsed = Date.now() - startTime
    logDebug("Ollama response received", { 
      responseLength: data.response.length,
      elapsedMs: elapsed,
    })
    
    return data.response
  } catch (error) {
    const elapsed = Date.now() - startTime
    
    // Provide better error messages for common issues
    if (error instanceof Error) {
      if (error.name === "TimeoutError" || error.message.includes("aborted")) {
        logDebug("Ollama request timed out", { elapsedMs: elapsed })
        throw new Error(
          `LLaMA inference timed out after ${Math.round(elapsed / 1000)}s. ` +
          `The model may be loading or the prompt is too complex. Try again.`
        )
      }
      if (error.message.includes("ECONNREFUSED")) {
        throw new Error("Cannot connect to Ollama. Make sure 'ollama serve' is running.")
      }
    }
    
    throw error
  }
}

/**
 * Check if Ollama is available with detailed status.
 * Results are cached for CACHE_TTL_MS to avoid repeated checks.
 */
export async function checkOllamaAvailability(forceRefresh = false): Promise<OllamaStatus> {
  // Return cached result if still valid
  const now = Date.now()
  if (!forceRefresh && cachedOllamaStatus && (now - cacheTimestamp) < CACHE_TTL_MS) {
    logDebug("Using cached Ollama status", cachedOllamaStatus)
    return cachedOllamaStatus
  }
  
  logDebug("Checking Ollama availability", { 
    url: OLLAMA_ENDPOINTS.tags, 
    targetModel: LLAMA_CONFIG.modelName 
  })
  
  let status: OllamaStatus = {
    available: false,
    serverRunning: false,
    modelInstalled: false,
    modelName: null,
    installedModels: [],
  }
  
  try {
    // Step 1: Check if Ollama server is running
    const response = await fetch(OLLAMA_ENDPOINTS.tags, {
      method: "GET",
      signal: AbortSignal.timeout(LLAMA_CONFIG.healthCheckTimeoutMs),
    })
    
    if (!response.ok) {
      logDebug("Ollama server returned error", { status: response.status, statusText: response.statusText })
      status = {
        ...status,
        serverRunning: false,
        error: `Ollama server returned HTTP ${response.status}: ${response.statusText}`,
        errorCode: "SERVER_UNREACHABLE",
        fixInstructions: [
          "Ollama server may not be running correctly.",
          "Try restarting Ollama:",
          "  1. Stop Ollama if running",
          "  2. Run: ollama serve",
        ],
      }
      cachedOllamaStatus = status
      cacheTimestamp = now
      return status
    }
    
    status.serverRunning = true
    
    // Step 2: Get list of installed models
    const data = await response.json() as { models?: { name: string; modified_at?: string }[] }
    status.installedModels = data.models?.map(m => m.name) || []
    
    logDebug("Ollama models found", { models: status.installedModels })
    
    // Step 3: Check if target model is installed
    const targetModel = LLAMA_CONFIG.modelName
    const acceptableNames = [targetModel, ...LLAMA_CONFIG.alternateNames]
    
    const matchedModel = status.installedModels.find(m => 
      acceptableNames.some(acceptable => 
        m === acceptable || m.startsWith(`${acceptable}:`) || m.startsWith(acceptable.split(":")[0])
      )
    )
    
    if (matchedModel) {
      status.modelInstalled = true
      status.modelName = matchedModel
      status.available = true
      logDebug("LLaMA model found", { matchedModel })
    } else {
      logDebug("LLaMA model not found", { 
        wanted: acceptableNames, 
        available: status.installedModels 
      })
      status = {
        ...status,
        error: `Model "${targetModel}" is not installed in Ollama`,
        errorCode: "MODEL_NOT_FOUND",
        fixInstructions: [
          `The model "${targetModel}" is not installed.`,
          "Run this command to install it:",
          `  ollama pull ${targetModel}`,
          "",
          "Available models on your system:",
          ...status.installedModels.map(m => `  - ${m}`),
          ...(status.installedModels.length === 0 ? ["  (none installed)"] : []),
        ],
      }
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const isTimeout = errorMessage.includes("timeout") || errorMessage.includes("aborted")
    
    logDebug("Ollama connection failed", { error: errorMessage, isTimeout })
    
    status = {
      ...status,
      serverRunning: false,
      error: isTimeout 
        ? "Connection to Ollama timed out" 
        : `Cannot connect to Ollama: ${errorMessage}`,
      errorCode: isTimeout ? "TIMEOUT" : "SERVER_UNREACHABLE",
      fixInstructions: [
        "Ollama is not running or cannot be reached.",
        "",
        "To start Ollama:",
        "  1. Open a terminal",
        "  2. Run: ollama serve",
        "",
        `To install the model:`,
        `  ollama pull ${LLAMA_CONFIG.modelName}`,
        "",
        "Ollama download: https://ollama.ai",
      ],
    }
  }
  
  // Cache the result
  cachedOllamaStatus = status
  cacheTimestamp = now
  
  return status
}

/**
 * Clear the cached Ollama status (useful for retry operations).
 */
export function clearOllamaStatusCache(): void {
  cachedOllamaStatus = null
  cacheTimestamp = 0
  logDebug("Ollama status cache cleared")
}

/**
 * Debug logging helper (only in development).
 */
function logDebug(message: string, data?: unknown): void {
  if (process.env.NODE_ENV === "development") {
    console.log(`[AI-Discovery] ${message}`, data ?? "")
  }
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Generate insights using LLaMA 3.1 based on deterministic analysis.
 * Now supports enhanced Python analytics for data-driven insights.
 * Returns insights with proper model attribution.
 */
export async function generateLLaMAInsights(
  analysis: DeterministicAnalysisResult,
  options?: {
    maxInsights?: number
    maxPredictions?: number
    focusAreas?: string[]
    pythonAnalytics?: PythonAnalyticsResult
  }
): Promise<LLaMAInsightResponse> {
  // Check if there's any data to analyze
  if (analysis.totalNumericFields === 0) {
    return {
      insights: [{
        id: "no-data",
        type: "summary",
        title: "No Numeric Data Available",
        explanation: "The selected datasets do not contain numeric fields suitable for statistical analysis. Consider selecting datasets with quantitative measurements.",
        confidence: "high",
        relatedFields: [],
        relatedDatasets: analysis.datasets.map(d => d.datasetName),
      }],
      predictions: [],
      summary: "No numeric data available for analysis.",
      modelUsed: LLAMA_CONFIG.modelName,
      generatedAt: new Date().toISOString(),
      disclaimer: "AI insights are interpretive and based on selected datasets only.",
    }
  }
  
  // Check Ollama availability BEFORE attempting inference
  const ollamaStatus = await checkOllamaAvailability()
  
  if (!ollamaStatus.available) {
    logDebug("Skipping LLaMA inference - Ollama not available", ollamaStatus)
    throw new Error(ollamaStatus.error || "Ollama is not available")
  }
  
  // Build prompt with Python analytics if available
  const prompt = buildLLaMAPrompt(analysis, {
    ...options,
    pythonAnalytics: options?.pythonAnalytics,
  })
  
  // Call Ollama with the actual installed model name
  const rawResponse = await callOllamaAPI(prompt, ollamaStatus.modelName || undefined)
  
  // Parse and validate response
  const datasetNames = analysis.datasets.map(d => d.datasetName)
  const response = parseLLaMAResponse(rawResponse, datasetNames)
  
  // Update model name to reflect actual model used
  response.modelUsed = ollamaStatus.modelName || LLAMA_CONFIG.modelName
  
  return response
}

/**
 * Generate fallback insights when LLaMA is unavailable.
 * These are basic, template-based insights derived from statistics.
 */
export function generateFallbackInsights(
  analysis: DeterministicAnalysisResult
): LLaMAInsightResponse {
  const insights: AIInsight[] = []
  let insightId = 0
  
  // Summary insight for each dataset
  for (const dataset of analysis.datasets) {
    insights.push({
      id: `fallback-${insightId++}`,
      type: "summary",
      title: `Dataset Overview: ${dataset.datasetName}`,
      explanation: `This dataset contains ${dataset.rowCount.toLocaleString()} rows with ${dataset.numericFieldCount} numeric fields and ${dataset.categoricalFieldCount} categorical fields.${dataset.hasTimeField ? ` Contains time-series data (${dataset.timeFieldName}).` : ""}`,
      confidence: "high",
      relatedFields: dataset.numericFields.map(f => f.fieldName),
      relatedDatasets: [dataset.datasetName],
    })
    
    // Highlight strong correlations
    for (const corr of dataset.topCorrelations.filter(c => c.strength === "strong")) {
      insights.push({
        id: `fallback-${insightId++}`,
        type: "correlation",
        title: `Strong Correlation: ${corr.field1} and ${corr.field2}`,
        explanation: `A ${corr.direction} correlation (r=${corr.coefficient.toFixed(3)}) was detected between ${corr.field1} and ${corr.field2}. This suggests these quantities may be related.`,
        confidence: "high",
        relatedFields: [corr.field1, corr.field2],
        relatedDatasets: [dataset.datasetName],
      })
    }
    
    // Highlight significant outliers
    for (const field of dataset.numericFields) {
      if (field.outliers.outlierRatio > 0.05) {
        insights.push({
          id: `fallback-${insightId++}`,
          type: "anomaly",
          title: `Outliers in ${field.fieldName}`,
          explanation: `${field.outliers.outlierCount} outliers detected (${(field.outliers.outlierRatio * 100).toFixed(1)}% of values). These may represent measurement errors or genuinely extreme objects.`,
          confidence: "medium",
          relatedFields: [field.fieldName],
          relatedDatasets: [dataset.datasetName],
        })
      }
      
      // Highlight trends
      if (field.trend && field.trend.significance !== "low") {
        insights.push({
          id: `fallback-${insightId++}`,
          type: "pattern",
          title: `${field.trend.direction.charAt(0).toUpperCase() + field.trend.direction.slice(1)} Trend in ${field.fieldName}`,
          explanation: `${field.fieldName} shows a ${field.trend.direction} trend over ${field.trend.timeField} (R²=${field.trend.rSquared.toFixed(3)}).`,
          confidence: field.trend.significance === "high" ? "high" : "medium",
          relatedFields: [field.fieldName, field.trend.timeField],
          relatedDatasets: [dataset.datasetName],
        })
      }
    }
  }
  
  // Cross-dataset comparisons
  for (const comp of analysis.crossDatasetComparisons) {
    if (comp.distributionShift !== "none") {
      insights.push({
        id: `fallback-${insightId++}`,
        type: "comparison",
        title: `Distribution Difference in ${comp.physicalQuantity}`,
        explanation: `The ${comp.physicalQuantity} values show ${comp.distributionShift} differences between datasets: ${comp.datasets.map(d => d.datasetName).join(", ")}. Overlap ratio: ${(comp.overlapRatio * 100).toFixed(1)}%.`,
        confidence: "medium",
        relatedFields: [comp.field],
        relatedDatasets: comp.datasets.map(d => d.datasetName),
      })
    }
  }
  
  return {
    insights: insights.slice(0, 10), // Limit to 10 insights
    predictions: [], // No predictions in fallback mode
    summary: `Analysis of ${analysis.datasets.length} dataset(s) with ${analysis.totalRows.toLocaleString()} total rows. LLaMA-powered insights unavailable; showing statistical summaries.`,
    modelUsed: "fallback",
    generatedAt: new Date().toISOString(),
    disclaimer: "These are basic statistical insights. For deeper analysis, ensure LLaMA 3.1 is available via Ollama.",
  }
}
