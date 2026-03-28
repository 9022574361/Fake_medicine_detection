"""
MediVerify AI — /predict Route
Direct prediction endpoint without image (for testing)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import logging
import base64

from models.ai_engine import get_ai_engine

logger = logging.getLogger("mediverify.routes.predict")
router = APIRouter()


# =========================
# Request Models
# =========================
class PredictRequest(BaseModel):
    image_base64: str
    include_features: bool = False


class BatchRequest(BaseModel):
    images: List[str]   # list of base64 images


# =========================
# Single Prediction
# =========================
@router.post("/predict")
async def predict(request: PredictRequest):
    """
    Run AI prediction on a base64-encoded image.
    Faster alternative to /scan for API integrations.
    """

    # ✅ Validate input
    if not request.image_base64:
        raise HTTPException(status_code=400, detail="Image data is required")

    # ✅ Decode Base64
    try:
        image_bytes = base64.b64decode(request.image_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image")

    try:
        ai = get_ai_engine()

        # 🔥 MAIN AI CALL
        result = ai.analyze(image_bytes)

        # ✅ Remove heavy features if not needed
        if not request.include_features:
            result.pop("image_features", None)

        # ✅ Safe response
        return {
            "status": "success",
            "verdict": result.get("verdict"),
            "fake_probability": result.get("fake_probability"),
            "confidence": result.get("confidence"),
            "models": result.get("models"),
            "processing_time_ms": result.get("processing_time_ms")
        }

    except Exception as e:
        logger.error(f"Predict failed: {e}")
        raise HTTPException(status_code=500, detail="Prediction failed")


# =========================
# Batch Prediction
# =========================
@router.post("/predict/batch")
async def predict_batch(request: BatchRequest):
    """
    Process multiple images (max 10)
    """

    if len(request.images) > 10:
        raise HTTPException(status_code=400, detail="Max 10 images allowed")

    ai = get_ai_engine()
    results = []

    for img_base64 in request.images:
        try:
            image_bytes = base64.b64decode(img_base64)
            result = ai.analyze(image_bytes)

            results.append({
                "verdict": result.get("verdict"),
                "confidence": result.get("confidence")
            })

        except Exception as e:
            results.append({
                "error": str(e)
            })

    return {
        "status": "success",
        "count": len(results),
        "results": results
    }