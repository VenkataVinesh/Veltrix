# Setup

Veltrix is a single Next.js application. There is no separate backend service,
no database to run locally, and nothing to install beyond Node.

> An earlier version of this project was a Next.js frontend against a FastAPI
> backend with Postgres and Redis. That backend has been removed — its
> responsibilities now live in Next route handlers under `app/api/` and in
> Supabase. If you are following an older guide that mentions `uvicorn`,
> port 8000 or `backend/.env`, it no longer applies.

## Prerequisites

- **Node.js 18+** and npm

That is the whole list.

## Quick start

```bash
git clone https://github.com/VenkataVinesh/Veltrix.git
cd Veltrix
npm install
npm run dev
```

Open <http://localhost:3000>.

It runs with **no configuration at all**. Crypto quotes, candles, technical
signals and forecasts all work immediately, because CoinGecko's public API
needs no key, and auth falls back to a shared demo Supabase project.

## Adding your own keys

Copy `.env.example` to `.env.local` and fill in what you need. Every key is
optional except Supabase, and the app degrades honestly without each one —
it reports a source as unavailable rather than substituting invented data.

```bash
cp .env.example .env.local
```

| Variable | Unlocks | Free tier |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `..._ANON_KEY` | Your own auth + portfolios | Yes |
| `TWELVEDATA_API_KEY` | **Equity history** → stock signals and forecasts | 800 credits/day, 8/min |
| `FINNHUB_API_KEY` | Live equity quotes and company headlines | 60 req/min |
| `ALPHAVANTAGE_API_KEY` | Fallback equity history | 25 req/day |
| `FRED_API_KEY` | The Macro page | Effectively unlimited |
| `GROQ_API_KEY` | Multi-agent debate (fastest option) | Generous |
| `GEMINI_API_KEY` | Debate fallback provider | Per-minute limits |
| `OPENROUTER_API_KEY` | Debate fallback provider | **50 requests/day** |

Two things worth knowing before you wire these up, both learned the hard way:

- **Finnhub alone is not enough for stocks.** Its `/stock/candle` endpoint is
  premium-only and returns `403` on a free key, so a Finnhub key gives you
  prices but no history — and without history there are no signals and no
  forecasts. Twelve Data is what actually makes equities work.
- **OpenRouter's free tier is 50 requests per _day_, not per minute.** One
  debate costs about 10 model calls. Set `GROQ_API_KEY` as well; free quotas
  are per-provider, so stacking them multiplies capacity at no cost.

The Supabase **anon/publishable** key is designed to ship in client bundles and
grants no privileges on its own — Row Level Security is the authorisation
boundary. Never put a *service role* key in this file.

## Supabase (only if using your own project)

1. Create a project at [supabase.com](https://supabase.com).
2. Under **Authentication → Providers → Email**, turn **Confirm email** off for
   local development, or signups will hang waiting on a confirmation link.
3. Copy the project URL and anon key from **Project Settings → API** into
   `.env.local`.

Schema and RLS policies are applied by the migrations in the Supabase project
itself; the app assumes tables are already present and does not create them.

## Checks

```bash
npm run build      # production build — compiles every route
npx tsc --noEmit   # type check
npm run lint       # eslint
```

CI runs all three on every push (`.github/workflows/frontend.yml`).

## Troubleshooting

**Stock symbols show "history unavailable".**
Expected without `TWELVEDATA_API_KEY`. Crypto is unaffected.

**Signup does nothing.**
Email confirmation is on in your Supabase project. See step 2 above.

**Macro page says no provider configured.**
`FRED_API_KEY` is unset. Keys are free and issued instantly.

**Debate returns the deterministic signal instead of agent opinions.**
No LLM key is set, or the day's free quota is spent. The app deliberately
falls back to the transparent composite signal rather than inventing
opinions.
