import redis.asyncio as aioredis
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("veltrix.redis")

# Redis is optional - gracefully degrade if not available
redis_client = None

if settings.redis_url:
    try:
        redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
        logger.info(f"Redis client initialized: {settings.redis_url}")
    except Exception as e:
        logger.warning(f"Failed to initialize Redis: {e}. Running without caching.")
        redis_client = None
else:
    logger.info("Redis URL not configured. Running without caching (in-memory fallback).")
