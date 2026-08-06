import { NextResponse } from 'next/server'
import { getMacro } from '@/lib/market/macro'

// Most of these series publish monthly; the daily ones update once a day
// after markets close. An hour at the edge is far more often than the data
// actually changes.
export const revalidate = 3600

export async function GET() {
  try {
    const macro = await getMacro()
    if ('unavailable' in macro) {
      return NextResponse.json({ unavailable: true, reason: macro.reason })
    }
    return NextResponse.json({ series: macro })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'macro fetch failed' },
      { status: 502 }
    )
  }
}
