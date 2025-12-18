from __future__ import annotations

import random
from typing import Dict, List

from rlpro_backend.models import Card


class CardScheduler:
    """Tracks card weights and selects the next question based on performance."""

    def __init__(self):
        self.weights: Dict[str, float] = {}

    def register_cards(self, cards: List[Card]) -> None:
        for card in cards:
            self.weights.setdefault(card.id, 1.0)

    def update(self, card_id: str, is_correct: bool) -> None:
        # Testing effect / reinforcement: wrong ↑, right ↓ (with floor/ceiling)
        if card_id not in self.weights:
            self.weights[card_id] = 1.0
        delta = -0.2 if is_correct else 0.5
        new_w = self.weights[card_id] + delta
        self.weights[card_id] = max(0.2, min(5.0, new_w))

    def next_card(self) -> str:
        if not self.weights:
            raise RuntimeError("No cards registered")
        items = list(self.weights.items())
        total = sum(w for _, w in items)
        r = random.random() * total
        upto = 0
        for cid, w in items:
            upto += w
            if upto >= r:
                return cid
        return items[-1][0]
