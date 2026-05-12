import { z } from 'zod'

export const DataMetaSchema = z.object({
  provider: z.string().optional(),
  generated_at: z.string().optional(),
  stale: z.boolean().optional(),
  realtime: z.boolean().optional(),
})

export const QuoteSchema = DataMetaSchema.extend({
  symbol: z.string(),
  price: z.number(),
  change: z.number(),
})

export const OhlcPointSchema = z.object({
  t: z.string(),
  o: z.number(),
  h: z.number(),
  l: z.number(),
  c: z.number(),
  v: z.number(),
})

export const OhlcResponseSchema = z.object({
  symbol: z.string(),
  timeframe: z.string(),
  interval: z.string().optional(),
  source: z.string().optional(),
  realtime: z.boolean().optional(),
  stale: z.boolean().optional(),
  points: z.array(OhlcPointSchema),
})

export const SignalSchema = z.object({
  symbol: z.string(),
  signal: z.string(),
  confidence: z.number(),
  momentum: z.number(),
  trend: z.string(),
  volatility: z.number(),
  support: z.number(),
  resistance: z.number(),
  target_up: z.number(),
  target_down: z.number(),
  bullish_probability: z.number().optional(),
  bearish_probability: z.number().optional(),
  neutral_probability: z.number().optional(),
  stop_price: z.number().optional(),
  volatility_expectation: z.number().optional(),
  model_version: z.string().optional(),
  provider: z.string().optional(),
})

export const PortfolioSummarySchema = z.object({
  equity: z.number(),
  daily_pnl: z.number(),
  positions: z.number(),
  portfolios: z.array(z.object({
    id: z.number(),
    name: z.string(),
    equity: z.number().optional(),
    positions: z.number().optional(),
  })).optional(),
})

export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Validation failed: ${issues}`)
  }
  return result.data
}
