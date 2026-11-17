# Security Policy

## Reporting a Vulnerability

If you discover a security issue in Veltrix, please report it privately by email rather than opening a public GitHub issue:

- **Contact:** `venkata-vinesh-kumar-reddy.atluri@etu.ec-lyon.fr`

Please include a clear description of the issue, the affected route or file, and steps to reproduce.

---

## Security Architecture

### 1. Row-Level Security (RLS) as the Authorisation Boundary

Veltrix uses Supabase (PostgreSQL + GoTrue Auth) for user accounts, paper portfolios, positions, and watchlists.

- **Client-side key:** `NEXT_PUBLIC_SUPABASE_ANON_KEY` is a Supabase publishable (anonymous) key. By design, it ships in browser bundles and grants **zero** table access on its own.
- **Database enforcement:** Every user table (`profiles`, `portfolios`, `positions`, `watchlist`) has PostgreSQL Row-Level Security enabled. Queries run with the caller's JWT (`auth.uid()`), so isolation is enforced by Postgres rather than application code.
- **Service role key:** Never used in client code, never committed, and not required by the application.

### 2. Server-Only Data and LLM Provider Keys

All third-party API keys (`FINNHUB_API_KEY`, `TWELVEDATA_API_KEY`, `ALPHAVANTAGE_API_KEY`, `FRED_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`) are read exclusively inside server-side Next.js Route Handlers (`app/api/*`) and server modules (`lib/market/*`, `lib/agents/*`). None carries the `NEXT_PUBLIC_` prefix, and none is serialized to the client.

When an optional provider key is absent, the server returns an explicit `{ unavailable: true, reason: "..." }` payload rather than falling back to fabricated data.

### 3. Dependency & Secret Hygiene

- `.env*` files (except `.env.example`) are blocked by `.gitignore`.
- Production dependencies are pinned to exact versions in `package.json`.
- Continuous Integration (`.github/workflows/frontend.yml`) enforces `npm audit --omit=dev --audit-level=high` on every push and pull request alongside linting, type-checking, unit tests, and production builds.
- Dependabot monitors `npm` and `github-actions` weekly.
