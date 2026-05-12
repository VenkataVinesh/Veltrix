export type DataMeta = {
  provider: string
  generated_at?: string
  stale?: boolean
  realtime?: boolean
}

export type Quote = DataMeta & {
  symbol: string
  price: number
  change: number
}

export type OhlcPoint = {
  t: string
  o: number
  h: number
  l: number
  c: number
  v: number
}

export type OhlcResponse = {
  symbol: string
  timeframe: string
  source: string
  points: OhlcPoint[]
}

export type AnalyticsResponse = {
  total_equity: number
  total_invested: number
  total_return_pct: number
  alpha: number
  beta: number
  sharpe: number
  sortino: number
  information_ratio: number
  rolling_volatility: number[]
  rolling_returns: number[]
  sector_exposure: Array<{ sector: string; weight: number }>
  correlation_matrix: Array<{ symbol: string; values: number[] }>
  performance_attribution: Array<{ symbol: string; weight: number; pnl: number; return_pct: number }>
}

export type RiskResponse = {
  equity: number
  var: number
  expected_shortfall: number
  max_drawdown: number
  concentration_risk: number
  liquidity_risk: number
  stress_tests: Array<{ metric: string; value: number }>
  scenario_engine: Array<{ name: string; shock_pct: number; projected_value: number; projected_pnl: number }>
}

export type OptimizerResponse = {
  optimal_portfolio: Array<{
    symbol: string
    weight: number
    notional: number
    price: number
    shares: number
  }>
  expected_return: number
  expected_volatility: number
  expected_sharpe: number
  efficient_frontier: Array<{ risk: number; return: number; sharpe: number }>
  growth_projection: Array<{ year: number; value: number }>
  explanation: {
    rationale: string[]
    macro_considerations: string[]
  }
}
