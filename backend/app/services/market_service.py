"""Market data service with async provider orchestration."""

from __future__ import annotations

from datetime import datetime
from typing import NamedTuple
import hashlib
import time
from sqlalchemy.orm import Session

from app.db.models import AISignal
from app.services.market_providers import provider_orchestrator
from app.core.logging import get_logger
from app.core.config import settings

logger = get_logger("veltrix.market_service")


class TimeframeConfig(NamedTuple):
    period: str
    interval: str
    ttl: int


TIMEFRAME_MAP: dict[str, TimeframeConfig] = {
    "1m": TimeframeConfig(period="1d", interval="1m", ttl=15),
    "5m": TimeframeConfig(period="5d", interval="5m", ttl=20),
    "15m": TimeframeConfig(period="1mo", interval="15m", ttl=30),
    "1h": TimeframeConfig(period="3mo", interval="60m", ttl=45),
    "4h": TimeframeConfig(period="6mo", interval="60m", ttl=60),
    "1d": TimeframeConfig(period="1y", interval="1d", ttl=120),
    "1w": TimeframeConfig(period="5y", interval="1wk", ttl=300),
}

_ohlc_cache: dict[str, tuple[dict, float]] = {}


def _normalize_timeframe(value: str) -> str:
    normalized = value.strip().lower()
    aliases = {"1h": "1h", "4h": "4h", "1d": "1d", "1w": "1w", "1m": "1m", "5m": "5m", "15m": "15m"}
    return aliases.get(normalized, "1d")


def _get_cache(key: str) -> dict | None:
    cached = _ohlc_cache.get(key)
    if not cached:
        return None
    payload, created_at = cached
    if time.time() - created_at > payload.get("ttl", 60):
        _ohlc_cache.pop(key, None)
        return None
    return payload


def _set_cache(key: str, payload: dict, ttl: int) -> None:
    payload = {**payload, "ttl": ttl}
    _ohlc_cache[key] = (payload, time.time())


async def get_quotes(symbols: list[str]) -> list[dict]:
    return await provider_orchestrator.get_quotes(symbols)


async def get_ohlc(symbol: str, timeframe: str = "1d") -> dict:
    normalized_timeframe = _normalize_timeframe(timeframe)
    timeframe_config = TIMEFRAME_MAP.get(normalized_timeframe, TIMEFRAME_MAP["1d"])
    cache_key = f"ohlc:{symbol.upper()}:{normalized_timeframe}"

    cached = _get_cache(cache_key)
    if cached:
        return cached

    # Try real provider
    try:
        real_ohlc = await provider_orchestrator.get_ohlc(symbol.upper(), normalized_timeframe)
        if real_ohlc and len(real_ohlc) > 0:
            payload = {
                "symbol": symbol.upper(),
                "timeframe": normalized_timeframe,
                "interval": timeframe_config.interval,
                "period": timeframe_config.period,
                "points": real_ohlc,
                "source": "real-market-data",
                "realtime": True,
                "generated_at": datetime.utcnow().isoformat(),
                "ttl": timeframe_config.ttl,
            }
            _set_cache(cache_key, payload, timeframe_config.ttl)
            logger.info(f"Fetched {len(real_ohlc)} points from provider for {symbol} {normalized_timeframe}")
            return payload
    except Exception as e:
        logger.warning(f"Provider fetch failed for {symbol} {normalized_timeframe}: {e}")

    if not settings.enable_fallback_data:
        logger.warning(f"No data available for {symbol} {normalized_timeframe} and fallback disabled")
        return {
            "symbol": symbol.upper(),
            "timeframe": normalized_timeframe,
            "interval": timeframe_config.interval,
            "points": [],
            "source": "unavailable",
            "realtime": False,
            "stale": True,
            "generated_at": datetime.utcnow().isoformat(),
        }

    # Deterministic simulation for development
    logger.info(f"Generating simulated OHLC for {symbol} {normalized_timeframe}")
    seed = int(hashlib.sha256(f"{symbol.upper()}:{normalized_timeframe}".encode()).hexdigest()[:8], 16)
    base = 100.0 + (seed % 90)
    step_map = {"1m": 0.08, "5m": 0.18, "15m": 0.35, "1h": 0.8, "4h": 1.4, "1d": 2.4, "1w": 4.8}
    count_map = {"1m": 180, "5m": 120, "15m": 100, "1h": 90, "4h": 70, "1d": 60, "1w": 52}
    drift_bias_map = {"1m": 0.02, "5m": 0.03, "15m": 0.05, "1h": 0.08, "4h": 0.12, "1d": 0.16, "1w": 0.22}
    step = step_map.get(normalized_timeframe, 1.0)
    count = count_map.get(normalized_timeframe, 60)
    bias = drift_bias_map.get(normalized_timeframe, 0.1)
    points: list[dict] = []
    price = base
    for index in range(count):
        direction = -1 if ((seed + index) % 5 == 0) else 1
        swing = ((index % 11) - 5) * step * 0.32
        open_price = price
        close_price = max(1.0, price + (direction * bias) + swing)
        high_price = max(open_price, close_price) + step * (0.55 + (index % 3) * 0.1)
        low_price = min(open_price, close_price) - step * (0.55 + (index % 4) * 0.08)
        volume = 400000 + (index * 9100) + (step * 32000) + (seed % 10000)
        points.append(
            {
                "t": f"{index}",
                "o": round(open_price, 2),
                "h": round(high_price, 2),
                "l": round(low_price, 2),
                "c": round(close_price, 2),
                "v": round(volume, 2),
            }
        )
        price = close_price

    payload = {
        "symbol": symbol.upper(),
        "timeframe": normalized_timeframe,
        "interval": timeframe_config.interval,
        "period": timeframe_config.period,
        "points": points,
        "source": "simulated",
        "realtime": False,
        "stale": True,
        "generated_at": datetime.utcnow().isoformat(),
    }
    _set_cache(cache_key, payload, timeframe_config.ttl)
    return payload


def generate_signal(db: Session, symbol: str, score: float, model: str = "xgboost_live") -> AISignal:
    signal = AISignal(symbol=symbol, score=score, model=model, payload={"generated_at": datetime.utcnow().isoformat()})
    db.add(signal)
    db.commit()
    db.refresh(signal)
    return signal
