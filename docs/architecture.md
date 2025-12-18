# Architecture (MVP)

## Core Flow
1. Ingest PDF/markdown → clean text, strip headers/footers, detect sections.
2. Chunk into segments with evidence and section paths.
3. Generate cards/questions (LLM or fallback), store with source/page/metadata.
4. Scheduler weights cards (wrong ↑, right ↓); practice endpoints serve next/grade.
5. Immersive co-learning page: LLM initiates interrogative prompts on the snippet, after 2–3 turns auto-generates test questions (live) with minimal controls (Next/Submit), then relearns weak points (testing effect).
6. Exports to CSV/MD/Anki; sessions logged to JSONL.

## Modules (mirrors directories)
- API: FastAPI routes for ingest/chunk/generate_cards/cards list/practice next/grade/live_question/exports/session.
- Services: PDF ingestion, chunking, card generation/parsing, grading, scheduler, LLM pipeline.
- Adapters: LLM HTTP client (OpenVINO Qwen).
- Storage: session logging.
- Frontend: Import, Cards, Practice, Export, Immersive pages.

## Data Shapes
- `Document`: cleaned pages + sections metadata.
- `Segment`: chunked text with `section_path`, `page`, `evidence`.
- `Card`: term/concept/cloze/short_answer/single_choice/multiple_choice with `question/answer/options` + source info + metadata.
- `Session`: metadata + answer records for logging/replay.

## Configuration & Defaults
- Env prefix `RLPRO_` (see `backend/rlpro_backend/config.py`) for paths, endpoints, decoding params.
- Deterministic-leaning decoding (low temperature, fixed seed).
- Testing seed corpus: `cogni_psyc.md` → `data/processed/` and `data/artifacts/cards.jsonl`.
