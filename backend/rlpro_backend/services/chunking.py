from __future__ import annotations

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Iterable, List, Tuple, Dict, Optional

from rlpro_backend.config import settings
from rlpro_backend.models import Document, Segment


class Chunker:
    """Splits cleaned PDF pages into manageable segments for card generation."""

    def __init__(self, max_chars: int = 900, overlap_chars: int = 120):
        self.max_chars = max_chars
        self.overlap_chars = overlap_chars

    def detect_headings(self, pages: Iterable[str], lookahead_lines: int = 5) -> Dict[int, str]:
        """Heuristic heading detector: grab short, title-like lines near page starts."""
        headings: Dict[int, str] = {}
        for idx, page_text in enumerate(pages, start=1):
            lines = [ln.strip() for ln in page_text.splitlines() if ln.strip()]
            for ln in lines[:lookahead_lines]:
                if self._looks_like_heading(ln):
                    headings[idx] = ln
                    break
        return headings

    def chunk_pages(self, doc_id: str, pages: Iterable[str], headings: Optional[Dict[int, str]] = None) -> List[Segment]:
        """Chunk cleaned pages (list of strings) into Segment objects."""
        segments: List[Segment] = []
        buffer: List[str] = []
        buffer_len = 0
        seg_counter = 0
        last_heading = None

        for page_idx, page_text in enumerate(pages, start=1):
            if headings and page_idx in headings:
                last_heading = headings[page_idx]
            paragraphs = self._split_paragraphs(page_text)
            for para in paragraphs:
                para_len = len(para)
                if buffer_len + para_len > self.max_chars and buffer:
                    # Flush current buffer as a segment
                    text = "\n\n".join(buffer).strip()
                    evidence = self._extract_evidence(text)
                    seg_counter += 1
                    segments.append(
                        Segment(
                            id=f"{doc_id}_seg_{seg_counter}",
                            section_path=[last_heading] if last_heading else [],
                            page=page_idx,
                            text=text,
                            evidence=evidence,
                        )
                    )
                    # Start next buffer with overlap from previous text plus current para
                    if self.overlap_chars > 0:
                        overlap = text[-self.overlap_chars :]
                        buffer = [overlap, para]
                        buffer_len = len(overlap) + para_len
                    else:
                        buffer = [para]
                        buffer_len = para_len
                else:
                    buffer.append(para)
                    buffer_len += para_len

        if buffer:
            text = "\n\n".join(buffer).strip()
            evidence = self._extract_evidence(text)
            seg_counter += 1
            segments.append(
                Segment(
                    id=f"{doc_id}_seg_{seg_counter}",
                    section_path=[last_heading] if last_heading else [],
                    page=None,
                    text=text,
                    evidence=evidence,
                )
            )

        return segments

    def chunk_document(self, document: Document, pages: Iterable[str]) -> Document:
        """Return a Document with segments populated (sections remain placeholder)."""
        segments = self.chunk_pages(document.id, pages)
        document.segments = segments
        return document

    def save_segments(self, doc_id: str, segments: List[Segment]) -> Path:
        """Persist segments as JSONL under processed_dir for reproducibility."""
        out_dir = Path(settings.processed_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{doc_id}_segments.jsonl"
        with out_path.open("w", encoding="utf-8") as f:
            for seg in segments:
                f.write(seg.model_dump_json(ensure_ascii=False) + "\n")
        return out_path

    @staticmethod
    def _split_paragraphs(text: str) -> List[str]:
        parts = re.split(r"\n\s*\n", text)
        clean = []
        for p in parts:
            p = p.strip()
            if not p:
                continue
            # Normalize whitespace
            p = re.sub(r"\s+", " ", p)
            clean.append(p)
        return clean

    @staticmethod
    def _extract_evidence(text: str, max_sentences: int = 2) -> List[str]:
        """Pick up to N first sentences as evidence."""
        sentences = re.split(r"(?<=[。.!?])\s+", text)
        return [s.strip() for s in sentences if s.strip()][:max_sentences]

    @staticmethod
    def _looks_like_heading(line: str) -> bool:
        # Short, not ending with a period, may start with digits/Chapter or be Title Case.
        if len(line) > 80:
            return False
        if line.endswith("."):
            return False
        if re.match(r"^(Chapter\s+\d+|[0-9]+(\.[0-9]+)*)\s+[A-Z].*", line):
            return True
        # Title case heuristic
        words = line.split()
        if 1 < len(words) <= 10 and sum(w[:1].isupper() for w in words) / len(words) > 0.6:
            return True
        return False
