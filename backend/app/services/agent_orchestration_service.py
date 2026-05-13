"""
Multi-agent orchestration service for portfolio decision-making.
Implements analyst, bullish/bearish, and portfolio manager agents with debate mechanics.
"""

from __future__ import annotations

import importlib
from datetime import datetime
from typing import Any

from app.core.logging import get_logger
from app.services.market_service import get_quotes

logger = get_logger("veltrix.agent_orchestration")


class TradeAgent:
    """Base class for trading agents."""
    
    def __init__(self, name: str, role: str):
        self.name = name
        self.role = role
        self.thoughts = []
    
    def think(self, context: dict) -> dict:
        """Generate a thought based on context."""
        raise NotImplementedError


class AnalystAgent(TradeAgent):
    """Analyst agent that evaluates technicals and fundamentals."""
    
    def __init__(self):
        super().__init__("Analyst", "Technical & Fundamental Analysis")
    
    def think(self, context: dict) -> dict:
        """Analyze symbol from technical perspective."""
        symbol = context.get("symbol", "")
        change_pct = context.get("change_pct", 0)
        
        if change_pct > 1.5:
            signal = "STRONG_BUY"
            confidence = 0.75
            thesis = f"{symbol} strong uptrend with +{change_pct}% momentum"
        elif change_pct > 0.5:
            signal = "BUY"
            confidence = 0.65
            thesis = f"{symbol} positive momentum at +{change_pct}%"
        elif change_pct > -0.5:
            signal = "HOLD"
            confidence = 0.60
            thesis = f"{symbol} consolidating near price"
        elif change_pct > -1.5:
            signal = "SELL"
            confidence = 0.65
            thesis = f"{symbol} showing weakness at {change_pct}%"
        else:
            signal = "STRONG_SELL"
            confidence = 0.75
            thesis = f"{symbol} severe downtrend with {change_pct}%"
        
        return {
            "agent": self.name,
            "signal": signal,
            "confidence": confidence,
            "thesis": thesis,
            "timestamp": datetime.utcnow().isoformat(),
        }


class BullishAgent(TradeAgent):
    """Bullish advocate agent."""
    
    def __init__(self):
        super().__init__("Bull", "Long Advocate")
    
    def think(self, context: dict) -> dict:
        """Build bullish case."""
        symbol = context.get("symbol", "")
        change_pct = context.get("change_pct", 0)
        
        confidence = 0.50
        bullish_points = []
        
        if change_pct > 0.5:
            bullish_points.append(f"Positive momentum +{change_pct}%")
            confidence += 0.15
        
        if len(bullish_points) > 0:
            signal = "BUY"
            thesis = f"Bullish case: {', '.join(bullish_points)}"
        else:
            signal = "HOLD"
            thesis = "Insufficient bullish signals"
        
        return {
            "agent": self.name,
            "signal": signal,
            "confidence": min(confidence, 0.85),
            "thesis": thesis,
            "timestamp": datetime.utcnow().isoformat(),
        }


class BearishAgent(TradeAgent):
    """Bearish advocate agent."""
    
    def __init__(self):
        super().__init__("Bear", "Short Advocate")
    
    def think(self, context: dict) -> dict:
        """Build bearish case."""
        symbol = context.get("symbol", "")
        change_pct = context.get("change_pct", 0)
        
        confidence = 0.50
        bearish_points = []
        
        if change_pct < -0.5:
            bearish_points.append(f"Negative momentum {change_pct}%")
            confidence += 0.15
        
        if len(bearish_points) > 0:
            signal = "SELL"
            thesis = f"Bearish case: {', '.join(bearish_points)}"
        else:
            signal = "HOLD"
            thesis = "No significant bearish signals"
        
        return {
            "agent": self.name,
            "signal": signal,
            "confidence": min(confidence, 0.85),
            "thesis": thesis,
            "timestamp": datetime.utcnow().isoformat(),
        }


class PortfolioManagerAgent(TradeAgent):
    """Portfolio manager balancing risk/return."""
    
    def __init__(self):
        super().__init__("PortfolioManager", "Risk/Return Optimization")
    
    def think(self, context: dict) -> dict:
        """Make final decision considering portfolio context."""
        signals = context.get("signals", [])
        confidences = context.get("confidences", [])
        
        # Aggregate signals
        signal_scores = {"STRONG_BUY": 2, "BUY": 1, "HOLD": 0, "SELL": -1, "STRONG_SELL": -2}
        total_score = sum(signal_scores.get(s, 0) for s in signals)
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.5
        
        if total_score > 1:
            final_signal = "BUY"
            final_thesis = "Consensus favors buying with strong confidence"
        elif total_score < -1:
            final_signal = "SELL"
            final_thesis = "Consensus favors selling with strong confidence"
        else:
            final_signal = "HOLD"
            final_thesis = "Mixed signals suggest caution"
        
        return {
            "agent": self.name,
            "signal": final_signal,
            "confidence": min(max(avg_confidence + 0.1, 0.3), 0.95),
            "thesis": final_thesis,
            "timestamp": datetime.utcnow().isoformat(),
        }


class AgentOrchestrationService:
    def __init__(self) -> None:
        self.analyst = AnalystAgent()
        self.bull = BullishAgent()
        self.bear = BearishAgent()
        self.pm = PortfolioManagerAgent()
        self.tradingagents_available = importlib.util.find_spec("tradingagents") is not None

    async def run_debate(self, symbol: str, context: dict | None = None) -> dict:
        """Run complete multi-agent debate."""
        now = datetime.utcnow().isoformat()
        context = context or {}
        
        # Get market data
        try:
            quotes = await get_quotes([symbol.upper()])
            if quotes:
                quote = quotes[0]
                context.update({
                    "symbol": symbol.upper(),
                    "price": quote.get("price", 0),
                    "change_pct": quote.get("change_pct", 0)
                })
        except Exception as e:
            logger.warning(f"Failed to fetch quotes: {e}")
            context["symbol"] = symbol.upper()
        
        # Run agent thoughts
        analyst_thought = self.analyst.think(context)
        bullish_thought = self.bull.think(context)
        bearish_thought = self.bear.think(context)
        
        # Aggregate for portfolio manager
        signals = [
            analyst_thought["signal"],
            bullish_thought["signal"],
            bearish_thought["signal"]
        ]
        confidences = [
            analyst_thought["confidence"],
            bullish_thought["confidence"],
            bearish_thought["confidence"]
        ]
        
        context["signals"] = signals
        context["confidences"] = confidences
        
        # Portfolio manager final decision
        pm_thought = self.pm.think(context)
        
        # Wire ML Agents Orchestrator
        try:
            from app.services.ml_engine.agents.orchestrator import TradingAgentSystem
            import asyncio
            
            system = TradingAgentSystem()
            try:
                ml_decision = asyncio.run(system.orchestrate_decision(symbol, context))
            except RuntimeError:
                loop = asyncio.get_event_loop()
                ml_decision = loop.run_until_complete(system.orchestrate_decision(symbol, context))
                
            pm_thought["signal"] = ml_decision["consensus_signal"]
            pm_thought["confidence"] = ml_decision["confidence_score"]
            pm_thought["thesis"] = f"ML Ensemble (Risk/Macro/Tech) derived regime: {ml_decision['regime']}"
        except Exception as e:
            logger.error(f"TradingAgentSystem failed: {e}")

        timeline = [analyst_thought, bullish_thought, bearish_thought, pm_thought]
        
        return {
            "symbol": symbol.upper(),
            "context": context,
            "timeline": timeline,
            "decision": {
                "action": pm_thought["signal"],
                "confidence": round(pm_thought["confidence"], 4),
                "rationale": pm_thought["thesis"],
                "timestamp": now,
            },
            "debate_tree": {
                "root": "portfolio_manager",
                "children": [
                    {"id": "analyst", "weight": analyst_thought["confidence"]},
                    {"id": "bull", "weight": bullish_thought["confidence"]},
                    {"id": "bear", "weight": bearish_thought["confidence"]},
                ],
            },
            "memory_checkpoint": {
                "checkpoint_id": f"{symbol.upper()}-{int(datetime.utcnow().timestamp())}",
                "stored": self.tradingagents_available,
            },
        }
