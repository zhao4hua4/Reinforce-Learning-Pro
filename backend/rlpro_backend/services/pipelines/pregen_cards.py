from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Iterable, List

from rlpro_backend.config import settings
from rlpro_backend.models import Segment, Card
from rlpro_backend.services.card_generation import CardGenerator


async def load_segments(path: str | Path) -> List[Segment]:
    segments: List[Segment] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            seg_dict = json.loads(line)
            segments.append(Segment.model_validate(seg_dict))
    return segments


async def run_pregen(seg_path: str | Path, out_path: str | Path | None = None, use_llm: bool = False) -> Path:
    """Generate cards for all segments and persist to JSONL."""
    segments = await load_segments(seg_path)
    gen = CardGenerator()
    cards: List[Card] = await gen.generate_for_segments(segments, use_llm=use_llm)
    out_dir = Path(settings.artifacts_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = Path(out_path) if out_path else out_dir / "cards.jsonl"
    with open(out_path, "w", encoding="utf-8") as f:
        for card in cards:
            f.write(card.model_dump_json(ensure_ascii=False) + "\n")
    return out_path


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Pre-generate cards from segments JSONL.")
    parser.add_argument("--segments", type=str, required=True, help="Path to segments JSONL")
    parser.add_argument("--out", type=str, help="Output JSONL for cards")
    parser.add_argument("--use-llm", action="store_true", help="Call LLM endpoint; otherwise use fallback heuristics")
    args = parser.parse_args()

    asyncio.run(run_pregen(args.segments, args.out, use_llm=args.use_llm))
