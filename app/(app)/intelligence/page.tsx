import { Suspense } from 'react'
import { IntelligenceView } from '@/components/views/intelligence-view'

export const metadata = { title: 'Intelligence — Veltrix' }

export default function IntelligencePage() {
  // The view reads ?symbol= via useSearchParams, which needs a Suspense boundary.
  return <Suspense fallback={null}><IntelligenceView /></Suspense>
}
