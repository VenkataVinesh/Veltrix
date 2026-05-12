from __future__ import annotations

import asyncio
import math
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.logging import get_logger
from app.db.models import AIMemory, ActivityLog, Conversation, User
from app.db.session import get_db
from app.services.copilot import copilot
from app.services.embedding_service import embed_text

router = APIRouter()
logger = get_logger("veltrix.copilot")


class ChatRequest(BaseModel):
    message: str
    symbols: list[str] | None = None


def _payload_text(payload: dict) -> str:
    return " ".join(
        str(payload.get(key, ""))
        for key in ("summary", "question", "answer", "message", "note")
        if payload.get(key)
    )


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right:
        return 0.0
    size = min(len(left), len(right))
    left = left[:size]
    right = right[:size]
    numerator = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left)) or 1.0
    right_norm = math.sqrt(sum(b * b for b in right)) or 1.0
    return numerator / (left_norm * right_norm)


@router.post("/chat")
async def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Process chat message using Gemini copilot."""
    try:
        recent = (
            db.query(Conversation)
            .filter(Conversation.user_id == user.id)
            .order_by(Conversation.created_at.desc())
            .limit(6)
            .all()
        )

        history: list[dict] = []
        for conversation in reversed(recent):
            history.append({"role": "user", "content": conversation.question})
            history.append({"role": "assistant", "content": conversation.answer})

        answer = await copilot.chat(
            message=payload.message,
            symbols=payload.symbols,
            conversation_history=history,
            user_id=user.id,
        )

        convo = Conversation(
            user_id=user.id,
            question=payload.message,
            answer=answer,
            context={
                "symbols": payload.symbols or [],
                "provider": "gemini",
            },
        )
        db.add(convo)
        db.flush()

        memory = AIMemory(
            user_id=user.id,
            embedding_key=f"conversation:{convo.id}",
            payload={
                "summary": payload.message,
                "answer": answer,
                "symbols": payload.symbols or [],
                "source": "copilot.chat",
            },
        )
        db.add(memory)
        db.add(
            ActivityLog(
                user_id=user.id,
                action="copilot.chat",
                activity_metadata={"symbols": payload.symbols or [], "provider": "gemini"},
            )
        )
        db.commit()
        db.refresh(convo)

        return {
            "id": convo.id,
            "answer": answer,
            "created_at": convo.created_at.isoformat(),
            "provider": "gemini" if "Gemini API key not configured" not in answer else "fallback",
        }
    except Exception as e:
        logger.error(f"Error in copilot chat: {e}")
        return {
            "id": -1,
            "answer": "An error occurred while processing your message. Please try again.",
            "created_at": datetime.utcnow().isoformat(),
            "provider": "error",
        }


@router.get("/history")
def history(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 50,
) -> list[dict]:
    """Get user's conversation history."""
    conversations = (
        db.query(Conversation)
        .filter(Conversation.user_id == user.id)
        .order_by(Conversation.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": conversation.id,
            "question": conversation.question,
            "answer": conversation.answer,
            "created_at": conversation.created_at.isoformat(),
        }
        for conversation in conversations
    ]


@router.get("/stream")
async def stream(
    message: str,
    symbols: str = Query(default=""),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    symbol_list = [item.strip().upper() for item in symbols.split(",") if item.strip()] or None
    history_rows = (
        db.query(Conversation)
        .filter(Conversation.user_id == user.id)
        .order_by(Conversation.created_at.desc())
        .limit(4)
        .all()
    )
    conversation_history: list[dict] = []
    for conversation in reversed(history_rows):
        conversation_history.append({"role": "user", "content": conversation.question})
        conversation_history.append({"role": "assistant", "content": conversation.answer})

    async def event_stream():
        response_text = await copilot.chat(message=message, symbols=symbol_list, conversation_history=conversation_history, user_id=user.id)
        token_count = 0
        chunks: list[str] = []
        for token in response_text.split():
            token_count += 1
            chunks.append(token)
            yield f"data: {token} \n\n"
            await asyncio.sleep(0.02)

        final_response = " ".join(chunks).strip()
        db.add(
            Conversation(
                user_id=user.id,
                question=message,
                answer=final_response,
                context={"stream": True, "symbols": symbol_list or [], "provider": "gemini"},
            )
        )
        db.add(
            AIMemory(
                user_id=user.id,
                embedding_key=f"stream:{datetime.utcnow().timestamp()}",
                payload={"summary": message, "answer": final_response, "source": "copilot.stream"},
            )
        )
        db.add(
            ActivityLog(
                user_id=user.id,
                action="copilot.stream",
                activity_metadata={"tokens": token_count, "symbols": symbol_list or []},
            )
        )
        db.commit()
        yield "event: done\ndata: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/memory/search")
async def memory_search(
    query: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 5,
) -> list[dict]:
    query_vector = embed_text(query)
    rows = (
        db.query(AIMemory)
        .filter(AIMemory.user_id == user.id)
        .order_by(AIMemory.created_at.desc())
        .limit(100)
        .all()
    )

    scored: list[dict] = []
    for row in rows:
        payload_text = _payload_text(row.payload if isinstance(row.payload, dict) else {})
        if not payload_text:
            continue
        score = _cosine_similarity(query_vector, embed_text(payload_text))
        scored.append(
            {
                "id": row.id,
                "score": round(score, 4),
                "embedding_key": row.embedding_key,
                "payload": row.payload,
                "created_at": row.created_at.isoformat(),
            }
        )

    scored.sort(key=lambda item: item["score"], reverse=True)
    return scored[:limit]
