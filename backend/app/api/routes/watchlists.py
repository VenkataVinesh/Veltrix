from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import User, Watchlist
from app.db.session import get_db

router = APIRouter()


@router.get("/")
def list_watchlist(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[dict]:
    records = (
        db.query(Watchlist)
        .filter(Watchlist.user_id == user.id)
        .order_by(Watchlist.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [{"id": row.id, "symbol": row.symbol, "created_at": row.created_at.isoformat()} for row in records]


@router.post("/{symbol}")
def add_watchlist(symbol: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    row = Watchlist(user_id=user.id, symbol=symbol.upper())
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "symbol": row.symbol}


@router.delete("/{item_id}")
def delete_watchlist(item_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    row = db.query(Watchlist).filter(Watchlist.id == item_id, Watchlist.user_id == user.id).first()
    if row:
        db.delete(row)
        db.commit()
    return {"status": "ok"}
