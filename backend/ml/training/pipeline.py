from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Iterable

from app.core.logging import get_logger
from app.services.market_service import get_ohlc
from ml.feature_pipeline import (
    DEFAULT_FEATURE_COLUMNS,
    MODEL_ARTIFACT_PATH,
    MarketFeaturePipeline,
    LinearSignalModel,
    build_training_dataset,
    train_signal_model,
)

logger = get_logger("veltrix.ml.training")


@dataclass
class TrainConfig:
    model_name: str
    symbol: str | None = None
    horizon: str = "1d"
    symbols: list[str] | None = None
    threshold: float = 0.002
    output_path: str | None = None


def _symbol_points(symbols: Iterable[str], horizon: str) -> dict[str, list[dict]]:
    payload: dict[str, list[dict]] = {}
    for symbol in symbols:
        ohlc = get_ohlc(symbol, horizon)
        points = ohlc.get("points", []) if isinstance(ohlc, dict) else []
        if points:
            payload[symbol.upper()] = points
    return payload


def run_training(config: TrainConfig) -> dict:
    symbols = [config.symbol.upper()] if config.symbol else [symbol.upper() for symbol in (config.symbols or ["SPY", "QQQ", "AAPL", "NVDA", "MSFT", "AMZN"])]
    symbol_points = _symbol_points(symbols, "1d")
    dataset = build_training_dataset(symbol_points, config.horizon, config.threshold)

    if len(dataset.labels) == 0:
        logger.warning("No training samples were available; saving fallback model")
        model = LinearSignalModel.create(DEFAULT_FEATURE_COLUMNS, metadata={"trained_at": datetime.utcnow().isoformat(), "samples": 0})
        metrics = {"loss": 0.0, "accuracy": 0.0}
    else:
        model, metrics = train_signal_model(dataset, model_name=config.model_name, version=datetime.utcnow().strftime("%Y.%m.%d.%H%M%S"))

    artifact_path = Path(config.output_path) if config.output_path else MODEL_ARTIFACT_PATH
    saved_path = model.save(artifact_path)

    summary = {
        "model_name": model.model_name,
        "version": model.version,
        "symbol": config.symbol,
        "symbols": symbols,
        "horizon": config.horizon,
        "samples": int(len(dataset.labels)),
        "features": len(dataset.feature_names),
        "artifact_path": str(saved_path),
        "status": "trained" if len(dataset.labels) else "fallback_saved",
        "metrics": metrics,
    }
    logger.info(f"Training complete: {summary}")
    return summary
