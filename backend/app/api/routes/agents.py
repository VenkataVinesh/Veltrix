from pydantic import BaseModel
from fastapi import APIRouter

from app.services.agent_orchestration_service import AgentOrchestrationService

router = APIRouter()


class AgentDebateRequest(BaseModel):
    symbol: str
    context: dict = {}


@router.post("/debate")
async def run_agent_debate(payload: AgentDebateRequest) -> dict:
    service = AgentOrchestrationService()
    return await service.run_debate(payload.symbol, payload.context)
