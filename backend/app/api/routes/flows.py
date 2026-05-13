"""Institutional flow detection API routes."""

from fastapi import APIRouter, Query

from app.services.flow_service import FlowService

router = APIRouter()


@router.get("")
async def get_institutional_flow(
    symbols: str = Query(default="AAPL,NVDA,MSFT,AMZN,TSLA,META,QQQ,SPY,JPM,UNH,XOM,AMD"),
    timeframe: str = Query(default="1d"),
    limit: int = Query(default=6, ge=1, le=20),
) -> dict:
    """Return high-conviction flow candidates derived from live market data."""
    symbol_list = [item.strip().upper() for item in symbols.split(",") if item.strip()]
    service = FlowService(symbol_list)
    return await service._get_flow_feed_async(timeframe=timeframe, limit=limit)