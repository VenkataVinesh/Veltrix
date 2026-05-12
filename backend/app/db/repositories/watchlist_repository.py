from sqlalchemy.orm import Session

from app.db.models import Watchlist
from app.db.repositories.base import BaseRepository


class WatchlistRepository(BaseRepository[Watchlist]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, Watchlist)

    def list_by_user(self, user_id: int, offset: int, limit: int, search: str | None = None) -> list[Watchlist]:
        query = self.db.query(Watchlist).filter(Watchlist.user_id == user_id)
        if search:
            query = query.filter(Watchlist.symbol.ilike(f"%{search.upper()}%"))
        return query.order_by(Watchlist.created_at.desc()).offset(offset).limit(limit).all()

    def get_by_user_and_symbol(self, user_id: int, symbol: str) -> Watchlist | None:
        return self.db.query(Watchlist).filter(Watchlist.user_id == user_id, Watchlist.symbol == symbol.upper()).first()
