'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  TrendingUp, TrendingDown, Minus, Play, ShieldAlert, ShieldCheck,
  AlertTriangle, Loader2,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Eyebrow, EmptyState, Skeleton, fmtUsd, fmtPrice } from '@/components/ui/primitives'
import { ForecastChart } from '@/components/forecast-chart'
import { cn } from '@/lib/utils'
import { InfoTip, GlossaryPanel } from '@/components/ui/glossary'
import { CRYPTO_IDS, EQUITY_NAMES } from '@/lib/market/providers'
import type { DebateResult, Stance } from '@/lib/agents/engine'

// Quick chips for the handful people actually reach for; the full 79-symbol
// universe lives in the dropdown beside them.
const QUICK = ['BTC', 'ETH', 'SOL', 'AAPL', 'NVDA', 'MSFT', 'SPY', 'TSLA']
const CRYPTO_LIST = Object.entries(CRYPTO_IDS).map(([s, m]) => [s, m.name] as const)
const EQUITY_LIST = Object.entries(EQUITY_NAMES) as [string, string][]

const stanceTone = (s: Stance) =>
  s === 'bullish' ? 'text-success' : s === 'bearish' ? 'text-destructive' : 'text-muted-foreground'

const StanceIcon = ({ s }: { s: Stance }) => {
  const C = s === 'bullish' ? TrendingUp : s === 'bearish' ? TrendingDown : Minus
  return <C className={cn('h-4 w-4 shrink-0', stanceTone(s))} />
}

const actionTone = (a: string) =>
  a === 'BUY' ? 'text-success' : a === 'SELL' ? 'text-destructive' : 'text-muted-foreground'

/** Confidence as a bar — a number alone reads as more precise than it is. */
function ConfidenceBar({ value, tone = 'bg-primary' }: { value: number; tone?: string }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-elevated">
      <div className={cn('h-full rounded-full', tone)} style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  )
}

export function IntelligenceView() {
  const [symbol, setSymbol] = useState('BTC')
  const [debate, setDebate] = useState<DebateResult | null>(null)

  const forecast = useQuery({
    queryKey: ['forecast', symbol],
    queryFn: () => api.forecast(symbol, 14),
  })
  const signal = useQuery({
    queryKey: ['signal', symbol],
    queryFn: () => api.signal(symbol),
  })
  const candles = useQuery({
    queryKey: ['candles', symbol, 90],
    queryFn: () => api.candles(symbol, 90),
  })

  // On-demand: a debate is ~10 LLM calls, so it never fires on page load.
  const runDebate = useMutation({
    mutationFn: () => api.agents(symbol),
    onSuccess: (d) => setDebate(d),
  })

  const f = forecast.data
  const s = signal.data
  const history = (candles.data?.candles ?? []).map((c) => c.c)
  const fUnavailable = !f || f.unavailable || !f.path?.length

  const pick = (sym: string) => {
    setSymbol(sym)
    setDebate(null)
    runDebate.reset()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Intelligence</Eyebrow>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Forecast &amp; agent debate</h1>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {QUICK.map((sym) => (
            <button
              key={sym}
              onClick={() => pick(sym)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                sym === symbol ? 'bg-primary text-primary-foreground' : 'bg-elevated text-muted-foreground hover:text-foreground'
              )}
            >
              {sym}
            </button>
          ))}
          <select
            aria-label="Choose any symbol"
            value={symbol}
            onChange={(e) => pick(e.target.value)}
            className="rounded-full bg-elevated px-3.5 py-1.5 text-sm font-medium text-foreground"
          >
            <optgroup label={`Crypto (${CRYPTO_LIST.length})`}>
              {CRYPTO_LIST.map(([s2, n]) => <option key={s2} value={s2}>{s2} — {n}</option>)}
            </optgroup>
            <optgroup label={`Stocks & ETFs (${EQUITY_LIST.length})`}>
              {EQUITY_LIST.map(([s2, n]) => <option key={s2} value={s2}>{s2} — {n}</option>)}
            </optgroup>
          </select>
        </div>
      </div>

      {/* ── Forecast ── */}
      <Card className="p-0">
        <div className="flex flex-wrap items-end justify-between gap-4 p-6 pb-0">
          <div>
            <Eyebrow>14-day ensemble forecast</Eyebrow>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="figure figure-lg">
                {f && !f.unavailable ? fmtPrice(f.currentPrice) : '—'}
              </span>
              {f && !f.unavailable && (
                <span className={cn('tnum text-sm', f.expectedReturnPct >= 0 ? 'text-success' : 'text-destructive')}>
                  {f.expectedReturnPct >= 0 ? '+' : ''}{f.expectedReturnPct.toFixed(2)}% expected
                </span>
              )}
            </div>
          </div>
          {f && !f.unavailable && (
            <div className="text-right">
              <span className="inline-flex items-center gap-1.5"><Eyebrow>Directional hit-rate</Eyebrow><InfoTip term="hitRate" /></span>
              {f.hitRate === null ? (
                <>
                  <p className="figure figure-md mt-2 text-muted-foreground">n/a</p>
                  <p className="text-xs text-muted-foreground">too few directional calls to measure</p>
                </>
              ) : (
                <>
                  <p className={cn('figure figure-md mt-2', f.hitRate > 0.55 ? 'text-success' : f.hitRate < 0.45 ? 'text-destructive' : 'text-muted-foreground')}>
                    {(f.hitRate * 100).toFixed(0)}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {f.backtest.nCorrect}/{f.backtest.nDirectional} directional calls
                    {' · ±'}
                    {(196 * Math.sqrt(0.25 / Math.max(f.backtest.nDirectional, 1))).toFixed(0)}pp
                    {' at 95%'}
                  </p>
                  {/* A sample this small cannot resolve a real edge from noise,
                      so say that outright instead of letting the headline
                      number imply more precision than it has. */}
                  {Math.abs(f.hitRate - 0.5) <
                    1.96 * Math.sqrt(0.25 / Math.max(f.backtest.nDirectional, 1)) && (
                    <p className="text-xs text-muted-foreground">
                      not distinguishable from a coin flip
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {forecast.isLoading ? (
          <Skeleton className="m-6 h-[320px]" />
        ) : fUnavailable ? (
          <div className="p-6">
            <EmptyState
              title="No forecast for this symbol"
              body={f?.reason ?? 'Not enough price history to fit and validate the models.'}
            />
          </div>
        ) : (
          <>
            <ForecastChart history={history} path={f.path} className="mt-6 h-[280px] w-full md:h-[320px]" />
            <div className="grid gap-px overflow-hidden border-t border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {([
                { k: 'Ensemble RMSE', v: f.backtest.rmse.toFixed(4), t: 'rmse' },
                { k: 'Ensemble MAE', v: f.backtest.mae.toFixed(4), t: 'mae' },
                { k: 'Out-of-sample steps', v: String(f.backtest.nTest), t: 'outOfSample' },
                { k: 'Band', v: '95% interval', t: 'band' },
              ] as const).map((m) => (
                <div key={m.k} className="bg-card p-5">
                  <span className="inline-flex items-center gap-1.5"><Eyebrow>{m.k}</Eyebrow><InfoTip term={m.t} /></span>
                  <p className="figure figure-md mt-2">{m.v}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-border p-6">
              <span className="inline-flex items-center gap-1.5"><Eyebrow>Model weights — earned by inverse RMSE on the backtest</Eyebrow><InfoTip term="weights" /></span>
              <div className="mt-4 space-y-3">
                {Object.entries(f.weights).map(([name, w]) => (
                  <div key={name}>
                    <div className="mb-1.5 flex items-baseline justify-between text-sm">
                      <span className="font-medium">{name}</span>
                      <span className="tnum text-muted-foreground">{(w * 100).toFixed(1)}%</span>
                    </div>
                    <ConfidenceBar value={w} />
                  </div>
                ))}
              </div>
              <p className="mt-5 text-xs leading-relaxed text-muted-foreground">{f.methodology}</p>
            </div>
          </>
        )}
      </Card>

      {/* ── Deterministic signal ── */}
      {s && !s.unavailable && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5"><Eyebrow>Composite signal — deterministic, no model involved</Eyebrow><InfoTip term="momentum" /></span>
              <div className="mt-2 flex items-baseline gap-3">
                <span className={cn('figure figure-lg', actionTone(s.signal))}>{s.signal}</span>
                <span className="tnum text-sm text-muted-foreground">momentum {s.momentum.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex gap-8 text-right">
              <div>
                <Eyebrow>Support</Eyebrow>
                <p className="figure figure-md mt-1.5">{fmtUsd(s.support)}</p>
              </div>
              <div>
                <Eyebrow>Resistance</Eyebrow>
                <p className="figure figure-md mt-1.5">{fmtUsd(s.resistance)}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-px overflow-hidden rounded-xl bg-border">
            {s.components.map((c) => (
              <div key={c.name} className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-card px-4 py-3">
                <StanceIcon s={c.vote as Stance} />
                <span className="min-w-[150px] text-sm font-medium">{c.name}</span>
                <span className="tnum text-sm text-muted-foreground">{c.value}</span>
                <span className="flex-1 text-sm text-muted-foreground">{c.detail}</span>
                <span className="tnum text-xs text-muted-foreground">weight {c.weight}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Agent debate ── */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Eyebrow>Multi-agent debate</Eyebrow>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Four analysts, a two-round bull/bear debate, a trader and a risk manager —
              all reading the evidence above. Architecture after TradingAgents.
            </p>
          </div>
          <button
            onClick={() => runDebate.mutate()}
            disabled={runDebate.isPending}
            className="btn-lime inline-flex items-center gap-2 px-6 py-3 text-sm disabled:opacity-60"
          >
            {runDebate.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Running debate…</>
              : <><Play className="h-4 w-4" /> Run analysis on {symbol}</>}
          </button>
        </div>

        {runDebate.isError && (
          <p className="mt-5 text-sm text-destructive">
            {(runDebate.error as Error).message}
          </p>
        )}

        {debate?.degraded && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-border p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium">Debate unavailable — showing arithmetic only</p>
              <p className="mt-1 text-sm text-muted-foreground">{debate.degradedReason}</p>
            </div>
          </div>
        )}

        {debate && !debate.degraded && (
          <div className="mt-6 space-y-6">
            {/* Verdict */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="panel-inset p-5">
                <Eyebrow>Trader</Eyebrow>
                <p className={cn('figure figure-lg mt-2', actionTone(debate.trader!.action))}>
                  {debate.trader!.action}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  confidence {(debate.trader!.confidence * 100).toFixed(0)}%
                </p>
              </div>
              <div className="panel-inset p-5">
                <span className="inline-flex items-center gap-1.5"><Eyebrow>Risk manager</Eyebrow><InfoTip term="positionSize" /></span>
                <p className="mt-2 flex items-center gap-2">
                  {debate.risk!.approved
                    ? <ShieldCheck className="h-5 w-5 text-success" />
                    : <ShieldAlert className="h-5 w-5 text-destructive" />}
                  <span className="figure figure-md">
                    {debate.risk!.approved ? `${debate.risk!.positionSizePct}% size` : 'Vetoed'}
                  </span>
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{debate.risk!.verdict}</p>
              </div>
              <div className="panel-inset p-5">
                <span className="inline-flex items-center gap-1.5"><Eyebrow>Agrees with the arithmetic?</Eyebrow><InfoTip term="agreesWithQuant" /></span>
                <p className={cn('figure figure-md mt-2', debate.agreesWithQuant ? 'text-success' : 'text-destructive')}>
                  {debate.agreesWithQuant === null ? 'n/a' : debate.agreesWithQuant ? 'Yes' : 'No'}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  composite said {debate.quantSignal ?? '—'} · debate took {(debate.totalMs / 1000).toFixed(1)}s
                </p>
              </div>
            </div>

            {debate.risk!.concerns.length > 0 && (
              <div>
                <Eyebrow>Risk concerns</Eyebrow>
                <ul className="mt-3 space-y-2">
                  {debate.risk!.concerns.map((c) => (
                    <li key={c} className="flex gap-2.5 text-sm text-muted-foreground">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Analysts */}
            <div>
              <Eyebrow>Analysts</Eyebrow>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {debate.analysts.map((a) => (
                  <div key={a.role} className="panel-inset p-5">
                    <div className="flex items-center gap-2">
                      <StanceIcon s={a.stance} />
                      <span className="text-sm font-medium">{a.label}</span>
                      <span className="tnum ml-auto text-xs text-muted-foreground">
                        {(a.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-3"><ConfidenceBar value={a.confidence} /></div>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a.argument}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Debate, by round */}
            <div>
              <Eyebrow>Bull vs bear — two rounds, confidence may move</Eyebrow>
              <div className="mt-3 space-y-3">
                {[1, 2].map((round) => (
                  <div key={round} className="grid gap-3 sm:grid-cols-2">
                    {debate.researchers.filter((r) => (r.round ?? 1) === round).map((r) => {
                      const prev = round === 2
                        ? debate.researchers.find((x) => x.role === r.role && (x.round ?? 1) === 1)
                        : undefined
                      const drift = prev ? r.confidence - prev.confidence : 0
                      return (
                        <div key={`${r.role}-${round}`} className="panel-inset p-5">
                          <div className="flex items-center gap-2">
                            <StanceIcon s={r.stance} />
                            <span className="text-sm font-medium">{r.label}</span>
                            <span className="rounded-full bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
                              round {round}
                            </span>
                            <span className="tnum ml-auto text-xs text-muted-foreground">
                              {(r.confidence * 100).toFixed(0)}%
                              {prev && drift !== 0 && (
                                <span className={cn('ml-1.5', drift > 0 ? 'text-success' : 'text-destructive')}>
                                  {drift > 0 ? '▲' : '▼'}{Math.abs(drift * 100).toFixed(0)}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="mt-3"><ConfidenceBar value={r.confidence} tone={r.stance === 'bullish' ? 'bg-success' : 'bg-destructive'} /></div>
                          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{r.argument}</p>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Trader rationale: {debate.trader!.rationale}
              {debate.evidenceGaps.length > 0 && (
                <> · Evidence gaps: {debate.evidenceGaps.join(', ')}</>
              )}
              {' '}· Models: {debate.analysts[0]?.model}
            </p>
          </div>
        )}
      </Card>

      {/* ── Reference ── */}
      <Card>
        <Eyebrow>What these terms mean</Eyebrow>
        <p className="mt-2 mb-6 text-sm text-muted-foreground">
          Every figure on this page in plain English, including how not to over-read it.
        </p>
        <GlossaryPanel
          terms={[
            'hitRate', 'band', 'garch', 'rmse', 'mae', 'outOfSample', 'weights',
            'driftEwma', 'ar', 'naive', 'compositeSignal', 'momentum', 'rsi', 'macd',
            'bollinger', 'trendStack', 'volume', 'supportResistance', 'volatility',
            'agreesWithQuant', 'positionSize',
            'portfolioValue', 'unrealisedPnl', 'invested', 'marketValue', 'paperTrading',
          ]}
        />
      </Card>
    </div>
  )
}
