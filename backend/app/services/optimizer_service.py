from __future__ import annotations

from dataclasses import dataclass
from statistics import mean, pstdev
import math
import random

from app.services.market_service import get_ohlc
from app.services.market_providers import provider_orchestrator


@dataclass
class OptimizerInput:
    amount: float
    risk_tolerance: str
    horizon: str
    preferred_sectors: list[str]
    ethical: bool
    dividend_preference: bool
    volatility_tolerance: str


class OptimizerService:
    def __init__(self) -> None:
        self.universe = ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "AMZN", "META", "JNJ", "XOM", "JPM"]

    @staticmethod
    async def _returns(symbol: str) -> list[float]:
        provider_points = await provider_orchestrator.get_ohlc(symbol, "1d")
        if provider_points:
            points = provider_points
        else:
            fallback = await get_ohlc(symbol, timeframe="1d")
            points = fallback.get("points", [])
        closes = [float(item.get("c", 0.0)) for item in points if float(item.get("c", 0.0)) > 0]
        if len(closes) < 2:
            return []
        return [((closes[idx] / closes[idx - 1]) - 1.0) for idx in range(1, len(closes)) if closes[idx - 1] > 0]

    @staticmethod
    def _risk_target(label: str) -> float:
        value = label.strip().lower()
        if value in {"low", "conservative"}:
            return 0.10
        if value in {"high", "aggressive"}:
            return 0.30
        return 0.18

    async def optimize(self, payload: OptimizerInput) -> dict:
        symbols = self.universe
        quotes = await provider_orchestrator.get_quotes(symbols)
        quote_map = {quote["symbol"]: float(quote.get("price", 0.0)) for quote in quotes}

        returns_map: dict[str, list[float]] = {}
        for symbol in symbols:
            returns_map[symbol] = await self._returns(symbol)
        base_stats: dict[str, tuple[float, float]] = {}
        for symbol in symbols:
            sample = returns_map.get(symbol, [])
            if len(sample) < 5:
                base_stats[symbol] = (0.0, 0.15)
                continue
            base_stats[symbol] = (mean(sample) * 252, pstdev(sample) * math.sqrt(252))

        risk_target = self._risk_target(payload.risk_tolerance)

        simulations = []
        rng = random.Random(42)
        for _ in range(300):
            raw = [rng.random() for _ in symbols]
            total = sum(raw) or 1.0
            weights = [item / total for item in raw]

            expected = 0.0
            variance = 0.0
            for idx, symbol in enumerate(symbols):
                mu, sigma = base_stats.get(symbol, (0.0, 0.2))
                expected += weights[idx] * mu
                variance += (weights[idx] ** 2) * (sigma ** 2)
            vol = math.sqrt(max(variance, 0.0))
            sharpe = expected / vol if vol > 1e-9 else 0.0
            simulations.append({
                "weights": weights,
                "expected_return": expected,
                "volatility": vol,
                "sharpe": sharpe,
            })

        eligible = [item for item in simulations if item["volatility"] <= risk_target + 0.03]
        pool = eligible if eligible else simulations
        best = max(pool, key=lambda item: item["sharpe"])

        allocation = []
        for idx, symbol in enumerate(symbols):
            weight = best["weights"][idx]
            if weight < 0.02:
                continue
            price = quote_map.get(symbol, 0.0)
            notional = payload.amount * weight
            shares = (notional / price) if price > 0 else 0.0
            allocation.append({
                "symbol": symbol,
                "weight": round(weight, 4),
                "notional": round(notional, 2),
                "price": round(price, 2),
                "shares": round(shares, 4),
            })

        frontier = sorted(simulations, key=lambda item: item["volatility"])
        frontier_points = [
            {
                "risk": round(item["volatility"], 6),
                "return": round(item["expected_return"], 6),
                "sharpe": round(item["sharpe"], 6),
            }
            for item in frontier[::8]
        ]

        growth_projection = []
        annual_return = best["expected_return"]
        for year in range(1, 11):
            projected = payload.amount * ((1 + annual_return) ** year)
            growth_projection.append({"year": year, "value": round(projected, 2)})

        explanation = {
            "rationale": [
                "Selected assets maximize expected Sharpe under target volatility budget.",
                "Diversification balances broad market ETFs with high-conviction growth and defensive names.",
                "Risk budget anchored to user risk tolerance and annualized volatility target.",
            ],
            "macro_considerations": [
                "Includes benchmark exposure for regime resilience.",
                "Adds defensive sectors to reduce drawdown sensitivity.",
            ],
        }

        return {
            "input": {
                "amount": payload.amount,
                "risk_tolerance": payload.risk_tolerance,
                "horizon": payload.horizon,
                "preferred_sectors": payload.preferred_sectors,
                "ethical": payload.ethical,
                "dividend_preference": payload.dividend_preference,
                "volatility_tolerance": payload.volatility_tolerance,
            },
            "optimal_portfolio": allocation,
            "expected_return": round(best["expected_return"], 6),
            "expected_volatility": round(best["volatility"], 6),
            "expected_sharpe": round(best["sharpe"], 6),
            "efficient_frontier": frontier_points,
            "growth_projection": growth_projection,
            "explanation": explanation,
        }
