## Demo Mode Guide (Universal Grammar)

Route `/demo` (nav hidden). Flow: Learn -> Test -> (adaptive) -> Loop complete, then flipped classroom moves to `/demo/flipped`. Model switch available (On-device, Qwen3-next-80b-a3b-instruct).

### Setup
- Backend: `.\.venv\Scripts\activate && set PYTHONPATH=%CD%\backend && .\.venv\Scripts\python.exe -m uvicorn rlpro_backend.api.server:app --host 127.0.0.1 --port 8000`
- Remote model (optional): override demo defaults via env `RLPRO_REMOTE_BASE_URL` and `RLPRO_REMOTE_API_KEY` (DashScope-compatible). Default remote model `qwen3-next-80b-a3b-instruct` was used to validate the scripted prompts below.
- Frontend: `cd frontend && npm run dev -- --host --port 5173`
- Open `http://127.0.0.1:5173/demo`

### Learning phase (on /demo)
1) Land on `/demo`. Show the learning note (UG + poverty-of-the-stimulus), example, reflect prompts; progress bar starts at 0. Confirm model dropdown shows "On-device" (or switch to "Qwen3-next-80b-a3b-instruct" for steadier outputs).
2) Selection ask: highlight `Children learn rapidly despite sparse and noisy input...` then click **Ask about selection**. Expect a second-person reply plus an extra engagement question (verified on Qwen3-next).
3) Reflection 1: type `I think UG is needed because input is limited.` then click **Respond & Next**. Call out the self-check + probing question.
4) Reflection 2: type `Could usage-based learning handle this?` then click **Respond & Next**. (Tip: you must submit a reflection to progress.) This advances into testing.
5) Multilingual: pick a language (English/中文/满族语言/藏语/朝鲜�?French/German) next to the model selector; click **Translate all** to render the entire page (UI + learning note + tests/chat prompts) in that language using sentence-by-sentence calls to the selected LLM.

### Testing phase (on /demo)
1) Q1 (multiple choice): select "Input is too sparse/noisy to explain rapid grammar learning without innate constraints." Click **Submit**. Result shows expected answer; chat gives a brief hint.
2) Q2 (short answer, scripted wrong): type `No evidence.` Click **Submit**. Result shows only correct/incorrect (no answer reveal); a hint appears in chat.
3) Q3 (single choice): select "Usage-based/statistical learning." Click **Submit**. After all three questions, if any were incorrect, the page enters **Reinforce testing*** with follow-ups.
4) Reinforce testing (adaptive): two fresh questions appear (one single-choice, one short-answer). They are grounded on the missed question. Answer both to show retesting of the same knowledge point. Progress rises toward 100%.
5) Loop completes; **Continue to Flipped Classroom** appears (enabled only after completion). Optional: click **Restart Loop** to reset learning/test flow.

Likely adaptive follow-ups (validated on remote `qwen3-next-80b-a3b-instruct`):
- Single-choice: *“What does the poverty of the stimulus argument primarily support in the context of universal grammar?�?  
  Options:  
  A) Children learn language solely through imitation and reinforcement.  
  B) Language acquisition requires extensive formal instruction.  
  C) The input children receive is insufficient to account for their linguistic competence, implying innate knowledge.  **(expected)**  
  D) All human languages share identical grammatical structures without variation.  
  Hint: environmental input alone cannot explain rapid acquisition.
- Short-answer: *“What concept explains how children acquire complex grammatical rules despite limited and often imperfect linguistic input?�?  
  Expected: **Universal grammar**. Hint: innate biological basis for language acquisition.

### Flipped classroom phase (on /demo/flipped; unlocked after loop complete)
1) Click **Continue to Flipped Classroom**; or open `/demo/flipped` after finishing the loop. Progress bar now tracks the teaching checklist.
2) Teaching chat (left): type `We are learning why sparse input still leads to grammar and how usage-based learning compares.` click **Send to student**. Student may misunderstand more often early; you must correct them for progress.
3) Progress checklist + coach (right sidebar): turns green when the LLM evaluator deems an item done (no keyword hacks, must show corrected understanding). Scores/summary only appear after **End class & evaluate**; coach chat lives on the right sidebar.
4) Coach chat: type `How do I help them grasp the input vs innateness tradeoff?` click **Ask coach**. Coach returns a 2-sentence suggestion; using the coach well boosts the coach_use score if teaching is otherwise solid.
5) Evaluation: click **End class & evaluate** to get subscores (responsiveness, clarity, scaffolding, coach_use, total) plus strengths/weaknesses. Good teaching without coach help earns a bonus; weak teaching without coach help is penalized.
6) Use **Back to demo** to re-run the learn/test loop; the model dropdown persists your last choice.

### Flipped classroom (multilingual) on `/demo/flipped-multilingual`
- Same flow as above, but all student/coach prompts and UI render in your selected language (English/中文/满族语言/藏语/朝鲜语/French/German). Use this to teach and get feedback natively, showing how the system breaks language boundaries for learning content beyond the learner's source language.

### Answer key (tests)
- Q1: "Input is too sparse/noisy to explain rapid grammar learning without innate constraints."
- Q2: scripted wrong entry "No evidence." (expected: "Critical period effects or specific language impairments selectively affecting grammar.")
- Q3: "Usage-based/statistical learning."

### Timing and tips
- ~3-4 minutes: ~1 min learn (2 reflections), ~1-1.5 min tests/adaptive, ~1 min flipped class + evaluation.
- If LLM stalls/echoes, narrate intended behavior; use hints/expected answers displayed; switch to Qwen3-next model for steadier outputs.

- Multilingual flipped classroom: use /demo/flipped-multilingual for native-language teaching and evaluation.

