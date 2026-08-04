/**
 * Multi-agent debate.
 *
 * Architecture follows TauricResearch/TradingAgents (Apache-2.0):
 * specialist analysts feed a bull-vs-bear researcher debate, a trader
 * synthesises a proposal, and a risk manager gates it. This is an
 * independent TypeScript implementation of that structure — it does not
 * run their Python, and it is credited as such in CREDITS.md.
 *
 * Two deliberate departures, both in service of not fabricating:
 *  - Agents are handed real sourced evidence (our indicator engine,
 *    Twelve Data / CoinGecko history, Finnhub news, FRED macro) rather
 *    than being asked to recall market data from weights.
 *  - The deterministic composite signal remains the headline. Agents add
 *    reasoning and a risk verdict; they never silently overwrite the
 *    arithmetic. Where they disagree with it, the disagreement is shown.
 */

import { askJSON, hasLLM, LLMUnavailable, num, str } from './llm'
import { gatherContext, renderEvidence, type DebateContext } from './context'

export type Stance = 'bullish' | 'bearish' | 'neutral'
export type Action = 'BUY' | 'SELL' | 'HOLD'

export interface AgentOpinion {
  role: string
  label: string
  stance: Stance
  confidence: number
  argument: string
  model: string
  ms: number
  /** Debate round this argument belongs to (researchers only). */
  round?: number
}

export interface DebateResult {
  symbol: string
  generatedAt: string
  /** The deterministic engine's call — always present, never LLM-derived. */
  quantSignal: Action | null
  quantMomentum: number | null
  price: number | null
  analysts: AgentOpinion[]
  researchers: AgentOpinion[]
  trader: { action: Action; confidence: number; rationale: string; model: string } | null
  risk: {
    approved: boolean
    verdict: string
    concerns: string[]
    positionSizePct: number
    model: string
  } | null
  agreesWithQuant: boolean | null
  evidenceGaps: string[]
  degraded: boolean
  degradedReason?: string
  /** Wall time per stage — the debate must fit Vercel's 60s ceiling. */
  phaseMs: { evidence: number; analysts: number; researchers: number; rebuttal: number; trader: number; risk: number }
  totalMs: number
}

const JSON_RULE =
  'Respond with a single JSON object and nothing else. No markdown, no prose outside the JSON.'

const ANALYSTS = [
  {
    role: 'technical',
    label: 'Technical analyst',
    brief:
      'You read price action, momentum and volatility only. Weigh the indicator votes you were given; do not invent indicators that were not provided.',
  },
  {
    role: 'fundamental',
    label: 'Fundamentals & news analyst',
    brief:
      'You read company/protocol news and fundamentals. If no headlines were supplied, say so and lower your confidence rather than guessing.',
  },
  {
    role: 'sentiment',
    label: 'Sentiment analyst',
    brief:
      'You judge crowd positioning and tone from the supplied price move and headlines. Distinguish crowded moves from durable ones.',
  },
  {
    role: 'macro',
    label: 'Macro analyst',
    brief:
      'You read the rate and growth backdrop from the supplied macro series and what it implies for this asset class. If no macro data was supplied, say so.',
  },
] as const

interface RawOpinion { stance?: string; confidence?: unknown; argument?: unknown }

const asStance = (v: unknown): Stance => {
  const s = String(v ?? '').toLowerCase()
  if (s.startsWith('bull')) return 'bullish'
  if (s.startsWith('bear')) return 'bearish'
  return 'neutral'
}

const asAction = (v: unknown): Action => {
  const s = String(v ?? '').toUpperCase()
  return s === 'BUY' || s === 'SELL' ? s : 'HOLD'
}

async function runAnalyst(
  a: (typeof ANALYSTS)[number],
  evidence: string
): Promise<AgentOpinion> {
  const { value, model, ms } = await askJSON<RawOpinion>(
    `You are the ${a.label} at a trading desk. ${a.brief}\n` +
      'Base every claim on the supplied evidence. Never state a number that is not in the evidence.\n' +
      `${JSON_RULE}\nSchema: {"stance":"bullish"|"bearish"|"neutral","confidence":0.0-1.0,"argument":"under 60 words"}`,
    evidence,
    { maxTokens: 300 }
  )
  return {
    role: a.role,
    label: a.label,
    stance: asStance(value.stance),
    confidence: num(value.confidence, 0, 1, 0.5),
    argument: str(value.argument, 500) || 'No argument returned.',
    model,
    ms,
  }
}

async function runResearcher(
  side: 'bull' | 'bear',
  evidence: string,
  analysts: AgentOpinion[],
  round = 1,
  opponent?: AgentOpinion
): Promise<AgentOpinion> {
  const digest = analysts
    .map((o) => `- ${o.label}: ${o.stance} (${o.confidence.toFixed(2)}) — ${o.argument}`)
    .join('\n')

  // Round two hands over the opposing case so the rebuttal is a real
  // response rather than a restatement, and explicitly licenses lowering
  // confidence — a debate nobody can lose is theatre, not analysis.
  const rebuttal = opponent
    ? `\n\nOPPOSING CASE TO REBUT (${opponent.label}, confidence ${opponent.confidence.toFixed(2)}):\n"${opponent.argument}"\n` +
      'Rebut its single weakest claim specifically. If it has genuinely damaged your position, lower your confidence to reflect that. Do not restate round one.'
    : ''

  const { value, model, ms } = await askJSON<RawOpinion>(
    `You are the ${side === 'bull' ? 'BULLISH' : 'BEARISH'} researcher. Argue that side as strongly as the evidence honestly allows — ` +
      'but if the evidence genuinely does not support your side, say so and report low confidence. ' +
      'Attack the weakest point in the opposing case.\n' +
      `${JSON_RULE}\nSchema: {"stance":"${side}ish","confidence":0.0-1.0,"argument":"under 70 words"}`,
    `${evidence}\n\nANALYST FINDINGS:\n${digest}${rebuttal}`,
    { maxTokens: 340, temperature: 0.5 }
  )
  return {
    role: `${side}-researcher`,
    label: side === 'bull' ? 'Bull researcher' : 'Bear researcher',
    stance: side === 'bull' ? 'bullish' : 'bearish',
    confidence: num(value.confidence, 0, 1, 0.5),
    argument: str(value.argument, 600) || 'No argument returned.',
    model,
    ms,
    round,
  }
}

export async function runDebate(symbol: string): Promise<DebateResult> {
  const started = Date.now()
  const phaseMs = { evidence: 0, analysts: 0, researchers: 0, rebuttal: 0, trader: 0, risk: 0 }
  const lap = () => { const n = Date.now(); const d = n - mark; mark = n; return d }
  let mark = started

  const ctx: DebateContext = await gatherContext(symbol)
  const evidence = renderEvidence(ctx)
  phaseMs.evidence = lap()

  const base: DebateResult = {
    symbol: ctx.symbol,
    generatedAt: new Date().toISOString(),
    quantSignal: ctx.signal?.signal ?? null,
    quantMomentum: ctx.signal?.momentum ?? null,
    price: ctx.quote?.price ?? null,
    analysts: [],
    researchers: [],
    trader: null,
    risk: null,
    agreesWithQuant: null,
    evidenceGaps: ctx.missing,
    degraded: false,
    phaseMs,
    totalMs: 0,
  }

  if (!hasLLM()) {
    return {
      ...base,
      degraded: true,
      degradedReason: 'OPENROUTER_API_KEY not configured — showing the deterministic signal only.',
      totalMs: Date.now() - started,
    }
  }

  try {
    // Analysts are independent, so they run concurrently — this is what
    // keeps a full debate near ~6s instead of ~25s on free-tier models.
    const analysts = await Promise.all(ANALYSTS.map((a) => runAnalyst(a, evidence)))
    phaseMs.analysts = lap()

    const [bull1, bear1] = await Promise.all([
      runResearcher('bull', evidence, analysts, 1),
      runResearcher('bear', evidence, analysts, 1),
    ])
    phaseMs.researchers = lap()

    // Round two: each side must engage the other's actual case. A debate
    // where neither side can move is theatre, so researchers are told they
    // may lower their own confidence if genuinely damaged.
    const [bull2, bear2] = await Promise.all([
      runResearcher('bull', evidence, analysts, 2, bear1),
      runResearcher('bear', evidence, analysts, 2, bull1),
    ])
    phaseMs.rebuttal = lap()

    // How far each side's conviction moved once challenged is itself a
    // signal, so the trader sees the drift rather than just the endpoint.
    const drift = (a: AgentOpinion, b: AgentOpinion) => {
      const d = b.confidence - a.confidence
      return d === 0 ? 'unchanged' : `${d > 0 ? 'up' : 'down'} ${Math.abs(d).toFixed(2)} after rebuttal`
    }

    const debateDigest =
      `BULL r1 (${bull1.confidence.toFixed(2)}): ${bull1.argument}\n` +
      `BULL r2 (${bull2.confidence.toFixed(2)}, ${drift(bull1, bull2)}): ${bull2.argument}\n` +
      `BEAR r1 (${bear1.confidence.toFixed(2)}): ${bear1.argument}\n` +
      `BEAR r2 (${bear2.confidence.toFixed(2)}, ${drift(bear1, bear2)}): ${bear2.argument}`

    const traderRes = await askJSON<{ action?: string; confidence?: unknown; rationale?: unknown }>(
      'You are the trader. Resolve the bull/bear debate into one action. ' +
        'The desk already computed a deterministic composite signal from weighted indicators; ' +
        'you may disagree with it, but if you do you must say why in the rationale.\n' +
        `${JSON_RULE}\nSchema: {"action":"BUY"|"SELL"|"HOLD","confidence":0.0-1.0,"rationale":"under 70 words"}`,
      `${evidence}\n\nDEBATE:\n${debateDigest}`,
      { maxTokens: 320, temperature: 0.3 }
    )

    phaseMs.trader = lap()
    const action = asAction(traderRes.value.action)

    const riskRes = await askJSON<{
      approved?: unknown; verdict?: unknown; concerns?: unknown; position_size_pct?: unknown
    }>(
      'You are the risk manager. You may veto the trader. Consider volatility, how far price sits ' +
        'from support/resistance, evidence gaps, and crowding. Position size is a percentage of ' +
        'portfolio equity and must be 0 if you do not approve.\n' +
        `${JSON_RULE}\nSchema: {"approved":true|false,"verdict":"under 50 words","concerns":["..."],"position_size_pct":0-10}`,
      `${evidence}\n\nDEBATE:\n${debateDigest}\n\nTRADER PROPOSES: ${action} (confidence ${num(traderRes.value.confidence, 0, 1, 0.5).toFixed(2)})`,
      { maxTokens: 320, temperature: 0.25 }
    )

    phaseMs.risk = lap()
    const approved = riskRes.value.approved === true || String(riskRes.value.approved) === 'true'
    const concerns = Array.isArray(riskRes.value.concerns)
      ? riskRes.value.concerns.map((c) => str(c, 200)).filter(Boolean).slice(0, 5)
      : []

    return {
      ...base,
      analysts,
      researchers: [bull1, bear1, bull2, bear2],
      trader: {
        action,
        confidence: num(traderRes.value.confidence, 0, 1, 0.5),
        rationale: str(traderRes.value.rationale, 600) || 'No rationale returned.',
        model: traderRes.model,
      },
      risk: {
        approved,
        verdict: str(riskRes.value.verdict, 400) || 'No verdict returned.',
        concerns,
        // A veto must mean zero size, whatever the model wrote.
        positionSizePct: approved ? num(riskRes.value.position_size_pct, 0, 10, 1) : 0,
        model: riskRes.model,
      },
      agreesWithQuant: ctx.signal ? action === ctx.signal.signal : null,
      totalMs: Date.now() - started,
    }
  } catch (e) {
    // The deterministic signal still stands on its own — degrade to it
    // rather than returning an invented opinion.
    return {
      ...base,
      degraded: true,
      degradedReason:
        e instanceof LLMUnavailable
          ? `Agent debate unavailable: ${e.message}`
          : `Agent debate failed: ${e instanceof Error ? e.message : String(e)}`,
      totalMs: Date.now() - started,
    }
  }
}
