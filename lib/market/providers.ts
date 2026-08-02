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
export const hasEquityProvider = () => FINNHUB.length > 0

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

export async function cryptoCandles(symbol: string, days: number): Promise<Candle[]> {
  const meta = CRYPTO_IDS[symbol.toUpperCase()]
  if (!meta) return []

  const res = await fetch(
    `${CG}/coins/${meta.id}/ohlc?vs_currency=usd&days=${days}`,
    { next: { revalidate: 60 } }
  )
  if (!res.ok) throw new Error(`CoinGecko OHLC ${res.status}`)
  // [[ms, o, h, l, c], ...] — CoinGecko's OHLC endpoint carries no volume.
  const raw = (await res.json()) as number[][]
  return raw.map(([ms, o, h, l, c]) => ({ t: Math.floor(ms / 1000), o, h, l, c, v: 0 }))
}

/* ── Finnhub (equities) ────────────────────────────────────────── */

const FH = 'https://finnhub.io/api/v1'

export const EQUITY_NAMES: Record<string, string> = {
  SPY: 'S&P 500 ETF', QQQ: 'Nasdaq 100 ETF', AAPL: 'Apple', MSFT: 'Microsoft',
  NVDA: 'NVIDIA', AMZN: 'Amazon', META: 'Meta', TSLA: 'Tesla',
  GOOGL: 'Alphabet', JPM: 'JPMorgan',
}

export const EQUITY_SYMBOLS = Object.keys(EQUITY_NAMES)

export async function equityQuotes(symbols: string[]): Promise<Quote[] | UnavailableReason> {
  if (!hasEquityProvider()) {
    return { unavailable: true, reason: 'FINNHUB_API_KEY not configured' }
  }
  const out = await Promise.all(
    symbols.map(async (raw): Promise<Quote | null> => {
      const symbol = raw.toUpperCase()
      try {
        const res = await fetch(`${FH}/quote?symbol=${symbol}&token=${FINNHUB}`, {
          next: { revalidate: 20 },
        })
        if (!res.ok) return null
        const d = (await res.json()) as { c: number; dp: number }
        if (!d?.c) return null
        return {
          symbol,
          name: EQUITY_NAMES[symbol] ?? symbol,
          price: d.c,
          change: d.dp ?? 0,
          assetType: 'equity',
          source: 'finnhub',
        }
      } catch {
        return null
      }
    })
  )
  return out.filter((q): q is Quote => q !== null)
}

export async function equityCandles(
  symbol: string,
  days: number
): Promise<Candle[] | UnavailableReason> {
  if (!hasEquityProvider()) {
    return { unavailable: true, reason: 'FINNHUB_API_KEY not configured' }
  }
  const to = Math.floor(Date.now() / 1000)
  const from = to - days * 86400
  const res = await fetch(
    `${FH}/stock/candle?symbol=${symbol.toUpperCase()}&resolution=D&from=${from}&to=${to}&token=${FINNHUB}`,
    { next: { revalidate: 300 } }
  )
  if (!res.ok) return { unavailable: true, reason: `Finnhub ${res.status}` }
  const d = (await res.json()) as {
    s: string; t?: number[]; o?: number[]; h?: number[]; l?: number[]; c?: number[]; v?: number[]
  }
  if (d.s !== 'ok' || !d.t?.length) {
    return { unavailable: true, reason: 'no candle data returned' }
  }
  return d.t.map((t, i) => ({
    t,
    o: d.o![i], h: d.h![i], l: d.l![i], c: d.c![i], v: d.v?.[i] ?? 0,
  }))
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
