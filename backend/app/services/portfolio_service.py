"""Portfolio management service with CRUD operations and calculations."""

from datetime import datetime
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.db.models import Portfolio, Position, Transaction, PortfolioSnapshot, User
from app.services.market_providers import ProviderOrchestrator, provider_orchestrator


class PortfolioService:
    """Handle portfolio operations including positions, transactions, and analytics."""

    def __init__(self, db: Session, market_provider: Optional[ProviderOrchestrator] = None):
        self.db = db
        self.market_provider = market_provider or provider_orchestrator

    # ============================================================================
    # PORTFOLIO MANAGEMENT
    # ============================================================================

    def create_portfolio(self, user_id: int, name: str, metadata: dict = None) -> Portfolio:
        """Create a new portfolio for user."""
        portfolio = Portfolio(
            user_id=user_id,
            name=name,
            portfolio_metadata=metadata or {}
        )
        self.db.add(portfolio)
        self.db.commit()
        self.db.refresh(portfolio)
        return portfolio

    def get_user_portfolios(self, user_id: int) -> List[Portfolio]:
        """Get all portfolios for a user."""
        return self.db.query(Portfolio).filter(Portfolio.user_id == user_id).all()

    def get_portfolio(self, portfolio_id: int, user_id: int) -> Optional[Portfolio]:
        """Get specific portfolio (with authorization check)."""
        return self.db.query(Portfolio).filter(
            and_(Portfolio.id == portfolio_id, Portfolio.user_id == user_id)
        ).first()

    def update_portfolio(self, portfolio_id: int, user_id: int, name: str = None, metadata: dict = None) -> Optional[Portfolio]:
        """Update portfolio metadata."""
        portfolio = self.get_portfolio(portfolio_id, user_id)
        if not portfolio:
            return None
        if name:
            portfolio.name = name
        if metadata:
            portfolio.portfolio_metadata = metadata
        self.db.commit()
        self.db.refresh(portfolio)
        return portfolio

    def delete_portfolio(self, portfolio_id: int, user_id: int) -> bool:
        """Delete portfolio and all associated positions."""
        portfolio = self.get_portfolio(portfolio_id, user_id)
        if not portfolio:
            return False
        # Delete positions
        self.db.query(Position).filter(Position.portfolio_id == portfolio_id).delete()
        # Delete transactions
        self.db.query(Transaction).filter(Transaction.portfolio_id == portfolio_id).delete()
        # Delete snapshots
        self.db.query(PortfolioSnapshot).filter(PortfolioSnapshot.portfolio_id == portfolio_id).delete()
        # Delete portfolio
        self.db.delete(portfolio)
        self.db.commit()
        return True

    # ============================================================================
    # POSITION MANAGEMENT
    # ============================================================================

    def add_position(self, portfolio_id: int, symbol: str, quantity: float, avg_price: float) -> Position:
        """Add new position to portfolio."""
        position = Position(
            portfolio_id=portfolio_id,
            symbol=symbol,
            quantity=quantity,
            avg_price=avg_price
        )
        self.db.add(position)
        self.db.commit()
        self.db.refresh(position)
        return position

    def get_positions(self, portfolio_id: int) -> List[Position]:
        """Get all positions in portfolio."""
        return self.db.query(Position).filter(Position.portfolio_id == portfolio_id).all()

    def get_position(self, position_id: int, portfolio_id: int) -> Optional[Position]:
        """Get specific position."""
        return self.db.query(Position).filter(
            and_(Position.id == position_id, Position.portfolio_id == portfolio_id)
        ).first()

    def update_position(self, position_id: int, portfolio_id: int, quantity: float = None, avg_price: float = None) -> Optional[Position]:
        """Update position quantity or average cost."""
        position = self.get_position(position_id, portfolio_id)
        if not position:
            return None
        if quantity is not None:
            position.quantity = quantity
        if avg_price is not None:
            position.avg_price = avg_price
        position.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(position)
        return position

    def delete_position(self, position_id: int, portfolio_id: int) -> bool:
        """Delete position from portfolio."""
        position = self.get_position(position_id, portfolio_id)
        if not position:
            return False
        self.db.delete(position)
        self.db.commit()
        return True

    def close_position(self, position_id: int, portfolio_id: int, exit_price: float, exit_date: datetime = None) -> Optional[Transaction]:
        """Close a position by creating a SELL transaction."""
        position = self.get_position(position_id, portfolio_id)
        if not position:
            return None

        # Record the sell transaction
        transaction = Transaction(
            portfolio_id=portfolio_id,
            symbol=position.symbol,
            action="SELL",
            quantity=position.quantity,
            price=exit_price,
            total=position.quantity * exit_price,
            commission=0.0,
            transaction_date=exit_date or datetime.utcnow()
        )
        self.db.add(transaction)
        
        # Delete the position
        self.db.delete(position)
        self.db.commit()
        self.db.refresh(transaction)
        return transaction

    # ============================================================================
    # TRANSACTION MANAGEMENT
    # ============================================================================

    def add_transaction(self, portfolio_id: int, symbol: str, action: str, quantity: float, 
                       price: float, commission: float = 0.0, transaction_date: datetime = None) -> Transaction:
        """Record a transaction (buy/sell/dividend)."""
        transaction = Transaction(
            portfolio_id=portfolio_id,
            symbol=symbol,
            action=action,
            quantity=quantity,
            price=price,
            total=quantity * price,
            commission=commission,
            transaction_date=transaction_date or datetime.utcnow()
        )
        self.db.add(transaction)
        self.db.commit()
        self.db.refresh(transaction)
        return transaction

    def get_transactions(self, portfolio_id: int, symbol: str = None) -> List[Transaction]:
        """Get transactions for portfolio, optionally filtered by symbol."""
        query = self.db.query(Transaction).filter(Transaction.portfolio_id == portfolio_id)
        if symbol:
            query = query.filter(Transaction.symbol == symbol)
        return query.order_by(Transaction.transaction_date.desc()).all()

    # ============================================================================
    # PORTFOLIO ANALYTICS
    # ============================================================================

    async def calculate_portfolio_value(self, portfolio_id: int) -> Tuple[float, float, dict]:
        """Calculate current portfolio value, total P&L, and per-symbol details."""
        positions = self.get_positions(portfolio_id)
        if not positions:
            return 0.0, 0.0, {}

        # Get current prices from market provider
        symbols = [p.symbol for p in positions]
        quotes = await self.market_provider.get_quotes(symbols)
        quote_dict = {q.get("symbol"): q.get("price", 0) for q in quotes}

        total_value = 0.0
        total_invested = 0.0
        details = {}

        for pos in positions:
            current_price = quote_dict.get(pos.symbol, pos.avg_price)
            position_value = pos.quantity * current_price
            position_invested = pos.quantity * pos.avg_price
            position_pnl = position_value - position_invested

            total_value += position_value
            total_invested += position_invested

            details[pos.symbol] = {
                "position_id": pos.id,
                "quantity": pos.quantity,
                "avg_price": pos.avg_price,
                "current_price": current_price,
                "position_value": position_value,
                "position_invested": position_invested,
                "position_pnl": position_pnl,
                "position_pnl_pct": (position_pnl / position_invested * 100) if position_invested > 0 else 0.0
            }

        total_pnl = total_value - total_invested
        return total_value, total_pnl, details

    async def get_portfolio_summary(self, portfolio_id: int) -> dict:
        """Get portfolio summary (equity, P&L, positions count, allocation)."""
        positions = self.get_positions(portfolio_id)
        if not positions:
            return {
                "portfolio_id": portfolio_id,
                "total_equity": 0.0,
                "total_pnl": 0.0,
                "daily_pnl": 0.0,
                "positions": 0,
                "allocation": [],
                "symbols": []
            }

        # Get current prices (synchronously for now)
        symbols = [p.symbol for p in positions]
        quotes = await self.market_provider.get_quotes(symbols)
        quote_dict = {q.get("symbol"): q.get("price", 0) for q in quotes}

        total_value = 0.0
        total_invested = 0.0
        allocation = []

        for pos in positions:
            current_price = quote_dict.get(pos.symbol, pos.avg_price)
            position_value = pos.quantity * current_price
            position_invested = pos.quantity * pos.avg_price

            total_value += position_value
            total_invested += position_invested

            allocation.append({
                "symbol": pos.symbol,
                "weight": None,  # Will calculate after total
                "shares": pos.quantity,
                "current_price": current_price,
                "avg_cost": pos.avg_price,
                "value": position_value,
                "pnl": position_value - position_invested,
                "pnl_pct": ((position_value - position_invested) / position_invested * 100) if position_invested > 0 else 0.0
            })

        # Calculate weights
        for item in allocation:
            item["weight"] = (item["value"] / total_value * 100) if total_value > 0 else 0.0

        total_pnl = total_value - total_invested

        return {
            "portfolio_id": portfolio_id,
            "total_equity": total_value,
            "total_invested": total_invested,
            "total_pnl": total_pnl,
            "total_pnl_pct": (total_pnl / total_invested * 100) if total_invested > 0 else 0.0,
            "daily_pnl": 0.0,  # TODO: Calculate from historical data
            "positions": len(positions),
            "allocation": allocation,
            "symbols": symbols
        }

    def save_portfolio_snapshot(self, portfolio_id: int, total_equity: float, total_pnl: float, 
                              daily_pnl: float = 0.0, volatility: float = 0.0, 
                              sharpe_ratio: float = 0.0, max_drawdown: float = 0.0) -> PortfolioSnapshot:
        """Save portfolio snapshot for historical tracking."""
        # Calculate total invested from positions
        positions = self.get_positions(portfolio_id)
        total_invested = sum(p.quantity * p.avg_price for p in positions)

        snapshot = PortfolioSnapshot(
            portfolio_id=portfolio_id,
            total_equity=total_equity,
            total_invested=total_invested,
            total_pnl=total_pnl,
            daily_pnl=daily_pnl,
            volatility=volatility,
            sharpe_ratio=sharpe_ratio,
            max_drawdown=max_drawdown
        )
        self.db.add(snapshot)
        self.db.commit()
        self.db.refresh(snapshot)
        return snapshot

    def get_portfolio_history(self, portfolio_id: int, days: int = 30) -> List[PortfolioSnapshot]:
        """Get historical portfolio snapshots."""
        from datetime import timedelta
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        return self.db.query(PortfolioSnapshot).filter(
            and_(
                PortfolioSnapshot.portfolio_id == portfolio_id,
                PortfolioSnapshot.captured_at >= cutoff_date
            )
        ).order_by(PortfolioSnapshot.captured_at.asc()).all()

    # ============================================================================
    # PERFORMANCE METRICS
    # ============================================================================

    def calculate_sharpe_ratio(self, portfolio_id: int, days: int = 252) -> float:
        """Calculate Sharpe ratio from historical performance."""
        history = self.get_portfolio_history(portfolio_id, days)
        if len(history) < 2:
            return 0.0

        # Calculate daily returns
        returns = []
        for i in range(1, len(history)):
            prev_equity = history[i - 1].total_equity
            curr_equity = history[i].total_equity
            if prev_equity > 0:
                daily_return = (curr_equity - prev_equity) / prev_equity
                returns.append(daily_return)

        if not returns:
            return 0.0

        import statistics
        avg_return = statistics.mean(returns)
        std_dev = statistics.stdev(returns) if len(returns) > 1 else 0.0
        
        # Risk-free rate (assume 4% annual = 0.04/252 daily)
        risk_free_rate = 0.04 / 252

        if std_dev == 0:
            return 0.0

        sharpe = (avg_return - risk_free_rate) / std_dev
        return sharpe

    def calculate_max_drawdown(self, portfolio_id: int, days: int = 252) -> float:
        """Calculate maximum drawdown from historical performance."""
        history = self.get_portfolio_history(portfolio_id, days)
        if not history:
            return 0.0

        running_max = history[0].total_equity
        max_drawdown = 0.0

        for snapshot in history:
            if snapshot.total_equity > running_max:
                running_max = snapshot.total_equity
            drawdown = (running_max - snapshot.total_equity) / running_max if running_max > 0 else 0.0
            if drawdown > max_drawdown:
                max_drawdown = drawdown

        return max_drawdown

    def calculate_volatility(self, portfolio_id: int, days: int = 30) -> float:
        """Calculate portfolio volatility from historical returns."""
        history = self.get_portfolio_history(portfolio_id, days)
        if len(history) < 2:
            return 0.0

        returns = []
        for i in range(1, len(history)):
            prev_equity = history[i - 1].total_equity
            curr_equity = history[i].total_equity
            if prev_equity > 0:
                daily_return = (curr_equity - prev_equity) / prev_equity
                returns.append(daily_return)

        if not returns:
            return 0.0

        import statistics
        return statistics.stdev(returns) * (252 ** 0.5)  # Annualized
