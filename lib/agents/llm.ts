/**
 * OpenRouter client.
 *
 * Free-tier models are the target, which shapes every decision here:
 * they rate-limit (429) without warning, occasionally return an empty
 * `content` because the whole answer went into a reasoning field, and
 * they wrap JSON in prose or code fences. All three are handled rather
 * than assumed away.
 *
 * Measured on the free tier, one structured call:
 *   nemotron-3-super-120b-a12b  ~1.3s   clean JSON
 *   gpt-oss-20b                 ~10.2s  empty content
 *   gemma-4-31b-it              429 rate limited
 * Hence the primary/fallback ordering below.
 */

const OR = 'https://openrouter.ai/api/v1/chat/completions'

const KEY = process.env.OPENROUTER_API_KEY?.trim() || ''
export const hasLLM = () => KEY.length > 0

/** Primary first; each fallback is tried only if the one before it fails.
 *  Kept short on purpose — the whole debate has to finish inside Vercel's
 *  60s function ceiling, and every dead model costs a full timeout. */
const MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
] as const

export class LLMUnavailable extends Error {}

/** Pull the first balanced JSON object out of a string. */
function extractJSON(raw: string): unknown {
  const text = raw.replace(/```(?:json)?/gi, '').trim()
  const start = text.indexOf('{')
  if (start === -1) throw new Error('no JSON object in model output')

  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (esc) { esc = false; continue }
    if (ch === '\\') { esc = true; continue }
    if (ch === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return JSON.parse(text.slice(start, i + 1))
    }
  }
  throw new Error('unterminated JSON object in model output')
}

interface ChatResponse {
  choices?: { message?: { content?: string | null; reasoning?: string | null } }[]
  error?: { message?: string; code?: number }
}

/**
 * One structured-JSON call. Walks the model list until one answers.
 * Throws LLMUnavailable if every model fails — callers degrade to the
 * deterministic engine rather than inventing an opinion.
 */
export async function askJSON<T>(
  system: string,
  user: string,
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {}
): Promise<{ value: T; model: string; ms: number }> {
  if (!KEY) throw new LLMUnavailable('OPENROUTER_API_KEY not configured')

  const { maxTokens = 400, temperature = 0.35, timeoutMs = 11_000 } = opts
  const failures: string[] = []

  for (const model of MODELS) {
    const started = Date.now()
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(OR, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${KEY}`,
          'Content-Type': 'application/json',
          // Optional OpenRouter attribution headers.
          'HTTP-Referer': 'https://github.com/VenkataVinesh/Veltrix',
          'X-Title': 'Veltrix',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          max_tokens: maxTokens,
          temperature,
          response_format: { type: 'json_object' },
          // These are reasoning models. Left on, they spend the token
          // budget thinking and then emit truncated or empty content —
          // measured: a 200-token cap produced no JSON at all. We want a
          // short structured answer, not a chain of thought, and turning
          // it off is both faster and far more reliably parseable.
          reasoning: { enabled: false },
        }),
        cache: 'no-store',
      })

      if (!res.ok) { failures.push(`${model}: HTTP ${res.status}`); continue }

      const data = (await res.json()) as ChatResponse
      if (data.error) { failures.push(`${model}: ${data.error.message}`); continue }

      // Some reasoning models leave `content` empty and put everything in
      // `reasoning`; fall back to that before giving up on the model.
      const msg = data.choices?.[0]?.message
      const text = (msg?.content || msg?.reasoning || '').trim()
      if (!text) { failures.push(`${model}: empty content`); continue }

      return { value: extractJSON(text) as T, model, ms: Date.now() - started }
    } catch (e) {
      failures.push(`${model}: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      clearTimeout(timer)
    }
  }

  throw new LLMUnavailable(`all models failed — ${failures.join('; ')}`)
}

export const num = (v: unknown, lo: number, hi: number, dflt: number): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt
}

export const str = (v: unknown, max = 400): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : ''
