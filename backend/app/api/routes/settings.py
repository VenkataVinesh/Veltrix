from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import Subscription, User, UserSetting
from app.db.session import get_db

router = APIRouter()


@router.get("/preferences")
def get_preferences(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    row = db.query(UserSetting).filter(UserSetting.user_id == user.id).first()
    if not row:
        row = UserSetting(user_id=user.id, preferences={"theme": "dark", "density": "comfortable"})
        db.add(row)
        db.commit()
        db.refresh(row)
    return {"preferences": row.preferences}


@router.put("/preferences")
def update_preferences(payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    row = db.query(UserSetting).filter(UserSetting.user_id == user.id).first()
    if not row:
        row = UserSetting(user_id=user.id, preferences={})
        db.add(row)
    row.preferences = payload.get("preferences", {})
    db.commit()
    return {"preferences": row.preferences}


@router.get("/subscription")
def get_subscription(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    row = db.query(Subscription).filter(Subscription.user_id == user.id).first()
    if not row:
        row = Subscription(user_id=user.id, plan="pro", status="active")
        db.add(row)
        db.commit()
        db.refresh(row)
    return {"plan": row.plan, "status": row.status}
