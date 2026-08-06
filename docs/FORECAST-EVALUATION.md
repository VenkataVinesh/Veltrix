# Forecast evaluation

Every model in this repo had to earn its place against held-out data. Two of
them did not, and were removed. This document records what was measured, how,
and what it means — including the parts that did not work.

All figures below are reproducible: `computeForecast` accepts
`{ allow, steps, noGarch }` precisely so these comparisons can be re-run
rather than believed.

## Method

- **Data** — daily bars from Twelve Data (up to 5,000 per symbol), and
  CoinGecko OHLC for crypto.
- **Protocol** — walk-forward, one step ahead. At each step the model sees
  only bars `0..i` and predicts `i+1`. Nothing downstream of `i` touches the
  feature row; that is the only thing separating this from a leaked backtest.
- **Direction** — a flat prediction expresses no direction, so it is excluded
  rather than scored as a coin flip. This matters: the naive model predicts
  exactly last price, so `sign(pred − last)` is always 0 for it.

## Result 1 — there is no directional edge

Baseline ensemble (drift+EWMA, AR(5), naive), 250 out-of-sample steps per
symbol:

| Symbol | Hit-rate | n |
|--------|---------:|--:|
| AAPL   | 51.2% | 250 |
| NVDA   | 50.0% | 250 |
| MSFT   | 52.4% | 250 |
| TSLA   | 48.0% | 250 |
| SPY    | 50.0% | 250 |
| AMZN   | 49.6% | 250 |
| **Pooled** | **50.2%** (753/1500) | **1500** |

Standard error at n=1500 is 1.29pp, so z = 0.16 against a fair coin. There is
no edge here, and the product says so on the page rather than burying it.

An earlier run at n=40 per symbol produced a much more exciting spread —
57.5% for AAPL, 40.0% for TSLA. That spread was entirely small-sample noise:
the standard error at n=40 is 7.9pp, wide enough to swallow every one of
those numbers. This is why the UI now prints the sample size and margin of
error next to the hit-rate, and states outright when a result cannot be
distinguished from chance.

## Result 2 — ridge and gradient boosting earned nothing

Ridge regression (11 engineered features, L2-regularised) and depth-1
gradient-boosted stumps were implemented in `lib/market/ml.ts`, added to the
ensemble, and measured against the same candles.

| Symbol | RMSE base → +ML | Hit-rate base → +ML | Latency base → +ML |
|--------|----------------:|--------------------:|-------------------:|
| AAPL | 7.12 → 7.11 | 57.5% → 52.5% | 37ms → 4548ms |
| NVDA | 5.05 → 5.02 | 52.5% → 50.0% | 15ms → 4818ms |
| MSFT | 12.86 → 12.88 | 47.5% → 50.0% | 11ms → 4868ms |
| TSLA | 14.89 → 14.76 | 40.0% → 50.0% | 12ms → 4559ms |
| SPY  | 6.97 → 6.98 | 42.5% → 47.5% | 11ms → 4557ms |

Three observations, none of which support shipping them:

1. **RMSE does not move.** Changes are sub-1% and mixed in sign.
2. **Hit-rates collapse toward 50%.** TSLA's 40% → 50% looks like a rescue but
   is the opposite — averaging five predictors, three of which are close to
   "predict last price", shrinks the ensemble toward no signal. That is
   regression to the mean, not learned skill.
3. **123–443× slower** across these symbols (AAPL's 37ms baseline includes
   JIT warm-up; the steady-state ratios are the higher ones). Each
   walk-forward step refits both models from scratch, giving ~4.5s per
   forecast. That is unacceptable in a serverless route.

The honest conclusion is the one the literature already predicts: daily price
direction is close to a random walk, and eleven features on a few hundred
noisy bars will not change that. The code is retained and reachable via
`allow: ALL_MODELS` so the negative result stays verifiable.

## Result 3 — GARCH bands were a real improvement

Unlike direction, volatility *is* predictable, because it clusters. GARCH(1,1)
is scored on the metric that applies to it — calibration of the 95% interval,
not hit-rate. 1,200 held-out 5-day forecasts:

| | Coverage (target 95%) | Mean band width |
|---|---:|---:|
| GARCH(1,1) | **94.75%** | 17.84% of price |
| EWMA (previous) | 91.67% | 16.23% of price |

EWMA was **overconfident** — the dangerous direction. Its "95%" band let the
price escape 8.3% of the time, roughly double the advertised 5%. GARCH lands
within 0.25pp of nominal and beat EWMA on all six symbols individually. It
costs about 10% wider bands, which is the correct price for a band that means
what it says.

GARCH is fit once per forecast, not per walk-forward step, so it adds no
meaningful latency. It ships.

## What this means for the product

The forecast's value is in the **band**, not the midline. The midline is
roughly a random walk and is labelled as such. The band is calibrated and
measured. Any product framing that reverses this would be a lie about
what the maths supports.
