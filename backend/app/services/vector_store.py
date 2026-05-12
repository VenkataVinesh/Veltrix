from __future__ import annotations

from abc import ABC, abstractmethod
import json

from app.core.redis_client import redis_client


class VectorStore(ABC):
    @abstractmethod
    async def upsert(self, namespace: str, key: str, vector: list[float], payload: dict) -> None:
        raise NotImplementedError

    @abstractmethod
    async def topk(self, namespace: str, vector: list[float], k: int = 5) -> list[dict]:
        raise NotImplementedError


class RedisVectorStore(VectorStore):
    async def upsert(self, namespace: str, key: str, vector: list[float], payload: dict) -> None:
        await redis_client.hset(f"vec:{namespace}", key, json.dumps({"vector": vector, "payload": payload}))

    async def topk(self, namespace: str, vector: list[float], k: int = 5) -> list[dict]:
        raw = await redis_client.hgetall(f"vec:{namespace}")
        scored: list[tuple[float, dict]] = []
        for _, value in raw.items():
            item = json.loads(value)
            ref = item["vector"]
            score = sum(a * b for a, b in zip(vector, ref))
            scored.append((score, item["payload"]))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [{"score": s, "payload": p} for s, p in scored[:k]]


vector_store = RedisVectorStore()
