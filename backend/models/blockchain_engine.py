"""
MediVerify AI — Blockchain Engine
Simulated smart contract for medicine batch verification.
In production: connects to Ethereum/Polygon network.
"""

import hashlib
import json
import time
import random
import logging
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any
from datetime import datetime

logger = logging.getLogger("mediverify.blockchain")


# ─── Data Classes ────────────────────────────────────────
@dataclass
class Transaction:
    tx_id: str
    batch_hash: str
    medicine_name: str
    manufacturer: str
    batch_id: str
    timestamp: float
    verified: bool
    block_number: int


@dataclass
class Block:
    index: int
    timestamp: float
    transactions: List[Transaction]
    previous_hash: str
    nonce: int = 0
    hash: str = ""

    def compute_hash(self) -> str:
        block_data = {
            "index": self.index,
            "timestamp": self.timestamp,
            "transactions": [asdict(t) for t in self.transactions],
            "previous_hash": self.previous_hash,
            "nonce": self.nonce
        }
        return "0x" + hashlib.sha256(
            json.dumps(block_data, sort_keys=True).encode()
        ).hexdigest()

    def mine(self, difficulty: int = 2):
        """Proof of work — find nonce where hash starts with 0s"""
        target = "0" * difficulty
        while not self.hash[2:2+difficulty] == target:
            self.nonce += 1
            self.hash = self.compute_hash()
        return self.hash


# ─── Medicine Registry (Simulated Smart Contract) ────────
MEDICINE_REGISTRY: Dict[str, Dict] = {
    "paracetamol_500mg": {
        "name": "Paracetamol 500mg",
        "manufacturers": ["Sun Pharma", "GSK", "Cipla"],
        "valid_batches": ["BTH-1001", "BTH-1002", "BTH-2210", "BTH-4421"],
        "approved": True
    },
    "amoxicillin_250mg": {
        "name": "Amoxicillin 250mg",
        "manufacturers": ["Cipla", "Dr. Reddys"],
        "valid_batches": ["BTH-2001", "BTH-2002", "BTH-2817"],
        "approved": True
    },
    "metformin_850mg": {
        "name": "Metformin 850mg",
        "manufacturers": ["Lupin", "Sun Pharma", "Alkem"],
        "valid_batches": ["BTH-3001", "BTH-9932", "BTH-4451"],
        "approved": True
    },
    "atorvastatin_10mg": {
        "name": "Atorvastatin 10mg",
        "manufacturers": ["Pfizer", "Sun Pharma", "Cadila"],
        "valid_batches": ["BTH-1105", "BTH-5500"],
        "approved": True
    }
}


# ─── Blockchain Engine ───────────────────────────────────
class MediChainEngine:
    """
    Simulated MediChain blockchain for medicine verification.
    
    Smart Contract Functions:
    - verify_batch(hash) → bool
    - register_batch(batch_data) → tx_hash
    - get_batch_history(medicine_name) → List[Transaction]
    - validate_manufacturer(manufacturer, medicine) → bool
    """

    NETWORK_NODES = 12
    CONFIRMATION_THRESHOLD = 6

    def __init__(self):
        self.chain: List[Block] = []
        self.pending_transactions: List[Transaction] = []
        self.verified_hashes: Dict[str, bool] = {}
        self._create_genesis_block()
        self._seed_initial_data()
        logger.info("MediChain blockchain initialized ✓")

    def _create_genesis_block(self):
        genesis = Block(
            index=0,
            timestamp=time.time() - 86400 * 30,
            transactions=[],
            previous_hash="0x0000000000000000000000000000000000000000000000000000000000000000"
        )
        genesis.hash = genesis.compute_hash()
        self.chain.append(genesis)

    def _seed_initial_data(self):
        """Seed blockchain with known medicine records"""
        medicines = list(MEDICINE_REGISTRY.values())
        for i, med in enumerate(medicines):
            for batch in med["valid_batches"]:
                batch_hash = self._compute_batch_hash(
                    med["name"], batch, med["manufacturers"][0]
                )
                self.verified_hashes[batch_hash] = True

                tx = Transaction(
                    tx_id=f"0x{hashlib.md5(f'{med}{batch}'.encode()).hexdigest()}",
                    batch_hash=batch_hash,
                    medicine_name=med["name"],
                    manufacturer=med["manufacturers"][0],
                    batch_id=batch,
                    timestamp=time.time() - random.randint(0, 86400 * 30),
                    verified=True,
                    block_number=i + 1
                )
                self.pending_transactions.append(tx)

        # Mine pending transactions into blocks
        self._mine_pending_transactions()

    def _compute_batch_hash(self, name: str, batch_id: str, manufacturer: str) -> str:
        data = f"{name.lower().strip()}{batch_id.upper()}{manufacturer.lower()}"
        return "0x" + hashlib.sha256(data.encode()).hexdigest()

    def _mine_pending_transactions(self):
        """Create a new block from pending transactions"""
        if not self.pending_transactions:
            return

        prev_block = self.chain[-1]
        new_block = Block(
            index=len(self.chain),
            timestamp=time.time(),
            transactions=self.pending_transactions[:10],
            previous_hash=prev_block.hash
        )
        new_block.hash = new_block.compute_hash()
        self.chain.append(new_block)
        self.pending_transactions = self.pending_transactions[10:]

    def verify_hash(self, batch_hash: str) -> Dict[str, Any]:
        """
        Smart contract: verifyBatch(bytes32 batchHash) returns (bool)
        Queries 12 nodes for confirmation.
        """
        # Check against known hashes
        is_verified = self.verified_hashes.get(batch_hash, False)

        # Simulate node confirmations
        node_results = []
        confirmations = 0
        for i in range(self.NETWORK_NODES):
            if is_verified:
                confirmed = random.random() > 0.05  # 95% nodes confirm
            else:
                confirmed = random.random() > 0.85  # 15% false positive
            node_results.append({
                "node_id": f"medichain-node-{i+1:02d}",
                "confirmed": confirmed,
                "response_ms": random.randint(10, 200)
            })
            if confirmed:
                confirmations += 1

        final_verified = confirmations >= self.CONFIRMATION_THRESHOLD

        # Find transaction if verified
        tx_data = None
        if final_verified:
            for block in self.chain:
                for tx in block.transactions:
                    if tx.batch_hash == batch_hash:
                        tx_data = asdict(tx)
                        tx_data["block_number"] = block.index
                        break

        return {
            "hash": batch_hash,
            "verified": final_verified,
            "confirmations": confirmations,
            "required_confirmations": self.CONFIRMATION_THRESHOLD,
            "total_nodes": self.NETWORK_NODES,
            "node_results": node_results,
            "transaction": tx_data,
            "chain_length": len(self.chain),
            "network": "MediChain v2.0",
            "timestamp": time.time()
        }

    def verify_batch_by_details(
        self,
        medicine_name: str,
        batch_id: str,
        manufacturer: str
    ) -> Dict[str, Any]:
        """Verify by medicine details"""
        batch_hash = self._compute_batch_hash(medicine_name, batch_id, manufacturer)
        result = self.verify_hash(batch_hash)
        result["medicine_name"] = medicine_name
        result["batch_id"] = batch_id
        result["manufacturer"] = manufacturer
        return result

    def register_batch(
        self,
        medicine_name: str,
        batch_id: str,
        manufacturer: str,
        expiry: str
    ) -> Dict[str, Any]:
        """Register a new medicine batch on the blockchain"""
        batch_hash = self._compute_batch_hash(medicine_name, batch_id, manufacturer)

        tx = Transaction(
            tx_id="0x" + hashlib.sha256(f"{batch_hash}{time.time()}".encode()).hexdigest(),
            batch_hash=batch_hash,
            medicine_name=medicine_name,
            manufacturer=manufacturer,
            batch_id=batch_id,
            timestamp=time.time(),
            verified=True,
            block_number=len(self.chain)
        )
        self.verified_hashes[batch_hash] = True
        self.pending_transactions.append(tx)
        self._mine_pending_transactions()

        return {
            "success": True,
            "tx_id": tx.tx_id,
            "batch_hash": batch_hash,
            "block_number": len(self.chain),
            "message": "Batch successfully registered on MediChain"
        }

    def get_chain_stats(self) -> Dict[str, Any]:
        return {
            "total_blocks": len(self.chain),
            "total_transactions": sum(len(b.transactions) for b in self.chain),
            "verified_batches": len(self.verified_hashes),
            "network_nodes": self.NETWORK_NODES,
            "chain_integrity": self.validate_chain()
        }

    def validate_chain(self) -> bool:
        """Validate blockchain integrity"""
        for i in range(1, len(self.chain)):
            curr = self.chain[i]
            prev = self.chain[i - 1]
            if curr.previous_hash != prev.hash:
                return False
        return True

    def get_recent_blocks(self, n: int = 10) -> List[Dict]:
        blocks = self.chain[-n:][::-1]
        return [{
            "index": b.index,
            "hash": b.hash,
            "prev_hash": b.previous_hash,
            "timestamp": b.timestamp,
            "tx_count": len(b.transactions),
            "verified": True
        } for b in blocks]


# Singleton
_blockchain: Optional[MediChainEngine] = None

def get_blockchain() -> MediChainEngine:
    global _blockchain
    if _blockchain is None:
        _blockchain = MediChainEngine()
    return _blockchain
