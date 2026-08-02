'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDownUp, Loader2, Check } from 'lucide-react'
import { api } from '@/lib/api'
import { PriceChart, type Candle } from '@/components/price-chart'
import { Card, Eyebrow, DeltaChip, EmptyState, fmtPrice, fmtUsd, fmtCompact } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

const SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE']
const RANGES = [
  { label: '24h', days: 1 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

export function TradeView() {
  const [symbol, setSymbol] = useState('BTC')
  const [days, setDays] = useState(30)
  const [mode, setMode] = useState<'area' | 'candles'>('area')
  const [hover, setHover] = useState<Candle | null>(null)
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('1000')
  const qc = useQueryClient()

  const { data: quoteData } = useQuery({
    queryKey: ['quotes', SYMBOLS],
    queryFn: () => api.quotes(SYMBOLS),
    refetchInterval: 30_000,
  })
  const { data: candleData, isLoading } = useQuery({
    queryKey: ['candles', symbol, days],
    queryFn: () => api.candles(symbol, days),
  })
  const { data: portfolio } = useQuery({ queryKey: ['portfolio'], queryFn: api.portfolio })

  const quote = useMemo(
    () => quoteData?.quotes.find((q) => q.symbol === symbol),
    [quoteData, symbol]
  )
  const candles = candleData?.candles ?? []
  const price = quote?.price ?? candles.at(-1)?.c ?? 0

  const usd = Number(amount) || 0
  const units = price > 0 ? usd / price : 0
  const cash = portfolio?.cash ?? 0
  const holding = portfolio?.positions.find((p) => p.symbol === symbol)

  const insufficientCash = side === 'buy' && usd > cash
  const insufficientUnits = side === 'sell' && units > (holding?.quantity ?? 0)
  const blocked = usd <= 0 || price <= 0 || insufficientCash || insufficientUnits

  const trade = useMutation({
    mutationFn: () =>
      api.addPosition({ symbol, quantity: units, avgPrice: price, assetType: 'crypto' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portfolio'] }),
  })

  const shown = hover ?? candles.at(-1) ?? null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Trade</Eyebrow>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-[-0.02em]">{symbol} / USD</h1>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SYMBOLS.map((s) => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              aria-pressed={s === symbol}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                s === symbol ? 'bg-primary text-primary-foreground' : 'bg-elevated text-muted-foreground hover:text-foreground'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        {/* Chart */}
        <Card className="p-0">
          <div className="flex flex-wrap items-start justify-between gap-4 p-6 pb-2">
            <div>
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="figure figure-xl">{price ? fmtPrice(price) : '—'}</span>
                {quote && <DeltaChip value={quote.change} />}
              </div>
              {shown && (
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                  <span>O <span className="tnum text-foreground">{shown.o.toFixed(2)}</span></span>
                  <span>H <span className="tnum text-foreground">{shown.h.toFixed(2)}</span></span>
                  <span>L <span className="tnum text-foreground">{shown.l.toFixed(2)}</span></span>
                  <span>C <span className="tnum text-foreground">{shown.c.toFixed(2)}</span></span>
                  {shown.v > 0 && <span>V <span className="tnum text-foreground">{fmtCompact(shown.v)}</span></span>}
                </div>
              )}
            </div>
            <div className="flex gap-1.5">
              <div className="flex gap-1 rounded-full bg-elevated p-1">
                {RANGES.map((r) => (
                  <button
                    key={r.label}
                    onClick={() => setDays(r.days)}
                    aria-pressed={days === r.days}
                    className={cn(
                      'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
                      days === r.days ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 rounded-full bg-elevated p-1">
                {(['area', 'candles'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    aria-pressed={mode === m}
                    aria-label={`${m} chart`}
                    className={cn(
                      'rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition-colors',
                      mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-2 pb-4" onMouseLeave={() => setHover(null)}>
            {isLoading ? (
              <div className="flex h-[380px] items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : candles.length ? (
              <PriceChart candles={candles} mode={mode} height={380} onHover={setHover} />
            ) : (
              <div className="px-4 py-8">
                <EmptyState
                  title="No chart data"
                  body={candleData?.reason ?? 'The provider returned no candles for this symbol and range.'}
                />
              </div>
            )}
          </div>
        </Card>

        {/* Order panel */}
        <div className="space-y-4">
          <Card>
            <div className="flex gap-1 rounded-full bg-elevated p-1">
              {(['buy', 'sell'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  aria-pressed={side === s}
                  className={cn(
                    'flex-1 rounded-full py-2.5 text-sm font-semibold capitalize transition-colors',
                    side === s
                      ? s === 'buy' ? 'bg-primary text-primary-foreground' : 'bg-destructive text-white'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="mt-5 space-y-2">
              <div className="panel-inset p-5">
                <div className="flex items-center justify-between">
                  <Eyebrow>You {side === 'buy' ? 'spend' : 'receive'}</Eyebrow>
                  <span className="text-xs text-muted-foreground">
                    Cash {fmtUsd(cash, 0)}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                    inputMode="decimal"
                    aria-label="USD amount"
                    className="figure figure-lg w-full bg-transparent outline-none"
                  />
                  <span className="shrink-0 rounded-full bg-primary/12 px-3.5 py-1.5 text-sm font-semibold text-primary">
                    USD
                  </span>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="-my-4 flex h-9 w-9 items-center justify-center rounded-full border-4 border-card bg-elevated">
                  <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <div className="panel-inset p-5">
                <div className="flex items-center justify-between">
                  <Eyebrow>You {side === 'buy' ? 'receive' : 'sell'}</Eyebrow>
                  <span className="text-xs text-muted-foreground">
                    Holding {(holding?.quantity ?? 0).toFixed(4)}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <span className="figure figure-lg w-full truncate">
                    {units ? units.toFixed(6) : '0.00'}
                  </span>
                  <span className="shrink-0 rounded-full bg-elevated px-3.5 py-1.5 text-sm font-semibold">
                    {symbol}
                  </span>
                </div>
              </div>
            </div>

            {(insufficientCash || insufficientUnits) && (
              <p className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {insufficientCash
                  ? `Not enough cash — you have ${fmtUsd(cash, 2)}.`
                  : `Not enough ${symbol} — you hold ${(holding?.quantity ?? 0).toFixed(6)}.`}
              </p>
            )}
            {trade.isError && (
              <p className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {(trade.error as Error).message}
              </p>
            )}

            <button
              onClick={() => trade.mutate()}
              disabled={blocked || trade.isPending || side === 'sell'}
              className="btn-lime mt-5 flex w-full items-center justify-center gap-2 py-3.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {trade.isPending ? <Loader2 className="h-4 w-4 animate-spin" />
                : trade.isSuccess ? <Check className="h-4 w-4" /> : null}
              {side === 'buy' ? `Buy ${symbol}` : 'Sell (coming soon)'}
            </button>

            <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
              Paper trading against live prices. Buys record a position at the current
              market price — no real order is placed.
            </p>
          </Card>

          <Card>
            <Eyebrow>Position</Eyebrow>
            {holding ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Quantity</span>
                  <span className="tnum font-medium">{holding.quantity.toFixed(6)} {symbol}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Avg price</span>
                  <span className="tnum font-medium">{fmtPrice(holding.avgPrice)}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Market value</span>
                  <span className="tnum font-medium">{fmtUsd(holding.marketValue)}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-border pt-3">
                  <span className="text-sm text-muted-foreground">Unrealised P&amp;L</span>
                  <span className={cn('tnum font-semibold', holding.pnl >= 0 ? 'text-success' : 'text-destructive')}>
                    {holding.pnl >= 0 ? '+' : ''}{fmtUsd(holding.pnl)} ({holding.pnlPct.toFixed(2)}%)
                  </span>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                You don&apos;t hold {symbol} yet.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
