'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api'
import { HeroCanvas } from '@/components/hero-canvas'
import { Ambient } from '@/components/motion/ambient'
import { Cursor, Grain, SplitText } from '@/components/motion/primitives'
import { fmtPrice } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

const PROOF = [
  'Signals expose every indicator vote',
  'Forecasts report measured hit-rate, not marketing',
  'Row-level security on every position',
]

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const { data: quoteData } = useQuery({
    queryKey: ['quotes', 'auth'],
    queryFn: () => api.quotes(['BTC', 'ETH', 'SOL', 'BNB']),
    refetchInterval: 30_000,
  })
  const { data: candleData } = useQuery({
    queryKey: ['candles', 'BTC', 30],
    queryFn: () => api.candles('BTC', 30),
  })

  const quotes = quoteData?.quotes ?? []
  const series = (candleData?.candles ?? []).map((c) => c.c)

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      {/* Sits behind everything; the cinematic panel's own canvas and
          gradient cover it, so in practice it lifts the form side. */}
      <Ambient />
      <Cursor />
      <Grain />

      {/* Cinematic panel */}
      <aside className="relative hidden overflow-hidden border-r border-border lg:flex lg:flex-col lg:justify-between">
        <HeroCanvas series={series} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/70 via-transparent to-background/95" />

        <div className="relative p-12">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to site
          </Link>
        </div>

        <div className="relative p-12">
          <h2 className="text-[clamp(2rem,3.4vw,3.2rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
            <SplitText mode="chars">Every number,</SplitText>
            <br />
            <SplitText mode="chars" className="text-primary" delay={0.12}>traceable.</SplitText>
          </h2>

          <ul className="mt-9 space-y-3">
            {PROOF.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[15px] text-muted-foreground">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {p}
              </li>
            ))}
          </ul>

          {quotes.length > 0 && (
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-border pt-7">
              {quotes.map((q) => (
                <div key={q.symbol}>
                  <p className="eyebrow">{q.symbol}</p>
                  <p className="tnum mt-1 text-sm">
                    {fmtPrice(q.price)}
                    <span className={cn('ml-2', q.change >= 0 ? 'text-success' : 'text-destructive')}>
                      {q.change >= 0 ? '+' : ''}{q.change.toFixed(2)}%
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Form side */}
      <main className="app-layer flex min-h-screen items-center justify-center px-6 py-16 lg:min-h-0 lg:px-14">
        {children}
      </main>
    </div>
  )
}
