"""
MediVerify AI — /history Route
Scan history CRUD endpoints
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional
import logging

from database.db import get_history, delete_scan, get_stats

logger = logging.getLogger("mediverify.routes.history")
router = APIRouter()


@router.get("/history")
async def get_scan_history(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    verdict: Optional[str] = Query(None, regex="^(fake|genuine|suspect)$"),
    medicine: Optional[str] = None
):
    """
    Get paginated scan history with optional filters.
    
    - limit: Max results (1-200)
    - offset: Pagination offset
    - verdict: Filter by verdict (fake/genuine/suspect)
    - medicine: Filter by medicine name (partial match)
    """
    try:
        results = await get_history(limit=limit, offset=offset, verdict=verdict, medicine=medicine)
        total = len(results)
        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "results": results
        }
    except Exception as e:
        logger.error(f"History fetch failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/stats")
async def scan_stats():
    """Get aggregated scan statistics"""
    try:
        return await get_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/history/{scan_id}")
async def delete_scan_record(scan_id: str):
    """Delete a specific scan record"""
    try:
        deleted = await delete_scan(scan_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Scan not found")
        return {"message": "Scan deleted successfully", "scan_id": scan_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/history")
async def clear_history():
    """Clear all scan history"""
    from database.db import clear_all_scans
    await clear_all_scans()
    return {"message": "History cleared"}
