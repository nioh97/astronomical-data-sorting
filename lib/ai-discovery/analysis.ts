/**
 * Deterministic Statistical Analysis Engine
 * 
 * Computes all numeric statistics, correlations, trends, and outliers
 * WITHOUT using any LLM. Results are used as input for LLaMA reasoning.
 * 
 * This module is the foundation of the AI Discovery system.
 * All computations must be deterministic and reproducible.
 */

import type { Dataset } from "@/lib/data-context"
import type {
  FieldStatistics,
  FieldCorrelation,
  TrendAnalysis,
  OutlierInfo,
  NumericFieldAnalysis,
  DatasetAnalysis,
  CrossDatasetComparison,
  DeterministicAnalysisResult,
} from "./types"

// ============================================================================
// CONSTANTS
// ============================================================================

/** Threshold for considering correlation significant */
const CORRELATION_THRESHOLD_WEAK = 0.3
const CORRELATION_THRESHOLD_MODERATE = 0.5
const CORRELATION_THRESHOLD_STRONG = 0.7

/** Z-score threshold for outlier detection */
const ZSCORE_THRESHOLD = 3.0

/** IQR multiplier for outlier detection */
const IQR_MULTIPLIER = 1.5

/** Minimum valid values required for correlation */
const MIN_VALUES_FOR_CORRELATION = 5

/** Patterns for detecting time-related columns */
const TIME_COLUMN_PATTERNS = [
  /^time$/i, /^date$/i, /^year$/i, /^epoch$/i,
  /^jd$/i, /^mjd$/i, /^bjd$/i, /^hjd$/i,
  /disc.*year/i, /discovery.*year/i, /obs.*date/i,
  /release.*date/i, /pub.*date/i, /rowupdate/i,
]

// ============================================================================
// BASIC STATISTICS
// ============================================================================

/**
 * Extract numeric values from a column, filtering out nulls and NaN.
 */
function extractNumericValues(
  rows: Record<string, unknown>[],
  fieldName: string
): number[] {
  const values: number[] = []
  
  for (const row of rows) {
    const val = row[fieldName]
    if (val === null || val === undefined) continue
    
    const num = typeof val === "number" ? val : parseFloat(String(val))
    if (!Number.isNaN(num) && Number.isFinite(num)) {
      values.push(num)
    }
  }
  
  return values
}

/**
 * Calculate basic descriptive statistics for a numeric array.
 */
function calculateStatistics(values: number[], totalCount: number): FieldStatistics {
  if (values.length === 0) {
    return {
      count: totalCount,
      validCount: 0,
      nullCount: totalCount,
      nullRatio: 1,
      mean: 0,
      median: 0,
      std: 0,
      min: 0,
      max: 0,
      q1: 0,
      q3: 0,
      iqr: 0,
    }
  }
  
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  
  // Mean
  const sum = sorted.reduce((acc, v) => acc + v, 0)
  const mean = sum / n
  
  // Median
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)]
  
  // Standard deviation
  const squaredDiffs = sorted.map(v => Math.pow(v - mean, 2))
  const variance = squaredDiffs.reduce((acc, v) => acc + v, 0) / n
  const std = Math.sqrt(variance)
  
  // Quartiles
  const q1Index = Math.floor(n * 0.25)
  const q3Index = Math.floor(n * 0.75)
  const q1 = sorted[q1Index]
  const q3 = sorted[q3Index]
  const iqr = q3 - q1
  
  return {
    count: totalCount,
    validCount: n,
    nullCount: totalCount - n,
    nullRatio: (totalCount - n) / totalCount,
    mean,
    median,
    std,
    min: sorted[0],
    max: sorted[n - 1],
    q1,
    q3,
    iqr,
  }
}

// ============================================================================
// CORRELATION ANALYSIS
// ============================================================================

/**
 * Calculate Pearson correlation coefficient between two arrays.
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < MIN_VALUES_FOR_CORRELATION) {
    return 0
  }
  
  const n = x.length
  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0)
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0)
  const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0)
  
  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  )
  
  if (denominator === 0) return 0
  
  return numerator / denominator
}

/**
 * Get correlation strength label.
 */
function getCorrelationStrength(r: number): "weak" | "moderate" | "strong" {
  const absR = Math.abs(r)
  if (absR >= CORRELATION_THRESHOLD_STRONG) return "strong"
  if (absR >= CORRELATION_THRESHOLD_MODERATE) return "moderate"
  return "weak"
}

/**
 * Get correlation direction.
 */
function getCorrelationDirection(r: number): "positive" | "negative" | "none" {
  if (Math.abs(r) < CORRELATION_THRESHOLD_WEAK) return "none"
  return r > 0 ? "positive" : "negative"
}

/**
 * Calculate correlations between a field and all other numeric fields.
 */
function calculateFieldCorrelations(
  rows: Record<string, unknown>[],
  targetField: string,
  otherFields: string[]
): FieldCorrelation[] {
  const targetValues = extractNumericValues(rows, targetField)
  if (targetValues.length < MIN_VALUES_FOR_CORRELATION) return []
  
  const correlations: FieldCorrelation[] = []
  
  for (const otherField of otherFields) {
    if (otherField === targetField) continue
    
    // Get paired values (both fields must have valid values)
    const pairedX: number[] = []
    const pairedY: number[] = []
    
    for (let i = 0; i < rows.length; i++) {
      const xVal = rows[i][targetField]
      const yVal = rows[i][otherField]
      
      if (xVal === null || xVal === undefined) continue
      if (yVal === null || yVal === undefined) continue
      
      const xNum = typeof xVal === "number" ? xVal : parseFloat(String(xVal))
      const yNum = typeof yVal === "number" ? yVal : parseFloat(String(yVal))
      
      if (Number.isNaN(xNum) || Number.isNaN(yNum)) continue
      if (!Number.isFinite(xNum) || !Number.isFinite(yNum)) continue
      
      pairedX.push(xNum)
      pairedY.push(yNum)
    }
    
    if (pairedX.length < MIN_VALUES_FOR_CORRELATION) continue
    
    const coefficient = pearsonCorrelation(pairedX, pairedY)
    
    correlations.push({
      field1: targetField,
      field2: otherField,
      coefficient,
      strength: getCorrelationStrength(coefficient),
      direction: getCorrelationDirection(coefficient),
    })
  }
  
  // Sort by absolute correlation strength
  return correlations.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient))
}

// ============================================================================
// OUTLIER DETECTION
// ============================================================================

/**
 * Detect outliers using z-score method.
 */
function detectOutliersZScore(
  rows: Record<string, unknown>[],
  fieldName: string,
  stats: FieldStatistics
): OutlierInfo {
  const outlierIndices: number[] = []
  
  if (stats.std === 0 || stats.validCount === 0) {
    return {
      field: fieldName,
      method: "zscore",
      outlierIndices: [],
      outlierCount: 0,
      outlierRatio: 0,
      threshold: ZSCORE_THRESHOLD,
    }
  }
  
  for (let i = 0; i < rows.length; i++) {
    const val = rows[i][fieldName]
    if (val === null || val === undefined) continue
    
    const num = typeof val === "number" ? val : parseFloat(String(val))
    if (Number.isNaN(num)) continue
    
    const zScore = Math.abs((num - stats.mean) / stats.std)
    if (zScore > ZSCORE_THRESHOLD) {
      outlierIndices.push(i)
    }
  }
  
  return {
    field: fieldName,
    method: "zscore",
    outlierIndices,
    outlierCount: outlierIndices.length,
    outlierRatio: outlierIndices.length / stats.validCount,
    threshold: ZSCORE_THRESHOLD,
  }
}

/**
 * Detect outliers using IQR method.
 */
function detectOutliersIQR(
  rows: Record<string, unknown>[],
  fieldName: string,
  stats: FieldStatistics
): OutlierInfo {
  const outlierIndices: number[] = []
  
  const lowerBound = stats.q1 - IQR_MULTIPLIER * stats.iqr
  const upperBound = stats.q3 + IQR_MULTIPLIER * stats.iqr
  
  for (let i = 0; i < rows.length; i++) {
    const val = rows[i][fieldName]
    if (val === null || val === undefined) continue
    
    const num = typeof val === "number" ? val : parseFloat(String(val))
    if (Number.isNaN(num)) continue
    
    if (num < lowerBound || num > upperBound) {
      outlierIndices.push(i)
    }
  }
  
  return {
    field: fieldName,
    method: "iqr",
    outlierIndices,
    outlierCount: outlierIndices.length,
    outlierRatio: stats.validCount > 0 ? outlierIndices.length / stats.validCount : 0,
    threshold: IQR_MULTIPLIER,
  }
}

// ============================================================================
// TREND ANALYSIS
// ============================================================================

/**
 * Check if a column name matches time patterns.
 */
function isTimeColumn(columnName: string): boolean {
  return TIME_COLUMN_PATTERNS.some(pattern => pattern.test(columnName))
}

/**
 * Find a time-related column in the dataset.
 */
function findTimeColumn(columns: { name: string }[]): string | undefined {
  return columns.find(col => isTimeColumn(col.name))?.name
}

/**
 * Perform simple linear regression.
 */
function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; rSquared: number } {
  const n = x.length
  if (n < 3) {
    return { slope: 0, intercept: 0, rSquared: 0 }
  }
  
  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0)
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0)
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  
  // Calculate R-squared
  const meanY = sumY / n
  const ssTotal = y.reduce((acc, yi) => acc + Math.pow(yi - meanY, 2), 0)
  const ssResidual = y.reduce((acc, yi, i) => {
    const predicted = slope * x[i] + intercept
    return acc + Math.pow(yi - predicted, 2)
  }, 0)
  
  const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0
  
  return { slope, intercept, rSquared: Math.max(0, Math.min(1, rSquared)) }
}

/**
 * Analyze trend of a field over time.
 */
function analyzeTrend(
  rows: Record<string, unknown>[],
  valueField: string,
  timeField: string
): TrendAnalysis | undefined {
  // Extract paired time-value data
  const pairedX: number[] = []
  const pairedY: number[] = []
  
  for (const row of rows) {
    const timeVal = row[timeField]
    const valueVal = row[valueField]
    
    if (timeVal === null || timeVal === undefined) continue
    if (valueVal === null || valueVal === undefined) continue
    
    const timeNum = typeof timeVal === "number" ? timeVal : parseFloat(String(timeVal))
    const valueNum = typeof valueVal === "number" ? valueVal : parseFloat(String(valueVal))
    
    if (Number.isNaN(timeNum) || Number.isNaN(valueNum)) continue
    if (!Number.isFinite(timeNum) || !Number.isFinite(valueNum)) continue
    
    pairedX.push(timeNum)
    pairedY.push(valueNum)
  }
  
  if (pairedX.length < 5) return undefined
  
  const { slope, intercept, rSquared } = linearRegression(pairedX, pairedY)
  
  // Determine direction and significance
  let direction: "increasing" | "decreasing" | "stable"
  if (Math.abs(slope) < 1e-10) {
    direction = "stable"
  } else {
    direction = slope > 0 ? "increasing" : "decreasing"
  }
  
  let significance: "low" | "medium" | "high"
  if (rSquared >= 0.7) {
    significance = "high"
  } else if (rSquared >= 0.4) {
    significance = "medium"
  } else {
    significance = "low"
  }
  
  return {
    field: valueField,
    timeField,
    slope,
    intercept,
    rSquared,
    direction,
    significance,
  }
}

// ============================================================================
// DATASET ANALYSIS
// ============================================================================

/**
 * Identify numeric columns in a dataset.
 */
function identifyNumericColumns(dataset: Dataset): string[] {
  const numericColumns: string[] = []
  
  for (const column of dataset.columns) {
    // Check if column has numeric values in the data
    let hasNumeric = false
    const sampleSize = Math.min(100, dataset.rows.length)
    
    for (let i = 0; i < sampleSize; i++) {
      const val = dataset.rows[i]?.[column.name]
      if (val === null || val === undefined) continue
      
      const num = typeof val === "number" ? val : parseFloat(String(val))
      if (!Number.isNaN(num) && Number.isFinite(num)) {
        hasNumeric = true
        break
      }
    }
    
    if (hasNumeric) {
      numericColumns.push(column.name)
    }
  }
  
  return numericColumns
}

/**
 * Analyze a single dataset.
 */
export function analyzeDataset(dataset: Dataset): DatasetAnalysis {
  const numericColumns = identifyNumericColumns(dataset)
  const timeColumn = findTimeColumn(dataset.columns)
  
  const numericFieldsAnalysis: NumericFieldAnalysis[] = []
  const allCorrelations: FieldCorrelation[] = []
  
  for (const fieldName of numericColumns) {
    const values = extractNumericValues(dataset.rows, fieldName)
    const stats = calculateStatistics(values, dataset.rows.length)
    
    // Get correlations with other numeric fields
    const correlations = calculateFieldCorrelations(dataset.rows, fieldName, numericColumns)
    allCorrelations.push(...correlations)
    
    // Detect outliers (prefer IQR for skewed data, z-score otherwise)
    const skewness = Math.abs(stats.mean - stats.median) / (stats.std || 1)
    const outliers = skewness > 0.5
      ? detectOutliersIQR(dataset.rows, fieldName, stats)
      : detectOutliersZScore(dataset.rows, fieldName, stats)
    
    // Analyze trend if time column exists
    const trend = timeColumn && fieldName !== timeColumn
      ? analyzeTrend(dataset.rows, fieldName, timeColumn)
      : undefined
    
    // Get column metadata
    const columnMeta = dataset.columns.find(c => c.name === fieldName)
    
    numericFieldsAnalysis.push({
      fieldName,
      physicalQuantity: columnMeta?.semanticType,
      unit: columnMeta?.unit ?? undefined,
      stats,
      outliers,
      correlations: correlations.slice(0, 5), // Top 5 correlations
      trend,
    })
  }
  
  // Deduplicate and get top correlations across all fields
  const uniqueCorrelations = new Map<string, FieldCorrelation>()
  for (const corr of allCorrelations) {
    const key = [corr.field1, corr.field2].sort().join("_")
    if (!uniqueCorrelations.has(key) || 
        Math.abs(corr.coefficient) > Math.abs(uniqueCorrelations.get(key)!.coefficient)) {
      uniqueCorrelations.set(key, corr)
    }
  }
  
  const topCorrelations = Array.from(uniqueCorrelations.values())
    .filter(c => Math.abs(c.coefficient) >= CORRELATION_THRESHOLD_WEAK)
    .sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient))
    .slice(0, 10)
  
  return {
    datasetId: dataset.id,
    datasetName: dataset.name,
    rowCount: dataset.rows.length,
    columnCount: dataset.columns.length,
    numericFieldCount: numericColumns.length,
    categoricalFieldCount: dataset.columns.length - numericColumns.length,
    numericFields: numericFieldsAnalysis,
    topCorrelations,
    hasTimeField: !!timeColumn,
    timeFieldName: timeColumn,
    analysisTimestamp: new Date().toISOString(),
  }
}

// ============================================================================
// CROSS-DATASET ANALYSIS
// ============================================================================

/**
 * Compare the same physical quantity across multiple datasets.
 */
function compareCrossDataset(
  datasets: DatasetAnalysis[],
  physicalQuantity: string
): CrossDatasetComparison | null {
  const relevantFields: {
    datasetId: string
    datasetName: string
    fieldName: string
    stats: FieldStatistics
  }[] = []
  
  for (const dataset of datasets) {
    for (const field of dataset.numericFields) {
      if (field.physicalQuantity?.toLowerCase() === physicalQuantity.toLowerCase()) {
        relevantFields.push({
          datasetId: dataset.datasetId,
          datasetName: dataset.datasetName,
          fieldName: field.fieldName,
          stats: field.stats,
        })
      }
    }
  }
  
  if (relevantFields.length < 2) return null
  
  // Calculate common range
  const allMins = relevantFields.map(f => f.stats.min)
  const allMaxs = relevantFields.map(f => f.stats.max)
  const globalMin = Math.min(...allMins)
  const globalMax = Math.max(...allMaxs)
  
  // Calculate overlap ratio
  const ranges = relevantFields.map(f => ({ min: f.stats.min, max: f.stats.max }))
  let overlapMin = Math.max(...ranges.map(r => r.min))
  let overlapMax = Math.min(...ranges.map(r => r.max))
  
  const overlapRatio = overlapMax > overlapMin
    ? (overlapMax - overlapMin) / (globalMax - globalMin)
    : 0
  
  // Determine distribution shift
  const means = relevantFields.map(f => f.stats.mean)
  const stds = relevantFields.map(f => f.stats.std)
  const avgStd = stds.reduce((a, b) => a + b, 0) / stds.length
  const meanSpread = Math.max(...means) - Math.min(...means)
  
  let distributionShift: "none" | "minor" | "significant"
  if (avgStd > 0) {
    const shiftRatio = meanSpread / avgStd
    if (shiftRatio < 0.5) distributionShift = "none"
    else if (shiftRatio < 1.5) distributionShift = "minor"
    else distributionShift = "significant"
  } else {
    distributionShift = meanSpread > 0 ? "significant" : "none"
  }
  
  return {
    field: relevantFields[0].fieldName,
    physicalQuantity,
    datasets: relevantFields.map(f => ({
      datasetId: f.datasetId,
      datasetName: f.datasetName,
      stats: f.stats,
    })),
    distributionShift,
    commonRange: { min: globalMin, max: globalMax },
    overlapRatio,
  }
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Run complete deterministic analysis on selected datasets.
 * This is the main entry point for the analysis pipeline.
 */
export function runDeterministicAnalysis(
  datasets: Dataset[]
): DeterministicAnalysisResult {
  // Analyze each dataset
  const datasetAnalyses = datasets.map(analyzeDataset)
  
  // Collect all unique physical quantities
  const physicalQuantities = new Set<string>()
  for (const analysis of datasetAnalyses) {
    for (const field of analysis.numericFields) {
      if (field.physicalQuantity) {
        physicalQuantities.add(field.physicalQuantity)
      }
    }
  }
  
  // Cross-dataset comparisons
  const crossDatasetComparisons: CrossDatasetComparison[] = []
  
  if (datasets.length > 1) {
    for (const pq of physicalQuantities) {
      const comparison = compareCrossDataset(datasetAnalyses, pq)
      if (comparison) {
        crossDatasetComparisons.push(comparison)
      }
    }
  }
  
  // Calculate totals
  const totalRows = datasets.reduce((sum, d) => sum + d.rows.length, 0)
  const totalNumericFields = datasetAnalyses.reduce((sum, a) => sum + a.numericFieldCount, 0)
  
  return {
    datasets: datasetAnalyses,
    crossDatasetComparisons,
    analysisTimestamp: new Date().toISOString(),
    totalRows,
    totalNumericFields,
  }
}

/**
 * Get a summary suitable for LLaMA prompt.
 * Optimized to be concise for faster inference.
 * IMPORTANT: Never sends empty statistics - always explicit about what was/wasn't found.
 */
export function getAnalysisSummaryForLLaMA(analysis: DeterministicAnalysisResult): string {
  const lines: string[] = []
  
  lines.push(`=== COMPUTED STATISTICS (DO NOT INVENT VALUES) ===`)
  lines.push(`SUMMARY: ${analysis.datasets.length} datasets, ${analysis.totalRows} rows, ${analysis.totalNumericFields} numeric fields`)
  lines.push(``)
  
  // Count total correlations found
  let totalCorrelations = 0
  
  for (const dataset of analysis.datasets) {
    lines.push(`DATASET: ${dataset.datasetName} (${dataset.rowCount} rows)`)
    
    // Limit to top 10 most interesting fields (those with outliers or trends)
    const interestingFields = dataset.numericFields
      .filter(f => f.outliers.outlierCount > 0 || f.trend)
      .slice(0, 5)
    
    const otherFields = dataset.numericFields
      .filter(f => !interestingFields.includes(f))
      .slice(0, 5)
    
    const fieldsToShow = [...interestingFields, ...otherFields].slice(0, 8)
    
    if (fieldsToShow.length > 0) {
      lines.push(`Fields (${dataset.numericFieldCount} numeric):`)
      for (const field of fieldsToShow) {
        const s = field.stats
        let fieldLine = `- ${field.fieldName}: range [${s.min.toPrecision(3)}, ${s.max.toPrecision(3)}], mean=${s.mean.toPrecision(3)}, std=${s.std.toPrecision(3)}`
        if (field.outliers.outlierCount > 0) {
          fieldLine += `, ${field.outliers.outlierCount} outliers`
        }
        if (field.trend && field.trend.rSquared > 0.3) {
          fieldLine += `, ${field.trend.direction} trend (R²=${field.trend.rSquared.toFixed(2)})`
        }
        lines.push(fieldLine)
      }
      
      if (dataset.numericFields.length > fieldsToShow.length) {
        lines.push(`- ... and ${dataset.numericFields.length - fieldsToShow.length} more fields`)
      }
    } else {
      lines.push(`No numeric fields with sufficient data found.`)
    }
    
    // Show top 3 correlations only
    if (dataset.topCorrelations.length > 0) {
      lines.push(`Correlations found:`)
      for (const corr of dataset.topCorrelations.slice(0, 3)) {
        lines.push(`- ${corr.field1} ↔ ${corr.field2}: r=${corr.coefficient.toFixed(3)} (${corr.strength}, ${corr.direction})`)
      }
      totalCorrelations += dataset.topCorrelations.length
    } else {
      lines.push(`Correlations: NONE found above threshold (|r| >= 0.3)`)
    }
    
    lines.push(``)
  }
  
  // Explicit warning if no correlations
  if (totalCorrelations === 0) {
    lines.push(`IMPORTANT: No significant correlations were detected between any numeric fields.`)
    lines.push(`This may indicate independent variables or insufficient data variance.`)
    lines.push(`DO NOT invent or assume correlations that are not explicitly listed above.`)
    lines.push(``)
  }
  
  // Only show significant cross-dataset comparisons
  const significantComparisons = analysis.crossDatasetComparisons
    .filter(c => c.distributionShift !== "none")
    .slice(0, 3)
    
  if (significantComparisons.length > 0) {
    lines.push(`CROSS-DATASET:`)
    for (const comp of significantComparisons) {
      lines.push(`- ${comp.physicalQuantity}: ${comp.distributionShift} shift, ${(comp.overlapRatio * 100).toFixed(0)}% overlap`)
    }
  }
  
  lines.push(`=== END COMPUTED STATISTICS ===`)
  
  return lines.join("\n")
}
