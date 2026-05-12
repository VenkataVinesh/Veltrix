from __future__ import annotations

from statistics import mean, pstdev
import math

from sqlalchemy.orm import Session

from app.db.models import Portfolio, Position
from app.services.market_service import get_ohlc
from app.services.market_providers import provider_orchestrator


class RiskService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _positions(self, user_id: int) -> list[Position]:
        portfolios = self.db.query(Portfolio).filter(Portfolio.user_id == user_id).all()
        if not portfolios:
            return []
        ids = [item.id for item in portfolios]
        return self.db.query(Position).filter(Position.portfolio_id.in_(ids)).all()

    @staticmethod
    def _returns(points: list[dict]) -> list[float]:
        closes = [float(p.get("c", 0.0)) for p in points if float(p.get("c", 0.0)) > 0]
        if len(closes) < 2:
            return []
        return [((closes[idx] / closes[idx - 1]) - 1.0) for idx in range(1, len(closes)) if closes[idx - 1] > 0]

    async def compute_risk(self, user_id: int, confidence: float = 0.95) -> dict:
        positions = self._positions(user_id)
        if not positions:
            return {
                "var": 0.0,
                "expected_shortfall": 0.0,
                "max_drawdown": 0.0,
                "concentration_risk": 0.0,
                "liquidity_risk": 0.0,
                "stress_tests": [],
                "scenario_engine": [],
            }

        symbols = sorted({position.symbol.upper() for position in positions})
        quotes = await provider_orchestrator.get_quotes(symbols)
        quote_map = {quote["symbol"]: float(quote.get("price", 0.0)) for quote in quotes}

        values = []
        invested_total = 0.0
        for position in positions:
            price = quote_map.get(position.symbol.upper(), float(position.avg_price))
            mv = float(position.quantity) * float(price)
            invested = float(position.quantity) * float(position.avg_price)
            values.append((position.symbol.upper(), mv, invested))
            invested_total += invested

        equity = sum(item[1] for item in values)
        if equity <= 0:
            equity = max(invested_total, 1.0)

        portfolio_returns: list[float] = []
        for symbol, value, _ in values:
            provider_points = await provider_orchestrator.get_ohlc(symbol, "1d")
            if provider_points:
                returns = self._returns(provider_points)
            else:
                ohlc = get_ohlc(symbol, timeframe="1d")
                returns = self._returns(list(ohlc.get("points", [])))
            weight = value / equity if equity else 0.0
            if not portfolio_returns:
                portfolio_returns = [weight * r for r in returns]
                continue
            size = min(len(portfolio_returns), len(returns))
            if size == 0:
                continue
            portfolio_returns = [portfolio_returns[-size + idx] + weight * returns[-size + idx] for idx in range(size)]

        if not portfolio_returns:
            portfolio_returns = [0.0]

        sorted_returns = sorted(portfolio_returns)
        var_index = max(0, min(len(sorted_returns) - 1, int((1 - confidence) * len(sorted_returns))))
        var_return = sorted_returns[var_index]
        var_value = abs(var_return) * equity

        tail = [item for item in sorted_returns if item <= var_return]
        expected_shortfall = abs(mean(tail)) * equity if tail else var_value

        running = 1.0
        peak = 1.0
        drawdowns = []
        for ret in portfolio_returns:
            running *= (1 + ret)
            peak = max(peak, running)
            drawdowns.append((peak - running) / peak if peak else 0.0)
        max_drawdown = max(drawdowns) if drawdowns else 0.0

        weights = [value / equity for _, value, _ in values]
        concentration_risk = sum(item * item for item in weights)

        liquidity_proxy = sum((1.0 / (1.0 + math.sqrt(max(1.0, val)))) * w for w, (_, val, _) in zip(weights, values))

        scenario_templates = [
            ("Fed shock", -0.03),
            ("CPI surprise", -0.02),
            ("Recession simulation", -0.08),
            ("Earnings crash", -0.05),
            ("Volatility spike", -0.04),
            ("Flash crash", -0.12),
        ]

        scenario_engine = []
        for name, shock in scenario_templates:
            shocked = equity * (1.0 + shock)
            pnl = shocked - equity
            scenario_engine.append({
                "name": name,
                "shock_pct": round(shock * 100, 2),
                "projected_value": round(shocked, 2),
                "projected_pnl": round(pnl, 2),
            })

        stress_tests = [
            {"metric": "VaR", "value": round(var_value, 2)},
            {"metric": "Expected Shortfall", "value": round(expected_shortfall, 2)},
            {"metric": "Max Drawdown %", "value": round(max_drawdown * 100, 4)},
            {"metric": "Concentration HHI", "value": round(concentration_risk, 6)},
            {"metric": "Liquidity Risk Proxy", "value": round(liquidity_proxy, 6)},
            {"metric": "Annualized Volatility %", "value": round((pstdev(portfolio_returns) * math.sqrt(252)) * 100 if len(portfolio_returns) > 1 else 0.0, 4)},
        ]

        return {
            "equity": round(equity, 2),
            "var": round(var_value, 2),
            "expected_shortfall": round(expected_shortfall, 2),
            "max_drawdown": round(max_drawdown, 6),
            "concentration_risk": round(concentration_risk, 6),
            "liquidity_risk": round(liquidity_proxy, 6),
            "stress_tests": stress_tests,
            "scenario_engine": scenario_engine,
        }
