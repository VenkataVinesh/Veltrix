from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Veltrix API"
    env: str = "development"
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expires_min: int = 15
    database_url: str = "sqlite:///./veltrix.db"
    redis_url: str | None = None  # Optional - will gracefully degrade without it
    frontend_url: str = "http://localhost:3000"  # Match Next.js dev server default port
    access_cookie_name: str = "veltrix_access"
    refresh_cookie_name: str = "veltrix_refresh"
    refresh_expires_days: int = 14
    access_expires_min: int = 15
    request_rate_limit: int = 180
    supabase_url: str | None = None
    supabase_key: str | None = None
    seed_default_users: bool = True  # Seed admin@veltrix.ai and demo@veltrix.ai on startup
    alphavantage_api_key: str | None = None
    alphavantage_base_url: str = "https://www.alphavantage.co/query"
    finnhub_api_key: str | None = None
    polygon_api_key: str | None = None
    fred_api_key: str | None = None
    tradingeconomics_api_key: str | None = None
    rapidapi_key: str | None = None
    rapidapi_host: str = "alpha-vantage.p.rapidapi.com"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.0-flash"
    ohlc_cache_ttl: int = 300
    quote_cache_ttl: int = 60
    alphavantage_rpm: int = 5
    finnhub_rpm: int = 100
    polygon_rpm: int = 100
    enable_live_market_data: bool = True
    enable_signals_engine: bool = True
    enable_copilot: bool = True
    enable_ml_inference: bool = True
    enable_fallback_data: bool = True
    market_sync_symbols: str = "SPY,AAPL,NVDA,TSLA,MSFT,AMZN"
    provider_failure_cooldown_sec: int = 30
    redis_warning_cooldown_sec: int = 30
    finnhub_symbol_cap: int = 25

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"


settings = Settings()
