from fastapi import APIRouter, Query

from app.services.market_service import get_ohlc, get_quotes
from app.services.signals_engine import analyze_signal, get_signals_for_symbols

router = APIRouter()


@router.get("/quotes")
async def get_market_quotes(symbols: str = Query(default="AAPL,NVDA,TSLA,MSFT,AMZN")) -> list[dict]:
    symbol_list = [item.strip().upper() for item in symbols.split(",") if item.strip()]
    return await get_quotes(symbol_list)


@router.get("/orderbook/{symbol}")
async def get_orderbook(symbol: str) -> dict:
    quotes = await get_quotes([symbol.upper()])
    quote = quotes[0] if quotes else None
    if quote and quote.get("price", 0) > 0:
        mid = float(quote["price"])
        spread = max(mid * 0.0008, 0.01)
        step = max(mid * 0.0004, 0.01)
        bids: list[list[float]] = []
        asks: list[list[float]] = []
        bid_size = 1200
        ask_size = 1300
        bid_total = 0
        ask_total = 0

        for index in range(8):
            bid_price = round(mid - spread - (index * step), 2)
            ask_price = round(mid + spread + (index * step), 2)
            bid_level = round(bid_size + (7 - index) * 140, 0)
            ask_level = round(ask_size + index * 130, 0)
            bid_total += bid_level
            ask_total += ask_level
            bids.append([bid_price, bid_level, bid_total])
            asks.append([ask_price, ask_level, ask_total])

        return {
            "symbol": symbol.upper(),
            "bids": bids,
            "asks": asks,
            "mid": round(mid, 2),
            "spread": round(spread * 2, 2),
            "source": quote.get("provider", "derived"),
            "timestamp": quote.get("timestamp"),
        }

    return {
        "symbol": symbol.upper(),
        "bids": [],
        "asks": [],
        "mid": 0,
        "spread": 0,
        "source": "unavailable",
        "timestamp": None,
    }


@router.get("/ohlc/{symbol}")
async def ohlc(symbol: str, timeframe: str = Query(default="1d")) -> dict:
    return await get_ohlc(symbol.upper(), timeframe=timeframe)


@router.get("/signals/{symbol}")
async def get_signal(symbol: str, timeframe: str = Query(default="1d")) -> dict:
    """Get AI trading signal for a symbol."""
    signal = await analyze_signal(symbol.upper(), timeframe)
    if signal:
        payload = signal._asdict()
        payload["provider"] = "calculated"
        payload["source"] = "technical-analysis"
        return payload
    return {
        "symbol": symbol.upper(),
        "signal": "HOLD",
        "confidence": 0.0,
        "momentum": 0.0,
        "trend": "sideways",
        "volatility": 0.0,
        "support": 0.0,
        "resistance": 0.0,
        "target_up": 0.0,
        "target_down": 0.0,
        "timestamp": None,
        "provider": "fallback",
        "source": "unavailable",
    }


@router.get("/signals")
async def get_signals(symbols: str = Query(default="AAPL,NVDA,TSLA,MSFT,AMZN"), timeframe: str = Query(default="1d")) -> list[dict]:
    """Get AI trading signals for multiple symbols."""
    symbol_list = [item.strip().upper() for item in symbols.split(",") if item.strip()]
    results = await get_signals_for_symbols(symbol_list, timeframe)
    for result in results:
        result.setdefault("provider", "calculated")
        result.setdefault("source", "technical-analysis")
    return results

