from fastapi import APIRouter

from app.api.routes import (
	agents,
	analytics,
	auth,
	copilot,
	flows,
	forecasts,
	macro,
	markets,
	notifications,
	optimizer,
	portfolio,
	risk,
	sectors,
	settings,
	signals,
	watchlists,
	ws,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(markets.router, prefix="/markets", tags=["markets"])
api_router.include_router(signals.router, prefix="/signals", tags=["signals"])
api_router.include_router(portfolio.router, prefix="/portfolio", tags=["portfolio"])
api_router.include_router(watchlists.router, prefix="/watchlists", tags=["watchlists"])
api_router.include_router(sectors.router, prefix="/sectors", tags=["sectors"])
api_router.include_router(flows.router, prefix="/flows", tags=["flows"])
api_router.include_router(forecasts.router, prefix="/forecasts", tags=["forecasts"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(copilot.router, prefix="/copilot", tags=["copilot"])
api_router.include_router(ws.router, prefix="/stream", tags=["stream"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(risk.router, prefix="/risk", tags=["risk"])
api_router.include_router(macro.router, prefix="/macro", tags=["macro"])
api_router.include_router(optimizer.router, prefix="/optimizer", tags=["optimizer"])
api_router.include_router(agents.router, prefix="/agents", tags=["agents"])
