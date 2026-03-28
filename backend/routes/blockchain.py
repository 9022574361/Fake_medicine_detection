"""
MediVerify AI — /verify_blockchain Route
Blockchain verification endpoints
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging

from models.blockchain_engine import get_blockchain

logger = logging.getLogger("mediverify.routes.blockchain")
router = APIRouter()


class VerifyHashRequest(BaseModel):
    hash: str


class VerifyBatchRequest(BaseModel):
    medicine_name: str
    batch_id: str
    manufacturer: str


class RegisterBatchRequest(BaseModel):
    medicine_name: str
    batch_id: str
    manufacturer: str
    expiry: str


@router.post("/verify_blockchain")
async def verify_blockchain(request: VerifyHashRequest):
    """Verify a medicine batch hash on the MediChain blockchain"""
    if not request.hash or len(request.hash) < 10:
        raise HTTPException(status_code=400, detail="Invalid hash format")

    try:
        bc = get_blockchain()
        result = bc.verify_hash(request.hash)
        return result
    except Exception as e:
        logger.error(f"Blockchain verification failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/verify_blockchain/batch")
async def verify_batch(request: VerifyBatchRequest):
    """Verify by medicine details (name + batch + manufacturer)"""
    try:
        bc = get_blockchain()
        result = bc.verify_batch_by_details(
            request.medicine_name,
            request.batch_id,
            request.manufacturer
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/verify_blockchain/register")
async def register_batch(request: RegisterBatchRequest):
    """Register a new verified medicine batch on the blockchain"""
    try:
        bc = get_blockchain()
        result = bc.register_batch(
            request.medicine_name,
            request.batch_id,
            request.manufacturer,
            request.expiry
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/verify_blockchain/chain")
async def get_chain():
    """Get recent blockchain blocks"""
    bc = get_blockchain()
    return {
        "blocks": bc.get_recent_blocks(10),
        "stats": bc.get_chain_stats()
    }


@router.get("/verify_blockchain/stats")
async def blockchain_stats():
    """Get MediChain network statistics"""
    bc = get_blockchain()
    return bc.get_chain_stats()
