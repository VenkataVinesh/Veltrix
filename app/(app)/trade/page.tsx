import { Suspense } from 'react'
import { TradeView } from '@/components/views/trade-view'

export const metadata = { title: 'Trade — Veltrix' }

export default function TradePage() {
  // The view reads ?symbol= via useSearchParams, which needs a Suspense boundary.
  return <Suspense fallback={null}><TradeView /></Suspense>
}
