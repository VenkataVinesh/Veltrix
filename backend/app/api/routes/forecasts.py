"""Forecast API routes."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.services.forecast_ensemble_service import ForecastEnsembleService
from app.services.forecast_service import ForecastService

router = APIRouter()


@router.get("")
async def get_forecasts(
    symbols: str = Query(default="SPY,QQQ,AAPL,NVDA,MSFT,AMZN"),
    horizons: str = Query(default="1d,7d,30d"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Return live forecasts derived from price action and signals."""
    symbol_list = [item.strip().upper() for item in symbols.split(",") if item.strip()]
    horizon_list = [item.strip().lower() for item in horizons.split(",") if item.strip()]
    service = ForecastService(db, symbol_list)
    return await service.get_forecasts(horizon_list)


@router.get("/ensemble/{symbol}")
async def get_ensemble_forecast(
    symbol: str,
    timeframe: str = Query(default="1d"),
    user: User = Depends(get_current_user),
) -> dict:
    """Return institutional forecast payload for one symbol.

    Includes model-level outputs, confidence interval, volatility cone,
    and support/resistance bands.
    """
    service = ForecastEnsembleService()
    return await service.build_forecast(symbol.upper(), timeframe=timeframe.lower())