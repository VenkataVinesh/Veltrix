"""
AI Copilot service using Google Gemini API.
Supports market-aware context and streaming responses.
"""
from __future__ import annotations

from datetime import datetime
from typing import AsyncGenerator, Optional

import httpx

from app.core.config import settings
from app.core.logging import get_logger
from app.services.market_service import get_ohlc
from app.db.session import SessionLocal

logger = get_logger("veltrix.copilot")


class GeminiCopilot:
    """Gemini-based trading assistant with portfolio-aware context."""

    def __init__(self):
        self.api_key = settings.gemini_api_key
        self.model = settings.gemini_model
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"

        if not self.api_key:
            logger.warning("Gemini API key not configured")

    def _build_market_context(self, symbols: list[str] | None = None) -> str:
        """Build market data context for copilot."""
        if not symbols:
            symbols = ["SPY", "AAPL", "NVDA", "MSFT", "TSLA"]

        context_parts = ["Current Market Context:"]

        for symbol in symbols[:5]:
            try:
                ohlc = get_ohlc(symbol, "1d")
                if ohlc and "points" in ohlc and ohlc["points"]:
                    latest = ohlc["points"][-1]
                    prev = ohlc["points"][-2] if len(ohlc["points"]) > 1 else latest
                    change = ((float(latest["c"]) - float(prev["c"])) / float(prev["c"]) * 100) if float(prev["c"]) > 0 else 0
                    source = ohlc.get("source", "unknown")
                    context_parts.append(
                        f"- {symbol}: ${latest['c']} ({change:+.2f}%) "
                        f"[H: ${latest['h']}, L: ${latest['l']}, V: {int(latest['v'])}] "
                        f"[source: {source}]"
                    )
            except Exception as e:
                logger.warning(f"Failed to fetch context for {symbol}: {e}")

        return "\n".join(context_parts)

    async def _build_portfolio_context(self, user_id: Optional[int] = None) -> str:
        """Build portfolio context for the copilot."""
        if not user_id:
            return ""

        try:
            from app.db.models import Portfolio, Position
            from app.services.market_providers import provider_orchestrator

            db = SessionLocal()
            try:
                portfolios = db.query(Portfolio).filter(Portfolio.user_id == user_id).all()
                if not portfolios:
                    return "User has no active portfolios."

                context_parts = ["\nPortfolio Context:"]
                total_equity = 0.0
                total_positions = 0

                for portfolio in portfolios:
                    positions = db.query(Position).filter(Position.portfolio_id == portfolio.id).all()
                    total_positions += len(positions)

                    if positions:
                        symbols = [p.symbol for p in positions]
                        quotes_data = []
                        try:
                            quotes_data = await provider_orchestrator.get_quotes(symbols)
                        except Exception:
                            pass

                        quote_map = {q.get("symbol"): q.get("price", 0) for q in quotes_data}

                        context_parts.append(f"\nPortfolio: {portfolio.name}")
                        for pos in positions:
                            current_price = quote_map.get(pos.symbol, pos.avg_price)
                            market_value = pos.quantity * current_price
                            invested = pos.quantity * pos.avg_price
                            pnl = market_value - invested
                            pnl_pct = (pnl / invested * 100) if invested > 0 else 0
                            total_equity += market_value
                            context_parts.append(
                                f"  - {pos.symbol}: {pos.quantity} shares @ ${pos.avg_price:.2f} avg, "
                                f"current ${current_price:.2f}, P&L ${pnl:+.2f} ({pnl_pct:+.2f}%)"
                            )

                context_parts.append(f"\nTotal estimated equity: ${total_equity:,.2f}")
                context_parts.append(f"Total positions: {total_positions}")
                return "\n".join(context_parts)

            finally:
                db.close()
        except Exception as e:
            logger.warning(f"Failed to build portfolio context: {e}")
            return ""

    async def chat(
        self,
        message: str,
        symbols: list[str] | None = None,
        conversation_history: list[dict] | None = None,
        user_id: int | None = None,
    ) -> str:
        """Send a message to Gemini copilot and get response."""
        if not self.api_key:
            return "Gemini API key not configured. Please set GEMINI_API_KEY environment variable."

        market_context = self._build_market_context(symbols)
        portfolio_context = await self._build_portfolio_context(user_id)

        system_prompt = f"""You are VELTRIX Copilot, an AI trading assistant for institutional traders.
You have expertise in technical analysis, market microstructure, and quantitative trading.

{market_context}
{portfolio_context}

Provide concise, actionable analysis. Always acknowledge risks and uncertainty.
When discussing specific trades, mention support/resistance levels and risk management.
Never guarantee outcomes or provide financial advice."""

        messages = [
            {"role": "user", "parts": [{"text": system_prompt}]},
        ]

        if conversation_history:
            for msg in conversation_history[-6:]:
                messages.append({
                    "role": msg.get("role", "user"),
                    "parts": [{"text": msg.get("content", "")}]
                })

        messages.append({"role": "user", "parts": [{"text": message}]})

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = f"{self.base_url}/{self.model}:generateContent?key={self.api_key}"

                payload = {
                    "contents": messages,
                    "generationConfig": {
                        "temperature": 0.7,
                        "topP": 0.95,
                        "topK": 40,
                        "maxOutputTokens": 2048,
                    },
                }

                response = await client.post(url, json=payload)
                response.raise_for_status()

                result = response.json()

                if "candidates" in result and len(result["candidates"]) > 0:
                    candidate = result["candidates"][0]
                    if "content" in candidate and "parts" in candidate["content"]:
                        text_parts = [p.get("text", "") for p in candidate["content"]["parts"]]
                        return " ".join(text_parts)

                return "No response from Gemini API"

        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            return f"Error communicating with Gemini: {str(e)}"

    async def stream_chat(
        self,
        message: str,
        symbols: list[str] | None = None,
        user_id: int | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream a response from Gemini copilot."""
        if not self.api_key:
            yield "Gemini API key not configured. Please set GEMINI_API_KEY environment variable."
            return

        response = await self.chat(message, symbols, user_id=user_id)
        yield response


copilot = GeminiCopilot()
