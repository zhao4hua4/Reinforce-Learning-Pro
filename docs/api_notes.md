# API Notes (current scaffolding)

- `POST /ingest` — upload PDF, saves to `data/raw/`, runs ingestion with section detection. Returns `{id,title,sections,pages_cleaned}`.
- `POST /chunk` — chunk processed doc (from `data/processed/<doc_id>.json`) into segments JSONL.
- `POST /generate_cards` — generate cards from segments JSONL (`use_llm` optional; else fallback heuristics); writes `data/artifacts/cards.jsonl`.
- `GET /cards` — returns pre-generated cards from `data/artifacts/cards.jsonl` (JSONL loaded into list).
- `POST /practice/next` — returns next card (by scheduler) and its weight; accepts optional `sections` filter.
- `GET /export/csv` — CSV export of cards.
- `GET /export/md` — Markdown export of cards.
- `POST /generate` — text generation helper (shared).
- `POST /live_question` — generate a single question from provided content (returns parsed JSON if possible, otherwise raw text).
- `POST /grade` — rule-based grading (choice or short-answer), updates scheduler; optionally logs session answers.
- `GET /schedule/next` — returns next card id by current scheduler weights.

Pending:
- `practice/grade` endpoints with scheduler/grading.
- Streaming responses for live generation (progress to UI).
