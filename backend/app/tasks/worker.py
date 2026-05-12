from celery import Celery
from celery.schedules import crontab
import asyncio
from datetime import datetime

from app.core.config import settings
from app.core.logging import get_logger
from app.services.market_service import get_quotes
from app.services.market_providers import provider_orchestrator
from app.ws.manager import ws_manager

celery_app = Celery("veltrix", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.task_routes = {
    "app.tasks.worker.sync_market_data": {"queue": "market"},
    "app.tasks.worker.generate_signals": {"queue": "signals"},
}
celery_app.conf.beat_schedule = {
    "sync-market-every-minute": {"task": "app.tasks.worker.sync_market_data", "schedule": crontab(minute="*/1")},
    "generate-signals-every-2-min": {"task": "app.tasks.worker.generate_signals", "schedule": crontab(minute="*/2")},
}
logger = get_logger("veltrix.worker")


@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def sync_market_data(self) -> dict:  # type: ignore[no-untyped-def]
    logger.info("sync_market_data started")

    async def _publish() -> dict:
        symbols = [item.strip().upper() for item in settings.market_sync_symbols.split(",") if item.strip()]
        quotes = await get_quotes(symbols)
        published = 0

        for quote in quotes:
            symbol = quote.get("symbol")
            if not symbol:
                continue

            quote_payload = {
                "type": "quote",
                "symbol": symbol,
                "quote": quote,
                "ts": datetime.utcnow().isoformat(),
            }
            await ws_manager.publish(f"market:{symbol}:1d", quote_payload)
            await ws_manager.publish(f"market:{symbol}:1h", quote_payload)
            published += 1

            ohlc_points = await provider_orchestrator.get_ohlc(symbol, "1d")
            last_point = ohlc_points[-1] if ohlc_points else None
            if last_point:
                await ws_manager.publish(
                    f"market:{symbol}:1d",
                    {
                        "type": "point",
                        "symbol": symbol,
                        "timeframe": "1d",
                        "point": last_point,
                        "source": quote.get("provider", "provider"),
                        "ts": datetime.utcnow().isoformat(),
                    },
                )

        return {"status": "synced", "symbols": symbols, "published": published}

    return asyncio.run(_publish())


@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def generate_signals(self) -> dict:  # type: ignore[no-untyped-def]
    logger.info("generate_signals started")
    return {"status": "signals-generated"}
