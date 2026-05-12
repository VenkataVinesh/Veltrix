from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from uuid import uuid4
from time import perf_counter, time
import asyncio

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import get_logger
from app.db.models import Base
from app.db.session import engine
from app.ws.manager import ws_manager
from app.services.stream_manager import market_stream

app = FastAPI(title=settings.app_name, version="0.1.0")
logger = get_logger("veltrix.api")
METRICS = {"requests_total": 0, "request_latency_ms": 0.0}

allowed_origins = list(
    dict.fromkeys(
        [
            settings.frontend_url,
            "http://localhost:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
        ]
    )
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix="/api/v1")


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app) -> None:  # type: ignore[no-untyped-def]
        super().__init__(app)
        self.bucket: dict[str, tuple[int, float]] = {}

    async def dispatch(self, request, call_next):  # type: ignore[no-untyped-def]
        start = perf_counter()
        request_id = request.headers.get("x-request-id", str(uuid4()))
        ip = request.client.host if request.client else "unknown"

        # Skip limiter for safe read-only endpoints and CORS preflight requests.
        if request.method == "OPTIONS" or request.url.path in {"/health", "/ready", "/metrics"}:
            response = await call_next(request)
            response.headers["x-request-id"] = request_id
            response.headers["x-content-type-options"] = "nosniff"
            response.headers["x-frame-options"] = "DENY"
            response.headers["content-security-policy"] = "default-src 'self'; connect-src 'self' ws: wss: http: https:;"
            return response

        count, window_started = self.bucket.get(ip, (0, time()))
        now = time()
        if now - window_started >= 60:
            count = 0
            window_started = now

        count += 1
        self.bucket[ip] = (count, window_started)

        if count > settings.request_rate_limit:
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})
        response = await call_next(request)
        METRICS["requests_total"] += 1
        METRICS["request_latency_ms"] = round((perf_counter() - start) * 1000, 2)
        response.headers["x-request-id"] = request_id
        response.headers["x-content-type-options"] = "nosniff"
        response.headers["x-frame-options"] = "DENY"
        response.headers["content-security-policy"] = "default-src 'self'; connect-src 'self' ws: wss: http: https:;"
        logger.info(f"{request.method} {request.url.path} {response.status_code} rid={request_id}")
        return response


app.add_middleware(RateLimitMiddleware)


@app.on_event("startup")
async def startup() -> None:
    """Initialize database, seed default users, and start WebSocket pubsub consumer."""
    # Create database tables
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise

    # Seed default users for local development
    if settings.seed_default_users:
        from app.db.session import SessionLocal
        from app.core.security import hash_password
        from app.db.models import User
        db = SessionLocal()
        try:
            # Check if admin account exists
            admin = db.query(User).filter(User.email == "admin@veltrix.ai").first()
            if not admin:
                admin = User(
                    email="admin@veltrix.ai",
                    password_hash=hash_password("Admin123!"),
                    role="admin",
                    is_active=True
                )
                db.add(admin)
                logger.info("Seeded admin@veltrix.ai (password: Admin123!)")
            
            # Check if demo account exists
            demo = db.query(User).filter(User.email == "demo@veltrix.ai").first()
            if not demo:
                demo = User(
                    email="demo@veltrix.ai",
                    password_hash=hash_password("Demo123!"),
                    role="trader",
                    is_active=True
                )
                db.add(demo)
                logger.info("Seeded demo@veltrix.ai (password: Demo123!)")
            
            db.commit()
        except Exception as e:
            logger.warning(f"Failed to seed default users: {e}")
            db.rollback()
        finally:
            db.close()

    # Start market stream polling
    asyncio.create_task(market_stream.start())
    logger.info("Application startup complete")


@app.on_event("shutdown")
async def shutdown() -> None:
    await market_stream.stop()
    logger.info("Application shutdown complete")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
def ready() -> dict[str, str]:
    return {"status": "ready"}


@app.get("/metrics")
def metrics() -> dict:
    return METRICS


@app.get("/api/v1/providers/health")
def provider_health() -> list[dict]:
    from app.services.market_providers import provider_orchestrator
    return provider_orchestrator.get_provider_status()


@app.get("/api/v1/stream/stats")
def stream_stats() -> dict:
    return {
        "ws_clients": ws_manager.client_count,
        "ws_channels": ws_manager.channel_count,
        "stream": market_stream.get_stats(),
    }
