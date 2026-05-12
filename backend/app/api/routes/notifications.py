from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import Notification, User
from app.db.repositories.notification_repository import NotificationRepository
from app.db.session import get_db
from app.ws.manager import ws_manager

router = APIRouter()


@router.get("/")
def list_notifications(
    unread_only: bool = False,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    repo = NotificationRepository(db)
    rows = repo.list_by_user(user.id, unread_only, offset, limit)
    return [{"id": row.id, "message": row.message, "is_read": row.is_read, "created_at": row.created_at.isoformat()} for row in rows]


@router.post("/")
async def create_notification(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    message = payload.get("message", "")
    row = Notification(user_id=user.id, message=message)
    db.add(row)
    db.commit()
    db.refresh(row)
    await ws_manager.publish(f"user:{user.id}:notifications", {"type": "notification", "id": row.id, "message": row.message})
    return {"id": row.id, "message": row.message}


@router.post("/{notification_id}/read")
def mark_read(notification_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    row = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user.id).first()
    if row:
        row.is_read = True
        db.commit()
    return {"status": "ok"}
