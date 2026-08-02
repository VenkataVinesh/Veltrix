'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Loader2, X } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Eyebrow, Stat, EmptyState, fmtUsd, fmtPrice } from '@/components/ui/primitives'
import { CRYPTO_SYMBOLS, EQUITY_SYMBOLS } from '@/lib/market/providers'
import { cn } from '@/lib/utils'

export function PortfolioView() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [symbol, setSymbol] = useState('BTC')
  const [quantity, setQuantity] = useState('')
  const [avgPrice, setAvgPrice] = useState('')

  const { data, isLoading } = useQuery({ queryKey: ['portfolio'], queryFn: api.portfolio })

  const add = useMutation({
    mutationFn: () =>
      api.addPosition({
        symbol,
        quantity: Number(quantity),
        avgPrice: Number(avgPrice),
        assetType: CRYPTO_SYMBOLS.includes(symbol) ? 'crypto' : 'equity',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio'] })
      setOpen(false); setQuantity(''); setAvgPrice('')
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.removePosition(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portfolio'] }),
  })

  const positions = data?.positions ?? []
  const invalid = !Number(quantity) || Number(quantity) <= 0 || Number(avgPrice) < 0 || avgPrice === ''

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Holdings</Eyebrow>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-[-0.02em]">Portfolio</h1>
        </div>
        <button onClick={() => setOpen(true)} className="btn-lime inline-flex items-center gap-2 px-5 py-2.5 text-sm">
          <Plus className="h-4 w-4" /> Add position
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total equity" value={fmtUsd(data?.equity ?? 0)} sub={`cash ${fmtUsd(data?.cash ?? 0, 0)}`} />
        <Stat
          label="Unrealised P&L"
          value={`${(data?.unrealisedPnl ?? 0) >= 0 ? '+' : ''}${fmtUsd(data?.unrealisedPnl ?? 0)}`}
          delta={positions.length ? data?.unrealisedPnlPct : undefined}
        />
        <Stat label="Invested" value={fmtUsd(data?.invested ?? 0)} />
        <Stat label="Market value" value={fmtUsd(data?.marketValue ?? 0)} sub={`${positions.length} position${positions.length === 1 ? '' : 's'}`} />
      </div>

      <Card className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-elevated" />
            ))}
          </div>
        ) : positions.length ? (
          <div className="overflow-x-auto">
            <table className="terminal-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th className="text-right">Quantity</th>
                  <th className="text-right">Avg price</th>
                  <th className="text-right">Last</th>
                  <th className="text-right">Market value</th>
                  <th className="text-right">P&amp;L</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="font-medium">{p.symbol}</span>
                      {!p.priced && (
                        <span className="ml-2 text-xs text-muted-foreground">(no live price)</span>
                      )}
                    </td>
                    <td className="tnum text-right">{p.quantity.toFixed(6)}</td>
                    <td className="tnum text-right">{fmtPrice(p.avgPrice)}</td>
                    <td className="tnum text-right">{fmtPrice(p.price)}</td>
                    <td className="tnum text-right font-medium">{fmtUsd(p.marketValue)}</td>
                    <td className="text-right">
                      <span className={cn('tnum font-medium', p.pnl >= 0 ? 'text-success' : 'text-destructive')}>
                        {p.pnl >= 0 ? '+' : ''}{fmtUsd(p.pnl)}
                        <span className="ml-1.5 text-xs opacity-80">({p.pnlPct.toFixed(2)}%)</span>
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => remove.mutate(p.id)}
                        disabled={remove.isPending}
                        aria-label={`Remove ${p.symbol}`}
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6">
            <EmptyState
              title="No positions yet"
              body="Add a holding to track it against live market prices, or buy one from the Trade screen."
              action={
                <button onClick={() => setOpen(true)} className="btn-lime inline-flex items-center gap-2 px-5 py-2.5 text-sm">
                  <Plus className="h-4 w-4" /> Add position
                </button>
              }
            />
          </div>
        )}
      </Card>

      {/* Add position dialog */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Add position"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <Card className="w-full max-w-md">
            <div className="flex items-start justify-between">
              <div>
                <Eyebrow>New holding</Eyebrow>
                <h2 className="mt-1.5 text-xl font-semibold">Add position</h2>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="btn-ghost p-2">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="sym" className="eyebrow">Asset</label>
                <select
                  id="sym"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-border bg-elevated px-4 py-3 text-[15px] outline-none focus:border-primary"
                >
                  <optgroup label="Crypto">
                    {CRYPTO_SYMBOLS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </optgroup>
                  <optgroup label="Equities">
                    {EQUITY_SYMBOLS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </optgroup>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="qty" className="eyebrow">Quantity</label>
                  <input
                    id="qty" inputMode="decimal" value={quantity}
                    onChange={(e) => setQuantity(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    className="mt-2 w-full rounded-xl border border-border bg-elevated px-4 py-3 text-[15px] outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label htmlFor="avg" className="eyebrow">Avg price (USD)</label>
                  <input
                    id="avg" inputMode="decimal" value={avgPrice}
                    onChange={(e) => setAvgPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    className="mt-2 w-full rounded-xl border border-border bg-elevated px-4 py-3 text-[15px] outline-none focus:border-primary"
                  />
                </div>
              </div>

              {add.isError && (
                <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {(add.error as Error).message}
                </p>
              )}

              <button
                onClick={() => add.mutate()}
                disabled={invalid || add.isPending}
                className="btn-lime flex w-full items-center justify-center gap-2 py-3.5 disabled:opacity-50"
              >
                {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Add position
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
