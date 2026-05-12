"""Unified WebSocket endpoint with multiplexed channel subscriptions."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.ws.manager import ws_manager

router = APIRouter()


@router.websocket("")
async def realtime_stream(websocket: WebSocket) -> None:
    """Single WebSocket endpoint for all realtime subscriptions.
    
    Protocol:
      Client -> Server: {"type": "subscribe", "channel": "market:SPY:1d"}
      Server -> Client: {"type": "subscribed", "channel": "market:SPY:1d"}
      Client -> Server: {"type": "unsubscribe", "channel": "market:SPY:1d"}
      Server -> Client: {"type": "unsubscribed", "channel": "market:SPY:1d"}
      Client -> Server: {"type": "ping"}
      Server -> Client: {"type": "pong"}
      Server -> Client: {"channel": "...", "type": "message", "payload": {...}}
    """
    await ws_manager.connect(websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            await ws_manager.handle_message(websocket, raw)
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(websocket)
