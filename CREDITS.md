# Credits & third-party licenses

Everything below is open-source and free for commercial and personal use.

## Architectural influence

### TradingAgents — TauricResearch/TradingAgents
- Source: https://github.com/TauricResearch/TradingAgents
- License: **Apache-2.0**
- Used in: `lib/agents/`

**What was and was not taken.** Veltrix's multi-agent debate follows the
*architecture* described by TradingAgents — specialist analysts
(technical, fundamentals/news, sentiment, macro) feeding a bull-vs-bear
researcher debate, resolved by a trader and gated by a risk manager.

The implementation is independent TypeScript. **Veltrix does not run
TradingAgents' Python, does not vendor their code, and does not use their
prompts.** No file from that repository is copied into this one.

Parts of the framework that are *not* implemented here, stated plainly so
the README cannot be read as overclaiming:

| TradingAgents component | In Veltrix |
| --- | --- |
| Four specialist analysts | Yes |
| Bull vs bear researcher debate | Yes, **single round** |
| Trader synthesis | Yes |
| Risk manager with veto and position sizing | Yes, **single manager** |
| Multi-round rebuttal between researchers | No |
| Agent memory / reflection across runs | No |
| Risk *team* debate (aggressive/neutral/conservative) | No |
| LangGraph runtime | No — plain async orchestration |

Two deliberate departures, both to avoid fabrication:

1. Agents receive real sourced evidence — our own indicator engine,
   Twelve Data / CoinGecko history, Finnhub headlines, FRED macro series.
   They are never asked to recall a price from model weights.
2. The deterministic composite signal stays the headline number. Agents
   add reasoning and a risk verdict; they never silently overwrite the
   arithmetic. Disagreement is surfaced via `agreesWithQuant` rather than
   hidden.

## Libraries

| Package | License | Use |
| --- | --- | --- |
| [Next.js](https://github.com/vercel/next.js) | MIT | App Router, route handlers, middleware |
| [React](https://github.com/facebook/react) | MIT | UI |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) | MIT | Styling |
| [GSAP](https://github.com/greensock/GSAP) | Standard "No Charge" license | Scroll choreography, ScrollTrigger |
| [Lenis](https://github.com/darkroomengineering/lenis) | MIT | Momentum smooth scroll |
| [lightweight-charts](https://github.com/tradingview/lightweight-charts) | Apache-2.0 | Price charts |
| [TanStack Query](https://github.com/TanStack/query) | MIT | Data fetching and caching |
| [lucide-react](https://github.com/lucide-icons/lucide) | ISC | Icons |
| [Supabase JS / SSR](https://github.com/supabase/supabase-js) | MIT | Auth and Postgres access |

## Fonts

| Font | License |
| --- | --- |
| [Inter](https://github.com/rsms/inter) | SIL Open Font License 1.1 |
| [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) | SIL Open Font License 1.1 |

## Data providers

| Provider | Use | Notes |
| --- | --- | --- |
| [CoinGecko](https://www.coingecko.com/en/api) | Crypto quotes and OHLC | No key required |
| [Finnhub](https://finnhub.io/) | Equity quotes, company news | Free tier; `/stock/candle` is premium-only |
| [Twelve Data](https://twelvedata.com/) | Equity OHLC history | Free tier: 800 credits/day |
| [Alpha Vantage](https://www.alphavantage.co/) | Equity daily bars | Fallback only; 25 req/day |
| [FRED](https://fred.stlouisfed.org/docs/api/fred/) | Macro series | St. Louis Fed |
| [OpenRouter](https://openrouter.ai/) | LLM routing for the agent debate | Free-tier models |
