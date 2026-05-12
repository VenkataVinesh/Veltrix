from fastapi import APIRouter

from app.services.macro_service import MacroService

router = APIRouter()


@router.get("/")
async def get_macro_dashboard() -> dict:
    service = MacroService()
    return await service.get_macro_dashboard()
