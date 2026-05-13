from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
import time
import json
import random
from functools import lru_cache
from urllib.parse import urlencode
import httpx
import yfinance as yf

from app.core.redis_client import redis_client
from app.core.logging import get_logger
from app.core.config import settings

logger = get_logger("veltrix.market_providers")

# In-memory cache as fallback when Redis is unavailable
_memory_cache: dict[str, tuple[str, float]] = {}  # key -> (json_data, timestamp)
_MEMORY_CACHE_TTL = 8  # seconds


class MarketProvider(ABC):
    name: str

    @abstractmethod
    async def quotes(self, symbols: list[str]) -> list[dict]:
        raise NotImplementedError


class YahooProvider(MarketProvider):
    name = "yahoo"

    async def quotes(self, symbols: list[str]) -> list[dict]:
        out: list[dict] = []
        for symbol in symbols:
            try:
                ticker = yf.Ticker(symbol)
                info = ticker.fast_info
                price = float(info.get("lastPrice") or info.get("last_price") or 0)
                prev = float(info.get("previousClose") or info.get("previous_close") or price)
                change = ((price - prev) / prev * 100) if prev else 0.0
                if price > 0:
                    out.append({"symbol": symbol, "price": round(price, 2), "change": round(change, 2), "provider": self.name})
            except Exception as e:
                logger.warning(f"Yahoo fetch failed for {symbol}: {e}")
                continue
        return out

    async def ohlc(self, symbol: str, timeframe: str = "1d") -> list[dict]:
        """Fetch real OHLC data from Yahoo Finance."""
        import asyncio
        try:
            ticker = yf.Ticker(symbol)
            # Map timeframe to yfinance interval and period
            interval_map = {
                "1m": "1m", "5m": "5m", "15m": "15m", "1h": "1h", "4h": "1h", "1d": "1d", "1w": "1wk"
            }
            timeframe_lower = timeframe.lower()
            interval = interval_map.get(timeframe_lower, "1d")
            
            # Period depends on interval
            period = "1d" if interval in ["1m", "5m", "15m"] else ("1mo" if interval == "1h" else "6mo")
            
            print(f"Yahoo OHLC request: {symbol}, tf={timeframe_lower}, int={interval}, per={period}")
            # yfinance is blocking, use to_thread
            df = await asyncio.to_thread(ticker.history, period=period, interval=interval)
            print(f"Yahoo OHLC response: empty={df.empty}, rows={len(df)}")
            
            if df.empty:
                logger.warning(f"Yahoo: No OHLC data for {symbol} (tf={timeframe_lower})")
                return []
                
            out: list[dict] = []
            for index, row in df.iterrows():
                out.append({
                    "t": index.strftime("%Y-%m-%d %H:%M:%S") if isinstance(index, datetime) else str(index),
                    "o": round(float(row["Open"]), 2),
                    "h": round(float(row["High"]), 2),
                    "l": round(float(row["Low"]), 2),
                    "c": round(float(row["Close"]), 2),
                    "v": round(float(row["Volume"]), 2),
                })
            return out
        except Exception as e:
            logger.warning(f"Yahoo OHLC fetch failed for {symbol}: {e}")
            return []


class AlphaVantageProvider(MarketProvider):
    name = "alphavantage"
    base_url = settings.alphavantage_base_url

    async def quotes(self, symbols: list[str]) -> list[dict]:
        """Fetch real quotes from AlphaVantage."""
        api_key = settings.alphavantage_api_key
        if not api_key:
            logger.warning("AlphaVantage API key not configured")
            return []

        out: list[dict] = []
        async with httpx.AsyncClient(timeout=10.0) as client:
            for symbol in symbols:
                try:
                    params = {
                        "function": "GLOBAL_QUOTE",
                        "symbol": symbol,
                        "apikey": api_key,
                    }
                    url = f"{self.base_url}?{urlencode(params)}"
                    response = await client.get(url)
                    response.raise_for_status()
                    data = response.json()

                    if "Global Quote" in data and data["Global Quote"]:
                        quote = data["Global Quote"]
                        price = float(quote.get("05. price", 0.0) or 0.0)
                        change_pct = float(quote.get("10. change percent", "0.0").replace("%", "") or 0.0)
                        if price > 0:
                            out.append({
                                "symbol": symbol,
                                "price": round(price, 2),
                                "change": round(change_pct, 2),
                                "provider": self.name,
                                "timestamp": datetime.utcnow().isoformat(),
                            })
                    else:
                        logger.warning(f"AlphaVantage: No quote data for {symbol}")
                except Exception as e:
                    logger.warning(f"AlphaVantage fetch failed for {symbol}: {e}")
                    continue

        return out

    async def ohlc(self, symbol: str, timeframe: str = "daily") -> list[dict]:
        """Fetch real OHLC data from AlphaVantage."""
        api_key = settings.alphavantage_api_key
        if not api_key:
            logger.warning("AlphaVantage API key not configured for OHLC")
            return []

        # Map to AlphaVantage function names
        function_map = {
            "1m": "TIME_SERIES_INTRADAY",
            "5m": "TIME_SERIES_INTRADAY",
            "15m": "TIME_SERIES_INTRADAY",
            "1h": "TIME_SERIES_INTRADAY",
            "4h": "TIME_SERIES_INTRADAY",
            "daily": "TIME_SERIES_DAILY",
            "1d": "TIME_SERIES_DAILY",
            "weekly": "TIME_SERIES_WEEKLY",
            "1w": "TIME_SERIES_WEEKLY",
            "monthly": "TIME_SERIES_MONTHLY",
        }

        function = function_map.get(timeframe, "TIME_SERIES_DAILY")
        params = {
            "function": function,
            "symbol": symbol,
            "apikey": api_key,
        }

        # Add interval for intraday
        if function == "TIME_SERIES_INTRADAY":
            interval_map = {"1m": "1min", "5m": "5min", "15m": "15min", "1h": "60min", "4h": "60min"}
            params["interval"] = interval_map.get(timeframe, "5min")
            if timeframe == "4h":
                # For 4h, AlphaVantage only provides 60min, we'll aggregate on client
                pass

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                url = f"{self.base_url}?{urlencode(params)}"
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()

                # Extract time series based on function type
                time_series_key = None
                if function == "TIME_SERIES_INTRADAY":
                    time_series_key = f"Time Series ({params.get('interval', '5min')})"
                elif function == "TIME_SERIES_DAILY":
                    time_series_key = "Time Series (Daily)"
                elif function == "TIME_SERIES_WEEKLY":
                    time_series_key = "Weekly Time Series"
                elif function == "TIME_SERIES_MONTHLY":
                    time_series_key = "Monthly Time Series"

                if time_series_key and time_series_key in data:
                    time_series = data[time_series_key]
                    out: list[dict] = []
                    for timestamp, ohlc in list(time_series.items())[:60]:  # Limit to 60 points
                        out.append({
                            "t": timestamp,
                            "o": round(float(ohlc.get("1. open", 0)), 2),
                            "h": round(float(ohlc.get("2. high", 0)), 2),
                            "l": round(float(ohlc.get("3. low", 0)), 2),
                            "c": round(float(ohlc.get("4. close", 0)), 2),
                            "v": round(float(ohlc.get("5. volume", 0)), 2),
                        })
                    return list(reversed(out))  # Reverse to chronological order
                else:
                    logger.warning(f"AlphaVantage: No time series data for {symbol}")
                    return []
        except Exception as e:
            logger.warning(f"AlphaVantage OHLC fetch failed for {symbol}: {e}")
            return []


class PolygonProvider(MarketProvider):
    name = "polygon"
    base_url = "https://api.polygon.io/v1"

    async def quotes(self, symbols: list[str]) -> list[dict]:
        """Fetch real quotes from Polygon.io."""
        api_key = settings.polygon_api_key
        if not api_key:
            logger.warning("Polygon API key not configured")
            return []

        out: list[dict] = []
        async with httpx.AsyncClient(timeout=10.0) as client:
            for symbol in symbols:
                try:
                    url = f"{self.base_url}/last/quote/{symbol}?apiKey={api_key}"
                    response = await client.get(url)
                    response.raise_for_status()
                    data = response.json()

                    if data.get("status") == "OK" and "result" in data:
                        result = data["result"]
                        bid = float(result.get("bid", 0) or 0)
                        ask = float(result.get("ask", 0) or 0)
                        price = (bid + ask) / 2 if bid and ask else 0

                        if price > 0:
                            out.append({
                                "symbol": symbol,
                                "price": round(price, 2),
                                "change": 0.0,  # Polygon doesn't provide change in quote endpoint
                                "provider": self.name,
                                "timestamp": datetime.utcnow().isoformat(),
                            })
                except Exception as e:
                    logger.warning(f"Polygon fetch failed for {symbol}: {e}")
                    continue

        return out


class FinnhubProvider(MarketProvider):
    name = "finnhub"
    base_url = "https://finnhub.io/api/v1"

    async def quotes(self, symbols: list[str]) -> list[dict]:
        """Fetch real quotes from Finnhub."""
        api_key = settings.finnhub_api_key
        if not api_key:
            logger.warning("Finnhub API key not configured")
            return []

        capped_symbols = symbols[: max(1, settings.finnhub_symbol_cap)]
        out: list[dict] = []
        rate_limited = False
        async with httpx.AsyncClient(timeout=10.0) as client:
            for symbol in capped_symbols:
                try:
                    url = f"{self.base_url}/quote?symbol={symbol}&token={api_key}"
                    response = await client.get(url)
                    if response.status_code == 429:
                        rate_limited = True
                        break
                    response.raise_for_status()
                    data = response.json()

                    price = float(data.get("c", 0) or 0)
                    prev_close = float(data.get("pc", price) or price)
                    change = ((price - prev_close) / prev_close * 100) if prev_close else 0

                    if price > 0:
                        out.append({
                            "symbol": symbol,
                            "price": round(price, 2),
                            "change": round(change, 2),
                            "provider": self.name,
                            "timestamp": datetime.utcnow().isoformat(),
                        })
                except Exception as e:
                    logger.warning(f"Finnhub fetch failed for {symbol}: {e}")
                    continue

        if rate_limited:
            logger.warning("Finnhub rate limited (429); stopping remaining symbol fetches for this cycle")

        return out


class ProviderOrchestrator:
    def __init__(self) -> None:
        self.providers: list[MarketProvider] = [
            YahooProvider(),
            AlphaVantageProvider(),
            FinnhubProvider(),
            PolygonProvider(),
        ]
        self.provider_backoff_until: dict[str, float] = {}
        self.provider_status: dict[str, dict] = {
            p.name: {"healthy": True, "last_ok": None, "last_error": None, "error_count": 0, "rate_limited_until": None}
            for p in self.providers
        }
        self._next_redis_warning_ts: float = 0.0
        self._redis_runtime_disabled: bool = False

    def get_provider_status(self) -> list[dict]:
        now = time.time()
        result = []
        for name, status in self.provider_status.items():
            cooled_down = now < self.provider_backoff_until.get(name, 0.0)
            rate_limited = status.get("rate_limited_until") and now < status["rate_limited_until"]
            result.append({
                "name": name,
                "healthy": not cooled_down and not rate_limited and status["healthy"],
                "cooled_down": cooled_down,
                "rate_limited": rate_limited,
                "last_ok": status["last_ok"],
                "last_error": status["last_error"],
                "error_count": status["error_count"],
            })
        return result

    def _record_provider_success(self, provider_name: str) -> None:
        self.provider_backoff_until.pop(provider_name, None)
        self.provider_status[provider_name]["healthy"] = True
        self.provider_status[provider_name]["last_ok"] = datetime.utcnow().isoformat()
        self.provider_status[provider_name]["error_count"] = 0

    def _record_provider_error(self, provider_name: str, error: str, rate_limited: bool = False) -> None:
        self.provider_status[provider_name]["last_error"] = error
        self.provider_status[provider_name]["error_count"] += 1
        if rate_limited:
            cooldown = max(settings.provider_failure_cooldown_sec, 60)
            self.provider_status[provider_name]["rate_limited_until"] = time.time() + cooldown
            self.provider_status[provider_name]["healthy"] = False

    def _set_provider_backoff(self, provider_name: str) -> None:
        self.provider_backoff_until[provider_name] = time.time() + settings.provider_failure_cooldown_sec

    def _is_provider_cooled_down(self, provider_name: str) -> bool:
        return time.time() < self.provider_backoff_until.get(provider_name, 0.0)

    def _log_redis_warning(self, message: str) -> None:
        now = time.time()
        if now >= self._next_redis_warning_ts:
            logger.warning(message)
            self._next_redis_warning_ts = now + settings.redis_warning_cooldown_sec

    def _disable_redis_runtime(self, reason: str) -> None:
        if not self._redis_runtime_disabled:
            self._redis_runtime_disabled = True
            self._log_redis_warning(f"Redis cache disabled for this process: {reason}")

    async def _get_from_cache(self, key: str) -> str | None:
        """Try Redis first, then fall back to in-memory cache."""
        if redis_client and not self._redis_runtime_disabled:
            try:
                return await redis_client.get(key)
            except Exception as e:
                if "different event loop" in str(e).lower():
                    self._disable_redis_runtime(str(e))
                self._log_redis_warning(f"Redis get failed: {e}")
        
        # In-memory fallback
        if key in _memory_cache:
            data, ts = _memory_cache[key]
            age = datetime.utcnow().timestamp() - ts
            if age < _MEMORY_CACHE_TTL:
                return data
            else:
                del _memory_cache[key]
        return None

    async def _set_cache(self, key: str, value: str, ttl: int) -> None:
        """Try Redis first, then fall back to in-memory cache."""
        if redis_client and not self._redis_runtime_disabled:
            try:
                await redis_client.setex(key, ttl, value)
                return
            except Exception as e:
                if "different event loop" in str(e).lower():
                    self._disable_redis_runtime(str(e))
                self._log_redis_warning(f"Redis set failed: {e}")
        
        # In-memory fallback
        _memory_cache[key] = (value, datetime.utcnow().timestamp())

    async def get_quotes(self, symbols: list[str]) -> list[dict]:
        cache_key = f"quotes:{','.join(sorted(symbols))}"
        
        # Try cache first
        cached = await self._get_from_cache(cache_key)
        if cached:
            return json.loads(cached)
        
        # Try each provider in priority order
        for provider in self.providers:
            if self._is_provider_cooled_down(provider.name):
                continue
            if self.provider_status[provider.name].get("rate_limited_until") and time.time() < self.provider_status[provider.name]["rate_limited_until"]:
                continue
            try:
                quotes = await provider.quotes(symbols)
                valid = [q for q in quotes if q.get("price", 0) > 0]
                if valid:
                    await self._set_cache(cache_key, json.dumps(valid), 60)
                    self._record_provider_success(provider.name)
                    logger.info(f"Fetched quotes from {provider.name}: {len(valid)} symbols")
                    return valid
                self._set_provider_backoff(provider.name)
            except Exception as e:
                is_rate_limit = "429" in str(e) or "rate limit" in str(e).lower()
                self._record_provider_error(provider.name, str(e), rate_limited=is_rate_limit)
                logger.warning(f"Provider {provider.name} failed for quotes: {e}")
                self._set_provider_backoff(provider.name)
                continue
        
        # Last-resort fallback with explicit simulation labeling
        fallback = [
            {
                "symbol": s,
                "price": round(100 + random.random() * 50, 2),
                "change": 0.0,
                "provider": "fallback-simulated",
                "realtime": False,
                "stale": True,
                "generated_at": datetime.utcnow().isoformat(),
            }
            for s in symbols
        ]
        await self._set_cache(cache_key, json.dumps(fallback), 3)
        logger.warning(f"Using fallback simulated quotes for {len(symbols)} symbols")
        return fallback

    async def get_ohlc(self, symbol: str, timeframe: str = "daily") -> list[dict]:
        """Fetch OHLC data with provider failover."""
        cache_key = f"ohlc:{symbol}:{timeframe}"
        
        # Try cache first
        cached = await self._get_from_cache(cache_key)
        if cached:
            return json.loads(cached)
        
        # Try providers that support OHLC
        for provider in self.providers:
            if self._is_provider_cooled_down(provider.name):
                continue
            if hasattr(provider, "ohlc"):
                try:
                    ohlc = await provider.ohlc(symbol, timeframe)
                    if ohlc:
                        await self._set_cache(cache_key, json.dumps(ohlc), 300)
                        logger.info(f"Fetched {len(ohlc)} OHLC points from {provider.name} for {symbol}")
                        return ohlc
                    self._set_provider_backoff(provider.name)
                except Exception as e:
                    logger.warning(f"Provider {provider.name} failed for OHLC: {e}")
                    self._set_provider_backoff(provider.name)
                    continue
        
        logger.warning(f"No OHLC data available for {symbol}")
        return []


provider_orchestrator = ProviderOrchestrator()
