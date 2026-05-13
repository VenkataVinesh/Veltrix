from __future__ import annotations

from dataclasses import dataclass
from statistics import mean, pstdev
import math

from sqlalchemy.orm import Session

from app.db.models import Portfolio, Position
from app.services.market_providers import provider_orchestrator
from app.services.market_service import get_ohlc


@dataclass
class PortfolioPoint:
    symbol: str
    quantity: float
    avg_price: float
    current_price: float


def _safe_div(numerator: float, denominator: float) -> float:
    if abs(denominator) < 1e-9:
        return 0.0
    return numerator / denominator


def _extract_returns(points: list[dict]) -> list[float]:
    closes = [float(p.get("c", 0.0)) for p in points if float(p.get("c", 0.0)) > 0]
    if len(closes) < 2:
        return []
    out: list[float] = []
    for idx in range(1, len(closes)):
        prev = closes[idx - 1]
        curr = closes[idx]
        if prev > 0:
            out.append((curr / prev) - 1.0)
    return out


class AnalyticsService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _get_positions(self, user_id: int) -> list[Position]:
        portfolios = self.db.query(Portfolio).filter(Portfolio.user_id == user_id).all()
        portfolio_ids = [portfolio.id for portfolio in portfolios]
        if not portfolio_ids:
            return []
        return self.db.query(Position).filter(Position.portfolio_id.in_(portfolio_ids)).all()

    async def compute_analytics(self, user_id: int) -> dict:
        positions = self._get_positions(user_id)
        if not positions:
            return {
                "total_equity": 0.0,
                "total_invested": 0.0,
                "alpha": 0.0,
                "beta": 0.0,
                "sharpe": 0.0,
                "sortino": 0.0,
                "information_ratio": 0.0,
                "rolling_volatility": [],
                "rolling_returns": [],
                "sector_exposure": [],
                "correlation_matrix": [],
                "performance_attribution": [],
            }

        symbols = sorted({position.symbol.upper() for position in positions})
        quotes = await provider_orchestrator.get_quotes(symbols)
        quote_map = {item["symbol"]: float(item.get("price", 0.0)) for item in quotes}

        points: list[PortfolioPoint] = []
        for position in positions:
            current_price = quote_map.get(position.symbol.upper(), float(position.avg_price))
            points.append(
                PortfolioPoint(
                    symbol=position.symbol.upper(),
                    quantity=float(position.quantity),
                    avg_price=float(position.avg_price),
                    current_price=current_price,
                )
            )

        total_equity = sum(point.quantity * point.current_price for point in points)
        total_invested = sum(point.quantity * point.avg_price for point in points)
        total_return = _safe_div(total_equity - total_invested, total_invested)

        symbol_returns: dict[str, list[float]] = {}
        for symbol in symbols:
            provider_points = await provider_orchestrator.get_ohlc(symbol, "1d")
            if provider_points:
                symbol_returns[symbol] = _extract_returns(provider_points)
            else:
                ohlc = await get_ohlc(symbol, timeframe="1d")
                symbol_returns[symbol] = _extract_returns(list(ohlc.get("points", [])))

        benchmark_points = await provider_orchestrator.get_ohlc("SPY", "1d")
        benchmark = _extract_returns(benchmark_points) if benchmark_points else _extract_returns(list((await get_ohlc("SPY", timeframe="1d")).get("points", [])))

        portfolio_daily_returns: list[float] = []
        min_len = min([len(ret) for ret in symbol_returns.values() if ret] + [len(benchmark)] or [0])
        if min_len > 5:
            weights = {}
            for point in points:
                market_value = point.quantity * point.current_price
                weights[point.symbol] = _safe_div(market_value, total_equity)

            for idx in range(min_len):
                weighted = 0.0
                for symbol, returns in symbol_returns.items():
                    if len(returns) >= min_len:
                        weighted += weights.get(symbol, 0.0) * returns[-min_len + idx]
                portfolio_daily_returns.append(weighted)

        portfolio_mean = mean(portfolio_daily_returns) if portfolio_daily_returns else 0.0
        benchmark_mean = mean(benchmark[-len(portfolio_daily_returns):]) if portfolio_daily_returns and benchmark else 0.0
        portfolio_std = pstdev(portfolio_daily_returns) if len(portfolio_daily_returns) > 1 else 0.0

        downside = [item for item in portfolio_daily_returns if item < 0]
        downside_std = pstdev(downside) if len(downside) > 1 else 0.0

        cov = 0.0
        bench_slice = benchmark[-len(portfolio_daily_returns):] if portfolio_daily_returns and benchmark else []
        if len(bench_slice) == len(portfolio_daily_returns) and len(bench_slice) > 1:
            px = portfolio_daily_returns
            bx = bench_slice
            p_mean = mean(px)
            b_mean = mean(bx)
            cov = sum((px[idx] - p_mean) * (bx[idx] - b_mean) for idx in range(len(px))) / len(px)
            bench_var = pstdev(bx) ** 2 if len(bx) > 1 else 0.0
            beta = _safe_div(cov, bench_var)
        else:
            beta = 0.0

        alpha = portfolio_mean - (beta * benchmark_mean)
        sharpe = _safe_div(portfolio_mean, portfolio_std)
        sortino = _safe_div(portfolio_mean, downside_std)
        tracking_error = pstdev([portfolio_daily_returns[i] - bench_slice[i] for i in range(len(portfolio_daily_returns))]) if len(bench_slice) > 1 else 0.0
        information_ratio = _safe_div(portfolio_mean - benchmark_mean, tracking_error)

        rolling_volatility = []
        rolling_returns = []
        window = 20
        if len(portfolio_daily_returns) >= window:
            for idx in range(window, len(portfolio_daily_returns) + 1):
                segment = portfolio_daily_returns[idx - window:idx]
                rolling_volatility.append(round(pstdev(segment) * math.sqrt(252), 6))
                rolling_returns.append(round(sum(segment), 6))

        sector_buckets = {
            "technology": ["AAPL", "MSFT", "NVDA", "META", "GOOGL"],
            "consumer": ["AMZN", "TSLA", "HD", "MCD"],
            "finance": ["JPM", "GS", "MS"],
            "energy": ["XOM", "CVX"],
            "healthcare": ["JNJ", "PFE", "UNH"],
        }
        sector_exposure_map: dict[str, float] = {}
        for point in points:
            mv = point.quantity * point.current_price
            sector = "other"
            for name, universe in sector_buckets.items():
                if point.symbol in universe:
                    sector = name
                    break
            sector_exposure_map[sector] = sector_exposure_map.get(sector, 0.0) + mv

        sector_exposure = [
            {"sector": sector, "weight": round(_safe_div(value, total_equity), 6)}
            for sector, value in sorted(sector_exposure_map.items(), key=lambda item: item[1], reverse=True)
        ]

        performance_attribution = []
        for point in points:
            invested = point.quantity * point.avg_price
            pnl = (point.current_price - point.avg_price) * point.quantity
            performance_attribution.append(
                {
                    "symbol": point.symbol,
                    "weight": round(_safe_div(point.quantity * point.current_price, total_equity), 6),
                    "pnl": round(pnl, 2),
                    "return_pct": round(_safe_div(pnl, invested) * 100, 4),
                }
            )

        correlations = []
        ordered_symbols = sorted(symbol_returns.keys())
        for left in ordered_symbols:
            row = []
            for right in ordered_symbols:
                a = symbol_returns.get(left, [])
                b = symbol_returns.get(right, [])
                size = min(len(a), len(b))
                if size < 3:
                    row.append(0.0)
                    continue
                a = a[-size:]
                b = b[-size:]
                am = mean(a)
                bm = mean(b)
                covar = sum((a[i] - am) * (b[i] - bm) for i in range(size)) / size
                av = pstdev(a)
                bv = pstdev(b)
                row.append(round(_safe_div(covar, av * bv), 4) if av and bv else 0.0)
            correlations.append({"symbol": left, "values": row})

        return {
            "total_equity": round(total_equity, 2),
            "total_invested": round(total_invested, 2),
            "total_return_pct": round(total_return * 100, 4),
            "alpha": round(alpha, 6),
            "beta": round(beta, 6),
            "sharpe": round(sharpe, 6),
            "sortino": round(sortino, 6),
            "information_ratio": round(information_ratio, 6),
            "rolling_volatility": rolling_volatility,
            "rolling_returns": rolling_returns,
            "sector_exposure": sector_exposure,
            "correlation_matrix": correlations,
            "performance_attribution": performance_attribution,
        }
