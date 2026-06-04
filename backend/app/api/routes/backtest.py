from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.services.backtester import run_backtest

router = APIRouter()


class BacktestRequest(BaseModel):
    symbol: str = Field(..., description="Ticker symbol to backtest (e.g., AAPL)")
    timeframe: str = Field("1d", description="OHLCV timeframe (e.g., 1d, 1h)")
    fast_window: int = Field(20, ge=2, le=200, description="Fast moving average period")
    slow_window: int = Field(50, ge=5, le=500, description="Slow moving average period")
    ma_type: str = Field("sma", description="Moving average type: 'sma' or 'ema'")
    direction_type: str = Field("long_only", description="Position direction profile: 'long_only' or 'long_short'")


@router.post("/")
async def execute_backtest(payload: BacktestRequest) -> dict:
    """Executes a vectorized crossover strategy backtest on historical price series."""
    if payload.fast_window >= payload.slow_window:
        raise HTTPException(
            status_code=400,
            detail="Fast window size must be strictly less than slow window size."
        )

    try:
        result = await run_backtest(
            symbol=payload.symbol,
            timeframe=payload.timeframe,
            fast_window=payload.fast_window,
            slow_window=payload.slow_window,
            ma_type=payload.ma_type,
            direction_type=payload.direction_type
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Backtest execution failed: {str(e)}"
        )
