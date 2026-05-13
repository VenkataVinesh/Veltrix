'use client'

import { DashboardView } from '@/components/views/dashboard-view'
import { MarketsView } from '@/components/views/markets-view'
import { SignalsView } from '@/components/views/signals-view'
import { ForecastView } from '@/components/views/forecast-view'
import { PortfolioView } from '@/components/views/portfolio-view'
import { OptimizerView } from '@/components/views/optimizer-view'
import { CopilotView } from '@/components/views/copilot-view'
import { AnalyticsView } from '@/components/views/analytics-view'
import { RiskView } from '@/components/views/risk-view'
import { MacroView } from '@/components/views/macro-view'
import { FlowView } from '@/components/views/flow-view'
import { AlertsView } from '@/components/views/alerts-view'
import { SettingsView } from '@/components/views/settings-view'
import { ErrorBoundary } from '@/components/error-boundary'

export const APP_SECTIONS = [
  'dashboard', 'markets', 'signals', 'forecast',
  'analytics', 'portfolio', 'optimizer', 'risk',
  'macro', 'flow', 'copilot', 'alerts', 'settings',
] as const

export type AppSection = (typeof APP_SECTIONS)[number]

export function isAppSection(value: string): value is AppSection {
  return APP_SECTIONS.includes(value as AppSection)
}

function Views({ section }: { section: AppSection }) {
  switch (section) {
    case 'dashboard':  return <DashboardView />
    case 'markets':    return <MarketsView />
    case 'signals':    return <SignalsView />
    case 'forecast':   return <ForecastView />
    case 'analytics':  return <AnalyticsView />
    case 'portfolio':  return <PortfolioView />
    case 'optimizer':  return <OptimizerView />
    case 'risk':       return <RiskView />
    case 'macro':      return <MacroView />
    case 'flow':       return <FlowView />
    case 'copilot':    return <CopilotView />
    case 'alerts':     return <AlertsView />
    case 'settings':   return <SettingsView />
    default:           return <DashboardView />
  }
}

export function SectionView({ section }: { section: AppSection }) {
  return <ErrorBoundary><Views section={section} /></ErrorBoundary>
}
