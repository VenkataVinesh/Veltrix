from datetime import datetime
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, JSON, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), default="trader", index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    portfolios: Mapped[list["Portfolio"]] = relationship(back_populates="user")
    watchlists: Mapped[list["Watchlist"]] = relationship(back_populates="user")


class Portfolio(Base):
    __tablename__ = "portfolios"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    portfolio_metadata: Mapped[dict] = mapped_column("metadata", JSON, default={})
    user: Mapped[User] = relationship(back_populates="portfolios")


class Position(Base):
    __tablename__ = "positions"
    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id"), index=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    quantity: Mapped[float] = mapped_column(Float)
    avg_price: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id"), index=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    action: Mapped[str] = mapped_column(String(10), index=True)  # BUY, SELL, DIVIDEND
    quantity: Mapped[float] = mapped_column(Float)
    price: Mapped[float] = mapped_column(Float)
    total: Mapped[float] = mapped_column(Float)
    commission: Mapped[float] = mapped_column(Float, default=0.0)
    transaction_date: Mapped[datetime] = mapped_column(DateTime, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"
    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id"), index=True)
    total_equity: Mapped[float] = mapped_column(Float)
    total_invested: Mapped[float] = mapped_column(Float)
    total_pnl: Mapped[float] = mapped_column(Float)
    daily_pnl: Mapped[float] = mapped_column(Float, default=0.0)
    volatility: Mapped[float] = mapped_column(Float, default=0.0)
    sharpe_ratio: Mapped[float] = mapped_column(Float, default=0.0)
    max_drawdown: Mapped[float] = mapped_column(Float, default=0.0)
    captured_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class Watchlist(Base):
    __tablename__ = "watchlists"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    user: Mapped[User] = relationship(back_populates="watchlists")


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    rule: Mapped[dict] = mapped_column(JSON, default={})
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    message: Mapped[str] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class AISignal(Base):
    __tablename__ = "ai_signals"
    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    model: Mapped[str] = mapped_column(String(64), index=True)
    score: Mapped[float] = mapped_column(Float, index=True)
    payload: Mapped[dict] = mapped_column(JSON, default={})
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class Prediction(Base):
    __tablename__ = "predictions"
    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    horizon: Mapped[str] = mapped_column(String(20), index=True)
    value: Mapped[float] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class Conversation(Base):
    __tablename__ = "ai_conversations"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    context: Mapped[dict] = mapped_column(JSON, default={})
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class AIMemory(Base):
    __tablename__ = "ai_memory"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    embedding_key: Mapped[str] = mapped_column(String(255), index=True)
    payload: Mapped[dict] = mapped_column(JSON, default={})
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class Subscription(Base):
    __tablename__ = "subscriptions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    plan: Mapped[str] = mapped_column(String(50), default="pro")
    status: Mapped[str] = mapped_column(String(32), default="active")


class UserSetting(Base):
    __tablename__ = "user_settings"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    preferences: Mapped[dict] = mapped_column(JSON, default={})


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(128), index=True)
    activity_metadata: Mapped[dict] = mapped_column("metadata", JSON, default={})
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class ForecastSnapshot(Base):
    __tablename__ = "forecast_snapshots"
    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    timeframe: Mapped[str] = mapped_column(String(20), index=True)
    model_name: Mapped[str] = mapped_column(String(64), index=True)
    forecast_payload: Mapped[dict] = mapped_column(JSON, default={})
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class AIDecision(Base):
    __tablename__ = "ai_decisions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    decision: Mapped[str] = mapped_column(String(16), index=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    rationale: Mapped[str] = mapped_column(Text, default="")
    timeline_payload: Mapped[dict] = mapped_column(JSON, default={})
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class RiskMetricSnapshot(Base):
    __tablename__ = "risk_metric_snapshots"
    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id"), index=True)
    var_95: Mapped[float] = mapped_column(Float, default=0.0)
    expected_shortfall: Mapped[float] = mapped_column(Float, default=0.0)
    max_drawdown: Mapped[float] = mapped_column(Float, default=0.0)
    concentration_risk: Mapped[float] = mapped_column(Float, default=0.0)
    liquidity_risk: Mapped[float] = mapped_column(Float, default=0.0)
    snapshot_payload: Mapped[dict] = mapped_column(JSON, default={})
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class AnalyticsSnapshot(Base):
    __tablename__ = "analytics_snapshots"
    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id"), index=True)
    total_return: Mapped[float] = mapped_column(Float, default=0.0)
    alpha: Mapped[float] = mapped_column(Float, default=0.0)
    beta: Mapped[float] = mapped_column(Float, default=0.0)
    sharpe: Mapped[float] = mapped_column(Float, default=0.0)
    sortino: Mapped[float] = mapped_column(Float, default=0.0)
    analytics_payload: Mapped[dict] = mapped_column(JSON, default={})
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class WebsocketEvent(Base):
    __tablename__ = "websocket_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    channel: Mapped[str] = mapped_column(String(128), index=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    payload: Mapped[dict] = mapped_column(JSON, default={})
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


Index("idx_predictions_symbol_horizon", Prediction.symbol, Prediction.horizon)
Index("idx_ai_signals_symbol_score", AISignal.symbol, AISignal.score)
Index("idx_forecast_symbol_timeframe", ForecastSnapshot.symbol, ForecastSnapshot.timeframe)
Index("idx_ai_decisions_symbol_created", AIDecision.symbol, AIDecision.created_at)
Index("idx_risk_metrics_portfolio_created", RiskMetricSnapshot.portfolio_id, RiskMetricSnapshot.created_at)
Index("idx_analytics_snapshots_portfolio_created", AnalyticsSnapshot.portfolio_id, AnalyticsSnapshot.created_at)
Index("idx_websocket_events_channel_created", WebsocketEvent.channel, WebsocketEvent.created_at)
