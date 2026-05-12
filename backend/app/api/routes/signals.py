from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import User, AISignal
from app.db.session import get_db
from app.core.logging import get_logger

router = APIRouter()
logger = get_logger("veltrix.signals")


@router.get("/")
def list_signals(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    symbol: str | None = None,
    min_score: float = Query(0.0, ge=0.0, le=1.0),
) -> list[dict]:
    """Get AI trading signals with optional filtering.
    
    Query signals from the database, filtered by symbol and confidence score.
    Returns signals in descending order by score.
    """
    try:
        query = db.query(AISignal)
        
        # Filter by symbol if provided
        if symbol:
            query = query.filter(AISignal.symbol == symbol.upper())
        
        # Filter by minimum confidence score
        query = query.filter(AISignal.score >= min_score)
        
        # Order by score (highest first) and recency
        query = query.order_by(AISignal.score.desc(), AISignal.created_at.desc())
        
        # Get total count for pagination
        total = query.count()
        
        # Apply pagination
        signals = query.offset(offset).limit(limit).all()
        
        return [
            {
                "id": s.id,
                "symbol": s.symbol,
                "direction": "long" if s.score > 0.5 else "short",
                "confidence": float(s.score),
                "model": s.model,
                "created_at": s.created_at.isoformat(),
                "payload": s.payload or {}
            }
            for s in signals
        ]
    except Exception as e:
        logger.warning(f"Error fetching signals: {e}")
        # Return empty list on error rather than crashing
        return []
