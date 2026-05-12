from sqlalchemy.orm import Session

from app.db.models import AIMemory, Conversation
from app.db.repositories.base import BaseRepository


class ConversationRepository(BaseRepository[Conversation]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, Conversation)

    def list_by_user(self, user_id: int, limit: int = 50) -> list[Conversation]:
        return (
            self.db.query(Conversation)
            .filter(Conversation.user_id == user_id)
            .order_by(Conversation.created_at.desc())
            .limit(limit)
            .all()
        )

    def list_memory(self, user_id: int, limit: int = 8) -> list[AIMemory]:
        return (
            self.db.query(AIMemory)
            .filter(AIMemory.user_id == user_id)
            .order_by(AIMemory.created_at.desc())
            .limit(limit)
            .all()
        )
