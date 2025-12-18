from __future__ import annotations

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from typing import Iterable, List, Set, Dict

import fitz  # PyMuPDF

from rlpro_backend.config import settings
from rlpro_backend.models import Document, Section
from rlpro_backend.services.chunking import Chunker


class PDFIngestor:
    """Extract structure and clean text from PDF materials."""

    def __init__(self, data_dir: str | None = None, processed_dir: str | None = None):
        self.data_dir = Path(data_dir or settings.data_dir)
        self.processed_dir = Path(processed_dir or settings.processed_dir)
        self.processed_dir.mkdir(parents=True, exist_ok=True)

    def ingest(self, pdf_path: str, *, skip_references: bool = True, detect_sections: bool = True) -> Document:
        """Parse, clean, and persist a PDF. Returns a Document shell (sections/segments filled later)."""
        path = Path(pdf_path)
        if not path.is_absolute() and not path.exists():
            path = self.data_dir / path
        if not path.exists():
            raise FileNotFoundError(f"PDF not found: {path}")

        with fitz.open(path) as pdf:
            total_pages = pdf.page_count
            # Detect running headers/footers from first/last lines across pages.
            first_lines: List[str] = []
            last_lines: List[str] = []
            for page in pdf:
                lines = page.get_text("text").splitlines()
                if not lines:
                    continue
                first_lines.append(lines[0].strip())
                last_lines.append(lines[-1].strip())

            headers = self._frequent_lines(first_lines, total_pages)
            footers = self._frequent_lines(last_lines, total_pages)

            cleaned_pages: List[str] = []
            for idx, page in enumerate(pdf, start=0):
                raw_text = page.get_text("text")
                cleaned = self._clean_page_text(raw_text, headers, footers)
                if skip_references and self._is_reference_page(cleaned, idx, total_pages):
                    continue
                cleaned_pages.append(cleaned)
            title = pdf.metadata.get("title") or path.stem

        doc_id = path.stem

        sections: List[Section] = []
        headings: Dict[int, str] = {}
        if detect_sections:
            # Reuse chunker heuristic for headings.
            ch = Chunker()
            headings = ch.detect_headings(cleaned_pages)
            sections = self._build_sections(headings, len(cleaned_pages))

        # Persist cleaned pages for downstream steps and reproducibility.
        output = {
            "id": doc_id,
            "title": title,
            "source_path": str(path.resolve()),
            "pages": cleaned_pages,
            "total_pages": len(cleaned_pages),
            "headings": [{"page": p, "title": t} for p, t in headings.items()],
            "sections": [s.model_dump() for s in sections],
        }
        out_file = self.processed_dir / f"{path.stem}.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)

        return Document(
            id=doc_id,
            title=title,
            sections=sections,
            segments=[],
            source_path=str(path.resolve()),
            metadata={"processed_file": str(out_file), "pages_cleaned": len(cleaned_pages)},
        )

    @staticmethod
    def _frequent_lines(lines: Iterable[str], total_pages: int, threshold: float = 0.6) -> Set[str]:
        """Identify lines that appear on a large fraction of pages (likely headers/footers)."""
        counts = Counter([ln.strip() for ln in lines if ln and ln.strip()])
        return {ln for ln, cnt in counts.items() if total_pages and (cnt / total_pages) >= threshold and len(ln) < 120}

    @staticmethod
    def _clean_page_text(text: str, headers: Set[str], footers: Set[str]) -> str:
        """Remove detected headers/footers and boilerplate lines."""
        cleaned: List[str] = []
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            lower = line.lower()
            if line in headers or line in footers:
                continue
            if any(term in lower for term in ["proquest", "ebook central", "copyright", "all rights reserved", "taylor & francis"]):
                continue
            cleaned.append(line)
        return "\n".join(cleaned)

    @staticmethod
    def _is_reference_page(text: str, page_index: int, total_pages: int) -> bool:
        """Heuristic: skip reference pages that start with 'References' near the back of the book."""
        if total_pages == 0 or page_index < int(total_pages * 0.7):
            return False
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        if not lines:
            return False
        first = lines[0]
        return bool(re.match(r"(?i)^references\b", first))

    @staticmethod
    def _build_sections(headings: Dict[int, str], total_pages: int) -> List[Section]:
        """Turn page->heading into a flat section list with page ranges."""
        sections: List[Section] = []
        sorted_items = sorted(headings.items(), key=lambda x: x[0])
        for idx, (page, title) in enumerate(sorted_items):
            page_start = page
            page_end = total_pages
            if idx + 1 < len(sorted_items):
                page_end = sorted_items[idx + 1][0] - 1
            level = PDFIngestor._infer_level(title)
            sections.append(Section(title=title, level=level, page_start=page_start, page_end=page_end))
        return sections

    @staticmethod
    def _infer_level(title: str) -> int:
        """Simple level heuristic: numbered headings = deeper."""
        if re.match(r"^\d+(\.\d+)+", title):
            return 2
        if re.match(r"^\d+", title) or title.lower().startswith("chapter"):
            return 1
        return 1
