'use client'

import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Plain-English definitions for every quantitative term the app shows.
 *
 * Written for someone who has not done a stats course: what it measures,
 * and — more importantly — how to read it. Several entries exist mainly
 * to stop a number being over-read, which is the failure mode that
 * matters here.
 */
export const GLOSSARY: Record<string, { title: string; body: string }> = {
  hitRate: {
    title: 'Directional hit-rate',
    body:
      'How often the forecast got the DIRECTION right (up vs down) on data it had never seen. 50% is a coin flip and means no edge. Crucially, read it together with the ± figure next to it: over a few dozen calls the margin of error is large, so 57% and 43% can both be the same underlying coin flip. Where the number sits inside that margin we say so rather than letting it look like skill.',
  },
  rmse: {
    title: 'RMSE — root mean squared error',
    body:
      'Average size of the forecast miss, in dollars, with big misses punished harder than small ones. Lower is better. Compare it against the price: an RMSE of $7 on a $300 stock is about 2%.',
  },
  mae: {
    title: 'MAE — mean absolute error',
    body:
      'Average size of the miss in dollars, treating all misses equally. Always smaller than RMSE. If RMSE is much larger than MAE, a few big misses are doing the damage.',
  },
  outOfSample: {
    title: 'Out-of-sample steps',
    body:
      'How many predictions were tested on data the model was not trained on. Testing on data a model has already seen tells you nothing, so only these count. More steps means a more trustworthy score.',
  },
  band: {
    title: '95% interval',
    body:
      'The shaded cone. The price should land inside it about 95 times out of 100 — and unlike most such claims, this one is checked. Over 1,200 held-out 5-day forecasts across six large caps the band caught 94.8% of outcomes, against the 95% it advertises. It widens with time because uncertainty compounds; that widening is the honest part of the picture.',
  },
  garch: {
    title: 'GARCH(1,1) volatility',
    body:
      'What sets the width of the cone. Volatility clusters — a violent day is followed by more violent days — and GARCH models that directly, then decays back toward the long-run level as the horizon extends. It replaced a simpler EWMA estimate that was measurably overconfident: EWMA\'s "95%" band only caught 91.7% of outcomes, so the price escaped roughly twice as often as promised. GARCH costs about 10% wider bands and buys back that honesty.',
  },
  weights: {
    title: 'Model weights',
    body:
      'Three models compete: drift+EWMA, AR(5), and a naive random walk. Each is scored on held-out data and weighted by inverse RMSE. Expect them to come out near a third each — measured across six large caps the spread was under 0.007. That is the honest result, not a bug: on daily bars these models are statistically indistinguishable, so none deserves to dominate. Ridge regression and gradient-boosted trees were also built and tested; they earned no place and were removed.',
  },
  driftEwma: {
    title: 'Drift + EWMA',
    body:
      'Assumes the price keeps its recent average trend, with volatility estimated so recent days count more than old ones (EWMA, decay 0.94 — the RiskMetrics standard). Simple and hard to beat. It still sets the band on short histories, where there is not enough data to fit GARCH.',
  },
  ar: {
    title: 'AR(5)',
    body:
      'Autoregression on the last 5 log returns: it looks for whether recent moves predict the next one. Fitted by least squares. Catches short-term momentum or mean-reversion when either exists.',
  },
  naive: {
    title: 'Naive (random walk)',
    body:
      'Predicts tomorrow equals today. Sounds useless, and usually wins — which is precisely why it is included. If the clever models cannot beat it, they have earned no weight.',
  },
  momentum: {
    title: 'Momentum score',
    body:
      'The composite signal on a −1 to +1 scale. Above +0.3 reads BUY, below −0.3 reads SELL, between is HOLD. It is a weighted sum of the indicator votes listed underneath — nothing hidden.',
  },
  rsi: {
    title: 'RSI (14)',
    body:
      'Relative Strength Index over 14 bars, scaled 0–100. Below 30 is traditionally "oversold" (possible bounce), above 70 "overbought" (possible pullback). Between 30 and 70 it says nothing, so it gets zero weight.',
  },
  macd: {
    title: 'MACD (12, 26, 9)',
    body:
      'Difference between a fast and slow moving average, versus its own signal line. A positive histogram means upward momentum is building; negative means it is fading.',
  },
  bollinger: {
    title: 'Bollinger Bands (20, 2)',
    body:
      'A 20-bar average with lines two standard deviations above and below. Price outside a band is unusually stretched. Inside them is normal, so it votes neutral.',
  },
  trendStack: {
    title: 'Trend EMA20 / SMA20',
    body:
      'Checks whether price, the 20-bar exponential average and the 20-bar simple average are stacked in order. All three aligned is a genuine trend; tangled means no trend.',
  },
  supportResistance: {
    title: 'Support / resistance',
    body:
      'Recent price floor and ceiling. Support is where buying has previously appeared, resistance where selling has. Price sitting right at either is fragile — it can bounce or break.',
  },
  volatility: {
    title: 'Volatility',
    body:
      'How much the price moves around, per bar. Higher volatility widens the forecast cone and should shrink position size.',
  },
  agreesWithQuant: {
    title: 'Agrees with the arithmetic',
    body:
      'Whether the language-model debate reached the same call as the deterministic indicator maths. Disagreement is not an error — it is shown rather than hidden so you can decide which you trust.',
  },
  positionSize: {
    title: 'Position size',
    body:
      'What percentage of the portfolio the risk manager will allow for this idea. Zero means vetoed. This is paper trading — no real order is ever placed.',
  },
}

/** Inline "?" that reveals a definition. Keyboard reachable, not hover-only. */
export function InfoTip({ term, className }: { term: keyof typeof GLOSSARY; className?: string }) {
  const g = GLOSSARY[term]
  if (!g) return null
  return <Explain title={g.title} body={g.body} className={className} />
}

/**
 * The same affordance for text that does not live in the glossary — the
 * macro series each carry their own note, which arrives with the data.
 */
export function Explain({
  title, body, className,
}: { title: string; body: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const g = { title, body }

  return (
    <span className={cn('relative inline-flex', className)}>
      <button
        type="button"
        aria-label={`What is ${g.title}?`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className="text-muted-foreground/70 transition-colors hover:text-primary focus-visible:text-primary"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-6 z-50 w-72 -translate-x-1/2 rounded-xl border border-border bg-popover p-4 text-left shadow-xl"
        >
          <span className="block text-sm font-semibold text-foreground">{g.title}</span>
          <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">{g.body}</span>
        </span>
      )}
    </span>
  )
}

/** Full reference list, for the bottom of a page. */
export function GlossaryPanel({ terms }: { terms: (keyof typeof GLOSSARY)[] }) {
  return (
    <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
      {terms.map((t) => {
        const g = GLOSSARY[t]
        return (
          <div key={t}>
            <dt className="text-sm font-medium text-foreground">{g.title}</dt>
            <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{g.body}</dd>
          </div>
        )
      })}
    </dl>
  )
}
