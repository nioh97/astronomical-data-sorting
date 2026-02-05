/**
 * AI Discovery Module
 * 
 * Exports all AI discovery functionality for the astronomy data platform.
 */

// Types
export type {
  // Statistical Analysis Types
  FieldStatistics,
  FieldCorrelation,
  TrendAnalysis,
  OutlierInfo,
  NumericFieldAnalysis,
  DatasetAnalysis,
  CrossDatasetComparison,
  DeterministicAnalysisResult,
  
  // LLaMA Insight Types
  InsightType,
  ConfidenceLevel,
  AIInsight,
  AIPrediction,
  LLaMAInsightResponse,
  
  // Enhanced Python Analytics Types (for data-driven predictions)
  EnhancedFieldStatistics,
  EnhancedCorrelation,
  RegressionResult,
  EnhancedOutlier,
  ComputedPrediction,
  PythonAnalyticsResult,
  
  // UI State Types
  DatasetSelection,
  DiscoveryPipelineState,
  DiscoveryError,
  AIDiscoveryResult,
  
  // API Types
  AIInsightsRequest,
  AIInsightsResponse,
} from "./types"

// Analysis Functions
export {
  analyzeDataset,
  runDeterministicAnalysis,
  getAnalysisSummaryForLLaMA,
} from "./analysis"

// LLaMA Functions
export {
  generateLLaMAInsights,
  generateFallbackInsights,
  checkOllamaAvailability,
  clearOllamaStatusCache,
  LLAMA_CONFIG,
} from "./llama-insights"

// LLaMA Types
export type { OllamaStatus } from "./llama-insights"

// Re-export AI Config for convenience
export { AI_CONFIG, OLLAMA_ENDPOINTS } from "../ai/config"
