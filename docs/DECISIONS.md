# Engineering decisions (`docs/DECISIONS.md`)

This document records the technical choices behind Veltrix: what was changed, what was built and cut when the numbers did not support it, what was deliberately left alone, and what comes next.

---

## 1. Why the headline feature is a 50.2% null result

Retail and student trading projects almost universally claim 70–90% directional accuracy on daily price bars. In nearly every case, that number comes from one of three bugs:
1. Scaling or normalising features over the full dataset before splitting train and test.
2. Tuning hyperparameters or model selection on the same window used to report accuracy.
3. Scoring a random-walk predictor (`pred = lastPrice`) as a 50% coin flip or letting `NaN` fall back to a hard-coded constant.

When Veltrix's forecast ensemble (`drift_ewma`, `ar`, `naive`) was evaluated through a strict one-step-ahead walk-forward harness over 1,500 out-of-sample calls across six liquid equities (`AAPL`, `NVDA`, `MSFT`, `TSLA`, `SPY`, `AMZN`), the pooled directional hit-rate was **50.2%** (753/1,500, $\text{SE} = 1.29\text{pp}, z = 0.16$).

Rather than tweaking features or changing the symbol set until the backtest looked flattering, we made that finding the centrepiece of the product:
- The landing page, dashboard, status bar, and intelligence view render the `EdgeReport` component (`components/edge-report.tsx`), stating plainly that the midline has **NO EDGE**.
- Every per-symbol forecast prints its out-of-sample directional count (`nCorrect / nDirectional`), its two-sided 95% margin of error (`±marginPp`), and a `not distinguishable from a coin flip` warning chip whenever the hit-rate sits inside that margin.
- The product pivots user attention to the part of the forecast that *is* predictable and empirically validated: the **95% GARCH(1,1) volatility band** (**94.75%** coverage across 1,200 held-out 5-day forecasts).

---

## 2. Why flat predictions are excluded from directional scoring

The `naive` random-walk model predicts tomorrow's price equals today's price (`pred = last`), so `Math.sign(pred - last)` is always `0`.

In an earlier version of the codebase, two subtle bugs interacted:
1. The headline hit-rate reported whichever single model held the largest inverse-RMSE weight. Because a random walk usually ties or beats AR/drift on 1-step RMSE, `naive` was almost always selected.
2. Because `naive` made zero directional calls, its directional hit-rate was `0 / 0 = NaN`, which fell back to a literal `0.5` (`50%`) in the response serializer. Every symbol showed `"50%"` while claiming it was measured over 40 held-out steps.

We fixed both:
- `walkForwardEnsemble` and `evaluateWalkForward` (`lib/evaluation.ts`) score the **weighted ensemble midline** that is actually drawn on the chart.
- Any step where `Math.sign(pred - anchor) === 0` or `Math.sign(actual - anchor) === 0` is excluded from `nDirectional`. When `nDirectional < 5`, `hitRate` is `null` (`n/a` in the UI), never `0.5` — "we could not measure a direction" and "it is a measured 50% coin flip" are different claims.

---

## 3. Why GARCH(1,1) replaced RiskMetrics EWMA for the 95% confidence bands

Initially, Veltrix built its 95% prediction intervals using RiskMetrics exponentially weighted moving average volatility ($\lambda = 0.94$), scaled by $\sqrt{h}$ for horizon $h$.

When we backtested 1,200 held-out 5-day interval forecasts (200 steps × 6 equities) and ran **Kupiec's (1995) Proportion of Failures (POF)** likelihood-ratio test against the nominal 95% target ($\alpha = 0.05$):
- **EWMA ($\lambda = 0.94$)** achieved **91.67%** coverage (100 violations vs 60 expected; **93.33%** / 80 violations on the 600-bar pinned fixture). The price escaped the "95%" cone far too often. Kupiec's test strongly rejects nominal calibration ($\text{LR}_{\text{POF}} = 24.93, p < 0.0001$). Because EWMA has no mean reversion ($\alpha + \beta = 1$), a calm week produces artificially narrow multi-day cones that fail as soon as volatility reverts.
- **GARCH(1,1)** models conditional variance with explicit mean reversion toward the long-run unconditional variance $\sigma^2_{\text{uncond}} = \omega / (1 - \alpha - \beta)$. Over the same 1,200 held-out 5-day forecasts, GARCH(1,1) achieved **94.75%** coverage (1,137/1,200), passing Kupiec's test with $\text{LR}_{\text{POF}} = 0.16$ ($p = 0.6934$) and achieving the best Patton (2011) QLIKE volatility loss (`-5.2448`).

GARCH(1,1) is fitted once per forecast via variance-targeted Gaussian maximum likelihood (`garchFit` in `lib/market/ml.ts`), adding `~0.76 ms` per request.

---

## 4. What we tried that did not work (and why we cut them)

Under the pre-registered protocol in `docs/FORECAST-EVALUATION.md` (`npm run evaluate`), we implemented and tested six additional directional and volatility models on the pinned 3,600-bar equity dataset (`tests/fixtures/equities-daily-2026-11-04.json`). Every one of them remains in `lib/market/ml.ts` and reachable via `ForecastOptions` so the negative results can be re-run rather than taken on faith.

### 4.1 Directional models ($M = 7$, Holm-Bonferroni corrected)
- **Ridge regression (11 engineered momentum, volatility-regime, MA-stretch, and volume features, $L_2 = 1.0$):** Pooled hit-rate **49.13%** (737/1,500, $z = -0.67, p_{\text{Holm}} = 1.00$), RMSE change `< 1%`, latency `286 ms`/symbol. **Cut.**
- **Gradient-boosted depth-1 stumps (25 rounds, $\text{lr} = 0.08$):** Pooled hit-rate **48.93%** (734/1,500, $z = -0.83, p_{\text{Holm}} = 1.00$). Combined with Ridge in the ensemble, per-forecast latency rose **123–443×** (`~4.5s`) because every walk-forward step refits from scratch. **Cut.**
- **1D Local-Level Kalman Filter (`kalmanReturnForecast`):** State-space filter separating latent drift from observation noise. Pooled hit-rate **48.33%** (725/1,500, $z = -1.29, p_{\text{Holm}} = 1.00$). On daily returns with low signal-to-noise ratio, the Kalman gain tracks recent noise just like sample drift. **Cut.**
- **Seasonal-Naive (`seasonalNaiveReturn`, 5-day lag):** Tests day-of-week return persistence. Pooled hit-rate **50.93%** (764/1,500, 95% CI `[48.4%, 53.5%]`, $z = +0.72, p_{\text{Holm}} = 1.00$). Fails the pre-registered `> 52.0%` + $p_{\text{Holm}} < 0.05$ threshold. **Cut.**

### 4.2 Volatility & interval models (1,200 held-out 5-day forecasts)
- **GJR-GARCH(1,1,1) (`gjrGarchFit`):** Glosten-Jagannathan-Runkle model adding an asymmetric leverage term $\gamma \mathbb{I}_{r_{t-1} < 0} r_{t-1}^2$. Achieved **94.67%** coverage (1,136/1,200, Kupiec $\text{LR}_{\text{POF}} = 0.28, p = 0.6000$), confirming that GARCH-family mean reversion is what calibrates the band. However, the 3D $(\alpha, \gamma, \beta)$ grid cost `1.93 ms` (2.5× slower than GARCH(1,1)) while scoring slightly worse on Winkler interval score (`26.67%` vs `26.54%`) and QLIKE (`-5.2356` vs `-5.2448`). **Kept as benchmark option (`volModel: 'gjr_garch'`), not default.**
- **Parkinson HAR-RV (`harRvFit`):** Corsi (2009) Heterogeneous Autoregressive model on 1d/5d/22d high-low range variance ($\sigma_{\text{P}}^2 = (\ln(H/L))^2 / (4 \ln 2)$). Achieved **91.67%** coverage (1,100/1,200) with narrower `14.98%` bands, failing Kupiec's test ($\text{LR}_{\text{POF}} = 23.59, p < 0.0001$). **Why it failed:** Intraday high-low range misses overnight close-to-open gaps, which is where equity earnings releases and macro announcements occur. **Cut.**
- **Split-Conformal GARCH (`conformalGarchMultiplier`):** Replaced the Gaussian 1.96 multiplier with the empirical 95th percentile of trailing 160-step GARCH-studentised 5-day residuals. Achieved **93.08%** coverage (1,117/1,200, Kupiec $\text{LR}_{\text{POF}} = 8.33, p = 0.0039$). **Why it failed:** Overlapping 5-day horizons inside a 160-day window provide only ~32 effective independent blocks, violating exchangeability when volatility shifts regimes. **Cut.**

---

## 5. System & product architecture decisions

### 5.1 Deleting the Python FastAPI backend
Veltrix originally split its Next.js frontend from a Python FastAPI + Redis + SQLite/Postgres backend. That architecture had three problems:
1. Two separate deployments (Vercel + Render/Railway) where cold starts on the free Python tier stalled every chart and signal load.
2. Every indicator, AR(5) solver, and GARCH grid search is pure array arithmetic that runs in `< 20 ms` in V8 TypeScript with zero native dependencies.
3. Supabase Row-Level Security (RLS) already enforces per-user isolation directly from Next.js Route Handlers using the caller's JWT cookie.

Deleting the Python service reduced the deployment to a single Next.js application with zero cold-start mismatch and allowed the same TypeScript modules (`lib/market/analysis.ts`, `lib/market/ml.ts`, `lib/evaluation.ts`) to power the API routes, unit tests, and `npm run evaluate`.

### 5.2 Multi-agent LLM debate as explanation, never headline prediction
The multi-agent debate (`lib/agents/engine.ts`, inspired by TradingAgents) runs four specialist analysts (technical, fundamentals/news, sentiment, macro), a two-round bull-vs-bear researcher rebuttal where conviction is allowed to move, a trader synthesis, and a risk manager with veto power.
- **No hallucinated prices:** `lib/agents/context.ts` gathers real quotes, computed indicator votes, Finnhub headlines, and FRED macro series first, and explicitly lists missing sources under `UNAVAILABLE EVIDENCE` so agents abstain rather than guess.
- **Arithmetic stays sovereign:** The deterministic composite signal (`computeSignal`) is always shown alongside `agreesWithQuant`. When no LLM key is configured or free-tier quotas are exhausted, the endpoint degrades cleanly to the deterministic signal.
- **Latency & rate-limit engineering:** Stacking Groq (`llama-3.3-70b-versatile` ~280ms), Gemini (`gemini-flash-lite-latest`), and OpenRouter with `mapLimit(2)` bounded concurrency reduced a 10-call debate from `~70s` to `~2.2s` without triggering per-minute 429 bursts.

### 5.3 Read-only Demo Mode (`?demo=1`)
A technical reviewer or recruiter evaluating the repository will rarely register an email account just to inspect an internal dashboard.
- `middleware.ts`, `app/(app)/layout.tsx`, and `/api/portfolio` support a read-only demo session (`?demo=1` / `veltrix_demo=1` cookie).
- Demo mode serves a pre-populated paper portfolio (`0.45 BTC`, `6 ETH`, `55 SOL` + `$42.5k` cash) marked to live CoinGecko prices while blocking `POST`/`DELETE` writes with `403`.
- Every surface (`AppShell` status bar, banner, Dashboard KPIs, Portfolio table, and Trade panel) labels the holdings as **SEEDED DEMO DATA** so simulated holdings are never mistaken for a live user account.

### 5.4 Next.js 16 migration & zero-advisory CI gate
Upgraded Next.js from `14.2.35` to `16.4.6` and PostCSS to `8.5.33`, clearing all four production security advisories (1 critical, 3 high) and enforcing `npm audit --omit=dev --audit-level=high` in GitHub Actions CI on every push and PR.

---

## 6. What was deliberately left alone

- **No deep neural sequence models (LSTM / TFT / N-BEATS) in the request path:** Training a neural network per serverless request on 300 bars is both too slow and statistically unsound; serving frozen pre-trained weights across 79 symbols introduces silent lookahead or stale scaling.
- **No synthetic fallback market data:** When `FINNHUB_API_KEY`, `TWELVEDATA_API_KEY`, or `FRED_API_KEY` is unset, the API returns `{ unavailable: true, reason: "..." }` and the UI explains which key is missing rather than rendering random-walk placeholder charts.
- **No external state management library:** Server state lives in TanStack Query (`['quotes']`, `['candles']`, `['signal']`, `['forecast']`, `['portfolio']`), and the active symbol lives in the URL (`?symbol=`) via `useSymbolParam` so links and command-palette actions are shareable.

---

## 7. What I would do next

1. **HAR-RV-J on intraday 5-minute bars:** Our offline evaluation showed why daily high-low Parkinson HAR-RV under-covered (91.67%) — it misses overnight close-to-open jumps. Decomposition into continuous intraday bipower variation plus an explicit overnight jump component (Andersen, Bollerslev & Diebold 2007) is the natural next experiment.
2. **Realised P&L ledger and transaction-cost modelling:** Extend the Supabase schema with an immutable `fills` table, support partial/full position sales in `/api/portfolio`, and deduct configurable bid-ask spread / slippage (bps) from paper executions.
3. **Combinatorial Purged Cross-Validation (CPCV) & Probability of Backtest Overfitting (PBO):** Extend `lib/evaluation.ts` to compute López de Prado's PBO across indicator weight grids to quantify how quickly threshold tuning on `computeSignal` overfits in-sample.
