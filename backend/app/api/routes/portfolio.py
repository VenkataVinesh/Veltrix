"""Portfolio API endpoints for CRUD operations and analytics."""

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import User, Portfolio, Position, Transaction
from app.db.session import get_db
from app.services.portfolio_service import PortfolioService

router = APIRouter()

# ============================================================================
# SCHEMAS (Pydantic models for request/response)
# ============================================================================


class PositionCreate(BaseModel):
    symbol: str
    quantity: float
    avg_price: float


class PositionUpdate(BaseModel):
    quantity: Optional[float] = None
    avg_price: Optional[float] = None


class PositionResponse(BaseModel):
    id: int
    symbol: str
    quantity: float
    avg_price: float
    current_price: float
    position_value: float
    position_pnl: float
    position_pnl_pct: float


class PortfolioCreate(BaseModel):
    name: str
    metadata: Optional[dict] = None


class PortfolioUpdate(BaseModel):
    name: Optional[str] = None
    metadata: Optional[dict] = None


class PortfolioResponse(BaseModel):
    id: int
    user_id: int
    name: str


class TransactionResponse(BaseModel):
    id: int
    symbol: str
    action: str
    quantity: float
    price: float
    total: float
    transaction_date: datetime


class PortfolioSummaryResponse(BaseModel):
    portfolio_id: int
    total_equity: float
    total_invested: float
    total_pnl: float
    total_pnl_pct: float
    daily_pnl: float
    positions: int
    allocation: List[dict]
    symbols: List[str]


class UserPortfolioSummaryResponse(BaseModel):
    equity: float
    daily_pnl: float
    positions: int
    portfolios: List[dict]


# ============================================================================
# PORTFOLIO ENDPOINTS
# ============================================================================


@router.get("/", response_model=UserPortfolioSummaryResponse)
async def get_portfolio_summary(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> dict:
    """Get user's portfolio summary (total equity, P&L, positions)."""
    try:
        service = PortfolioService(db)
        portfolios = service.get_user_portfolios(user.id)

        if not portfolios:
            return {
                "equity": 0.0,
                "daily_pnl": 0.0,
                "positions": 0,
                "portfolios": []
            }

        total_equity = 0.0
        total_positions = 0
        portfolio_list = []

        for portfolio in portfolios:
            summary = await service.get_portfolio_summary(portfolio.id)
            total_equity += summary.get("total_equity", 0.0)
            total_positions += summary.get("positions", 0)
            portfolio_list.append({
                "id": portfolio.id,
                "name": portfolio.name,
                "equity": summary.get("total_equity", 0.0),
                "positions": summary.get("positions", 0)
            })

        return {
            "equity": total_equity,
            "daily_pnl": 0.0,  # Would need historical data
            "positions": total_positions,
            "portfolios": portfolio_list
        }
    except Exception as e:
        return {
            "equity": 0.0,
            "daily_pnl": 0.0,
            "positions": 0,
            "portfolios": []
        }


# ============================================================================
# PORTFOLIO CRUD
# ============================================================================


@router.post("/", response_model=PortfolioResponse, status_code=status.HTTP_201_CREATED)
def create_portfolio(
    payload: PortfolioCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Portfolio:
    """Create a new portfolio."""
    service = PortfolioService(db)
    portfolio = service.create_portfolio(user.id, payload.name, payload.metadata)
    return portfolio


@router.get("/list", response_model=List[PortfolioResponse])
def list_portfolios(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[Portfolio]:
    """List all user's portfolios."""
    service = PortfolioService(db)
    return service.get_user_portfolios(user.id)


@router.get("/{portfolio_id}", response_model=dict)
async def get_portfolio_details(
    portfolio_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> dict:
    """Get portfolio details with summary and positions."""
    service = PortfolioService(db)
    portfolio = service.get_portfolio(portfolio_id, user.id)
    
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )

    summary = await service.get_portfolio_summary(portfolio_id)
    return {
        "id": portfolio.id,
        "name": portfolio.name,
        "summary": summary
    }


@router.put("/{portfolio_id}", response_model=PortfolioResponse)
def update_portfolio(
    portfolio_id: int,
    payload: PortfolioUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Optional[Portfolio]:
    """Update portfolio metadata."""
    service = PortfolioService(db)
    portfolio = service.update_portfolio(
        portfolio_id, user.id,
        name=payload.name,
        metadata=payload.metadata
    )
    
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )
    
    return portfolio


@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portfolio(
    portfolio_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete portfolio and all associated positions."""
    service = PortfolioService(db)
    success = service.delete_portfolio(portfolio_id, user.id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )


# ============================================================================
# POSITION MANAGEMENT
# ============================================================================


@router.get("/{portfolio_id}/positions", response_model=List[PositionResponse])
async def get_positions(
    portfolio_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[dict]:
    """Get all positions in portfolio."""
    service = PortfolioService(db)
    
    # Verify ownership
    portfolio = service.get_portfolio(portfolio_id, user.id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )

    positions = service.get_positions(portfolio_id)
    
    # Get current prices
    symbols = [p.symbol for p in positions]
    quotes = await service.market_provider.get_quotes(symbols)
    quote_dict = {q.get("symbol"): q.get("price", 0) for q in quotes}

    result = []
    for pos in positions:
        current_price = quote_dict.get(pos.symbol, pos.avg_price)
        position_value = pos.quantity * current_price
        position_pnl = position_value - (pos.quantity * pos.avg_price)
        position_pnl_pct = (position_pnl / (pos.quantity * pos.avg_price) * 100) if pos.avg_price > 0 else 0.0

        result.append({
            "id": pos.id,
            "symbol": pos.symbol,
            "quantity": pos.quantity,
            "avg_price": pos.avg_price,
            "current_price": current_price,
            "position_value": position_value,
            "position_pnl": position_pnl,
            "position_pnl_pct": position_pnl_pct
        })

    return result


@router.post("/{portfolio_id}/positions", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_position(
    portfolio_id: int,
    payload: PositionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> dict:
    """Add position to portfolio (record a buy)."""
    service = PortfolioService(db)
    
    # Verify ownership
    portfolio = service.get_portfolio(portfolio_id, user.id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )

    # Check if position already exists; if so, average the cost
    existing = db.query(Position).filter(
        Position.portfolio_id == portfolio_id,
        Position.symbol == payload.symbol
    ).first()

    if existing:
        # Average the cost basis
        total_shares = existing.quantity + payload.quantity
        total_cost = (existing.quantity * existing.avg_price) + (payload.quantity * payload.avg_price)
        new_avg = total_cost / total_shares

        position = service.update_position(existing.id, portfolio_id, quantity=total_shares, avg_price=new_avg)
    else:
        position = service.add_position(portfolio_id, payload.symbol, payload.quantity, payload.avg_price)

    # Record transaction
    service.add_transaction(
        portfolio_id,
        payload.symbol,
        "BUY",
        payload.quantity,
        payload.avg_price,
        commission=0.0
    )

    # Get current price for response
    print("Fetching quotes in create_position...")
    quotes = await service.market_provider.get_quotes([payload.symbol])
    print("Fetched quotes in create_position:", quotes)
    current_price = quotes[0].get("price", payload.avg_price) if quotes else payload.avg_price
    position_value = position.quantity * current_price
    position_pnl = position_value - (position.quantity * position.avg_price)

    return {
        "id": position.id,
        "symbol": position.symbol,
        "quantity": position.quantity,
        "avg_price": position.avg_price,
        "current_price": current_price,
        "position_value": position_value,
        "position_pnl": position_pnl
    }


@router.put("/{portfolio_id}/positions/{position_id}", response_model=dict)
async def update_position_endpoint(
    portfolio_id: int,
    position_id: int,
    payload: PositionUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> dict:
    """Update position quantity or average cost."""
    service = PortfolioService(db)
    
    # Verify ownership
    portfolio = service.get_portfolio(portfolio_id, user.id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )

    position = service.update_position(
        position_id, portfolio_id,
        quantity=payload.quantity,
        avg_price=payload.avg_price
    )

    if not position:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Position not found"
        )

    # Get current price
    quotes = await service.market_provider.get_quotes([position.symbol])
    current_price = quotes[0].get("price", position.avg_price) if quotes else position.avg_price
    position_value = position.quantity * current_price
    position_pnl = position_value - (position.quantity * position.avg_price)

    return {
        "id": position.id,
        "symbol": position.symbol,
        "quantity": position.quantity,
        "avg_price": position.avg_price,
        "current_price": current_price,
        "position_value": position_value,
        "position_pnl": position_pnl
    }


@router.delete("/{portfolio_id}/positions/{position_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_position_endpoint(
    portfolio_id: int,
    position_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete position (record a sell at current market price)."""
    service = PortfolioService(db)
    
    # Verify ownership
    portfolio = service.get_portfolio(portfolio_id, user.id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )

    position = service.get_position(position_id, portfolio_id)
    if not position:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Position not found"
        )

    # Get current price to record exit
    quotes = await service.market_provider.get_quotes([position.symbol])
    exit_price = quotes[0].get("price", position.avg_price) if quotes else position.avg_price

    service.close_position(position_id, portfolio_id, exit_price)


# ============================================================================
# TRANSACTION HISTORY
# ============================================================================


@router.get("/{portfolio_id}/transactions", response_model=List[TransactionResponse])
def get_transactions(
    portfolio_id: int,
    symbol: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[Transaction]:
    """Get transaction history for portfolio."""
    service = PortfolioService(db)
    
    # Verify ownership
    portfolio = service.get_portfolio(portfolio_id, user.id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )

    return service.get_transactions(portfolio_id, symbol)


# ============================================================================
# PORTFOLIO ANALYTICS
# ============================================================================


@router.get("/{portfolio_id}/analytics", response_model=dict)
def get_portfolio_analytics(
    portfolio_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> dict:
    """Get portfolio analytics (Sharpe, max drawdown, volatility)."""
    service = PortfolioService(db)
    
    # Verify ownership
    portfolio = service.get_portfolio(portfolio_id, user.id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )

    sharpe = service.calculate_sharpe_ratio(portfolio_id)
    max_drawdown = service.calculate_max_drawdown(portfolio_id)
    volatility = service.calculate_volatility(portfolio_id)

    return {
        "portfolio_id": portfolio_id,
        "sharpe_ratio": sharpe,
        "max_drawdown": max_drawdown,
        "volatility": volatility
    }
