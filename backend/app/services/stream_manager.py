"""Realtime market data stream manager.

Polls providers and fans out updates via WebSocket channels.
Runs as an asyncio background task.
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime

from app.core.logging import get_logger
from app.core.config import settings
from app.services.market_providers import provider_orchestrator
from app.ws.manager import ws_manager

logger = get_logger("veltrix.stream")

STREAM_INTERVALS: dict[str, float] = {
    "quotes": 8.0,
    "signals": 15.0,
}

DEFAULT_SYMBOLS = ["SPY", "AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "META", "GOOGL", "QQQ"]


class MarketStreamManager:
    """Polls market providers and fans out updates via WebSocket channels."""

    def __init__(self) -> None:
        self._tasks: list[asyncio.Task] = []
        self._running = False
        self._stats: dict[str, dict] = {}

    def _track(self, stream: str, duration_ms: float, ok: bool) -> None:
        if stream not in self._stats:
            self._stats[stream] = {"polls": 0, "errors": 0, "last_latency_ms": 0.0, "last_ok": None, "last_error": None}
        self._stats[stream]["polls"] += 1
        self._stats[stream]["last_latency_ms"] = round(duration_ms, 1)
        if ok:
            self._stats[stream]["errors"] = 0
            self._stats[stream]["last_ok"] = datetime.utcnow().isoformat()
        else:
            self._stats[stream]["errors"] += 1
            self._stats[stream]["last_error"] = datetime.utcnow().isoformat()

    def get_stats(self) -> dict:
        return dict(self._stats)

    async def _poll_quotes(self) -> None:
        while self._running:
            if not ws_manager.has_subscribers("quotes"):
                await asyncio.sleep(STREAM_INTERVALS["quotes"])
                continue
            start = time.perf_counter()
            try:
                quotes = await provider_orchestrator.get_quotes(DEFAULT_SYMBOLS)
                elapsed = (time.perf_counter() - start) * 1000
                if quotes:
                    self._track("quotes", elapsed, True)
                    now_ts = datetime.utcnow().isoformat()
                    enriched = []
                    for q in quotes:
                        q["generated_at"] = now_ts
                        q["latency_ms"] = round(elapsed, 1)
                        enriched.append(q)
                    await ws_manager.broadcast("quotes", {
                        "type": "quote_update",
                        "payload": enriched,
                        "generated_at": now_ts,
                        "latency_ms": round(elapsed, 1),
                    })
                    logger.debug(f"Streamed {len(quotes)} quotes in {elapsed:.0f}ms")
                else:
                    self._track("quotes", elapsed, False)
                    logger.warning("Stream poll returned empty quotes")
            except Exception as e:
                elapsed = (time.perf_counter() - start) * 1000
                self._track("quotes", elapsed, False)
                logger.warning(f"Stream poll failed: {e}")
            await asyncio.sleep(STREAM_INTERVALS["quotes"])

    async def _poll_signals(self) -> None:
        while self._running:
            if not ws_manager.has_subscribers("signals"):
                await asyncio.sleep(STREAM_INTERVALS["signals"])
                continue
            start = time.perf_counter()
            try:
                from app.services.market_service import get_ohlc
                from app.services.signals_engine import analyze_signal
                signals = []
                for symbol in DEFAULT_SYMBOLS:
                    signal = await analyze_signal(symbol, "1d")
                    if signal:
                        signals.append(signal._asdict())
                    await asyncio.sleep(0.1)
                elapsed = (time.perf_counter() - start) * 1000
                self._track("signals", elapsed, True)
                await ws_manager.broadcast("signals", {
                    "type": "signal_update",
                    "payload": signals,
                    "generated_at": datetime.utcnow().isoformat(),
                    "latency_ms": round(elapsed, 1),
                })
            except Exception as e:
                elapsed = (time.perf_counter() - start) * 1000
                self._track("signals", elapsed, False)
                logger.warning(f"Signal stream poll failed: {e}")
            await asyncio.sleep(STREAM_INTERVALS["signals"])

    async def _save_portfolio_snapshots(self) -> None:
        """Periodically save portfolio snapshots for historical equity curves."""
        while self._running:
            try:
                from app.db.session import SessionLocal
                from app.db.models import Portfolio
                from app.services.portfolio_service import PortfolioService

                db = SessionLocal()
                try:
                    portfolios = db.query(Portfolio).all()
                    for portfolio in portfolios:
                        try:
                            service = PortfolioService(db)
                            summary = await service.get_portfolio_summary(portfolio.id)
                            if summary and summary.get("positions", 0) > 0:
                                service.save_portfolio_snapshot(
                                    portfolio_id=portfolio.id,
                                    total_equity=summary["total_equity"],
                                    total_pnl=summary.get("total_pnl", 0.0),
                                    daily_pnl=summary.get("daily_pnl", 0.0),
                                )
                                logger.debug(f"Snapshot saved for portfolio {portfolio.id}")
                        except Exception as e:
                            logger.warning(f"Snapshot failed for portfolio {portfolio.id}: {e}")
                finally:
                    db.close()
            except Exception as e:
                logger.warning(f"Portfolio snapshot cycle failed: {e}")
            await asyncio.sleep(3600)  # Every hour

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._tasks = [
            asyncio.create_task(self._poll_quotes(), name="stream-quotes"),
            asyncio.create_task(self._poll_signals(), name="stream-signals"),
            asyncio.create_task(self._save_portfolio_snapshots(), name="portfolio-snapshots"),
        ]
        logger.info(f"Market stream manager started ({len(self._tasks)} streams)")

    async def stop(self) -> None:
        self._running = False
        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
        logger.info("Market stream manager stopped")


market_stream = MarketStreamManager()
