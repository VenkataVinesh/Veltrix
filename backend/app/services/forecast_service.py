"""Forecast engine built from live market data and technical signals."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
import statistics

from app.db.models import Prediction
from app.services.market_service import get_ohlc
from app.services.signals_engine import analyze_signal


DEFAULT_FORECAST_SYMBOLS = ["SPY", "QQQ", "AAPL", "NVDA", "MSFT", "AMZN"]

HORIZON_MULTIPLIERS = {
    "1d": 1.0,
    "7d": 2.8,
    "30d": 5.5,
}


class ForecastService:
    """Generate price forecasts from trend, volatility, and signal context."""

    def __init__(self, db, symbols: Optional[list[str]] = None) -> None:
        self.db = db
        self.symbols = [symbol.upper() for symbol in (symbols or DEFAULT_FORECAST_SYMBOLS)]

    def _daily_returns(self, closes: list[float]) -> list[float]:
        returns: list[float] = []
        for index in range(1, len(closes)):
            prev_close = closes[index - 1]
            current_close = closes[index]
            if prev_close > 0:
                returns.append((current_close - prev_close) / prev_close)
        return returns

    def _slope(self, closes: list[float]) -> float:
        if len(closes) < 3:
            return 0.0
        window = closes[-12:]
        x_values = list(range(len(window)))
        x_mean = statistics.mean(x_values)
        y_mean = statistics.mean(window)
        numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_values, window))
        denominator = sum((x - x_mean) ** 2 for x in x_values) or 1.0
        return numerator / denominator

    def _persist_prediction(self, symbol: str, horizon: str, value: float, confidence: float) -> Prediction:
        prediction = Prediction(
            symbol=symbol,
            horizon=horizon,
            value=value,
            confidence=confidence,
        )
        self.db.add(prediction)
        self.db.commit()
        self.db.refresh(prediction)
        return prediction

    def _build_forecast(self, symbol: str, horizon: str) -> Optional[dict]:
        ohlc = get_ohlc(symbol, "1d")
        points = ohlc.get("points", []) if isinstance(ohlc, dict) else []
        if len(points) < 10:
            return None

        closes = [float(point["c"]) for point in points if point.get("c") is not None]
        volumes = [float(point["v"]) for point in points if point.get("v") is not None]
        if len(closes) < 10 or len(volumes) < 10:
            return None

        current_price = closes[-1]
        returns = self._daily_returns(closes)
        recent_returns = returns[-10:] if len(returns) >= 10 else returns
        trend_rate = statistics.mean(recent_returns) if recent_returns else 0.0
        slope = self._slope(closes)
        signal = analyze_signal(symbol, "1d")

        volatility = statistics.stdev(recent_returns) if len(recent_returns) > 1 else 0.0
        volume_ratio = volumes[-1] / (statistics.mean(volumes[-20:]) if len(volumes) >= 20 else statistics.mean(volumes))
        horizon_multiplier = HORIZON_MULTIPLIERS.get(horizon, 1.0)

        signal_bias = 0.0
        confidence_bias = 0.15
        if signal:
            if signal.signal == "BUY":
                signal_bias += 0.012
            elif signal.signal == "SELL":
                signal_bias -= 0.012
            confidence_bias += min(0.25, signal.confidence * 0.2)

        projected_return = (trend_rate * 0.75) + (slope / current_price * 0.45 if current_price else 0.0) + signal_bias
        projected_return *= horizon_multiplier

        volatility_buffer = volatility * (0.55 + (horizon_multiplier / 10.0))
        target_price = current_price * (1 + projected_return)
        target_up = target_price * (1 + volatility_buffer)
        target_down = max(0.01, target_price * (1 - volatility_buffer))

        support = signal.support if signal else min(closes[-20:])
        resistance = signal.resistance if signal else max(closes[-20:])

        confidence = min(0.98, max(0.08, confidence_bias + min(0.35, abs(projected_return) * 9.0) + min(0.15, max(0.0, volume_ratio - 1.0) / 4.0)))
        direction = "BUY" if projected_return > 0.003 else "SELL" if projected_return < -0.003 else "HOLD"

        self._persist_prediction(symbol, horizon, round(target_price, 2), round(confidence, 3))

        return {
            "symbol": symbol,
            "horizon": horizon,
            "current_price": round(current_price, 2),
            "forecast_price": round(target_price, 2),
            "target_up": round(target_up, 2),
            "target_down": round(target_down, 2),
            "support": round(support, 2),
            "resistance": round(resistance, 2),
            "confidence": round(confidence, 3),
            "expected_return_pct": round(projected_return * 100, 2),
            "volatility_pct": round(volatility * 100, 2),
            "signal": direction,
            "signal_source": signal.signal if signal else "HOLD",
            "signal_confidence": round(signal.confidence, 3) if signal else 0.0,
            "timestamp": ohlc.get("generated_at") or datetime.utcnow().isoformat(),
            "source": ohlc.get("source", "market-data"),
        }

    def get_forecasts(self, horizons: list[str] | None = None) -> dict:
        horizons = horizons or ["1d", "7d", "30d"]
        items: list[dict] = []

        for symbol in self.symbols:
            for horizon in horizons:
                forecast = self._build_forecast(symbol, horizon)
                if forecast:
                    items.append(forecast)

        items.sort(key=lambda item: (item["confidence"], abs(item["expected_return_pct"])), reverse=True)

        bullish = sum(1 for item in items if item["signal"] == "BUY")
        bearish = sum(1 for item in items if item["signal"] == "SELL")
        neutral = sum(1 for item in items if item["signal"] == "HOLD")

        return {
            "source": "live-market-forecast",
            "generated_at": datetime.utcnow().isoformat(),
            "summary": {
                "bullish": bullish,
                "bearish": bearish,
                "neutral": neutral,
                "symbols": len(self.symbols),
                "forecasts": len(items),
            },
            "items": items,
        }