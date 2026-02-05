/**
 * AI Configuration - Server-Side Only
 * 
 * This is the SINGLE SOURCE OF TRUTH for all AI-related configuration.
 * Client components must NEVER import this file directly.
 * Instead, they should call server-side API routes.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * AI provider configuration.
 * Uses environment variables with sensible defaults.
 */
export const AI_CONFIG = {
  /** AI provider (currently only "ollama" is supported) */
  provider: "ollama" as const,
  
  /** Base URL for Ollama API */
  baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  
  /** Default model to use */
  model: process.env.OLLAMA_MODEL ?? "llama3.1:8b",
  
  /** Alternative model names that are also acceptable */
  alternateModels: [
    "llama3.1",
    "llama3.1:latest", 
    "llama3.1:8b", 
    "llama3.1:70b",
    "llama3.1:8b-instruct-q4_0",
  ],
  
  /** Temperature for inference (0 = deterministic, 1 = creative) */
  temperature: 0.3,
  
  /** Maximum tokens to generate */
  maxTokens: 1500,
  
  /** Timeout for inference requests (ms) */
  inferenceTimeoutMs: 180000, // 3 minutes
  
  /** Timeout for health check requests (ms) */
  healthCheckTimeoutMs: 10000, // 10 seconds
  
  /** Cache TTL for Ollama status (ms) */
  statusCacheTtlMs: 30000, // 30 seconds
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * Ollama API endpoints derived from base URL.
 */
export const OLLAMA_ENDPOINTS = {
  generate: `${AI_CONFIG.baseUrl}/api/generate`,
  tags: `${AI_CONFIG.baseUrl}/api/tags`,
  show: `${AI_CONFIG.baseUrl}/api/show`,
  chat: `${AI_CONFIG.baseUrl}/api/chat`,
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type AIProvider = typeof AI_CONFIG.provider
export type AIConfigType = typeof AI_CONFIG
