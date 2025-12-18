# Learning Extraction Plan (cogni_psyc.md)

Goal: produce rich 150–300 word pedagogical cards (explanation + example + reflective question) from the cognitive psychology corpus for the immersive co-learning page.

## Inputs
- Source: `cogni_psyc.md` already cleaned and segmented to `data/processed/cogni_psyc_segments.jsonl`.
- Each segment includes `section_path`, `page`, `evidence`, `text`.

## Steps
1. **Select segment**: use scheduler/filters to pick the next segment (already in `/practice/next`).
2. **Expand**: call `/expand` with `content = question + source_snippet` (or full segment text when available) to get a 150–300 word teaching note:
   - Intro + clear explanation grounded in snippet
   - One concrete example
   - Closing interrogative to invite reflection
   - No direct answer reveal for MC items
3. **Co-learn**: LLM starts with an interrogative tied to the expanded card (immersive page).
4. **Test**: After 2–3 turns, generate a live question via `/live_question` and grade via `/grade`.
5. **Relearn**: Bias scheduler toward weak items; repeat.

## Prompting guidelines
- Expansion prompt (backend `/expand`): 150–300 words, structured intro/explanation/example/question, grounded strictly in content.
- Avoid leaking the answer; emphasize clarity and curiosity.
- Learning vs testing: learning cards via `/learn_card` (full segment, 180–320 words, intro + 3–5 knowledge points + example + Socratic questions). Testing cards via `/generate_tests` (multiple questions/types) linked to the same segment.

## Quality checks
- Spot-check `/expand` outputs for length (>=150 words) and concreteness.
- If LLM unavailable, fallback expansion pads content but should be replaced when local model is up.
- For `/generate_tests`, ensure ≥3 diverse questions and schema validity; fallback emits generic short-answer if parsing fails.

## Open items
- Consider using full segment text instead of snippets for richer cards.
- Add evaluation script to batch-run `/expand` over sample segments and flag short outputs.
