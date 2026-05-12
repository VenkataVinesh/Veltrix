from pydantic import BaseModel, Field
from fastapi import APIRouter

from app.services.optimizer_service import OptimizerInput, OptimizerService

router = APIRouter()


class OptimizeRequest(BaseModel):
    amount: float = Field(ge=100.0)
    risk_tolerance: str = "medium"
    horizon: str = "long"
    preferred_sectors: list[str] = []
    ethical: bool = False
    dividend_preference: bool = False
    volatility_tolerance: str = "medium"


@router.post("/")
async def optimize_portfolio(payload: OptimizeRequest) -> dict:
    service = OptimizerService()
    result = await service.optimize(
        OptimizerInput(
            amount=payload.amount,
            risk_tolerance=payload.risk_tolerance,
            horizon=payload.horizon,
            preferred_sectors=payload.preferred_sectors,
            ethical=payload.ethical,
            dividend_preference=payload.dividend_preference,
            volatility_tolerance=payload.volatility_tolerance,
        )
    )
    return result
