# Forecast evaluation

Every model in this repo had to earn its place against held-out data. Six candidate extensions did not, and were left out of the production ensemble. This document records what was measured, how, and what it means — including the parts that did not work.

All figures below are reproducible:
- `computeForecast` accepts `{ allow, steps, noGarch, volModel }` so every comparison can be re-run rather than believed.
- `npm run evaluate` runs the full offline benchmark (`scripts/evaluate.ts`) against the pinned 3,600-bar daily equity fixture in `tests/fixtures/equities-daily-2026-11-04.json` and writes the machine-readable report to `docs/EVALUATION-BENCHMARK.json`.

## Method

- **Data** — daily bars from Twelve Data (up to 5,000 per symbol) for the initial production benchmark, pinned offline daily OHLCV fixtures (`tests/fixtures/equities-daily-2026-11-04.json`, 600 trading days × 6 symbols through 2026-11-04) for deterministic offline reproduction, and CoinGecko OHLC for crypto.
- **Protocol** — walk-forward, one step ahead (`lib/evaluation.ts`). At each step `i`, the model receives a defensive copy of bars `0..i` (with optional embargo purging `embargoBars` for multi-bar horizons) and predicts `i+1`. Nothing downstream of `i` touches the feature row, scaler, or volatility filter; `tests/evaluation.test.ts` enforces strict prefix invariance and verifies that a 1-bar lookahead leak is caught immediately.
- **Direction** — a flat prediction expresses no direction, so it is excluded rather than scored as a coin flip. This matters: the naive model predicts exactly last price, so `sign(pred − last)` is always 0 for it.

## Result 1 — there is no directional edge

Baseline ensemble (drift+EWMA, AR(5), naive), 250 out-of-sample steps per symbol:

| Symbol | Hit-rate | n |
|--------|---------:|--:|
| AAPL   | 51.2% | 250 |
| NVDA   | 50.0% | 250 |
| MSFT   | 52.4% | 250 |
| TSLA   | 48.0% | 250 |
| SPY    | 50.0% | 250 |
| AMZN   | 49.6% | 250 |
| **Pooled** | **50.2%** (753/1500) | **1500** |

Standard error at n=1500 is 1.29pp, so z = 0.16 against a fair coin. There is no edge here, and the product says so on the page rather than burying it.

An earlier run at n=40 per symbol produced a much more exciting spread — 57.5% for AAPL, 40.0% for TSLA. That spread was entirely small-sample noise: the standard error at n=40 is 7.9pp, wide enough to swallow every one of those numbers. This is why the UI now prints the sample size and margin of error next to the hit-rate, and states outright when a result cannot be distinguished from chance.

## Result 2 — ridge and gradient boosting earned nothing

Ridge regression (11 engineered features, L2-regularised) and depth-1 gradient-boosted stumps were implemented in `lib/market/ml.ts`, added to the ensemble, and measured against the same candles.

| Symbol | RMSE base → +ML | Hit-rate base → +ML | Latency base → +ML |
|--------|----------------:|--------------------:|-------------------:|
| AAPL | 7.12 → 7.11 | 57.5% → 52.5% | 37ms → 4548ms |
| NVDA | 5.05 → 5.02 | 52.5% → 50.0% | 15ms → 4818ms |
| MSFT | 12.86 → 12.88 | 47.5% → 50.0% | 11ms → 4868ms |
| TSLA | 14.89 → 14.76 | 40.0% → 50.0% | 12ms → 4559ms |
| SPY  | 6.97 → 6.98 | 42.5% → 47.5% | 11ms → 4557ms |

Three observations, none of which support shipping them:

1. **RMSE does not move.** Changes are sub-1% and mixed in sign.
2. **Hit-rates collapse toward 50%.** TSLA's 40% → 50% looks like a rescue but is the opposite — averaging five predictors, three of which are close to "predict last price", shrinks the ensemble toward no signal. That is regression to the mean, not learned skill.
3. **123–443× slower** across these symbols (AAPL's 37ms baseline includes JIT warm-up; the steady-state ratios are the higher ones). Each walk-forward step refits both models from scratch, giving ~4.5s per forecast. That is unacceptable in a serverless route.

The honest conclusion is the one the literature already predicts: daily price direction is close to a random walk, and eleven features on a few hundred noisy bars will not change that. The code is retained and reachable via `allow: ALL_MODELS` so the negative result stays verifiable.

## Result 3 — GARCH bands were a real improvement

Unlike direction, volatility *is* predictable, because it clusters. GARCH(1,1) is scored on the metric that applies to it — calibration of the 95% interval, not hit-rate. 1,200 held-out 5-day forecasts:

| | Coverage (target 95%) | Mean band width | Kupiec POF LR (`p`-value) |
|---|---:|---:|---:|
| GARCH(1,1) | **94.75%** (1,137/1,200) | 17.84% of price | **0.16** (`p = 0.693` — calibrated) |
| EWMA (previous) | 91.67% (1,100/1,200) | 16.23% of price | **24.93** (`p < 0.0001` — rejected) |

EWMA was **overconfident** — the dangerous direction. Its "95%" band let the price escape 8.3% of the time, roughly double the advertised 5%, and fails Kupiec's (1995) Proportion of Failures likelihood-ratio test (`LR_POF = 24.93 > 3.84`). GARCH lands within 0.25pp of nominal (`LR_POF = 0.16, p = 0.693`), passes the Kupiec test cleanly, and beat EWMA on all six symbols individually. It costs about 10% wider bands, which is the correct price for a band that means what it says.

GARCH is fit once per forecast, not per walk-forward step, so it adds under 1ms of latency. It ships.

---

## Result 4 — Pre-registered expansion benchmark (`npm run evaluate`)

To test whether stronger structural baselines, state-space filtering, asymmetric volatility, high-low range estimators, or distribution-free conformal calibration could improve either the midline or the interval band, we pre-registered the following protocol on the pinned offline dataset (`tests/fixtures/equities-daily-2026-11-04.json`):

### Pre-registered protocol

1. **Fixed dataset:** `AAPL`, `NVDA`, `MSFT`, `TSLA`, `SPY`, `AMZN` — 600 daily OHLCV bars per symbol through `2026-11-04` (3,600 bars total).
2. **Directional decision rule:** Test $M = 7$ directional models over 250 out-of-sample walk-forward steps per symbol (1,500 calls total). Keep a candidate in `BASELINE_MODELS` *only if* its pooled hit-rate exceeds **52.0%** with a two-sided **Holm-Bonferroni FWER-adjusted** $p < 0.05$ and mean latency under **50 ms** per symbol.
3. **Volatility / interval decision rule:** Test 5 interval models over 200 held-out 5-day forecasts per symbol (1,200 forecasts total) at a 95% nominal target ($\alpha = 0.05$). Keep a candidate over `GARCH(1,1)` *only if* it passes the **Kupiec (1995) POF test** ($\text{LR}_{\text{POF}} \le 3.8415, p \ge 0.05$) and improves both the **Winkler (1972) proper interval score** and **Patton (2011) QLIKE volatility loss** within 50 ms per forecast.

### 4a. Directional models (1,500 walk-forward calls on pinned fixture)

| Model | Pooled hit-rate | 95% CI | z-stat | Raw `p` | Holm-Bonferroni `p` | Latency / symbol | Verdict |
|---|---:|---:|---:|---:|---:|---:|---|
| `baseline_ensemble` (`drift_ewma` + `ar` + `naive`) | **49.00%** (735/1500) | `[46.5%, 51.5%]` | -0.77 | 0.4413 | **1.0000** | 48.6 ms | **KEEP (baseline)** |
| `drift_ewma` (shrunk 0.5×) | **48.27%** (724/1500) | `[45.7%, 50.8%]` | -1.34 | 0.1802 | **1.0000** | 3.0 ms | **KEEP (baseline)** |
| `ar` (AR(5) via OLS) | **50.33%** (755/1500) | `[47.8%, 52.9%]` | +0.26 | 0.7949 | **1.0000** | 18.0 ms | **KEEP (baseline)** |
| `seasonal_naive` (5-day weekly return lag) | **50.93%** (764/1500) | `[48.4%, 53.5%]` | +0.72 | 0.4715 | **1.0000** | 2.9 ms | **CUT** (null after Holm correction) |
| `kalman` (1D local-level return filter) | **48.33%** (725/1500) | `[45.8%, 50.9%]` | -1.29 | 0.1971 | **1.0000** | 3.3 ms | **CUT** (no edge) |
| `ridge` (11 features, L2 = 1.0) | **49.13%** (737/1500) | `[46.6%, 51.7%]` | -0.67 | 0.5029 | **1.0000** | 286.0 ms | **CUT** (no edge, 6× slower) |
| `gbm` (25 depth-1 stumps, lr = 0.08) | **48.93%** (734/1500) | `[46.4%, 51.5%]` | -0.83 | 0.4065 | **1.0000** | 6,496.5 ms | **CUT** (no edge, 134× slower) |

Every single directional model has a 95% confidence interval spanning 50.0% and a Holm-Bonferroni adjusted $p$-value of **1.00**. None beats a coin flip.

### 4b. Volatility & 95% interval calibration models (1,200 held-out 5-day forecasts on pinned fixture)

| Model | Coverage (target 95%) | Mean width | Winkler score (lower = better) | QLIKE loss (lower = better) | Kupiec $\text{LR}_{\text{POF}}$ (`p`-value) | Latency / fc | Verdict |
|---|---:|---:|---:|---:|---:|---:|---|
| **GARCH(1,1)** | **94.75%** (1137/1200) | 18.07% | 26.54% | **-5.2448** | **0.16** (`p = 0.6934` — pass) | 0.76 ms | **KEEP (ships)** |
| **GJR-GARCH(1,1,1)** | **94.67%** (1136/1200) | 18.13% | 26.67% | -5.2356 | **0.28** (`p = 0.6000` — pass) | 1.93 ms | **CUT** (ties GARCH at 2.5× cost) |
| **RiskMetrics EWMA** ($\lambda = 0.94$) | 93.33% (1120/1200) | 17.20% | 26.90% | -5.2437 | **6.38** (`p = 0.0115` — **reject**) | 0.02 ms | **CUT** (overconfident) |
| **GARCH(1,1) + Split-Conformal** | 93.08% (1117/1200) | 18.23% | 27.54% | -5.2448 | **8.33** (`p = 0.0039` — **reject**) | 0.80 ms | **CUT** (regime non-exchangeability) |
| **Parkinson HAR-RV** (1d/5d/22d range) | 91.67% (1100/1200) | 14.98% | 26.33% | -5.2363 | **23.59** (`p < 0.0001` — **reject**) | 0.33 ms | **CUT** (misses overnight gap risk) |

### Model-by-model experiment cards

#### GJR-GARCH(1,1,1) (Glosten-Jagannathan-Runkle asymmetric volatility)
- **Hypothesis:** Adding an asymmetric leverage term $\gamma \mathbb{I}_{r_{t-1} < 0} r_{t-1}^2$ to capture sharper volatility spikes after negative equity returns would improve 5-day calibration and QLIKE over symmetric GARCH(1,1).
- **Protocol:** 6 symbols × 200 out-of-sample 5-day forecasts (`n = 1,200`), grid-fitted with variance targeting and stationarity constraint $\alpha + \frac{1}{2}\gamma + \beta < 0.995$.
- **Result:** Coverage = **94.67%** (1,136/1,200, Kupiec $\text{LR}_{\text{POF}} = 0.28, p = 0.60$), Winkler score = 26.67% vs 26.54% for GARCH(1,1), QLIKE = -5.2356 vs -5.2448.
- **Cost:** 1.93 ms per forecast vs 0.76 ms for GARCH(1,1) (2.5× slower due to the 3D $(\alpha, \gamma, \beta)$ grid).
- **Decision:** **CUT from default serving (retained via `volModel: 'gjr_garch'`)** — validates that GARCH-family mean reversion is what fixes calibration, but symmetric GARCH(1,1) already achieves 94.75% coverage with better QLIKE and lower latency.

#### Parkinson HAR-RV (Corsi 2009 Heterogeneous Autoregressive Range Volatility)
- **Hypothesis:** High-low intraday range ($\sigma_{\text{P}}^2 = (\ln(H/L))^2 / (4 \ln 2)$) is theoretically 5× more efficient than close-to-close squared returns on continuous diffusion paths; a 1d/5d/22d HAR cascade should tighten the bands.
- **Protocol:** 6 symbols × 200 held-out 5-day forecasts (`n = 1,200`), Ridge-regularised OLS on log range-variance blended with close-to-close variance.
- **Result:** Coverage = **91.67%** (1,100/1,200), mean band width = 14.98%, Kupiec $\text{LR}_{\text{POF}} = 23.59$ ($p < 0.0001$ — rejected).
- **Cost:** 0.33 ms per forecast.
- **Decision:** **CUT** — intraday high-low range systematically underestimates multi-day equity variance because earnings announcements and macro shocks occur as overnight close-to-open jumps outside regular trading hours. Narrower bands (14.98%) caused a 8.33% violation rate against a 5% target.

#### Split-Conformal GARCH Intervals (`garch_conformal`)
- **Hypothesis:** Replacing the Gaussian quantile ($z_{0.95} = 1.96$) with the empirical $(1-\alpha)(1+1/K)$ quantile of trailing GARCH-studentised 5-day residuals would account for fat tails without parametric assumptions.
- **Protocol:** 6 symbols × 200 held-out 5-day forecasts (`n = 1,200`), trailing 160-step causal calibration window.
- **Result:** Coverage = **93.08%** (1,117/1,200), Winkler score = 27.54%, Kupiec $\text{LR}_{\text{POF}} = 8.33$ ($p = 0.0039$ — rejected).
- **Cost:** 0.80 ms per forecast.
- **Decision:** **CUT** — overlapping 5-day returns inside a 160-bar calibration window contain only ~32 independent 5-day blocks. When the market shifts from a calm regime into a volatile one, trailing residual quantiles lag the regime shift and under-cover.

#### Kalman State-Space Filter (`kalman`) & Seasonal-Naive (`seasonal_naive`)
- **Hypothesis:** A 1D local-level Kalman filter isolating latent drift from observation noise, or a 5-day weekly persistence baseline, might outperform sample drift on directional calls.
- **Protocol:** 6 symbols × 250 out-of-sample 1-step calls (`n = 1,500`), Holm-Bonferroni corrected across $M = 7$ models.
- **Result:** `kalman` hit-rate = **48.33%** (95% CI `[45.8%, 50.9%]`, $z = -1.29, p_{\text{Holm}} = 1.00$); `seasonal_naive` hit-rate = **50.93%** (95% CI `[48.4%, 53.5%]`, $z = +0.72, p_{\text{Holm}} = 1.00$).
- **Cost:** ~3 ms per 250-step backtest.
- **Decision:** **CUT** — neither is distinguishable from a fair coin.

## What this means for the product

The forecast's value is in the **band**, not the midline. The midline is roughly a random walk across all seven directional models tested (`p_Holm = 1.00`) and is labelled as such. The GARCH(1,1) band is calibrated (`94.75%` empirical vs `95%` nominal, Kupiec $p = 0.693$) and measured. Any product framing that reverses this would be a lie about what the maths supports.
