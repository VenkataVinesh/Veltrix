/**
 * Market data providers.
 *
 * Crypto  → CoinGecko public API (no key, generous free limits)
 * Equities→ Finnhub (requires FINNHUB_API_KEY)
 *
 * If FINNHUB_API_KEY is absent the equity paths return an explicit
 * `unavailable` marker rather than fabricating prices — the UI renders a
 * "connect a key" state instead of silently showing invented numbers.
 */

export type AssetType = 'equity' | 'crypto'

export interface Quote {
  symbol: string
  name: string
  price: number
  change: number // percent vs previous close
  assetType: AssetType
  source: string
}

export interface Candle {
  t: number // unix seconds
  o: number
  h: number
  l: number
  c: number
  v: number
}

export interface UnavailableReason {
  unavailable: true
  reason: string
}

const FINNHUB = process.env.FINNHUB_API_KEY?.trim() || ''
const TWELVEDATA = process.env.TWELVEDATA_API_KEY?.trim() || ''
const ALPHAVANTAGE = process.env.ALPHAVANTAGE_API_KEY?.trim() || ''

/** Quotes need only Finnhub; history needs Twelve Data (or the AV fallback). */
export const hasEquityProvider = () =>
  FINNHUB.length > 0 || TWELVEDATA.length > 0
export const hasEquityHistory = () =>
  TWELVEDATA.length > 0 || ALPHAVANTAGE.length > 0

/* ── CoinGecko ─────────────────────────────────────────────────── */

const CG = 'https://api.coingecko.com/api/v3'

// Display symbol → CoinGecko id
export const CRYPTO_IDS: Record<string, { id: string; name: string }> = {
  BTC: { id: 'bitcoin', name: 'Bitcoin' },
  ETH: { id: 'ethereum', name: 'Ethereum' },
  SOL: { id: 'solana', name: 'Solana' },
  BNB: { id: 'binancecoin', name: 'BNB' },
  XRP: { id: 'ripple', name: 'XRP' },
  ADA: { id: 'cardano', name: 'Cardano' },
  DOGE: { id: 'dogecoin', name: 'Dogecoin' },
  AVAX: { id: 'avalanche-2', name: 'Avalanche' },
  LINK: { id: 'chainlink', name: 'Chainlink' },
  MATIC: { id: 'matic-network', name: 'Polygon' },
}

export const CRYPTO_SYMBOLS = Object.keys(CRYPTO_IDS)

export async function cryptoQuotes(symbols: string[]): Promise<Quote[]> {
  const wanted = symbols.map((s) => s.toUpperCase()).filter((s) => CRYPTO_IDS[s])
  if (!wanted.length) return []

  const ids = wanted.map((s) => CRYPTO_IDS[s].id).join(',')
  const res = await fetch(
    `${CG}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
    { next: { revalidate: 20 } }
  )
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
  const data = (await res.json()) as Record<string, { usd: number; usd_24h_change?: number }>

  return wanted
    .map((sym): Quote | null => {
      const row = data[CRYPTO_IDS[sym].id]
      if (!row) return null
      return {
        symbol: sym,
        name: CRYPTO_IDS[sym].name,
        price: row.usd,
        change: row.usd_24h_change ?? 0,
        assetType: 'crypto',
        source: 'coingecko',
      }
    })
    .filter((q): q is Quote => q !== null)
}

// CoinGecko's /ohlc endpoint only accepts these exact values — anything else
// comes back as an empty array rather than an error.
const CG_OHLC_DAYS = [1, 7, 14, 30, 90, 180, 365]
const snapDays = (d: number) =>
  CG_OHLC_DAYS.reduce((best, v) => (Math.abs(v - d) < Math.abs(best - d) ? v : best), CG_OHLC_DAYS[0])

async function fetchCryptoOhlc(id: string, days: number): Promise<Candle[]> {
  const res = await fetch(
    `${CG}/coins/${id}/ohlc?vs_currency=usd&days=${snapDays(days)}`,
    { next: { revalidate: 60 } }
  )
  if (!res.ok) throw new Error(`CoinGecko OHLC ${res.status}`)
  // [[ms, o, h, l, c], ...] — CoinGecko's OHLC endpoint carries no volume.
  const raw = (await res.json()) as number[][]
  if (!Array.isArray(raw)) return []
  return raw.map(([ms, o, h, l, c]) => ({ t: Math.floor(ms / 1000), o, h, l, c, v: 0 }))
}

/** Longest window CoinGecko's keyless tier actually serves OHLC for. */
export const CRYPTO_MAX_DAYS = 30

export async function cryptoCandles(symbol: string, days: number): Promise<Candle[]> {
  const meta = CRYPTO_IDS[symbol.toUpperCase()]
  if (!meta) return []

  const rows = await fetchCryptoOhlc(meta.id, days)
  if (rows.length || days <= CRYPTO_MAX_DAYS) return rows

  // The public tier returns 200 with an EMPTY array for windows past 30
  // days rather than an error, so a long request silently yields nothing
  // and every caller reports "insufficient history". Fall back to the
  // widest window that actually returns data — 30d is ~180 four-hour
  // bars, far more usable than the sparse daily candles longer windows
  // used to give.
  return fetchCryptoOhlc(meta.id, CRYPTO_MAX_DAYS)
}

/* ── Finnhub (equities) ────────────────────────────────────────── */

const FH = 'https://finnhub.io/api/v1'

export const EQUITY_NAMES: Record<string, string> = {
  SPY: 'S&P 500 ETF', QQQ: 'Nasdaq 100 ETF', AAPL: 'Apple', MSFT: 'Microsoft',
  NVDA: 'NVIDIA', AMZN: 'Amazon', META: 'Meta', TSLA: 'Tesla',
  GOOGL: 'Alphabet', JPM: 'JPMorgan',
}

export const EQUITY_SYMBOLS = Object.keys(EQUITY_NAMES)

/** Twelve Data quote — the fallback when there's no Finnhub key. */
async function twelveDataQuote(symbol: string): Promise<Quote | null> {
  try {
    const res = await fetch(
      `${TD}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${TWELVEDATA}`,
      { next: { revalidate: 60 } }
    )
    if (!res.ok) return null
    const d = (await res.json()) as {
      status?: string; close?: string; percent_change?: string; name?: string
    }
    const price = parseFloat(d.close ?? '')
    if (d.status === 'error' || !Number.isFinite(price)) return null
    return {
      symbol,
      name: EQUITY_NAMES[symbol] ?? d.name ?? symbol,
      price,
      change: parseFloat(d.percent_change ?? '0') || 0,
      assetType: 'equity',
      source: 'twelvedata',
    }
  } catch {
    return null
  }
}

export async function equityQuotes(symbols: string[]): Promise<Quote[] | UnavailableReason> {
  if (!hasEquityProvider()) {
    return {
      unavailable: true,
      reason: 'No equity provider configured (set FINNHUB_API_KEY or TWELVEDATA_API_KEY)',
    }
  }
  const out = await Promise.all(
    symbols.map(async (raw): Promise<Quote | null> => {
      const symbol = raw.toUpperCase()
      if (FINNHUB) {
        try {
          const res = await fetch(`${FH}/quote?symbol=${symbol}&token=${FINNHUB}`, {
            next: { revalidate: 20 },
          })
          if (res.ok) {
            const d = (await res.json()) as { c: number; dp: number }
            if (d?.c) {
              return {
                symbol,
                name: EQUITY_NAMES[symbol] ?? symbol,
                price: d.c,
                change: d.dp ?? 0,
                assetType: 'equity',
                source: 'finnhub',
              }
            }
          }
        } catch {
          /* fall through to Twelve Data */
        }
      }
      return TWELVEDATA ? twelveDataQuote(symbol) : null
    })
  )
  return out.filter((q): q is Quote => q !== null)
}

/* ── Twelve Data (equity history) ──────────────────────────────
   Finnhub's /stock/candle is premium-only — a free key returns
   403 "You don't have access to this resource". Verified against a
   live key, so equity history comes from Twelve Data instead, with
   Alpha Vantage as a daily-bar fallback when the 800/day budget runs
   out. Finnhub is still the best free *quote* source, so it keeps
   that job. */

const TD = 'https://api.twelvedata.com'

/** Pick the finest interval that keeps the series under ~5000 points. */
function tdInterval(days: number): { interval: string; perDay: number } {
  if (days <= 2) return { interval: '5min', perDay: 78 }
  if (days <= 10) return { interval: '30min', perDay: 13 }
  if (days <= 60) return { interval: '1h', perDay: 7 }
  return { interval: '1day', perDay: 1 }
}

async function twelveDataCandles(
  symbol: string,
  days: number
): Promise<Candle[] | UnavailableReason> {
  const { interval, perDay } = tdInterval(days)
  const outputsize = Math.min(5000, Math.max(30, Math.ceil(days * perDay)))
  const res = await fetch(
    `${TD}/time_series?symbol=${encodeURIComponent(symbol.toUpperCase())}` +
      `&interval=${interval}&outputsize=${outputsize}&apikey=${TWELVEDATA}`,
    { next: { revalidate: 300 } }
  )
  if (!res.ok) return { unavailable: true, reason: `Twelve Data ${res.status}` }

  const d = (await res.json()) as {
    status?: string
    message?: string
    values?: { datetime: string; open: string; high: string; low: string; close: string; volume?: string }[]
  }
  // Twelve Data reports errors with HTTP 200 and a status field.
  if (d.status === 'error' || !d.values?.length) {
    return { unavailable: true, reason: d.message || 'Twelve Data returned no series' }
  }

  // Newest-first from the API; charts and indicators both want chronological.
  return d.values
    .map((v) => ({
      t: Math.floor(new Date(v.datetime.replace(' ', 'T') + 'Z').getTime() / 1000),
      o: parseFloat(v.open),
      h: parseFloat(v.high),
      l: parseFloat(v.low),
      c: parseFloat(v.close),
      v: v.volume ? parseFloat(v.volume) : 0,
    }))
    .filter((c) => Number.isFinite(c.c) && Number.isFinite(c.t))
    .sort((a, b) => a.t - b.t)
}

async function alphaVantageCandles(
  symbol: string,
  days: number
): Promise<Candle[] | UnavailableReason> {
  const res = await fetch(
    `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY` +
      `&symbol=${encodeURIComponent(symbol.toUpperCase())}` +
      `&outputsize=${days > 100 ? 'full' : 'compact'}&apikey=${ALPHAVANTAGE}`,
    { next: { revalidate: 3600 } }
  )
  if (!res.ok) return { unavailable: true, reason: `Alpha Vantage ${res.status}` }
  const d = (await res.json()) as Record<string, unknown>
  const series = d['Time Series (Daily)'] as
    | Record<string, Record<string, string>>
    | undefined
  // Free tier signals exhaustion via a "Note"/"Information" field, not an error code.
  if (!series) {
    const note = (d.Note || d.Information || d['Error Message']) as string | undefined
    return { unavailable: true, reason: note || 'Alpha Vantage returned no series' }
  }
  const cutoff = Date.now() / 1000 - days * 86400
  return Object.entries(series)
    .map(([date, row]) => ({
      t: Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000),
      o: parseFloat(row['1. open']),
      h: parseFloat(row['2. high']),
      l: parseFloat(row['3. low']),
      c: parseFloat(row['4. close']),
      v: parseFloat(row['5. volume'] ?? '0'),
    }))
    .filter((c) => Number.isFinite(c.c) && c.t >= cutoff)
    .sort((a, b) => a.t - b.t)
}

export async function equityCandles(
  symbol: string,
  days: number
): Promise<Candle[] | UnavailableReason> {
  if (!hasEquityHistory()) {
    return {
      unavailable: true,
      reason: 'No equity history provider configured (set TWELVEDATA_API_KEY)',
    }
  }

  if (TWELVEDATA) {
    const td = await twelveDataCandles(symbol, days).catch(
      (e): UnavailableReason => ({ unavailable: true, reason: String(e) })
    )
    if (Array.isArray(td) && td.length) return td
    if (!ALPHAVANTAGE) return td
    // Budget exhausted or symbol unsupported — fall through to the daily fallback.
  }

  return alphaVantageCandles(symbol, days).catch(
    (e): UnavailableReason => ({ unavailable: true, reason: String(e) })
  )
}

/* ── Unified helpers ───────────────────────────────────────────── */

export function assetTypeOf(symbol: string): AssetType {
  return CRYPTO_IDS[symbol.toUpperCase()] ? 'crypto' : 'equity'
}

export async function getQuotes(symbols: string[]): Promise<Quote[]> {
  const crypto = symbols.filter((s) => assetTypeOf(s) === 'crypto')
  const equity = symbols.filter((s) => assetTypeOf(s) === 'equity')

  const [c, e] = await Promise.all([
    crypto.length ? cryptoQuotes(crypto).catch(() => [] as Quote[]) : Promise.resolve([] as Quote[]),
    equity.length ? equityQuotes(equity).catch(() => [] as Quote[]) : Promise.resolve([] as Quote[]),
  ])

  const equities = Array.isArray(e) ? e : []
  return [...c, ...equities]
}

export async function getCandles(symbol: string, days = 90): Promise<Candle[] | UnavailableReason> {
  return assetTypeOf(symbol) === 'crypto'
    ? cryptoCandles(symbol, days).catch(() => [])
    : equityCandles(symbol, days)
}
