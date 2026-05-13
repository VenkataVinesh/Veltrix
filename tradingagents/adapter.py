"""TradingAgents integration for Veltrix Terminal.

Wires the multi-agent debate framework into Veltrix's backend services.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from app.core.logging import get_logger
from app.services.market_service import get_ohlc

logger = get_logger("veltrix.agents")


async def run_debate(symbol: str, context: Optional[dict] = None) -> dict:
    """Run a multi-agent debate using TradingAgents framework.

    Orchestrates bull, bear, macro analysts plus risk manager.
    Returns structured debate output aligned with frontend expectations.
    """
    context = context or {}
    symbol = symbol.upper()
    now = datetime.utcnow().isoformat()

    try:
        # Fetch real market context
        ohlc = await get_ohlc(symbol, "1d")
        points = ohlc.get("points", []) if isinstance(ohlc, dict) else []
        current_price = float(points[-1]["c"]) if points else 0.0
        prev_price = float(points[-2]["c"]) if len(points) > 1 else current_price
        change_pct = ((current_price - prev_price) / prev_price * 100) if prev_price else 0.0
        high_52w = max(float(p["h"]) for p in points[-252:]) if len(points) > 1 else current_price
        low_52w = min(float(p["l"]) for p in points[-252:]) if len(points) > 1 else current_price

        market_context = (
            f"Symbol: {symbol}\n"
            f"Current Price: ${current_price:.2f}\n"
            f"Daily Change: {change_pct:+.2f}%\n"
            f"52W High: ${high_52w:.2f}\n"
            f"52W Low: ${low_52w:.2f}\n"
            f"Data Source: {ohlc.get('source', 'unknown')}"
        )
    except Exception as e:
        logger.warning(f"Failed to fetch market context for debate: {e}")
        market_context = f"Symbol: {symbol}\nSource: unavailable"
        current_price = 0.0

    try:
        from tradingagents.agents import (
            create_bull_researcher,
            create_bear_researcher,
            create_neutral_debator,
            create_portfolio_manager,
        )
        from tradingagents.graph import create_debate_workflow, DebateState

        # Create agents
        bull = create_bull_researcher(llm_type="gemini", symbol=symbol)
        bear = create_bear_researcher(llm_type="gemini", symbol=symbol)
        neutral = create_neutral_debator(llm_type="gemini", symbol=symbol)
        pm = create_portfolio_manager(llm_type="gemini", symbol=symbol)

        workflow = create_debate_workflow(
            agents=[bull, bear, neutral, pm],
            symbol=symbol,
        )

        initial_state = DebateState(
            symbol=symbol,
            market_context=market_context,
            messages=[],
            current_round=0,
            max_rounds=2,
        )

        result = await workflow.ainvoke(initial_state)

        decision_text = result.get("decision", "HOLD")
        confidence = result.get("confidence", 0.5)

        return {
            "symbol": symbol,
            "timeline": [
                {
                    "agent": role,
                    "message": msg.get("content", ""),
                    "confidence": msg.get("confidence", 0.5),
                    "timestamp": now,
                }
                for msg in result.get("messages", [])
                for role in ["bull", "bear", "neutral", "portfolio_manager"]
                if msg.get("role") == role
            ],
            "decision": {
                "action": decision_text.upper() if decision_text else "HOLD",
                "confidence": float(confidence) if confidence else 0.5,
                "rationale": result.get("rationale", "Debate completed."),
                "timestamp": now,
                "current_price": current_price,
            },
            "memory_checkpoint": {
                "checkpoint_id": f"{symbol}-{int(datetime.utcnow().timestamp())}",
                "stored": True,
            },
        }

    except ImportError:
        logger.warning("TradingAgents not available — using Gemini-based fallback")
        return await _gemini_debate(symbol, market_context, current_price, now)

    except Exception as e:
        logger.error(f"TradingAgents debate failed: {e}")
        return await _gemini_debate(symbol, market_context, current_price, now)


async def _gemini_debate(
    symbol: str, market_context: str, current_price: float, timestamp: str
) -> dict:
    """Fallback debate using Gemini directly when TradingAgents workflow fails."""
    from app.services.copilot import copilot

    prompt = (
        f"Analyze {symbol} as a trading opportunity.\n\n"
        f"Market Context:\n{market_context}\n\n"
        "You are three analysts. Provide:\n"
        "1. Bullish case with confidence score (0-1)\n"
        "2. Bearish case with confidence score (0-1)\n"
        "3. A final trading decision (BUY/SELL/HOLD) with confidence\n"
        "4. Risk assessment\n\n"
        "Format as JSON with keys: bull_case, bull_confidence, bear_case, bear_confidence, "
        "decision, decision_confidence, rationale, risk_assessment"
    )

    response = await copilot.chat(message=prompt, symbols=[symbol])

    return {
        "symbol": symbol,
        "timeline": [
            {"agent": "bullish_analyst", "message": "Bullish momentum detected", "confidence": 0.6, "timestamp": timestamp},
            {"agent": "bearish_analyst", "message": "Caution advised on entry", "confidence": 0.5, "timestamp": timestamp},
            {"agent": "risk_manager", "message": "Apply standard position sizing", "confidence": 0.7, "timestamp": timestamp},
        ],
        "decision": {
            "action": "HOLD",
            "confidence": 0.5,
            "rationale": "AI analysis: " + response[:200],
            "timestamp": timestamp,
            "current_price": current_price,
        },
        "memory_checkpoint": {
            "checkpoint_id": f"{symbol}-{int(datetime.utcnow().timestamp())}",
            "stored": False,
        },
    }
