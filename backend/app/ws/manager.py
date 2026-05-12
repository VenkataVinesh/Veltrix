"""WebSocket manager supporting multiplexed channel subscriptions."""

from collections import defaultdict
import json
from fastapi import WebSocket

from app.core.redis_client import redis_client
from app.core.logging import get_logger

logger = get_logger("veltrix.ws")

CLIENT_CHANNELS: dict[WebSocket, set[str]] = {}
CHANNEL_CLIENTS: dict[str, set[WebSocket]] = defaultdict(set)


class WSManager:
    """Manages multiplexed WebSocket connections.
    
    Each client connects once and subscribes to channels via messages.
    """

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        CLIENT_CHANNELS[websocket] = set()
        logger.info(f"WebSocket client connected (total: {len(CLIENT_CHANNELS)})")
        await self._send(websocket, {"type": "connected"})

    def disconnect(self, websocket: WebSocket) -> None:
        channels = CLIENT_CHANNELS.pop(websocket, set())
        for channel in channels:
            CHANNEL_CLIENTS[channel].discard(websocket)
            if not CHANNEL_CLIENTS[channel]:
                del CHANNEL_CLIENTS[channel]
        logger.info(f"WebSocket client disconnected (total: {len(CLIENT_CHANNELS)})")

    async def handle_message(self, websocket: WebSocket, raw: str) -> None:
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            await self._send(websocket, {"type": "error", "detail": "invalid JSON"})
            return

        msg_type = msg.get("type")
        if msg_type == "subscribe":
            channel = msg.get("channel")
            if not channel:
                await self._send(websocket, {"type": "error", "detail": "channel required"})
                return
            CLIENT_CHANNELS[websocket].add(channel)
            CHANNEL_CLIENTS[channel].add(websocket)
            await self._send(websocket, {"type": "subscribed", "channel": channel})

        elif msg_type == "unsubscribe":
            channel = msg.get("channel")
            if channel:
                CLIENT_CHANNELS[websocket].discard(channel)
                CHANNEL_CLIENTS[channel].discard(websocket)
                if not CHANNEL_CLIENTS[channel]:
                    del CHANNEL_CLIENTS[channel]
            await self._send(websocket, {"type": "unsubscribed", "channel": channel})

        elif msg_type == "ping":
            await self._send(websocket, {"type": "pong"})

        else:
            await self._send(websocket, {"type": "error", "detail": f"unknown type: {msg_type}"})

    async def broadcast(self, channel: str, payload: dict) -> None:
        """Broadcast to all clients subscribed to a channel."""
        for ws in list(CHANNEL_CLIENTS.get(channel, set())):
            try:
                await ws.send_json({
                    "channel": channel,
                    "type": payload.get("type", "message"),
                    "payload": payload,
                })
            except Exception as e:
                logger.warning(f"WS broadcast failed on {channel}: {e}")
                self.disconnect(ws)

    async def publish(self, channel: str, payload: dict) -> None:
        """Publish to Redis pubsub + broadcast locally."""
        if redis_client:
            try:
                await redis_client.publish(channel, json.dumps(payload))
            except Exception as e:
                logger.warning(f"Redis publish failed: {e}")
        await self.broadcast(channel, payload)

    async def _send(self, ws: WebSocket, msg: dict) -> None:
        try:
            await ws.send_json(msg)
        except Exception:
            self.disconnect(ws)

    @property
    def client_count(self) -> int:
        return len(CLIENT_CHANNELS)

    @property
    def channel_count(self) -> int:
        return len(CHANNEL_CLIENTS)

    def get_subscribed_channels(self, websocket: WebSocket) -> list[str]:
        return list(CLIENT_CHANNELS.get(websocket, set()))

    def has_subscribers(self, channel: str) -> bool:
        return len(CHANNEL_CLIENTS.get(channel, set())) > 0

    def get_active_channels(self) -> list[str]:
        return list(CHANNEL_CLIENTS.keys())


ws_manager = WSManager()
