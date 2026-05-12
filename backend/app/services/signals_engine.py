"""
Real-time signals engine based on technical analysis.
Generates directional signals with confidence scores.
"""
from __future__ import annotations

from datetime import datetime
import statistics
from typing import NamedTuple

from app.core.logging import get_logger
from app.services.market_service import get_ohlc
from ml.inference.predict import predict

logger = get_logger("veltrix.signals")


class TechnicalIndicators(NamedTuple):
    sma_20: float
    ema_20: float
    rsi_14: float
    macd: float
    macd_signal: float
    macd_histogram: float
    bb_upper: float
    bb_middle: float
    bb_lower: float
    atr_14: float
    price: float
    volume: float


class SignalAnalysis(NamedTuple):
    symbol: str
    signal: str  # "BUY", "SELL", "HOLD"
    confidence: float  # 0.0 to 1.0
    momentum: float  # -1.0 to 1.0
    trend: str  # "up", "down", "sideways"
    volatility: float
    support: float
    resistance: float
    target_up: float
    target_down: float
    bullish_probability: float
    bearish_probability: float
    neutral_probability: float
    stop_price: float
    volatility_expectation: float
    model_version: str
    timestamp: str


def calculate_sma(prices: list[float], period: int = 20) -> float:
    """Calculate Simple Moving Average."""
    if len(prices) < period:
        return prices[-1] if prices else 0.0
    return statistics.mean(prices[-period:])


def calculate_ema(prices: list[float], period: int = 20) -> float:
    """Calculate Exponential Moving Average."""
    if len(prices) < period:
        return prices[-1] if prices else 0.0
    
    multiplier = 2 / (period + 1)
    ema = statistics.mean(prices[-period:])
    
    for price in prices[-(period-1):]:
        ema = price * multiplier + ema * (1 - multiplier)
    
    return ema


def calculate_rsi(prices: list[float], period: int = 14) -> float:
    """Calculate Relative Strength Index."""
    if len(prices) < period + 1:
        return 50.0  # Neutral
    
    deltas = [prices[i] - prices[i-1] for i in range(1, len(prices))]
    gains = [d if d > 0 else 0 for d in deltas]
    losses = [-d if d < 0 else 0 for d in deltas]
    
    avg_gain = statistics.mean(gains[-period:])
    avg_loss = statistics.mean(losses[-period:])
    
    if avg_loss == 0:
        return 100.0 if avg_gain > 0 else 50.0
    
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return max(0, min(100, rsi))


def calculate_macd(prices: list[float]) -> tuple[float, float, float]:
    """Calculate MACD, Signal, and Histogram."""
    if len(prices) < 26:
        return 0.0, 0.0, 0.0
    
    ema_12 = calculate_ema(prices, 12)
    ema_26 = calculate_ema(prices, 26)
    macd = ema_12 - ema_26
    
    # Signal line is EMA(9) of MACD
    macd_values = []
    for i in range(max(0, len(prices) - 26), len(prices)):
        e12 = calculate_ema(prices[:i+1], 12)
        e26 = calculate_ema(prices[:i+1], 26)
        macd_values.append(e12 - e26)
    
    signal = calculate_ema(macd_values, 9) if len(macd_values) >= 9 else macd
    histogram = macd - signal
    
    return macd, signal, histogram


def calculate_bollinger_bands(prices: list[float], period: int = 20, std_dev: int = 2) -> tuple[float, float, float]:
    """Calculate Bollinger Bands."""
    if len(prices) < period:
        return prices[-1], prices[-1], prices[-1]
    
    recent_prices = prices[-period:]
    middle = statistics.mean(recent_prices)
    variance = statistics.variance(recent_prices) if len(recent_prices) > 1 else 0
    stdev = (variance ** 0.5) if variance > 0 else 0
    
    upper = middle + (stdev * std_dev)
    lower = middle - (stdev * std_dev)
    
    return upper, middle, lower


def calculate_atr(ohlc_points: list[dict], period: int = 14) -> float:
    """Calculate Average True Range."""
    if len(ohlc_points) < 2:
        return 0.0
    
    true_ranges = []
    for i in range(1, len(ohlc_points)):
        high = float(ohlc_points[i]["h"])
        low = float(ohlc_points[i]["l"])
        close_prev = float(ohlc_points[i-1]["c"])
        
        tr1 = high - low
        tr2 = abs(high - close_prev)
        tr3 = abs(low - close_prev)
        
        tr = max(tr1, tr2, tr3)
        true_ranges.append(tr)
    
    return statistics.mean(true_ranges[-period:]) if true_ranges else 0.0


def find_support_resistance(prices: list[float], window: int = 5) -> tuple[float, float]:
    """Find support and resistance levels."""
    if len(prices) < window * 2:
        low = min(prices)
        high = max(prices)
        return low, high
    
    recent = prices[-window*3:]
    support = min(recent)
    resistance = max(recent)
    
    return support, resistance


async def analyze_signal(symbol: str, timeframe: str = "1d") -> SignalAnalysis | None:
    """Generate trading signal based on technical analysis."""
    try:
        # Fetch OHLC data
        ohlc_data = await get_ohlc(symbol, timeframe)
        if not ohlc_data or "points" not in ohlc_data or len(ohlc_data["points"]) == 0:
            logger.warning(f"No OHLC data for {symbol}")
            return None
        
        points = ohlc_data["points"]
        
        # Extract closes for indicator calculation
        closes = [float(p["c"]) for p in points]
        current_price = closes[-1]
        
        # Calculate indicators
        sma_20 = calculate_sma(closes, 20)
        ema_20 = calculate_ema(closes, 20)
        rsi_14 = calculate_rsi(closes, 14)
        macd, macd_signal, macd_hist = calculate_macd(closes)
        bb_upper, bb_middle, bb_lower = calculate_bollinger_bands(closes, 20, 2)
        atr_14 = calculate_atr(points, 14)
        support, resistance = find_support_resistance(closes)
        
        # Calculate volume trend
        volumes = [float(p["v"]) for p in points]
        avg_volume = statistics.mean(volumes[-20:]) if len(volumes) >= 20 else statistics.mean(volumes)
        current_volume = volumes[-1]
        volume_ratio = current_volume / avg_volume if avg_volume > 0 else 1.0
        
        # Trend determination
        if ema_20 > sma_20:
            trend = "up"
        elif ema_20 < sma_20:
            trend = "down"
        else:
            trend = "sideways"
        
        # Signal generation
        momentum_score = 0.0
        consensus_count = 0
        
        # RSI signals
        if rsi_14 < 30:
            momentum_score += 1.0  # Oversold
            consensus_count += 1
        elif rsi_14 > 70:
            momentum_score -= 1.0  # Overbought
            consensus_count += 1
        
        # MACD signals
        if macd > macd_signal and macd_hist > 0:
            momentum_score += 0.8
            consensus_count += 1
        elif macd < macd_signal and macd_hist < 0:
            momentum_score -= 0.8
            consensus_count += 1
        
        # Price position in Bollinger Bands
        if current_price < bb_lower:
            momentum_score += 0.6
            consensus_count += 1
        elif current_price > bb_upper:
            momentum_score -= 0.6
            consensus_count += 1
        
        # EMA crossover
        if current_price > ema_20 and ema_20 > sma_20:
            momentum_score += 0.5
            consensus_count += 1
        elif current_price < ema_20 and ema_20 < sma_20:
            momentum_score -= 0.5
            consensus_count += 1
        
        # Volume confirmation
        if volume_ratio > 1.5:
            momentum_score += 0.3
        
        # Normalize momentum
        if consensus_count > 0:
            momentum = momentum_score / max(1, consensus_count * 0.5)
        else:
            momentum = 0.0
        
        momentum = max(-1.0, min(1.0, momentum))
        
        # Generate signal
        confidence = min(0.95, abs(momentum) * 0.9)
        
        if momentum > 0.3:
            signal = "BUY"
        elif momentum < -0.3:
            signal = "SELL"
        else:
            signal = "HOLD"
            confidence *= 0.5  # Lower confidence for hold
        
        # Target calculations
        volatility = atr_14 / current_price if current_price > 0 else 0.01
        target_up = current_price + (atr_14 * 2)
        target_down = max(support, current_price - (atr_14 * 2))

        ml_prediction = predict(symbol, timeframe, points=points)
        bullish_probability = float(ml_prediction.get("bullish_probability", 0.5))
        bearish_probability = float(ml_prediction.get("bearish_probability", 0.5))
        neutral_probability = float(ml_prediction.get("neutral_probability", 1.0))
        ml_confidence = float(ml_prediction.get("confidence", confidence))
        model_direction = str(ml_prediction.get("direction", signal)).upper()
        model_target_up = float(ml_prediction.get("target_range_high", target_up))
        model_target_down = float(ml_prediction.get("target_range_low", target_down))
        stop_price = float(ml_prediction.get("stop_price", target_down))
        volatility_expectation = float(ml_prediction.get("volatility_pct", volatility * 100.0))
        model_version = str(ml_prediction.get("model_version", "technical-only"))

        if model_direction in {"BUY", "SELL"} and (ml_confidence >= confidence or signal == "HOLD"):
            signal = model_direction
            confidence = max(confidence, ml_confidence)
            target_up = max(target_up, model_target_up)
            target_down = min(target_down, model_target_down)
        
        return SignalAnalysis(
            symbol=symbol,
            signal=signal,
            confidence=round(confidence, 3),
            momentum=round(momentum, 3),
            trend=trend,
            volatility=round(volatility, 4),
            support=round(support, 2),
            resistance=round(resistance, 2),
            target_up=round(target_up, 2),
            target_down=round(target_down, 2),
            bullish_probability=round(bullish_probability, 3),
            bearish_probability=round(bearish_probability, 3),
            neutral_probability=round(neutral_probability, 3),
            stop_price=round(stop_price, 2),
            volatility_expectation=round(volatility_expectation, 2),
            model_version=model_version,
            timestamp=datetime.utcnow().isoformat(),
        )
    
    except Exception as e:
        logger.error(f"Signal analysis failed for {symbol}: {e}")
        return None


async def get_signals_for_symbols(symbols: list[str], timeframe: str = "1d") -> list[dict]:
    """Get signals for multiple symbols."""
    signals = []
    for symbol in symbols:
        signal_analysis = await analyze_signal(symbol, timeframe)
        if signal_analysis:
            signals.append(signal_analysis._asdict())
        else:
            # Return neutral signal if analysis fails
            signals.append({
                "symbol": symbol,
                "signal": "HOLD",
                "confidence": 0.0,
                "momentum": 0.0,
                "trend": "sideways",
                "volatility": 0.0,
                "support": 0.0,
                "resistance": 0.0,
                "target_up": 0.0,
                "target_down": 0.0,
                "bullish_probability": 0.5,
                "bearish_probability": 0.5,
                "neutral_probability": 1.0,
                "stop_price": 0.0,
                "volatility_expectation": 0.0,
                "model_version": "fallback",
                "timestamp": datetime.utcnow().isoformat(),
            })
    
    return signals
