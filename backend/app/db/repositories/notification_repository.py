from sqlalchemy.orm import Session

from app.db.models import Notification
from app.db.repositories.base import BaseRepository


class NotificationRepository(BaseRepository[Notification]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, Notification)

    def list_by_user(self, user_id: int, unread_only: bool, offset: int, limit: int) -> list[Notification]:
        query = self.db.query(Notification).filter(Notification.user_id == user_id)
        if unread_only:
            query = query.filter(Notification.is_read.is_(False))
        return query.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()
