# Action Plan (trackable)

> Mark progress inline by changing `[ ]` to `[x]` when done.

## 1) PDF Ingestion & Cleaning
- [x] Implement PyMuPDF-based extractor: strip headers/footers/refs, keep page numbers.
- [x] Build section tree/chapters (heading heuristic); normalize whitespace and punctuation.
- [x] Save cleaned text + metadata to `data/processed/` (JSON/NDJSON).

## 2) Chunking & Evidence
- [x] Sentence/paragraph chunker with max token/char limits.
- [x] Attach section path (chapter selection), page, evidence sentences to each chunk (heading heuristic).
- [x] Persist chunks with stable IDs.

## 3) Card/Question Generation (LLM) - REDONE
- [x] Learning cards: 180-320 word teaching notes from segment context (e.g., cogni_psyc.md ¡ì5.2). Each includes intro, 3-5 knowledge points (UG/innateness/rebuttals), one concrete example, and 2 Socratic prompts. No direct answers to test items.
- [x] Testing cards: concise Q/A items distinct from learning cards; multiple question types (MCQ, short answer, concept) targeting the same knowledge points. Generate at least 3 test questions per learning card on the fly.
- [x] Corpus-aware prompts: use full segment text to ground learning/testing; capture section metadata when available.
- [x] Runtime pipeline: generate learning card first, then auto-generate its test set; deterministic decoding for tests (temp ~0.1, seeded) and warmer decoding for learning cards (temp ~0.3) to permit richer prose.
- [x] Validation: enforce schema for testing cards; length/structure checks for learning cards. Log/flag failures and fall back gracefully.
- [ ] Storage: persist generated pairs with links (learning_card_id -> test_card_ids) in artifacts; keep source_id/page/section for traceability.
- [x] UX integration: immersive page shows the learning card before serving its distinct test questions; co-learning AI uses reflective prompts and does not leak test answers.

## 4) Scoring & Scheduler
- [x] Rule-based grading for single/multiple choice; keyword thresholds for short answers.
- [x] Adaptive weights (wrong -> right) grounded in testing effect / Skinnerian reinforcement; next-card selection API.
- [x] Persist session stats (JSONL append); adjust next-batch via scheduler in real time.

## 5) API Surface (FastAPI)
- [x] Endpoints: ingest, chunk, generate_cards, list cards; live_question; practice_next; exports (csv/md/anki); grade; schedule/next.
- [x] Stream generation progress/logs to frontend during live question creation (server streams; UI shows incremental chunks).
- [x] Serve static frontend (frontend/public); enable streaming/long responses pending.
- [x] CORS/config tightened to localhost:5173.
- [x] Validate LLM responses against schema server-side; surface errors cleanly to UI.
- [x] Add /expand endpoint for 150-300 word pedagogical cards (example + reflective question) with fallback.
- [x] Add /learn_card and /generate_tests endpoints for rich learning notes and paired test sets.
- [ ] Remove or override hardcoded remote API key/base URL before publishing.

## 6) Frontend (React/Vite)
- [x] Pages scaffolded: Import (upload + sections), Cards (list), Practice (next/grade/live question with streaming), Export (CSV/MD/Anki).
- [x] Allow studying selected chapters only (section filter client-side), basic live progress UI for questions/answers.
- [x] Sidebar for weak areas + simple progress chart (testing effect emphasis).
- [x] API hooks with error/latency display (basic hooks exist; polish pending).
- [x] Add learn -> test -> learn loop with co-learning chat: user can ask follow-ups; show regeneration of questions/explanations; allow LLM extensions beyond book while citing source.
- [x] New immersive page: guided reading with LLM-initiated prompts, on-the-fly question generation, minimal controls (Next/Submit), bias toward weak points.
- [x] Immersive page uses expanded 180-320 word learning cards by default; added length enforcement and test-set generation flow.
- [x] Immersive UI polish: highlighted learning card block, progress bar, sticky chat pane with selection-based ask, and stepwise coaching prompts.
- [x] Co-learning tone: prompts force second-person "you" self-evaluation, and discussion-inviting questions tied to learner input/selection; chat fixed on the right to avoid full-page scroll.

## 7) Exports & Logging
- [x] CSV/Markdown/Anki exporters.
- [x] Session metadata logging (model, seed, params, timestamps) to `data/sessions/`.

## 8) Testing & Benchmarks
- [x] Unit tests for ingestion/chunking/grading/scheduler; small integration for card & live question generation (currently need pytest install).
- [ ] Perf logs: tokens/s, latency, PDF parse time.

## 9) Demo Mode & Flipped Classroom
- [x] `/demo` route: model switch (on-device vs Qwen3-next), learn -> test -> adaptive follow-ups; selection-based asks; scripted wrong short-answer leading to adaptive follow-ups.
- [x] Flipped classroom moved to `/demo/flipped` (unlocks after demo loop); includes student chat, senior instructor coach chat, progress checklist, end-class evaluation.
- [x] Prompt-level context windows per thread (learner chat, adaptive follow-ups, student chat, coach chat) to avoid cross-context bleed; keep history scoped per role.
- [x] Demo guide updated with phase-by-phase steps and explicit user inputs/buttons.
- [x] Scripted prompts validated against remote `qwen3-next-80b-a3b-instruct` for predictable demo outputs.

- [ ] Multilingual demo: add language selector (English/????/????????/????/??????/French/German) and sentence-by-sentence translation via selected model.

- [ ] Multilingual routes: /demo translation selector and /demo/flipped-multilingual for native-language flipped classroom; highlight boundary-less learning in docs.

- [ ] Multilingual flipped classroom route documented and native-language UX wired.
\n- [ ] Rework main app to module-based dashboard/import/learn with multilingual UI/prompts; demo routes untouched.
