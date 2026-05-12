"""Sector performance API endpoints."""

from typing import List, Dict, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.db.models import User
from app.services.sector_service import SectorService

router = APIRouter()


# ============================================================================
# SCHEMAS
# ============================================================================


class SectorPerformanceResponse(BaseModel):
    name: str
    change: float
    weight: int
    stocks: List[Dict]
    constituent_count: int


class SectorHeatmapResponse(BaseModel):
    name: str
    change: float
    weight: int


class SectorLeadersLosersResponse(BaseModel):
    leaders: List[SectorPerformanceResponse]
    losers: List[SectorPerformanceResponse]


# ============================================================================
# SECTOR ENDPOINTS
# ============================================================================


@router.get("/performance", response_model=List[SectorPerformanceResponse])
async def get_sector_performance(
    user: User = Depends(get_current_user)
) -> List[Dict]:
    """Get current sector performance with constituent stocks."""
    service = SectorService()
    return await service.get_sector_performance()


@router.get("/heatmap", response_model=List[SectorHeatmapResponse])
async def get_sector_heatmap(
    user: User = Depends(get_current_user)
) -> List[Dict]:
    """Get sector data formatted for heatmap visualization."""
    service = SectorService()
    return await service.get_sector_heatmap_data()


@router.get("/leaders-losers", response_model=SectorLeadersLosersResponse)
async def get_leaders_losers(
    limit: int = 3,
    user: User = Depends(get_current_user)
) -> Dict:
    """Get top performing and worst performing sectors."""
    service = SectorService()
    return await service.get_sector_leaders_losers(limit)


@router.get("/{sector_name}", response_model=Dict)
async def get_sector_details(
    sector_name: str,
    user: User = Depends(get_current_user)
) -> Optional[Dict]:
    """Get detailed information about a specific sector."""
    service = SectorService()
    details = await service.get_sector_details(sector_name)
    
    if not details:
        return {
            "error": f"Sector '{sector_name}' not found",
            "available_sectors": list(service.sector_stocks.keys())
        }
    
    return details
