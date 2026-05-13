'use client'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Globe2, TrendingUp, Activity, Calendar } from 'lucide-react'
import { api } from '@/lib/api-client'

const fmt = (v: unknown, dec = 2) => { const n = Number(v); return Number.isFinite(n) ? n.toFixed(dec) : '—' }

function Card({ children, className = 'p-5' }: { children: React.ReactNode; className?: string }) {
  return <div className={`premium-card ${className}`}>{children}</div>
}

export function MacroView() {
  const { data: raw, isLoading } = useQuery({ queryKey: ['macro'], queryFn: api.macro, refetchInterval: 60_000, staleTime: 45_000 })
  // VIX from quotes
  const { data: quotes } = useQuery({ queryKey: ['quotes'], queryFn: api.quotes, refetchInterval: 15_000, staleTime: 12_000 })

  const m = raw as Record<string, unknown> | undefined
  const rates = (m?.rates ?? {}) as Record<string, unknown>
  const inflation = (m?.inflation ?? {}) as Record<string, unknown>
  const commodities = (m?.commodities ?? {}) as Record<string, unknown>
  const dxy = (m?.dxy ?? {}) as Record<string, unknown>
  const sentiment = (m?.sentiment ?? {}) as Record<string, unknown>
  const calendar = (m?.calendar ?? []) as Array<Record<string, unknown>>

  const regime = String(sentiment.macro_regime ?? 'Unknown')
  const recessionProb = Number(sentiment.recession_probability ?? 0)
  const spyQuote = quotes?.find(q => q.symbol === 'SPY')
  const ust10y = Number(rates.ust10y ?? 0)
  const ust2y = Number(rates.ust2y ?? 0)
  const spread = ust10y - ust2y
  const dxyVal = Number(dxy.index ?? 0)
  const wti = Number(commodities.wti ?? 0)
  const gold = Number(commodities.gold ?? 0)

  const REGIME_COLOR: Record<string, string> = { inflationary: '#ef4444', neutral: '#f59e0b', disinflationary: '#10b981', unknown: '#6b7280' }
  const regimeColor = REGIME_COLOR[regime.toLowerCase()] ?? '#f59e0b'

  const hasRates = ust10y > 0 || ust2y > 0
  const hasCommodities = wti > 0 || gold > 0

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /></div>

  return (
    <div className="space-y-5 max-w-[1400px]">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-xl font-bold text-white">Macro Intelligence</h2>
        <p className="text-xs text-gray-600 mt-0.5">Global economic regime, rates & commodities</p>
      </motion.div>

      {/* Hero metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'US 10Y Yield', value: hasRates ? `${fmt(ust10y)}%` : '—', sub: ust10y > 4 ? 'Elevated rates' : 'Normal range', color: ust10y > 4 ? '#ef4444' : '#f59e0b', icon: TrendingUp },
          { label: 'Yield Spread (10-2)', value: hasRates ? `${spread >= 0 ? '+' : ''}${fmt(spread)}%` : '—', sub: spread < 0 ? 'Inverted curve — risk' : 'Normal curve', color: spread < 0 ? '#ef4444' : '#10b981', icon: Activity },
          { label: 'Macro Regime', value: regime.charAt(0).toUpperCase() + regime.slice(1), sub: `Recession prob: ${(recessionProb * 100).toFixed(0)}%`, color: regimeColor, icon: Globe2 },
          { label: 'DXY Index', value: dxyVal > 0 ? fmt(dxyVal, 1) : spyQuote ? `SPY $${spyQuote.price.toFixed(0)}` : '—', sub: dxyVal > 104 ? 'Dollar strength' : dxyVal > 0 ? 'Dollar neutral' : 'Market proxy', color: '#06b6d4', icon: TrendingUp },
        ].map((metric, i) => (
          <motion.div key={metric.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card>
              <div className="relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: metric.color, opacity: 0.6 }} />
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-600">{metric.label}</span>
                  <metric.icon className="w-4 h-4" style={{ color: metric.color }} />
                </div>
                <div className="text-2xl font-bold font-mono" style={{ color: metric.color }}>{metric.value}</div>
                <div className="text-xs text-gray-600 mt-1">{metric.sub}</div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Recession probability */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Recession Probability</h3>
              <p className="text-xs text-gray-600 mt-0.5">Based on yield curve spread</p>
            </div>
            <span className="text-2xl font-bold font-mono" style={{ color: recessionProb > 0.5 ? '#ef4444' : recessionProb > 0.3 ? '#f59e0b' : '#10b981' }}>
              {(recessionProb * 100).toFixed(0)}%
            </span>
          </div>
          <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${recessionProb * 100}%` }} transition={{ duration: 1 }}
              style={{ background: recessionProb > 0.5 ? 'linear-gradient(to right, #f59e0b, #ef4444)' : 'linear-gradient(to right, #10b981, #f59e0b)' }} />
          </div>
          <div className="flex justify-between text-[10px] text-gray-700 mt-1.5">
            <span>Low Risk (0%)</span><span>Elevated (50%)</span><span>High Risk (100%)</span>
          </div>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Rates */}
        <Card>
          <h3 className="text-sm font-semibold text-white mb-4">Interest Rates</h3>
          {hasRates ? (
            [['US 10Y', ust10y, '%'], ['US 2Y', ust2y, '%'], ['10-2 Spread', spread, '%']].map(([label, val, unit], i) => (
              <motion.div key={String(label)} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.05 }}
                className="flex items-center justify-between py-2.5 border-b border-white/[0.03] last:border-0">
                <span className="text-xs text-gray-500">{String(label)}</span>
                <span className={`text-sm font-mono font-semibold ${Number(val) < 0 ? 'text-red-400' : 'text-amber-400'}`}>{Number(val) >= 0 ? '+' : ''}{fmt(val)}{unit}</span>
              </motion.div>
            ))
          ) : (
            <div className="py-4">
              <p className="text-xs text-gray-600 mb-2">FRED API key not configured.</p>
              <p className="text-xs text-gray-700">Set <code className="text-amber-500/70">FRED_API_KEY</code> in backend .env to fetch real rates.</p>
            </div>
          )}
        </Card>

        {/* Inflation */}
        <Card>
          <h3 className="text-sm font-semibold text-white mb-4">Inflation</h3>
          {Object.keys(inflation).length > 0 ? (
            Object.entries(inflation).map(([k, v], i) => (
              <motion.div key={k} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.05 }}
                className="flex items-center justify-between py-2.5 border-b border-white/[0.03] last:border-0">
                <span className="text-xs text-gray-500">{k.toUpperCase()}</span>
                <span className="text-sm font-mono font-semibold text-white">{fmt(v)}</span>
              </motion.div>
            ))
          ) : (
            <p className="text-xs text-gray-600 py-4">Configure FRED_API_KEY for real data.</p>
          )}
        </Card>

        {/* Commodities */}
        <Card>
          <h3 className="text-sm font-semibold text-white mb-4">Commodities</h3>
          {hasCommodities ? (
            [['WTI Oil', wti, '$'], ['Gold', gold, '$']].map(([label, val, prefix], i) => (
              <motion.div key={String(label)} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.05 }}
                className="flex items-center justify-between py-2.5 border-b border-white/[0.03] last:border-0">
                <span className="text-xs text-gray-500">{String(label)}</span>
                <span className="text-sm font-mono font-semibold text-amber-400">{prefix}{fmt(val, 2)}</span>
              </motion.div>
            ))
          ) : (
            <div className="py-4 space-y-2">
              {(() => {
                const commodityQuotes = quotes?.filter(q => ['GC=F','CL=F','GLD','USO'].includes(q.symbol)) ?? []
                return commodityQuotes.length > 0
                  ? commodityQuotes.map(q => (
                    <div key={q.symbol} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
                      <span className="text-xs text-gray-500">{q.symbol}</span>
                      <span className="text-sm font-mono font-semibold text-amber-400">${q.price.toFixed(2)}</span>
                    </div>
                  ))
                  : <p className="text-xs text-gray-600">Set FRED_API_KEY in backend .env for live commodity data.</p>
              })()}
            </div>
          )}
        </Card>
      </div>

      {/* AI Macro narrative */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        <Card>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${regimeColor}15` }}>
              <Globe2 className="w-5 h-5" style={{ color: regimeColor }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">AI Macro Narrative</h3>
              <p className="text-xs text-gray-500 leading-relaxed max-w-3xl">
                Current regime classified as <span style={{ color: regimeColor }} className="font-semibold capitalize">{regime}</span>.{' '}
                {hasRates ? `US 10-2 yield spread at ${spread >= 0 ? '+' : ''}${fmt(spread)}% — ${spread < 0 ? 'inverted curve signals recession risk.' : 'positive slope suggests expansion.'} ` : ''}
                Recession probability model outputs <strong className="text-gray-300">{(recessionProb * 100).toFixed(0)}%</strong>.{' '}
                {hasCommodities ? `WTI crude at $${fmt(wti)}, gold at $${fmt(gold, 0)} reflects ${gold > 2000 ? 'safe-haven demand.' : 'risk appetite.'}` : ''}
              </p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Economic calendar */}
      {calendar.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-white">Economic Calendar</h3>
            </div>
            <div className="space-y-2">
              {calendar.slice(0, 8).map((ev, i) => {
                const country = String(ev.country ?? '')
                const event = String(ev.event ?? '—')
                const value = ev.actual != null ? String(ev.actual) : ev.forecast != null ? String(ev.forecast) : '—'
                return (
                  <motion.div
                    key={`${country}-${event}-${i}`}
                    initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.04 }}
                    className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: '#0a0a0f' }}
                  >
                    <span className="text-[10px] font-bold text-amber-500/70 w-8">{country}</span>
                    <span className="flex-1 text-xs text-gray-400">{event}</span>
                    <span className="text-xs font-mono text-gray-500">{value}</span>
                  </motion.div>
                )
              })}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
