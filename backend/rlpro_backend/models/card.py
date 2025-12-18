from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class CardType(str, Enum):
    TERM = "term"
    CONCEPT = "concept"
    CLOZE = "cloze"
    SHORT_ANSWER = "short_answer"
    SINGLE_CHOICE = "single_choice"
    MULTIPLE_CHOICE = "multiple_choice"


class Card(BaseModel):
    """Shared structure for all card types."""

    id: str = Field(..., description="Unique card id")
    card_type: CardType
    question: str
    answer: str
    options: Optional[List[str]] = Field(
        None, description="Options for single/multi choice; None for open-ended"
    )
    source_id: Optional[str] = Field(
        None, description="Source segment or document identifier"
    )
    source_page: Optional[int] = Field(None, description="Page number if available")
    source_snippet: Optional[str] = Field(
        None, description="Evidence sentence(s) supporting the answer"
    )
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        json_schema_extra = {
            "example": {
                "id": "card_001",
                "card_type": "term",
                "question": "定义：强化学习的状态价值函数是什么？",
                "answer": "状态价值函数给出在该状态下按策略行动的期望回报。",
                "source_id": "seg_10",
                "source_page": 5,
                "source_snippet": "状态价值函数 vπ(s) 表示从状态 s 按策略 π 行动的期望回报。",
            }
        }
