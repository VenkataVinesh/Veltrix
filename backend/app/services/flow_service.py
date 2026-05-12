"""Institutional flow detection built from live price and volume data."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
import statistics

from app.services.market_service import get_ohlc


DEFAULT_FLOW_SYMBOLS = [
    "AAPL",
    "NVDA",
    "MSFT",
    "AMZN",
    "TSLA",
    "META",
    "QQQ",
    "SPY",
    "JPM",
    "UNH",
    "XOM",
    "AMD",
]


class FlowService:
    """Detect institutional-style flow candidates from market activity."""

    def __init__(self, symbols: Optional[list[str]] = None) -> None:
        self.symbols = [symbol.upper() for symbol in (symbols or DEFAULT_FLOW_SYMBOLS)]

    def _format_amount(self, notional: float) -> str:
        if notional >= 1_000_000_000:
            return f"{notional / 1_000_000_000:.1f}B"
        if notional >= 1_000_000:
            return f"{notional / 1_000_000:.1f}M"
        if notional >= 1_000:
            return f"{notional / 1_000:.1f}K"
        return f"{notional:.0f}"

    def _score_flow(self, closes: list[float], volumes: list[float]) -> dict:
        current_price = closes[-1]
        previous_price = closes[-2] if len(closes) > 1 else current_price
        price_change_pct = ((current_price - previous_price) / previous_price * 100) if previous_price else 0.0

        avg_volume = statistics.mean(volumes[-20:]) if len(volumes) >= 20 else statistics.mean(volumes)
        current_volume = volumes[-1]
        volume_ratio = current_volume / avg_volume if avg_volume > 0 else 1.0

        recent_returns = []
        for index in range(1, min(len(closes), 6)):
            prior = closes[-index - 1]
            current = closes[-index]
            if prior > 0:
                recent_returns.append((current - prior) / prior)
        momentum = statistics.mean(recent_returns) if recent_returns else 0.0

        flow_score = (volume_ratio - 1.0) * 0.65 + (momentum * 12.0) + (price_change_pct / 4.0)
        if flow_score > 0.25:
            side = "BUY"
            label = "Accumulation"
        elif flow_score < -0.25:
            side = "SELL"
            label = "Distribution"
        else:
            side = "NEUTRAL"
            label = "Mixed flow"

        confidence = min(0.99, max(0.05, abs(flow_score) / 2.0 + min(0.35, max(0.0, volume_ratio - 1.0) / 4.0)))
        notional = current_price * current_volume

        return {
            "side": side,
            "label": label,
            "price": round(current_price, 2),
            "price_change_pct": round(price_change_pct, 2),
            "volume_ratio": round(volume_ratio, 2),
            "current_volume": round(current_volume, 2),
            "avg_volume": round(avg_volume, 2),
            "notional": round(notional, 2),
            "amount": self._format_amount(notional),
            "confidence": round(confidence, 3),
        }

    def get_flow_feed(self, timeframe: str = "1d", limit: int = 6) -> dict:
        """Return the strongest flow candidates across the configured symbol set."""
        items: list[dict] = []

        for symbol in self.symbols:
            ohlc = get_ohlc(symbol, timeframe)
            points = ohlc.get("points", []) if isinstance(ohlc, dict) else []
            if len(points) < 10:
                continue

            closes = [float(point["c"]) for point in points if point.get("c") is not None]
            volumes = [float(point["v"]) for point in points if point.get("v") is not None]
            if len(closes) < 2 or len(volumes) < 2:
                continue

            metrics = self._score_flow(closes, volumes)
            if metrics["side"] == "NEUTRAL" and metrics["confidence"] < 0.25:
                continue

            items.append(
                {
                    "symbol": symbol,
                    "action": metrics["side"],
                    "label": metrics["label"],
                    "amount": metrics["amount"],
                    "notional": metrics["notional"],
                    "volume_ratio": metrics["volume_ratio"],
                    "confidence": metrics["confidence"],
                    "price": metrics["price"],
                    "price_change_pct": metrics["price_change_pct"],
                    "timestamp": ohlc.get("generated_at") or datetime.utcnow().isoformat(),
                    "source": ohlc.get("source", "market-data"),
                }
            )

        items.sort(key=lambda item: (item["confidence"], item["notional"]), reverse=True)
        items = items[:limit]

        buy_flow = sum(item["notional"] for item in items if item["action"] == "BUY")
        sell_flow = sum(item["notional"] for item in items if item["action"] == "SELL")
        net_flow = buy_flow - sell_flow

        return {
            "source": "live-market-analysis" if items else "fallback-analysis",
            "generated_at": datetime.utcnow().isoformat(),
            "summary": {
                "buy_flow": round(buy_flow, 2),
                "sell_flow": round(sell_flow, 2),
                "net_flow": round(net_flow, 2),
                "tracked_symbols": len(self.symbols),
                "signals": len(items),
            },
            "items": items,
        }