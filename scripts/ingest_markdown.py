from __future__ import annotations

import json
import re
from pathlib import Path

from rlpro_backend.models import Document, Section, Segment


def ingest_markdown(md_path: str, doc_id: str | None = None, title: str | None = None) -> tuple[Document, list[Segment]]:
    path = Path(md_path)
    text = path.read_text(encoding="utf-8")
    doc_id = doc_id or path.stem
    title = title or path.stem

    # Split by H2 headings as sections (## ...)
    sections: list[Section] = []
    segments: list[Segment] = []
    current_section = None
    lines = text.splitlines()
    buffer: list[str] = []
    sec_counter = 0
    seg_counter = 0
    for line in lines:
        if line.startswith("## "):
            if buffer and current_section:
                seg_text = "\n".join(buffer).strip()
                if seg_text:
                    seg_counter += 1
                    segments.append(
                        Segment(
                            id=f"{doc_id}_seg_{seg_counter}",
                            section_path=[current_section.title],
                            page=None,
                            text=seg_text,
                            evidence=_extract_evidence(seg_text),
                        )
                    )
            buffer = []
            sec_counter += 1
            current_section = Section(title=line[3:].strip(), level=1, page_start=None, page_end=None, children=[])
            sections.append(current_section)
        else:
            buffer.append(line)

    if buffer:
        seg_text = "\n".join(buffer).strip()
        if seg_text:
            seg_counter += 1
            sec_title = current_section.title if current_section else "general"
            segments.append(
                Segment(
                    id=f"{doc_id}_seg_{seg_counter}",
                    section_path=[sec_title],
                    page=None,
                    text=seg_text,
                    evidence=_extract_evidence(seg_text),
                )
            )

    doc = Document(
        id=doc_id,
        title=title,
        sections=sections,
        segments=segments,
        source_path=str(path.resolve()),
        metadata={"source": "markdown"},
    )
    return doc, segments


def _extract_evidence(text: str, max_sentences: int = 2) -> list[str]:
    sentences = re.split(r"(?<=[。.!?])\s+", text)
    return [s.strip() for s in sentences if s.strip()][:max_sentences]


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Ingest markdown into Document + segments JSONL.")
    parser.add_argument("--md", required=True, help="Path to markdown file (e.g., cogni_psyc.md)")
    parser.add_argument("--out-dir", default="data/processed", help="Output directory for JSON and segments JSONL")
    args = parser.parse_args()

    doc, segments = ingest_markdown(args.md)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    doc_path = out_dir / f"{doc.id}.json"
    seg_path = out_dir / f"{doc.id}_segments.jsonl"
    with doc_path.open("w", encoding="utf-8") as f:
        json.dump(
            {
                "id": doc.id,
                "title": doc.title,
                "sections": [s.model_dump() for s in doc.sections],
                "source_path": doc.source_path,
                "metadata": doc.metadata,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )
    with seg_path.open("w", encoding="utf-8") as f:
        for seg in segments:
            f.write(seg.model_dump_json(ensure_ascii=False) + "\n")
    print(f"Saved doc to {doc_path}")
    print(f"Saved segments to {seg_path}")
