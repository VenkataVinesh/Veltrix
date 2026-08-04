/**
 * LLM client for the agent debate.
 *
 * Free tiers are the target, which shapes every decision here: they
 * rate-limit (429) without warning, sometimes return empty `content`
 * because the whole answer went into a reasoning field, and they wrap
 * JSON in prose or code fences. All three are handled, not assumed away.
 *
 * Measured on OpenRouter's free tier, one structured call:
 *   nemotron-3-super-120b-a12b  ~1.3s   clean JSON
 *   gpt-oss-20b                 ~10.2s  empty content
 *   gemma-4-31b-it              429 rate limited
 */

/**
 * Providers are stacked because free quotas are per-provider, and a single
 * one is not enough to run a product. Measured: OpenRouter's free tier is
 * capped at 50 model requests PER DAY
 * ("free-models-per-day", X-RateLimit-Limit: 50). One debate costs 10
 * calls, so OpenRouter alone supports five debates a day in total.
 *
 * Groq and Gemini both expose OpenAI-compatible endpoints and bill against
 * their own separate free quotas, so adding either multiplies capacity at
 * no cost. Whichever keys exist are used, in order.
 */
interface Provider {
  name: string
  url: string
  key: string
  models: string[]
}

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY?.trim() || ''
const GROQ_KEY = process.env.GROQ_API_KEY?.trim() || ''
const GEMINI_KEY = process.env.GEMINI_API_KEY?.trim() || ''

const PROVIDERS: Provider[] = [
  // Groq first when present: far higher free daily allowance and the
  // fastest inference of the three.
  {
    name: 'groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: GROQ_KEY,
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  },
  {
    name: 'gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    key: GEMINI_KEY,
    // Measured against a fresh key: flash-lite-latest ~1.2s clean JSON,
    // flash-latest ~3.0s. gemini-2.5-flash 404s ("no longer available to
    // new users") and gemini-2.0-flash reports zero quota, so neither is
    // listed — model aliases, not pinned versions, survive deprecation.
    models: ['gemini-flash-lite-latest', 'gemini-flash-latest'],
  },
  {
    name: 'openrouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: OPENROUTER_KEY,
    models: [
      'nvidia/nemotron-3-super-120b-a12b:free',
      'nvidia/nemotron-3-nano-30b-a3b:free',
    ],
  },
].filter((p) => p.key.length > 0)

export const hasLLM = () => PROVIDERS.length > 0

/** Flattened attempt order: every model of every configured provider. */
const ATTEMPTS = PROVIDERS.flatMap((p) => p.models.map((m) => ({ p, model: m })))

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

/** Gemini returns errors as a single-element ARRAY rather than an object.
 *  Unwrapped here so a real error is reported as such instead of being
 *  mistaken for an empty completion. */
function unwrap(body: unknown): ChatResponse {
  const b = Array.isArray(body) ? body[0] : body
  return (b ?? {}) as ChatResponse
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
  if (!ATTEMPTS.length) {
    throw new LLMUnavailable(
      'No LLM provider configured (set GROQ_API_KEY, GEMINI_API_KEY or OPENROUTER_API_KEY)'
    )
  }

  const { maxTokens = 400, temperature = 0.35, timeoutMs = 9_000 } = opts
  const failures: string[] = []

  for (const { p, model } of ATTEMPTS) {
    const started = Date.now()
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(p.url, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${p.key}`,
          'Content-Type': 'application/json',
          // Optional OpenRouter attribution headers; harmless elsewhere.
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
          // OpenRouter extension; Groq and Gemini reject unknown fields.
          ...(p.name === 'openrouter' ? { reasoning: { enabled: false } } : {}),
        }),
        cache: 'no-store',
      })

      const data = unwrap(await res.json().catch(() => ({})))
      if (!res.ok) {
        failures.push(`${p.name}/${model}: HTTP ${res.status}${data.error?.message ? ` — ${data.error.message.slice(0, 90)}` : ''}`)
        continue
      }
      if (data.error) { failures.push(`${p.name}/${model}: ${data.error.message}`); continue }

      // Some reasoning models leave `content` empty and put everything in
      // `reasoning`; fall back to that before giving up on the model.
      const msg = data.choices?.[0]?.message
      const text = (msg?.content || msg?.reasoning || '').trim()
      if (!text) { failures.push(`${p.name}/${model}: empty content`); continue }

      return { value: extractJSON(text) as T, model: `${p.name}/${model}`, ms: Date.now() - started }
    } catch (e) {
      failures.push(`${p.name}/${model}: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      clearTimeout(timer)
    }
  }

  throw new LLMUnavailable(`all providers failed — ${failures.join('; ')}`)
}

export const num = (v: unknown, lo: number, hi: number, dflt: number): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt
}

export const str = (v: unknown, max = 400): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : ''
