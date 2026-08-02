'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, ArrowDown } from 'lucide-react'
import { api } from '@/lib/api'
import { useLenis } from '@/lib/use-lenis'
import { HeroCanvas } from '@/components/hero-canvas'
import {
  Preloader, KineticText, Reveal, Magnetic, Cursor, Marquee, CountUp,
  HorizontalScroller, Grain,
} from '@/components/motion/primitives'
import { fmtPrice } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

const CHAPTERS = [
  {
    n: '01',
    title: 'Signals that show their work',
    body: 'Every BUY or SELL is a weighted sum of indicator votes — RSI, MACD, Bollinger, trend stack, volume. The panel lists each component, what it measured, which way it voted and how much weight it carried. Disagree with it and you can see exactly where.',
    stat: { to: 5, label: 'indicator components, all exposed' },
  },
  {
    n: '02',
    title: 'Forecasts that admit uncertainty',
    body: 'Geometric drift with EWMA volatility, an AR(5) on log returns, and a random-walk baseline — ensembled by inverse-RMSE from a walk-forward backtest. Confidence is the measured directional hit-rate, so when there is no edge it reports ~50%.',
    stat: { to: 40, label: 'out-of-sample steps per backtest' },
  },
  {
    n: '03',
    title: 'Positions marked to the live tape',
    body: 'Paper-trade against real prices. Holdings revalue on every quote, unrealised P&L computes from your actual cost basis, and each row is isolated to your account by row-level security in Postgres.',
    stat: { to: 100000, label: 'paper cash on every new account' },
  },
  {
    n: '04',
    title: 'Built in the open',
    body: 'Next.js on Vercel, Supabase Postgres with RLS, CoinGecko and Finnhub for market data. The signal and forecast engines are plain TypeScript you can read. No invented metrics anywhere in the product.',
    stat: { to: 95, label: '% confidence interval on forecast bands' },
  },
]

const CAPABILITIES = [
  { k: 'Composite signal engine', v: 'Five technical components, weighted and normalised to [-1,+1], with every vote surfaced.' },
  { k: 'Walk-forward backtest', v: 'One-step-ahead evaluation on held-out data. MAE, RMSE and directional hit-rate reported as measured.' },
  { k: 'Ensemble forecasting', v: 'Drift+EWMA, AR(5) and naive baseline, weighted by inverse RMSE — a model earns weight by predicting.' },
  { k: 'Live candles & quotes', v: 'CoinGecko for crypto with no key required, Finnhub for equities. Area and candlestick views.' },
  { k: 'Row-level security', v: 'Portfolios and positions scoped to the owner in Postgres. Verified: anonymous reads return nothing.' },
  { k: 'Paper trading', v: 'Buy against the live mid with balance validation. No real order is ever placed.' },
]

export function LandingView() {
  useLenis()

  const { data: quoteData } = useQuery({
    queryKey: ['quotes', 'landing'],
    queryFn: () => api.quotes(['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX']),
    refetchInterval: 30_000,
  })
  const { data: candleData } = useQuery({
    queryKey: ['candles', 'BTC', 30],
    queryFn: () => api.candles('BTC', 30),
  })

  const quotes = quoteData?.quotes ?? []
  const btc = quotes.find((q) => q.symbol === 'BTC')
  const series = (candleData?.candles ?? []).map((c) => c.c)

  return (
    <div className="relative bg-background">
      <Preloader />
      <Cursor />
      <Grain />

      {/* Nav */}
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-6 md:px-12">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary">
              <span className="text-sm font-bold text-primary-foreground">V</span>
            </div>
            <span className="text-lg font-semibold tracking-tight">Veltrix</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/login" className="btn-ghost px-5 py-2.5 text-sm">Log in</Link>
            <Magnetic>
              <Link href="/signup" className="btn-lime inline-flex items-center gap-1.5 px-5 py-2.5 text-sm">
                Get started <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Magnetic>
          </nav>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative flex h-[100svh] flex-col justify-end overflow-hidden">
        <HeroCanvas series={series} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/85 via-transparent to-background" />

        <div className="relative mx-auto w-full max-w-[1600px] px-6 pb-[9vh] md:px-12">
          <div className="flex items-center gap-3">
            <span className="status-dot live" />
            <span className="eyebrow">
              {btc ? `BTC ${fmtPrice(btc.price)} · ${btc.change >= 0 ? '+' : ''}${btc.change.toFixed(2)}% 24h` : 'Connecting to live feed'}
            </span>
          </div>

          <h1 className="mt-7 text-[clamp(2.8rem,9.5vw,9rem)] font-semibold leading-[0.92] tracking-[-0.045em]">
            <KineticText>The market,</KineticText>
            <br />
            <KineticText className="text-primary" delay={0.1}>rendered live.</KineticText>
          </h1>

          <div className="mt-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
              A trading terminal where every number traces back to the data behind it.
              The shape above is not decoration — it is the last 30 days of Bitcoin,
              drawn from the same feed the app runs on.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Magnetic>
                <Link href="/signup" className="btn-lime inline-flex items-center gap-2 px-8 py-4 text-[15px]">
                  Open the terminal <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Magnetic>
              <Link href="/login" className="btn-ghost px-8 py-4 text-[15px]">I have an account</Link>
            </div>
          </div>

          <div className="mt-12 flex items-center gap-2 text-muted-foreground">
            <ArrowDown className="h-4 w-4 animate-bounce" />
            <span className="text-xs uppercase tracking-[0.14em]">Scroll</span>
          </div>
        </div>
      </section>

      {/* ─── Live ticker ─── */}
      <div className="border-y border-border py-5">
        <Marquee speed={42}>
          {(quotes.length ? quotes : Array.from({ length: 8 }, () => null)).map((q, i) => (
            <span key={q?.symbol ?? i} className="flex shrink-0 items-center gap-3 text-lg">
              <span className="font-medium">{q?.symbol ?? '—'}</span>
              <span className="tnum text-muted-foreground">{q ? fmtPrice(q.price) : '···'}</span>
              {q && (
                <span className={cn('tnum text-sm', q.change >= 0 ? 'text-success' : 'text-destructive')}>
                  {q.change >= 0 ? '+' : ''}{q.change.toFixed(2)}%
                </span>
              )}
              <span className="text-border">/</span>
            </span>
          ))}
        </Marquee>
      </div>

      {/* ─── Chapters ─── */}
      <section className="mx-auto max-w-[1600px] px-6 py-24 md:px-12 md:py-36">
        {CHAPTERS.map((c, i) => (
          <div
            key={c.n}
            className={cn(
              'grid items-start gap-8 border-t border-border py-14 md:grid-cols-12 md:gap-12 md:py-20',
              i === 0 && 'border-t-0 pt-0'
            )}
          >
            <Reveal className="md:col-span-2">
              <span className="figure text-[clamp(2.5rem,5vw,4.5rem)] text-primary/25">{c.n}</span>
            </Reveal>

            <div className="md:col-span-6">
              <KineticText
                as="h2"
                className="block text-[clamp(1.75rem,3.6vw,3.1rem)] font-semibold leading-[1.06] tracking-[-0.03em]"
              >
                {c.title}
              </KineticText>
              <Reveal delay={0.08}>
                <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted-foreground">{c.body}</p>
              </Reveal>
            </div>

            <Reveal className="md:col-span-4" delay={0.14}>
              <div className="card-surface p-7">
                <CountUp
                  to={c.stat.to}
                  prefix={c.stat.to === 100000 ? '$' : ''}
                  className="figure figure-xl block text-primary"
                />
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.stat.label}</p>
              </div>
            </Reveal>
          </div>
        ))}
      </section>

      {/* ─── Capabilities (pinned horizontal on desktop) ─── */}
      <section className="overflow-hidden py-10">
        <div className="mx-auto max-w-[1600px] px-6 md:px-12">
          <Reveal>
            <span className="eyebrow">What's inside</span>
            <h2 className="mt-4 max-w-2xl text-[clamp(1.75rem,3.6vw,3.1rem)] font-semibold leading-[1.06] tracking-[-0.03em]">
              Six things it actually does
            </h2>
          </Reveal>
        </div>

        <div className="mt-12 px-6 md:px-12">
          <HorizontalScroller>
            {CAPABILITIES.map((c, i) => (
              <article
                key={c.k}
                className="card-surface flex w-[300px] shrink-0 flex-col p-7 md:w-[380px]"
              >
                <span className="eyebrow text-primary">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-5 text-xl font-semibold leading-snug">{c.k}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{c.v}</p>
              </article>
            ))}
          </HorizontalScroller>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="mx-auto max-w-[1600px] px-6 py-24 md:px-12 md:py-36">
        <Reveal>
          <div className="card-surface relative overflow-hidden p-10 md:p-20">
            <h2 className="max-w-3xl text-[clamp(2rem,5.5vw,4.5rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
              <KineticText>No invented metrics.</KineticText>
              <br />
              <KineticText className="text-primary" delay={0.08}>Ever.</KineticText>
            </h2>
            <p className="mt-8 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
              Forecast accuracy is whatever the backtest measured — including the times it lands
              at 50% and means nothing. That honesty is the point. Free account, crypto data works
              without any API key.
            </p>
            <Magnetic>
              <Link href="/signup" className="btn-lime mt-10 inline-flex items-center gap-2 px-8 py-4 text-[15px]">
                Create free account <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Magnetic>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-6 py-10 text-sm text-muted-foreground md:px-12">
          <span>Veltrix — built by A. Venkata Vinesh Kumar Reddy</span>
          <div className="flex gap-6">
            <a href="https://github.com/VenkataVinesh/Veltrix" target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground">GitHub</a>
            <a href="https://www.linkedin.com/in/venkat-vinesh" target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground">LinkedIn</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
