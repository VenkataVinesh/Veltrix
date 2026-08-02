import { createClient } from '@/lib/supabase/server'
import { hasEquityProvider } from '@/lib/market/providers'
import { Card, Eyebrow } from '@/components/ui/primitives'
import { SignOutButton } from '@/components/sign-out-button'

export const metadata = { title: 'Settings — Veltrix' }
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const providers = [
    { name: 'CoinGecko', scope: 'Crypto prices & candles', ok: true, note: 'No API key required' },
    {
      name: 'Finnhub',
      scope: 'Equity prices & candles',
      ok: hasEquityProvider(),
      note: hasEquityProvider() ? 'API key configured' : 'Set FINNHUB_API_KEY to enable equities',
    },
  ]

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Eyebrow>Account</Eyebrow>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-[-0.02em]">Settings</h1>
      </div>

      <Card>
        <Eyebrow>Signed in as</Eyebrow>
        <p className="mt-2 text-lg font-medium">{user?.email}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Account created {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
        </p>
        <div className="mt-6">
          <SignOutButton />
        </div>
      </Card>

      <Card>
        <Eyebrow>Data providers</Eyebrow>
        <div className="mt-4 space-y-3">
          {providers.map((p) => (
            <div key={p.name} className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-muted-foreground">{p.scope} · {p.note}</p>
              </div>
              <span className={`chip ${p.ok ? 'chip-up' : 'chip-flat'}`}>
                {p.ok ? 'Active' : 'Not configured'}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Eyebrow>About this build</Eyebrow>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Veltrix is a portfolio project by A. Venkata Vinesh Kumar Reddy. Prices come from live
          public APIs; signals and forecasts are computed server-side from that data. Forecast
          confidence is a measured walk-forward hit-rate and is reported even when it shows no
          predictive edge. Trading is paper-only — no real orders are placed anywhere.
          Nothing here is investment advice.
        </p>
        <a
          href="https://github.com/VenkataVinesh/Veltrix"
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
        >
          View source on GitHub
        </a>
      </Card>
    </div>
  )
}
