import Link from 'next/link'
import { ArrowUpRight, LineChart, ShieldCheck, Activity } from 'lucide-react'
import { CRYPTO_SYMBOLS } from '@/lib/market/providers'

export const revalidate = 60

const FEATURES = [
  {
    icon: LineChart,
    title: 'Transparent signals',
    body: 'Every BUY/SELL shows the indicator votes behind it — RSI, MACD, Bollinger, trend stack — with the weight each one carried.',
  },
  {
    icon: Activity,
    title: 'Validated forecasts',
    body: 'Drift+EWMA, AR(5) and a random-walk baseline, ensembled by inverse-RMSE from a walk-forward backtest. Confidence is a measured hit-rate.',
  },
  {
    icon: ShieldCheck,
    title: 'Portfolio & risk',
    body: 'Track positions marked to live prices, with unrealised P&L, concentration and volatility computed from your actual holdings.',
  },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Nav */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary">
            <span className="text-sm font-bold text-primary-foreground">V</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">Veltrix</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost px-5 py-2.5 text-sm">Log in</Link>
          <Link href="/signup" className="btn-lime px-5 py-2.5 text-sm">Get started</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 pb-16 pt-12 md:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="chip chip-up">
              <span className="status-dot live" /> Live market data
            </span>
            <h1 className="mt-6 text-[clamp(2.75rem,6vw,4.5rem)] font-semibold leading-[1.03] tracking-[-0.03em]">
              Market analytics
              <br />
              that shows its
              <span className="text-primary"> work.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              A trading terminal where every number is traceable to the data behind it.
              Real-time crypto and equity prices, an auditable signal engine, and forecasts
              honest enough to tell you when they have no edge.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="btn-lime inline-flex items-center gap-2 px-7 py-3.5 text-[15px]">
                Open the terminal <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link href="/login" className="btn-ghost px-7 py-3.5 text-[15px]">
                I have an account
              </Link>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              Free account · crypto data works out of the box, no API key needed
            </p>
          </div>

          {/* Live ticker preview */}
          <div className="card-surface p-6 md:p-8">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Tracked markets</p>
              <span className="chip chip-flat">CoinGecko + Finnhub</span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {CRYPTO_SYMBOLS.slice(0, 6).map((sym) => (
                <div key={sym} className="panel-inset p-4">
                  <p className="text-sm font-medium text-muted-foreground">{sym}</p>
                  <p className="figure figure-md mt-2 text-foreground">USD</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              Prices, candles, signals and forecasts all stream from the same providers once
              you sign in — nothing here is mocked.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card-surface p-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12">
                <f.icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Honesty note */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="card-surface p-8 md:p-12">
          <h2 className="max-w-2xl text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-tight tracking-[-0.02em]">
            No invented metrics. No simulated confidence.
          </h2>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            Forecast accuracy is measured by walk-forward backtest on held-out data and
            reported as-is — including when the hit-rate lands near 50%, which means no
            directional edge. Signals expose their component votes so you can disagree with them.
            This is a portfolio project, not investment advice.
          </p>
          <Link href="/signup" className="btn-lime mt-8 inline-flex items-center gap-2 px-7 py-3.5 text-[15px]">
            Create free account <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
          <span>Veltrix — built by A. Venkata Vinesh Kumar Reddy</span>
          <a
            href="https://github.com/VenkataVinesh/Veltrix"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Source on GitHub
          </a>
        </div>
      </footer>
    </main>
  )
}
