/**
 * Macro series from FRED (Federal Reserve Bank of St. Louis).
 *
 * The agent debate already pulled three latest values from FRED. This module
 * exists because a panel needs more than a number: it needs history to draw,
 * a comparison to say whether the number is moving, and — for an index like
 * CPI — a transform, because the raw level (~320) means nothing to anyone.
 *
 * Every series carries its own plain-English note. A macro dashboard that
 * shows "T10Y2Y: -0.42" without explaining that an inverted curve has
 * preceded most recessions is decoration, not information.
 */

const FRED = process.env.FRED_API_KEY?.trim() || ''

export const hasMacroProvider = () => FRED.length > 0

export type MacroGroup = 'rates' | 'inflation' | 'labour' | 'risk'

interface SeriesSpec {
  id: string
  label: string
  unit: string
  group: MacroGroup
  /** 'level' shows the number as published; 'yoy' converts an index to % change on a year ago. */
  transform: 'level' | 'yoy'
  /** Observations to request. Daily series need more to cover the same span. */
  points: number
  /** Observations that make up one year, for the year-on-year transform. */
  periodsPerYear: number
  note: string
}

const SERIES: SeriesSpec[] = [
  {
    id: 'DGS10', label: '10-year Treasury', unit: '%', group: 'rates',
    transform: 'level', points: 400, periodsPerYear: 252,
    note: 'What the US government pays to borrow for ten years. The anchor for mortgage rates, corporate borrowing and equity valuations — when it rises, every future dollar of company earnings is worth less today.',
  },
  {
    id: 'DGS2', label: '2-year Treasury', unit: '%', group: 'rates',
    transform: 'level', points: 400, periodsPerYear: 252,
    note: 'The two-year yield tracks where the market thinks the Fed will set rates over the next couple of years. It moves faster than the 10-year on policy news.',
  },
  {
    id: 'T10Y2Y', label: 'Yield curve (10y − 2y)', unit: '%', group: 'rates',
    transform: 'level', points: 400, periodsPerYear: 252,
    note: 'Long rate minus short rate. Normally positive — lending for longer should pay more. When it goes negative the curve is "inverted", which has preceded most US recessions, though with long and unreliable lags. Treat it as a caution flag, not a trigger.',
  },
  {
    id: 'FEDFUNDS', label: 'Fed funds rate', unit: '%', group: 'rates',
    transform: 'level', points: 60, periodsPerYear: 12,
    note: 'The policy rate the Federal Reserve actually sets. Everything else on this page reacts to it.',
  },
  {
    id: 'CPIAUCSL', label: 'CPI inflation', unit: '% y/y', group: 'inflation',
    transform: 'yoy', points: 60, periodsPerYear: 12,
    note: 'Consumer prices against a year ago. The Fed targets 2% — persistently above it argues for higher rates, below it for cuts. Shown as a year-on-year change because the published index level is meaningless on its own.',
  },
  {
    id: 'CPILFESL', label: 'Core CPI', unit: '% y/y', group: 'inflation',
    transform: 'yoy', points: 60, periodsPerYear: 12,
    note: 'The same measure with food and energy stripped out. Those two are volatile and driven by supply shocks, so core is the better read on whether inflation is embedded.',
  },
  {
    id: 'UNRATE', label: 'Unemployment', unit: '%', group: 'labour',
    transform: 'level', points: 60, periodsPerYear: 12,
    note: 'Share of the labour force looking for work. Low is good for growth, but a very tight labour market pushes wages and can keep the Fed hawkish.',
  },
  {
    id: 'PAYEMS', label: 'Nonfarm payrolls', unit: 'k jobs m/m', group: 'labour',
    transform: 'level', points: 60, periodsPerYear: 12,
    note: 'Total jobs on US payrolls. The month-on-month change is the number markets trade — it is the single most watched economic release.',
  },
  {
    id: 'VIXCLS', label: 'VIX', unit: '', group: 'risk',
    transform: 'level', points: 400, periodsPerYear: 252,
    note: 'Expected S&P 500 volatility over the next 30 days, implied by option prices. Below 15 is calm, above 30 is stress. Often called the "fear gauge".',
  },
]

export interface MacroReading {
  id: string
  label: string
  unit: string
  group: MacroGroup
  note: string
  value: number
  asOf: string
  /** Change against the previous observation. Null when there is no prior point. */
  change: number | null
  /** Change against roughly a year earlier. Null when history is too short. */
  changeYear: number | null
  /** Chronological history for the sparkline, already transformed. */
  spark: number[]
}

export interface MacroUnavailable {
  unavailable: true
  reason: string
}

interface Obs {
  date: string
  value: number
}

async function fetchSeries(spec: SeriesSpec): Promise<MacroReading | null> {
  try {
    const res = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=${spec.id}` +
        `&api_key=${FRED}&file_type=json&limit=${spec.points}&sort_order=desc`,
      // Macro data updates daily at best, most of it monthly. Six hours is
      // generous and keeps us far inside FRED's limits.
      { next: { revalidate: 21_600 } }
    )
    if (!res.ok) return null

    const d = (await res.json()) as { observations?: { date: string; value: string }[] }
    if (!d.observations?.length) return null

    // FRED writes "." for a missing observation; newest-first from the API.
    const obs: Obs[] = d.observations
      .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
      .filter((o) => Number.isFinite(o.value))
      .reverse()

    if (!obs.length) return null

    let series: Obs[]
    if (spec.transform === 'yoy') {
      const k = spec.periodsPerYear
      if (obs.length <= k) return null
      series = obs.slice(k).map((o, i) => ({
        date: o.date,
        value: ((o.value - obs[i].value) / obs[i].value) * 100,
      }))
    } else if (spec.id === 'PAYEMS') {
      // Payrolls are published as a cumulative level in thousands. Nobody
      // trades the level; the monthly change is the number that moves markets.
      series = obs.slice(1).map((o, i) => ({ date: o.date, value: o.value - obs[i].value }))
    } else {
      series = obs
    }

    if (!series.length) return null

    const last = series[series.length - 1]
    const prev = series[series.length - 2] ?? null
    const yearAgo = series[series.length - 1 - spec.periodsPerYear] ?? null

    return {
      id: spec.id,
      label: spec.label,
      unit: spec.unit,
      group: spec.group,
      note: spec.note,
      value: +last.value.toFixed(2),
      asOf: last.date,
      change: prev ? +(last.value - prev.value).toFixed(2) : null,
      changeYear: yearAgo ? +(last.value - yearAgo.value).toFixed(2) : null,
      spark: series.slice(-120).map((o) => +o.value.toFixed(3)),
    }
  } catch {
    return null
  }
}

export async function getMacro(): Promise<MacroReading[] | MacroUnavailable> {
  if (!FRED) {
    return { unavailable: true, reason: 'No macro provider configured (set FRED_API_KEY)' }
  }
  const out = await Promise.all(SERIES.map(fetchSeries))
  const ok = out.filter((r): r is MacroReading => r !== null)
  if (!ok.length) return { unavailable: true, reason: 'FRED returned no usable observations' }
  return ok
}
