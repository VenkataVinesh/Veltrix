from __future__ import annotations

from typing import Any

from app.services.market_service import get_ohlc
from app.core.logging import get_logger
from ml.feature_pipeline import LinearSignalModel, predict_signal_from_points

logger = get_logger("veltrix.ml.inference")


def predict_from_points(symbol: str, horizon: str, points: list[dict[str, Any]]) -> dict:
    result = predict_signal_from_points(symbol, horizon, points)
    return result.to_dict()


def predict(symbol: str, horizon: str, points: list[dict[str, Any]] | None = None) -> dict:
    if points is None:
        ohlc = get_ohlc(symbol, horizon)
        points = ohlc.get("points", []) if isinstance(ohlc, dict) else []

    if not points:
        logger.warning(f"No OHLC points available for prediction: {symbol} {horizon}")
        return {
            "symbol": symbol.upper(),
            "horizon": horizon,
            "direction": "HOLD",
            "bullish_probability": 0.5,
            "bearish_probability": 0.5,
            "neutral_probability": 1.0,
            "confidence": 0.0,
            "expected_return_pct": 0.0,
            "target_price": 0.0,
            "target_range_low": 0.0,
            "target_range_high": 0.0,
            "stop_price": 0.0,
            "volatility_pct": 0.0,
            "anomaly_score": 0.0,
            "model_version": "fallback",
            "feature_snapshot": {},
        }

    return predict_signal_from_points(symbol, horizon, points).to_dict()
