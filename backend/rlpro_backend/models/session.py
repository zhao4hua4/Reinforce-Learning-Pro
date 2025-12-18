from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from .card import CardType


class AnswerRecord(BaseModel):
    card_id: str
    card_type: CardType
    user_answer: str
    is_correct: bool
    score: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    feedback: Optional[str] = None
    evidence_used: Optional[str] = None


class SessionMetadata(BaseModel):
    session_id: str
    started_at: datetime = Field(default_factory=datetime.utcnow)
    model_name: str = "qwen3-8b-openvino"
    temperature: float = 0.1
    seed: int = 42
    stats: Dict[str, float] = Field(default_factory=dict)
    answers: List[AnswerRecord] = Field(default_factory=list)
