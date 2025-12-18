from __future__ import annotations

from __future__ import annotations

import re
from typing import Dict, Tuple, List
from difflib import SequenceMatcher

from rlpro_backend.models import Card, CardType


class Grader:
    """Rule-based scorer. Lightweight, deterministic."""

    def grade(self, card: Card, user_answer: str) -> Tuple[bool, float, Dict[str, str]]:
        if card.card_type in {
            CardType.TERM,
            CardType.CONCEPT,
            CardType.CLOZE,
            CardType.SHORT_ANSWER,
        }:
            return self._grade_short_answer(card, user_answer)
        if card.card_type in {"single_choice", "multiple_choice"}:
            return self._grade_choice(card, user_answer)
        return self._grade_choice(card, user_answer)

    def _grade_choice(self, card: Card, user_answer: str) -> Tuple[bool, float, Dict[str, str]]:
        ua = normalize_answer(user_answer)
        ans = normalize_answer(card.answer)
        ua_set = set(split_multi(ua))
        ans_set = set(split_multi(ans))
        is_correct = ua_set == ans_set if ans_set else ua == ans
        score = 1.0 if is_correct else max(0.0, min(1.0, len(ua_set & ans_set) / len(ans_set) if ans_set else 0.0))
        return is_correct, score, {"expected": card.answer, "received": user_answer}

    def _grade_short_answer(self, card: Card, user_answer: str) -> Tuple[bool, float, Dict[str, str]]:
        ua = normalize_answer(user_answer)
        ans = normalize_answer(card.answer)
        keywords = extract_keywords(ans)
        matched = sum(1 for kw in keywords if kw in ua)
        recall = matched / len(keywords) if keywords else 0
        similarity = SequenceMatcher(None, ua, ans).ratio()
        score = max(recall, similarity)
        is_correct = score >= 0.6
        return is_correct, score, {"expected": card.answer, "received": user_answer, "matched_keywords": matched, "similarity": similarity}


def normalize_answer(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text


def split_multi(text: str) -> List[str]:
    return [t.strip() for t in re.split(r"[;,、，/ ]+", text) if t.strip()]


def extract_keywords(text: str, max_kw: int = 8) -> List[str]:
    # Very naive: split, deduplicate, keep content-ish tokens
    tokens = [t for t in re.split(r"[ ,.;:、，。/]+", text.lower()) if 2 <= len(t) <= 20]
    seen = []
    for t in tokens:
        if t not in seen:
            seen.append(t)
        if len(seen) >= max_kw:
            break
    return seen
