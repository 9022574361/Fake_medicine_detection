"""
MediVerify AI — /scan Route
Main scanning endpoint: accepts image → returns full AI analysis
"""

from fastapi import APIRouter, File, UploadFile, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging

from models.ai_engine import get_ai_engine
from models.blockchain_engine import get_blockchain
from database.db import save_scan

logger = logging.getLogger("mediverify.routes.scan")
router = APIRouter()


class ScanResponse(BaseModel):
    medicine_name: str
    verdict: str
    fake_probability: float
    confidence: float
    batch_id: Optional[str]
    expiry: Optional[str]
    manufacturer: Optional[str]
    blockchain_hash: str
    blockchain_verified: bool
    ocr_text: str
    models: Dict[str, float]
    detections: List[Dict]
    processing_time_ms: float
    scan_id: str


@router.post("/scan", response_model=dict)
async def scan_medicine(file: UploadFile = File(...)):
    """
    Analyze a medicine image for authenticity.
    
    - Accepts: JPEG, PNG, WebP image
    - Returns: Full analysis with AI predictions, OCR, and blockchain verification
    """
    # Validate file type
    if file.content_type not in ["image/jpeg", "image/png", "image/webp", "image/jpg"]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}. Use JPEG, PNG, or WebP."
        )

    # Read image bytes
    image_bytes = await file.read()
    if len(image_bytes) > 15 * 1024 * 1024:  # 15MB limit
        raise HTTPException(status_code=413, detail="Image too large. Max 15MB.")

    try:
        # Run AI analysis
        ai = get_ai_engine()
        result = ai.analyze(image_bytes)

        # Auto-verify on blockchain
        bc = get_blockchain()
        if result.get("batch_id"):
            bc_result = bc.verify_batch_by_details(
                result["medicine_name"],
                result["batch_id"],
                result.get("manufacturer", "Unknown")
            )
            result["blockchain_verified"] = bc_result["verified"]
            result["blockchain_confirmations"] = bc_result["confirmations"]

        # Save to database
        import uuid
        scan_id = str(uuid.uuid4())[:8].upper()
        result["scan_id"] = scan_id
        await save_scan(result)

        logger.info(
            f"Scan complete | ID:{scan_id} | "
            f"Medicine:{result['medicine_name']} | "
            f"Verdict:{result['verdict']} | "
            f"Time:{result['processing_time_ms']}ms"
        )

        return result

    except Exception as e:
        logger.error(f"Scan failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/scan/{scan_id}")
async def get_scan(scan_id: str):
    """Retrieve a previous scan result by ID"""
    from database.db import get_scan_by_id
    result = await get_scan_by_id(scan_id)
    if not result:
        raise HTTPException(status_code=404, detail="Scan not found")
    return result
