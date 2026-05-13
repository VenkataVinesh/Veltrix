// Shared formatters for UI components
// src/components/ui/formatters.ts

/**
 * Format a number with a fixed number of decimal places.
 * Returns a placeholder dash if value is not finite.
 */
export function fmt(value: unknown, decimals: number = 2): string {
  const n = Number(value)
  return Number.isFinite(n) ? n.toFixed(decimals) : '—'
}

/**
 * Format a number as a percentage string with a leading sign.
 */
export function pct(value: unknown, decimals: number = 2): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${(n * 100).toFixed(decimals)}%`
}

/**
 * Format a number as USD currency.
 */
export function usd(value: unknown, decimals: number = 0): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}
