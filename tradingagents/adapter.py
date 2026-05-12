from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass
class DebateInput:
    symbol: str
    context: dict


def run_debate(input_payload: DebateInput) -> dict:
    """Adapter boundary for the TradingAgents package.

    Replace this implementation with direct TradingAgents orchestration calls.
    The response contract is already aligned with frontend debate tree rendering.
    """
    now = datetime.utcnow().isoformat()
    return {
        "symbol": input_payload.symbol.upper(),
        "timeline": [
            {"agent": "bullish_analyst", "message": "Momentum expanding", "confidence": 0.64, "timestamp": now},
            {"agent": "bearish_analyst", "message": "Macro downside remains", "confidence": 0.59, "timestamp": now},
            {"agent": "risk_manager", "message": "Apply tighter position sizing", "confidence": 0.71, "timestamp": now},
        ],
        "decision": {
            "action": "HOLD",
            "confidence": 0.67,
            "rationale": "Debate split; risk manager reduces conviction.",
            "timestamp": now,
        },
        "memory_checkpoint": {
            "checkpoint_id": f"{input_payload.symbol.upper()}-{int(datetime.utcnow().timestamp())}",
            "stored": False,
        },
    }
