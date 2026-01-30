/**
 * Safe JSON Parsing Utilities for LLM Responses
 * 
 * Handles extraction and parsing of JSON from LLM outputs,
 * including decorated JSON (markdown, explanations) and incomplete responses.
 */

/**
 * Extract the first valid JSON object from text
 * Simple approach: find first '{' and last '}', slice between them
 * 
 * @param text - Raw text that may contain JSON
 * @returns Extracted JSON string or null if not found
 */
export function extractJSON(text: string): string | null {
  if (!text || typeof text !== "string") {
    return null
  }

  // Remove markdown code blocks if present
  let cleaned = text.trim()
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim()
  }

  // Find the first opening brace
  const firstBrace = cleaned.indexOf("{")
  if (firstBrace === -1) {
    return null
  }

  // Find the last closing brace (accepts partial trailing data)
  const lastBrace = cleaned.lastIndexOf("}")
  if (lastBrace === -1 || lastBrace <= firstBrace) {
    return null
  }

  // Slice from first '{' to last '}' (inclusive)
  return cleaned.substring(firstBrace, lastBrace + 1)
}

/**
 * Safely parse JSON with extraction and error handling
 * Resilient to truncated or partial responses
 * 
 * @param text - Raw text containing JSON
 * @param context - Optional context string for error messages
 * @returns Parsed JSON object of type T, or null if extraction/parsing fails
 */
export function safeParseJSON<T>(text: string, context: string = "JSON"): T | null {
  try {
    const extracted = extractJSON(text)
    if (!extracted) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`Failed to extract ${context} from response`)
        console.warn("Raw response (first 1000 chars):", text.substring(0, 1000))
      }
      return null
    }

    try {
      const parsed = JSON.parse(extracted) as T
      return parsed
    } catch (parseError) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`Failed to parse ${context}:`, parseError)
        console.warn("Extracted JSON (first 1000 chars):", extracted.substring(0, 1000))
        console.warn("Full raw response:", text)
      }
      return null
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`Error extracting ${context}:`, error)
    }
    return null
  }
}

