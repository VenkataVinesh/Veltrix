from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.services.risk_service import RiskService

router = APIRouter()


@router.get("/")
async def get_risk_engine(
    confidence: float = Query(default=0.95, ge=0.8, le=0.99),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    service = RiskService(db)
    return await service.compute_risk(user.id, confidence=confidence)
