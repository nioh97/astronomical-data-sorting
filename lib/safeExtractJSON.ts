/**
 * Universal safe JSON extraction for LLM responses.
 * NEVER trust raw LLM output. NEVER assume the response ends cleanly.
 * Find first '{', last '}', slice between them, parse. Return null on any failure.
 * Use this for ALL LLM integration points — no direct JSON.parse on raw response.
 */

/**
 * Extract a single JSON object from raw LLM response. Replace ALL JSON.parse on LLM output.
 * Find first '{', last '}', slice and parse. Returns null on failure. NEVER throws.
 */
export function safeExtractJSONObject(raw: string): object | null {
  try {
    const start = raw.indexOf("{")
    const end = raw.lastIndexOf("}")
    if (start === -1 || end === -1) return null
    const parsed = JSON.parse(raw.slice(start, end + 1))
    if (parsed != null && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as object
    return null
  } catch {
    return null
  }
}

/**
 * Typed wrapper: extract object and cast to T. Returns null on failure.
 */
export function safeExtractJSON<T = Record<string, unknown>>(raw: string): T | null {
  const obj = safeExtractJSONObject(raw)
  return obj != null ? (obj as T) : null
}
