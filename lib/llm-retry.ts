/**
 * LLM call contract + retry. All LLM calls MUST go through this wrapper.
 * maxRetries = 2. Retry prompt: "Your previous output was invalid JSON. Output ONLY the JSON object."
 * Returns { responseText, parsed }. NEVER throws due to JSON failure.
 */

import { safeExtractJSONObject } from "@/lib/safeExtractJSON"

/** Exact system message for JSON-only output. No strict end validation. */
export const LLM_SYSTEM_JSON_ONLY =
  "You MUST output ONLY valid JSON.\nNo markdown. No explanations.\nOutput MUST start with { and end with }."

export const LLM_USER_NO_TEXT_AROUND =
  "Do not include any text before or after JSON."

export const LLM_RETRY_USER =
  "Your previous output was invalid JSON. Output ONLY the JSON object."

const RETRY_DELAY_MS = 500
const MAX_RETRIES = 2

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface CallOllamaOptions {
  model: string
  /** User message / task prompt */
  prompt: string
  /** System message; defaults to LLM_SYSTEM_JSON_ONLY */
  system?: string
  /** @deprecated use system */
  systemPrefix?: string
  useRetryPrompt?: boolean
  options?: { temperature?: number; top_p?: number; num_predict?: number }
}

/**
 * Call Ollama /api/generate. Uses safeExtractJSONObject; retries up to MAX_RETRIES on invalid JSON.
 * Returns { responseText, parsed }. Never throws for parse failure.
 */
export async function callOllamaWithRetry(
  opts: CallOllamaOptions
): Promise<{ responseText: string; parsed: object | null }> {
  const system = opts.system ?? opts.systemPrefix ?? LLM_SYSTEM_JSON_ONLY
  const { model, prompt, useRetryPrompt = true, options = {} } = opts
  let lastResponseText = ""
  let attempt = 0

  while (attempt < MAX_RETRIES) {
    const userPrompt =
      attempt === 0
        ? `${prompt}\n\n${LLM_USER_NO_TEXT_AROUND}`
        : `${useRetryPrompt ? LLM_RETRY_USER + "\n\n" : ""}${prompt}\n\n${LLM_USER_NO_TEXT_AROUND}`
    const fullPrompt = `${system}\n\n${userPrompt}`

    try {
      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt: fullPrompt,
          format: "json",
          stream: false,
          options: { temperature: 0.2, top_p: 0.9, num_predict: 1024, ...options },
        }),
      })

      if (!response.ok) {
        if (typeof console !== "undefined" && console.warn) console.warn("Ollama API non-OK:", response.statusText)
        lastResponseText = ""
        attempt++
        await sleep(RETRY_DELAY_MS)
        continue
      }

      const data = await response.json().catch(() => ({}))
      lastResponseText = (data.response ?? "") as string
      const parsed = safeExtractJSONObject(lastResponseText)
      if (parsed != null) return { responseText: lastResponseText, parsed }
    } catch (e) {
      if (typeof console !== "undefined" && console.warn) console.warn("Ollama call error:", e)
    }

    attempt++
    if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS)
  }

  return { responseText: lastResponseText, parsed: null }
}
