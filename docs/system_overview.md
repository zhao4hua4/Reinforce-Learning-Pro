# Reinforce Learning Pro — Detailed System & Flow Guide

This document is deliberately long-form. It describes every learner flow, the multilingual experience (with special care for minority languages), the pedagogy we implement, and the Intel OpenVINO + Qwen stack that powers the system.

## Complete learner workflows

### /demo (Universal Grammar demo)
1) **Learn phase**
   - One concise learning card (title, body, example, reflection prompts).
   - Learner writes a reflection; co-learning tutor responds in second person with encouragement + probing question; meta-talk is stripped.
   - Language toggle reloads UI and LLM language; Uyghur renders right-to-left (RTL).
2) **Test phase**
   - Fixed 3-question set (single- or multi-choice plus short answer). Answers are hidden; learner only sees correct/incorrect + hint.
   - Feedback prompt: one encouragement, one hint (partial), one probing question grounded in the item.
3) **Reinforce phase (adaptive)**
   - For each missed item, the system generates one new choice question; plus one new short-answer question across the missed set.
   - Prompts forbid “translate the original”; they demand new questions on the same knowledge point. Hints are removed from generated items to avoid leakage.
   - Minimal JSON schema: {id, card_type, question, options (4 or null), answer}. Fallback items ensure continuity.
4) **Loop complete**
   - User can restart or move to flipped classroom; localStorage stores `demo_complete`, `demo_model`, `demo_language`.

### Modules: Learn → Test → Reinforce (main app)
1) **Learn**
   - Module note, example, and reflection prompts. After two learn turns, advance to test automatically.
   - Tutor replies are scoped to the learner’s turns and selection; always second person and probing.
2) **Test**
   - Module questions (choice + short answer). Feedback mirrors demo (encouragement + hint + probe). Misses are collected.
3) **Reinforce (per-miss generation)**
   - One new choice question per miss + one short-answer question across misses.
   - Same “no translation/duplication” rule; minimal JSON; small per-call token budgets to avoid API limits.
   - Completion returns to the loop; restart supported.

### Flipped classroom (demo and multilingual)
- Teacher drives; student replies only after teacher messages (no auto-student posts).
- Coach scoring at end: responsiveness, clarity, scaffolding, coach_use, total.
- Multilingual page adds full language toggle/reload; Uyghur is RTL.
- Pedagogical “flip”: content before class, practice and coaching during session.

## Native-language experience (priority on minority languages)
- Supported UI/LLM languages: English, Chinese (中文), Tibetan (藏语), Uyghur (维吾尔语, RTL), Korean (朝鲜语), French, German, Spanish.
- Language toggle triggers full reload to keep UI strings, prompts, and LLM outputs in sync.
- “Translate all” (demo) regenerates learning note, example, prompts, and test items in the chosen language.
- Follow-up generation is requested directly in the target language (no intermediate translation), with explicit instructions **not** to translate or repeat original questions—new questions must target the same knowledge point. This reduces cognitive load for minority-language learners and keeps the experience native-first.
- RTL for Uyghur is set on the container (`dir="rtl"`); all other languages remain LTR.

## Model stack (Intel OpenVINO + Qwen)

### On-device presets (backend `llm_pipeline.py`, mirrored in frontend selectors)
- `qwen2.5-1.5b-int4-ov` (CPU)
- `qwen3-4b-int4-ov` (CPU/GPU)
- `qwen3-8b-int4-ov` (CPU/GPU/NPU)
- `qwen3-14b-int4-ov` (GPU)
- Remote comparator: `qwen3-next-80b-a3b-instruct`

### Prompt discipline
- Qwen3 user prompts end with `/nothink` (at the very end of the user prompt). System prompts **do not** include it.
- Stop strings keep `<think>` from surfacing in user-facing text.
- Backend `GenerateRequest.max_new_tokens` raised to 2400; frontend calls keep smaller per-call budgets (typically 200–400) to stay within FastAPI and model limits.

### OpenVINO LLM pipeline (example)
```python
import openvino_genai as ov

model_dir = "data/artifacts/models/qwen3-4b-int4-ov"
pipe = ov.LLMPipeline(model_dir, device="GPU", cache_dir="data/ov_cache")

gen_cfg = ov.GenerationConfig(
    max_new_tokens=400,
    temperature=0.35,
    top_p=0.9,
    stop_strings=["</think>"],
)

result = pipe.generate(
    prompt,
    generation_config=gen_cfg,
    tokenizer_encode_kwargs={"add_special_tokens": True},
)
print(result.text)
```
- Use `threads`, `streams`, and `cache_dir` (see `scripts/benchmark_openvino_llm.py`) to reduce first-token latency and boost throughput.
- INT4 IR reduces memory and accelerates decoding on Intel GPUs/NPUs while keeping accuracy strong for education prompts.

### Frontend model labels
- Shown as `On-Device: Model (device)` vs `Remote: …` to foreground local acceleration and sponsorship by Intel and Qwen.

## Pedagogical foundations in the code
- **Testing effect + spacing**: Short learn turns, immediate low-stakes tests, then adaptive follow-ups to reinforce retrieval.
- **Skinnerian reinforcement**: Immediate, specific feedback (encouragement + hint + probe) and new items targeted to errors; adapts quantity based on misses.
- **Co-learning**: Tutor speaks in second person, references user-selected text, and asks probing questions; meta-talk is stripped.
- **Flipped classroom**: Teacher-first, student responds, coach scores; aligns with pre-class content digestion and in-session practice.

## Implementation highlights
- Adaptive follow-ups are generated **one-at-a-time** (choice per miss + one short answer) to prevent token overflow and schema drift; fallbacks ensure UI continuity.
- Language reload persists choice in localStorage and reinitializes routes; Uyghur containers set `dir="rtl"`.
- Model choice persists; invalid choices fall back to `qwen2.5-1.5b-int4-ov` for deterministic on-device behavior.
- Hints are removed from generated follow-ups to reduce leakage; base test hints remain to scaffold initial assessment.

## Developer guidance
- Do not alter `/demo` routes unless explicitly requested.
- Keep `/nothink` appended **only** to Qwen3 user prompts; never to system prompts.
- For new follow-ups, require minimal JSON `{id, card_type, question, options (4 or null), answer}` and forbid translation/repetition of originals.
- Place new OpenVINO IRs under `data/artifacts/models/<dir>`; mirror labels/presets across backend and frontend.
- Maintain small per-call `max_new_tokens` in frontend; reserve higher caps (≤2400) for backend when needed.
- Preserve RTL handling for Uyghur when adding new UI containers.

## Co-learning: what it means in this system
- The LLM always speaks **to the learner**, not about the learner. Prompts enforce second-person voice and short, probing replies.
- Memory is scoped: each response uses the most recent turns, not a global transcript, to keep feedback grounded and avoid drift.
- Reflection-first: learn phases require a learner reflection; the tutor replies with encouragement + a probing question to sustain dialogue and metacognition.
- Hint discipline: initial tests surface hints only after an attempt; generated follow-ups omit hints to drive active recall.
- Ask-about-selection: learners can highlight any snippet of the learning note; the tutor explains that snippet, invites self-evaluation, and asks a connecting question. This anchors the dialogue to learner-chosen context and reduces cognitive load for non-native speakers.
- Minimal meta-talk: cleaning functions strip boilerplate like “you are a co-learning tutor…” before rendering, keeping the UI concise.
- Safety on state: chats, model selection, language choice, and completion status persist locally, so learners can reload without losing context.

### Co-learning prompts (representative patterns)
- Learn reflection reply: “Encouragement + hint + probing question” tied to the learner’s text; 2–3 sentences, second person.
- Ask selection: explains the highlighted snippet, then asks a connective question (“How would you apply this?”).
- Chat: uses recent turns only; ends with a probe to keep the learner talking.
- Follow-up feedback: short, targeted, no overlong explanations.

## Ask-about-selection flow (demo and modules)
1) Learner highlights text in the learning note.
2) Clicks “Ask about selection.”
3) Backend prompt includes the selection, enforces second-person tone, and asks for a probing question that bridges or extends the snippet.
4) Reply is injected into chat, followed by a fixed “What do you think? How would you apply this?” to sustain interaction.

## Language experience, extended rationale
- Minority-language focus: Tibetan, Uyghur (RTL), and Korean learners get full UI/LLM coverage, lowering cognitive load versus English-only materials.
- Direct-in-language generation: follow-ups are produced **in** the selected language, not translated from English, to avoid semantic drift and to respect native phrasing.
- “Do not translate originals; create new questions” prevents mere surface translation and encourages culturally and linguistically authentic assessment items.
- RTL support: Uyghur sets `dir="rtl"` on main containers to preserve reading order, controls layout, and form affordances.

## Innovation summary (why this is worth investment)
- **On-device, privacy-preserving LLMs**: OpenVINO INT4 Qwen models run locally on Intel CPUs/GPUs/NPUs, reducing cloud costs and latency, enabling offline or bandwidth-limited use.
- **Adaptive reinforcement at the edge**: Per-miss follow-up generation with tight token budgets and fallback safety keeps the loop responsive on constrained devices.
- **Multilingual-first assessment**: Native-language generation (not translation) for follow-ups and tests lowers cognitive overhead for minority-language learners, enabling equitable access to advanced content.
- **Co-learning tutor**: Every interaction enforces second-person, probing, low-meta responses; selection-aware prompts let learners drive the focus, increasing agency and engagement.
- **Flipped classroom alignment**: Teacher-led flow with student pacing and coach scoring matches modern pedagogy and can be deployed locally with on-device inference.
- **Operational robustness**: Minimal JSON schemas, per-call token caps, `/nothink` hygiene, and RTL-aware containers reduce failure modes and parsing issues.
- **Benchmarkable performance**: `scripts/benchmark_openvino_llm.py` exposes threads/streams/cache tuning so teams can squeeze maximum throughput on Intel hardware.
- **Rapid model swapping**: Presets and labels are synchronized across backend and frontend; adding a new IR is predictable (`data/artifacts/models/<dir>` + label wiring).

## Extended technical notes (for reviewers)
- Follow-up generation is intentionally one-per-call to avoid schema drift and to keep within service token limits; retries fall back to deterministic items.
- Stop strings and `/nothink` placement are designed to suppress verbose traces while keeping determinism across Qwen3 variants.
- Uyghur RTL was tested at the container level; when adding new panels, always propagate `dir={isRTL ? "rtl" : "ltr"}`.
- LocalStorage keys in use: `demo_language`, `demo_model`, `demo_complete` (demo); similar patterns for modules; ensure new features reuse or namespace keys to avoid collisions.
- Translation calls are sentence-chunked with small `max_new_tokens` to avoid runaway completions; failures clear translation state rather than blocking UI.
- Fallbacks in reinforce phases ensure the learner always sees a valid question set, even if JSON parsing fails.

## What to read in code (mapping doc → code)
- Demo flow: `frontend/src/pages/DemoPage.tsx` (learn/test/reinforce, ask selection, language toggle, RTL).
- Module flow: `frontend/src/pages/ModuleLearnPage.tsx` (module learn/test/reinforce, translation, chat).
- Flipped classroom: `frontend/src/pages/FlippedClassroomPage.tsx` and `frontend/src/pages/FlippedClassroomMultilingualPage.tsx` (multilingual, RTL-aware).
- Model presets and local/remote routing: `backend/rlpro_backend/services/llm_pipeline.py`, `frontend/src/api.ts`, selectors in pages.
- Follow-up logging trigger and token cap: `backend/rlpro_backend/api/server.py`.
- Benchmark and tuning: `scripts/benchmark_openvino_llm.py`.

## Practical checklist for future contributors
- Preserve co-learning tone: second person, short, probing, low meta.
- Keep `/nothink` only at the end of Qwen3 **user** prompts; never in system prompts.
- Require minimal JSON for generated items; forbid translation of originals; generate new questions in target language.
- Maintain per-call `max_new_tokens` small on frontend; use backend cap (≤2400) only when necessary.
- Keep Uyghur RTL on all new containers; do not remove existing `dir` settings.
- When adding models, place IR under `data/artifacts/models/<dir>` and wire labels identically across backend/frontend.
- Avoid touching `/demo` routes unless explicitly requested; they are canonical for regression comparisons.
