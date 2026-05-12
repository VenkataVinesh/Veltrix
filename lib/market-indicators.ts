export interface OhlcPoint {
  t: string
  o: number
  h: number
  l: number
  c: number
  v: number
}

export interface ChartPoint extends OhlcPoint {
  sma20?: number | null
  ema20?: number | null
  ema12?: number | null
  ema26?: number | null
  macd?: number | null
  macdSignal?: number | null
  macdHistogram?: number | null
  rsi14?: number | null
  bollingerUpper?: number | null
  bollingerLower?: number | null
  volumeProfile?: number | null
}

export function round(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function calculateSma(values: number[], period: number): Array<number | null> {
  return values.map((_, index) => {
    if (index + 1 < period) return null
    const slice = values.slice(index + 1 - period, index + 1)
    return round(slice.reduce((sum, item) => sum + item, 0) / period)
  })
}

export function calculateEma(values: number[], period: number): Array<number | null> {
  const multiplier = 2 / (period + 1)
  const output: Array<number | null> = []
  let previous: number | null = null

  values.forEach((value, index) => {
    if (index + 1 < period) {
      output.push(null)
      return
    }
    if (previous === null) {
      const seed = values.slice(0, period).reduce((sum, item) => sum + item, 0) / period
      previous = seed
      output.push(round(seed))
      return
    }
    previous = (value - previous) * multiplier + previous
    output.push(round(previous))
  })

  return output
}

export function calculateRsi(values: number[], period = 14): Array<number | null> {
  const output: Array<number | null> = []
  let averageGain = 0
  let averageLoss = 0

  for (let index = 0; index < values.length; index += 1) {
    if (index === 0) {
      output.push(null)
      continue
    }

    const change = values[index] - values[index - 1]
    const gain = Math.max(change, 0)
    const loss = Math.max(-change, 0)

    if (index <= period) {
      averageGain += gain
      averageLoss += loss
      output.push(null)
      if (index === period) {
        averageGain /= period
        averageLoss /= period
        const rs = averageLoss === 0 ? 100 : averageGain / averageLoss
        output[output.length - 1] = round(100 - 100 / (1 + rs))
      }
      continue
    }

    averageGain = ((averageGain * (period - 1)) + gain) / period
    averageLoss = ((averageLoss * (period - 1)) + loss) / period
    const rs = averageLoss === 0 ? 100 : averageGain / averageLoss
    output.push(round(100 - 100 / (1 + rs)))
  }

  return output
}

export function calculateStdDev(values: number[], period: number): Array<number | null> {
  return values.map((_, index) => {
    if (index + 1 < period) return null
    const slice = values.slice(index + 1 - period, index + 1)
    const mean = slice.reduce((sum, item) => sum + item, 0) / period
    const variance = slice.reduce((sum, item) => sum + ((item - mean) ** 2), 0) / period
    return round(Math.sqrt(variance))
  })
}

export function calculateBollingerBands(values: number[], period = 20, multiplier = 2) {
  const sma = calculateSma(values, period)
  const stdDev = calculateStdDev(values, period)
  return values.map((_, index) => {
    if (sma[index] == null || stdDev[index] == null) {
      return { upper: null, lower: null, middle: sma[index] ?? null }
    }
    return {
      upper: round((sma[index] as number) + (stdDev[index] as number) * multiplier),
      lower: round((sma[index] as number) - (stdDev[index] as number) * multiplier),
      middle: sma[index],
    }
  })
}

export function calculateMacd(values: number[]) {
  const ema12 = calculateEma(values, 12)
  const ema26 = calculateEma(values, 26)
  const macd = values.map((_, index) => {
    if (ema12[index] == null || ema26[index] == null) return null
    return round((ema12[index] as number) - (ema26[index] as number))
  })
  const macdValues = macd.map((value) => value ?? 0)
  const signal = calculateEma(macdValues, 9)
  const histogram = macd.map((value, index) => {
    if (value == null || signal[index] == null) return null
    return round(value - (signal[index] as number))
  })
  return { ema12, ema26, macd, signal, histogram }
}

export function calculateVolumeProfile(points: OhlcPoint[], bins = 12): Array<{ price: number; volume: number }> {
  if (!points.length) return []
  const min = Math.min(...points.map((point) => point.l))
  const max = Math.max(...points.map((point) => point.h))
  const step = (max - min) / bins || 1
  const buckets = Array.from({ length: bins }, (_, index) => ({
    price: round(min + step * (index + 0.5)),
    volume: 0,
  }))

  points.forEach((point) => {
    const midpoint = (point.h + point.l + point.c) / 3
    const index = Math.min(bins - 1, Math.max(0, Math.floor((midpoint - min) / step)))
    buckets[index].volume += point.v
  })

  return buckets
}

export function buildChartPoints(points: OhlcPoint[]): ChartPoint[] {
  const closes = points.map((point) => point.c)
  const sma20 = calculateSma(closes, 20)
  const ema20 = calculateEma(closes, 20)
  const rsi14 = calculateRsi(closes, 14)
  const { ema12, ema26, macd, signal, histogram } = calculateMacd(closes)
  const bands = calculateBollingerBands(closes, 20, 2)
  const volumeProfile = calculateVolumeProfile(points)
  const profileValues = volumeProfile.length ? volumeProfile.map((bucket) => bucket.volume) : []

  return points.map((point, index) => ({
    ...point,
    sma20: sma20[index],
    ema20: ema20[index],
    ema12: ema12[index],
    ema26: ema26[index],
    macd: macd[index],
    macdSignal: signal[index],
    macdHistogram: histogram[index],
    rsi14: rsi14[index],
    bollingerUpper: bands[index]?.upper ?? null,
    bollingerLower: bands[index]?.lower ?? null,
    volumeProfile: profileValues[index % Math.max(profileValues.length, 1)] ?? null,
  }))
}