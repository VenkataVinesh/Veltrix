'use client'

import { env } from "@/lib/env"

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const apiBaseUrls = Array.from(
  new Set([
    env.apiBaseUrl,
    "http://localhost:8000/api/v1",
    "http://127.0.0.1:8000/api/v1",
    "http://localhost:8001/api/v1",
    "http://127.0.0.1:8001/api/v1",
  ])
)

let devAuthPromise: Promise<boolean> | null = null

function persistAccessToken(token?: string) {
  try {
    if (typeof window !== 'undefined' && token) {
      window.localStorage.setItem('veltrix_access_token', token)
    }
  } catch (error) {
    /* ignore storage errors */
  }
}

async function tryDevLogin(baseUrl: string) {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'production') return false
  if (devAuthPromise) return devAuthPromise

  devAuthPromise = (async () => {
    try {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: env.devAuthEmail, password: env.devAuthPassword }),
      })

      if (!response.ok) return false

      const data = await response.json() as { access_token?: string }
      persistAccessToken(data.access_token)
      return true
    } catch {
      return false
    }
  })()

  try {
    return await devAuthPromise
  } finally {
    devAuthPromise = null
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let lastNetworkError: unknown = null

  for (const baseUrl of apiBaseUrls) {
    const doFetch = () => {
      // try to attach bearer token from localStorage as fallback when cookies are not available
      let authHeader: Record<string, string> = {}
      try {
        if (typeof window !== 'undefined') {
          const token = window.localStorage.getItem('veltrix_access_token')
          if (token) authHeader = { Authorization: `Bearer ${token}` }
        }
      } catch (e) {
        /* ignore localStorage errors */
      }

      return fetch(`${baseUrl}${path}`, {
        ...init,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
          ...authHeader,
        },
      })
    }

    try {
      let response = await doFetch()
      if (response.status === 401 && !path.includes("/auth/refresh")) {
        await fetch(`${baseUrl}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
        response = await doFetch()
        if (response.status === 401 && !path.startsWith('/auth/')) {
          const authed = await tryDevLogin(baseUrl)
          if (authed) {
            response = await doFetch()
          }
        }
      }
      if (!response.ok) {
        const body = await response.text()
        throw new ApiError(body || "Request failed", response.status)
      }
      return response.json()
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      lastNetworkError = error
    }
  }

  if (lastNetworkError instanceof Error) {
    throw lastNetworkError
  }

  throw new Error("Failed to connect to the API")
}

export const api = {
  signup: (payload: { email: string; password: string; role?: string }) =>
    request<{ access_token: string; refresh_token: string; token_type: string }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then((data) => {
      persistAccessToken(data.access_token)
      return data
    }),
  login: (payload: { email: string; password: string }) =>
    request<{ access_token: string; refresh_token: string; token_type: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then((data) => {
      persistAccessToken(data.access_token)
      return data
    }),
  logout: () => request<{ status: string }>("/auth/logout", { method: "POST" }),
  me: () => request<{ id: number; email: string; role: string }>("/auth/me"),
  refresh: () => request<{ access_token: string; refresh_token: string; token_type: string }>("/auth/refresh", { method: "POST", body: JSON.stringify({}) }),
  quotes: () => request<Array<{ symbol: string; price: number; change: number; provider?: string; realtime?: boolean; stale?: boolean; generated_at?: string }>>("/markets/quotes"),
  ohlc: (symbol: string, timeframe = "1D") => request<{ symbol: string; timeframe: string; interval: string; source?: string; realtime?: boolean; stale?: boolean; points: Array<{ t: string; o: number; h: number; l: number; c: number; v: number }> }>(`/markets/ohlc/${symbol}?timeframe=${encodeURIComponent(timeframe)}`),
  signal: (symbol: string, timeframe = "1D") => request<{ symbol: string; signal: string; confidence: number; momentum: number; trend: string; volatility: number; support: number; resistance: number; target_up: number; target_down: number; bullish_probability?: number; bearish_probability?: number; neutral_probability?: number; stop_price?: number; volatility_expectation?: number; model_version?: string; provider?: string }>(`/markets/signals/${symbol}?timeframe=${encodeURIComponent(timeframe)}`),
  signals: (symbols?: string, timeframe = "1D") => request<Array<{ symbol: string; signal: string; confidence: number; momentum: number; trend: string; volatility: number; support: number; resistance: number; target_up?: number; target_down?: number; bullish_probability?: number; bearish_probability?: number; neutral_probability?: number; stop_price?: number; volatility_expectation?: number; model_version?: string; provider?: string }>>(`/markets/signals?symbols=${encodeURIComponent(symbols || "AAPL,NVDA,TSLA,MSFT,AMZN")}&timeframe=${encodeURIComponent(timeframe)}`),
  watchlist: () => request<Array<{ id: number; symbol: string; created_at: string }>>("/watchlists/"),
  addWatchlist: (symbol: string) => request<{ id: number; symbol: string }>(`/watchlists/${symbol}`, { method: "POST" }),
  copilotHistory: () => request<Array<{ id: number; question: string; answer: string; created_at: string }>>("/copilot/history"),
  copilotChat: (message: string, symbols?: string[]) => request<{ id: number; answer: string }>("/copilot/chat", { method: "POST", body: JSON.stringify({ message, symbols }) }),
  copilotStream: async (message: string, onChunk: (chunk: string) => void) => {
    let authHeader: Record<string, string> = {}
    try {
      if (typeof window !== 'undefined') {
        const token = window.localStorage.getItem('veltrix_access_token')
        if (token) authHeader = { Authorization: `Bearer ${token}` }
      }
    } catch {
      /* ignore localStorage errors */
    }

    const response = await fetch(`${env.apiBaseUrl}/copilot/stream?message=${encodeURIComponent(message)}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
      },
    })
    if (!response.body) return
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value)
      text.split("\n").forEach((line) => {
        if (line.startsWith("data: ")) onChunk(line.replace("data: ", ""))
      })
    }
  },
  portfolio: () => request<{ equity: number; daily_pnl: number; positions: number }>("/portfolio/"),
  
  // Portfolio CRUD
  portfolios: () => request<Array<{ id: number; user_id: number; name: string }>>("/portfolio/list"),
  createPortfolio: (name: string, metadata?: object) =>
    request<{ id: number; user_id: number; name: string }>("/portfolio/", {
      method: "POST",
      body: JSON.stringify({ name, metadata }),
    }),
  getPortfolio: (id: number) =>
    request<{ id: number; name: string; summary: object }>(`/portfolio/${id}`),
  updatePortfolio: (id: number, name?: string, metadata?: object) =>
    request<{ id: number; user_id: number; name: string }>(`/portfolio/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name, metadata }),
    }),
  deletePortfolio: (id: number) =>
    request<{ status: string }>(`/portfolio/${id}`, { method: "DELETE" }),
  
  // Positions
  getPositions: (portfolioId: number) =>
    request<Array<{ id: number; symbol: string; quantity: number; avg_price: number; current_price: number; position_value: number; position_pnl: number; position_pnl_pct: number }>>(
      `/portfolio/${portfolioId}/positions`
    ),
  createPosition: (portfolioId: number, symbol: string, quantity: number, avg_price: number) =>
    request<{ id: number; symbol: string; quantity: number; avg_price: number; current_price: number; position_value: number; position_pnl: number }>(
      `/portfolio/${portfolioId}/positions`,
      {
        method: "POST",
        body: JSON.stringify({ symbol, quantity, avg_price }),
      }
    ),
  updatePosition: (portfolioId: number, positionId: number, quantity?: number, avg_price?: number) =>
    request<{ id: number; symbol: string; quantity: number; avg_price: number; current_price: number; position_value: number; position_pnl: number }>(
      `/portfolio/${portfolioId}/positions/${positionId}`,
      {
        method: "PUT",
        body: JSON.stringify({ quantity, avg_price }),
      }
    ),
  deletePosition: (portfolioId: number, positionId: number) =>
    request<{ status: string }>(`/portfolio/${portfolioId}/positions/${positionId}`, {
      method: "DELETE",
    }),
  
  // Transactions
  getTransactions: (portfolioId: number, symbol?: string) =>
    request<Array<{ id: number; symbol: string; action: string; quantity: number; price: number; total: number; transaction_date: string }>>(
      `/portfolio/${portfolioId}/transactions${symbol ? `?symbol=${symbol}` : ""}`
    ),
  
  // Analytics
  getPortfolioAnalytics: (portfolioId: number) =>
    request<{ portfolio_id: number; sharpe_ratio: number; max_drawdown: number; volatility: number }>(
      `/portfolio/${portfolioId}/analytics`
    ),
  getSectorPerformance: () =>
    request<Array<{ name: string; change: number; weight: number; stocks: Array<{ symbol: string; price: number; change: number }>; constituent_count: number }>>(
      "/sectors/performance"
    ),
  getSectorHeatmap: () =>
    request<Array<{ name: string; change: number; weight: number }>>("/sectors/heatmap"),
  orderbook: (symbol: string) => request<{ symbol: string; bids: Array<[number, number, number]>; asks: Array<[number, number, number]>; mid: number; spread: number; source: string; timestamp: string | null }>(`/markets/orderbook/${symbol}`),
  notifications: () => request<Array<{ id: number; message: string; is_read?: boolean }>>("/notifications/"),
  getSectorLeadersLosers: (limit?: number) =>
    request<{ leaders: Array<any>; losers: Array<any> }>(
      `/sectors/leaders-losers${limit ? `?limit=${limit}` : ""}`
    ),
  getSectorDetails: (sectorName: string) =>
    request<{ name: string; weight: number; avg_change: number; stocks: Array<any>; best_performer: any; worst_performer: any; constituent_count: number }>(
      `/sectors/${sectorName}`
    ),
  getInstitutionalFlow: (symbols?: string, timeframe = "1D", limit = 6) =>
    request<{ source: string; generated_at: string; summary: { buy_flow: number; sell_flow: number; net_flow: number; tracked_symbols: number; signals: number }; items: Array<{ symbol: string; action: string; label: string; amount: string; notional: number; volume_ratio: number; confidence: number; price: number; price_change_pct: number; timestamp: string; source: string }> }>(
      `/flows?symbols=${encodeURIComponent(symbols || "AAPL,NVDA,MSFT,AMZN,TSLA,META,QQQ,SPY,JPM,UNH,XOM,AMD")}&timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`
    ),
  forecasts: (symbols?: string, horizons = "1d,7d,30d") =>
    request<{ source: string; generated_at: string; summary: { bullish: number; bearish: number; neutral: number; symbols: number; forecasts: number }; items: Array<{ symbol: string; horizon: string; current_price: number; forecast_price: number; target_up: number; target_down: number; support: number; resistance: number; confidence: number; expected_return_pct: number; volatility_pct: number; signal: string; signal_source: string; signal_confidence: number; timestamp: string; source: string }> }>(
      `/forecasts?symbols=${encodeURIComponent(symbols || "SPY,QQQ,AAPL,NVDA,MSFT,AMZN")}&horizons=${encodeURIComponent(horizons)}`
    ),
  optimizer: (payload: {
    amount: number
    risk_tolerance: string
    horizon: string
    preferred_sectors: string[]
    ethical: boolean
    dividend_preference: boolean
    volatility_tolerance: string
  }) => request('/optimizer/', { method: 'POST', body: JSON.stringify(payload) }),
  createNotification: (message: string) => request<{ id: number; message: string }>("/notifications/", { method: "POST", body: JSON.stringify({ message }) }),
  settings: () => request<{ preferences: Record<string, unknown> }>("/settings/preferences"),
  updateSettings: (preferences: Record<string, unknown>) => request<{ preferences: Record<string, unknown> }>("/settings/preferences", { method: "PUT", body: JSON.stringify({ preferences }) }),
  subscription: () => request<{ plan: string; status: string }>("/settings/subscription"),
  analytics: () => request<{
    total_equity: number; total_invested: number; total_return_pct: number; alpha: number; beta: number; sharpe: number; sortino: number; information_ratio: number;
    rolling_volatility: number[]; rolling_returns: number[];
    sector_exposure: Array<{ sector: string; weight: number }>;
    performance_attribution: Array<{ symbol: string; weight: number; pnl: number; return_pct: number }>;
  }>("/analytics/"),
  risk: () => request<{
    equity: number; var: number; expected_shortfall: number; max_drawdown: number; concentration_risk: number; liquidity_risk: number;
    stress_tests: Array<{ metric: string; value: number }>;
    scenario_engine: Array<{ name: string; shock_pct: number; projected_value: number; projected_pnl: number }>;
  }>("/risk/"),
  macro: () => request<Record<string, unknown>>("/macro/"),
}
