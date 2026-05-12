from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.services.analytics_service import AnalyticsService

router = APIRouter()


@router.get("/")
async def get_analytics(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    service = AnalyticsService(db)
    return await service.compute_analytics(user.id)
