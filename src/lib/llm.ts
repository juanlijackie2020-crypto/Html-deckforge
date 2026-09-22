/**
 * Shared LLM client for DeckForge.
 *
 * All calls go through the dev-server proxy at /api/llm (llmProxyPlugin in
 * vite.config.ts), which forwards to the GenAI Nexus gateway and injects the
 * API key server-side from LLM_API_KEY in .env.local — the key must never
 * appear in client code.
 */
export const LLM_BASE_URL = '/api/llm'

/** Model name comes from VITE_LLM_MODEL in .env.local (client-visible, non-secret). */
export const LLM_MODEL = import.meta.env.VITE_LLM_MODEL || 'qwen3.7-max'

export const LLM_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'anthropic-version': '2023-06-01',
}

export interface LlmMessage {
  role: string
  content: string
}

export interface CallLlmOptions {
  maxTokens?: number
  /** Optional client-side abort; without it the proxy timeout (120s) bounds the call. */
  timeoutMs?: number
}

/**
 * Call the LLM (Anthropic-style /messages) via the local proxy.
 * Resolves to the first text block of the response ('' if none).
 */
export async function callLLM(
  messages: LlmMessage[],
  system: string,
  opts: CallLlmOptions = {}
): Promise<string> {
  const controller = new AbortController()
  const timeout: ReturnType<typeof setTimeout> | undefined = opts.timeoutMs !== undefined
    ? setTimeout(() => controller.abort(), opts.timeoutMs)
    : undefined

  try {
    const response = await fetch(`${LLM_BASE_URL}/messages`, {
      method: 'POST',
      headers: LLM_HEADERS,
      body: JSON.stringify({
        model: LLM_MODEL,
        max_tokens: opts.maxTokens ?? 16000,
        // qwen3.7-max emits a leading thinking block by default; it burns
        // tokens and latency without helping these structured-output use
        // cases, and can starve small max_tokens budgets.
        thinking: { type: 'disabled' },
        system,
        messages,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(`API error: ${response.status} ${errText}`)
    }

    const data = await response.json()
    const textBlock = (data.content as { type: string; text?: string }[] | undefined)?.find(
      (b) => b.type === 'text'
    )
    return textBlock?.text || ''
  } finally {
    if (timeout !== undefined) clearTimeout(timeout)
  }
}
