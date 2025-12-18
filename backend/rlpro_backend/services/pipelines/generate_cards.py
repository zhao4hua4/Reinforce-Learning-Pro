from __future__ import annotations

from typing import List

from rlpro_backend.models import Card, Document


async def run_generate_cards_pipeline(document: Document) -> List[Card]:
    """Placeholder for an end-to-end pipeline that yields cards from a parsed document."""
    _ = document
    raise NotImplementedError("Card generation pipeline is not implemented yet.")
