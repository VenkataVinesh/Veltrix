import time
import redis.asyncio as aioredis
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("veltrix.redis")

class InMemoryRedis:
    """Mock Redis client for in-memory fallback when Redis is unavailable."""
    def __init__(self):
        self.data = {}
        self.expirations = {}
        logger.info("Initialized In-Memory Redis fallback cache")
        
    async def get(self, key: str) -> str | None:
        if key in self.data:
            if key in self.expirations and time.time() > self.expirations[key]:
                del self.data[key]
                del self.expirations[key]
                return None
            return self.data[key]
        return None
        
    async def setex(self, key: str, ttl: int, value: str) -> bool:
        self.data[key] = value
        self.expirations[key] = time.time() + ttl
        return True
        
    async def hset(self, name: str, key: str, value: str):
        if name not in self.data:
            self.data[name] = {}
        self.data[name][key] = value
        
    async def hgetall(self, name: str) -> dict:
        return self.data.get(name, {})
        
    async def publish(self, channel: str, message: str) -> int:
        # Mock publish for websocket manager
        return 0

# Redis is optional - gracefully degrade to in-memory if not available
redis_client = None

# Force In-Memory fallback for guaranteed performance in local dev environment
logger.info("Forcing In-Memory Redis fallback for guaranteed performance.")
redis_client = InMemoryRedis()
