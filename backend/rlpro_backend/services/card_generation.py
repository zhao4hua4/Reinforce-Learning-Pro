from __future__ import annotations

from typing import List, Sequence, Literal, Tuple
import json
from pydantic import BaseModel, ValidationError

from rlpro_backend.adapters.llm_client import LLMClient
from rlpro_backend.config import settings
from rlpro_backend.models import Card, Segment
from rlpro_backend.services import prompts


class CardGenerator:
    """Generates four card types for each segment via the local LLM."""

    def __init__(self, client: LLMClient | None = None):
        self.client = client or LLMClient()

    async def generate_for_segments(self, segments: Sequence[Segment], use_llm: bool = True) -> Tuple[List[Card], List[str]]:
        results: List[Card] = []
        errors: List[str] = []
        for seg in segments:
            resp = None
            if use_llm:
                prompt = prompts.card_prompt(seg.text)
                payload = {
                    "model": "qwen",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": settings.temperature,
                    "top_p": 0.9,
                    "max_tokens": 512,
                    "seed": settings.seed,
                }
                try:
                    resp = await self.client.generate(payload)
                except Exception:
                    resp = None
            cards, parse_errors = self._parse_cards(resp, seg)
            results.extend(cards)
            errors.extend(parse_errors)
        return results, errors

    def _parse_cards(self, resp: dict | None, seg: Segment) -> Tuple[List[Card], List[str]]:
        # Minimal parser: assume model returns JSON in choices[0].message.content
        errors: List[str] = []
        if resp:
            try:
                content = resp["choices"][0]["message"]["content"]
                data = json.loads(content)
                out = []
                for idx, item in enumerate(data):
                    try:
                        parsed = GeneratedCard.model_validate(item)
                    except ValidationError as ve:
                        errors.append(f"{seg.id} card {idx+1} schema error: {ve}")
                        continue
                    out.append(
                        Card(
                            id=f"{seg.id}_card_{idx+1}",
                            card_type=parsed.card_type,
                            question=parsed.question,
                            answer=parsed.answer,
                            options=parsed.options,
                            source_id=seg.id,
                            source_page=seg.page,
                            source_snippet=" ".join(seg.evidence)[:500],
                            metadata={"section": seg.section_path},
                        )
                    )
                if out:
                    return out, errors
            except Exception as exc:
                errors.append(f"{seg.id} parse error: {exc}")
        # Fallback: heuristic card from segment text
        first_sentence = (seg.evidence[0] if seg.evidence else seg.text[:200]).strip()
        fallback = Card(
            id=f"{seg.id}_card_fallback",
            card_type="short_answer",
            question=f"Based on this section, what is the key idea? {first_sentence[:120]}",
            answer=first_sentence,
            options=None,
            source_id=seg.id,
            source_page=seg.page,
            source_snippet=" ".join(seg.evidence)[:500],
            metadata={"section": seg.section_path, "fallback": True},
        )
        return [fallback], errors


class GeneratedCard(BaseModel):
    card_type: Literal["term", "concept", "cloze", "short_answer", "single_choice", "multiple_choice"]
    question: str
    answer: str
    options: list[str] | None = None
