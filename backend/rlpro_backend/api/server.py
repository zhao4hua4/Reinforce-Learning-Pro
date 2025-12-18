from __future__ import annotations

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, conint, confloat
import httpx

from rlpro_backend.config import settings
from rlpro_backend.services.llm_pipeline import generate, LOCAL_MODEL_PRESETS
from rlpro_backend.services.card_generation import CardGenerator
from rlpro_backend.services.chunking import Chunker
import json
from functools import lru_cache
from pathlib import Path
from textwrap import shorten
from uuid import uuid4
from rlpro_backend.models import Segment, Card
from rlpro_backend.services import prompts
from rlpro_backend.services.pdf_ingestion import PDFIngestor
from rlpro_backend.services.grading import Grader
from rlpro_backend.services.scheduler import CardScheduler
from rlpro_backend.storage.session_store import SessionStore
from rlpro_backend.storage.module_store import ModuleStore
from rlpro_backend.models.session import SessionMetadata, AnswerRecord
from datetime import datetime

grader = Grader()
scheduler = CardScheduler()
session_store = SessionStore()
module_store = ModuleStore()

app = FastAPI(
    title="Reinforce Learning Pro",
    version="0.1.0",
    description="Offline PDF -> cards -> practice pipeline (skeleton).",
)

allowed_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files (frontend preview)
static_dir = Path("frontend/public")
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


class GenerateRequest(BaseModel):
    prompt: str = Field(..., description="User prompt to send to Qwen3 model")
    max_new_tokens: conint(gt=0, le=2400) = 128
    temperature: confloat(ge=0, le=1) | None = None
    top_p: confloat(gt=0, le=1) = 0.9
    model: str | None = None


class LiveQuestionRequest(BaseModel):
    content: str
    card_type: str = Field(..., description="term|concept|cloze|short_answer|single_choice|multiple_choice")
    max_new_tokens: conint(gt=0, le=512) = 256
    temperature: confloat(ge=0, le=1) | None = None
    top_p: confloat(gt=0, le=1) = 0.9


class LiveQuestionResponse(BaseModel):
    card_type: str
    question: str
    options: list[str] | None = None
    answer: str
    explanation: str | None = None


class ChunkRequest(BaseModel):
    doc_id: str
    max_chars: conint(gt=100, le=2000) = 900
    overlap_chars: conint(ge=0, le=400) = 120


class GenerateCardsRequest(BaseModel):
    doc_id: str | None = None
    segments_path: str | None = None
    use_llm: bool = False


class GradeRequest(BaseModel):
    card_id: str
    card_type: str
    question: str
    expected_answer: str
    user_answer: str
    options: list[str] | None = None
    source_id: str | None = None
    source_page: int | None = None
    source_snippet: str | None = None
    metadata: dict | None = None
    session_id: str | None = None
    use_llm: bool = False


class PracticeNextRequest(BaseModel):
    sections: list[str] | None = None


class SessionStartRequest(BaseModel):
    session_id: str | None = None
    model_name: str | None = None
    temperature: float | None = None
    seed: int | None = None


class ExpandRequest(BaseModel):
    content: str
    min_words: conint(gt=50, le=400) = 150
    max_words: conint(gt=100, le=500) = 300


class ExpandResponse(BaseModel):
    text: str


class LearnCardRequest(BaseModel):
    source_id: str | None = None
    card_question: str | None = None
    card_answer: str | None = None
    context: str | None = None
    min_words: conint(gt=100, le=500) = 180
    max_words: conint(gt=150, le=600) = 320


class LearnCardResponse(BaseModel):
    text: str
    prompts: list[str] = Field(default_factory=list)


class TestQuestion(BaseModel):
    card_type: str
    question: str
    answer: str
    options: list[str] | None = None


class GenerateTestsRequest(BaseModel):
    content: str | None = None
    source_id: str | None = None
    question_count: conint(gt=0, le=5) = 3
    temperature: confloat(ge=0, le=1) | None = 0.1
    top_p: confloat(gt=0, le=1) | None = 0.9


class GenerateTestsResponse(BaseModel):
    questions: list[TestQuestion]


class ModuleQuestion(BaseModel):
    id: str
    card_type: str
    question: str
    options: list[str] | None = None
    answer: str
    hint: str | None = None
    forceWrong: bool | None = False


class ModulePayload(BaseModel):
    id: str
    title: str
    language: str
    learning_note: str
    example: str | None = None
    prompts: list[str] = Field(default_factory=list)
    questions: list[ModuleQuestion] = Field(default_factory=list)
    checklist: list[str] = Field(default_factory=list)


class GenerateModuleRequest(BaseModel):
    text: str
    language: str | None = None
    model_name: str | None = None


class GenerateModuleResponse(BaseModel):
    module: ModulePayload


@lru_cache(maxsize=1)
def _learning_cards_cache() -> list[dict]:
    path = Path(settings.artifacts_dir) / "learning_cards.jsonl"
    if not path.exists():
        return []
    out: list[dict] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            clean = line.lstrip("\ufeff").strip()
            if not clean:
                continue
            try:
                out.append(json.loads(clean))
            except Exception:
                continue
    return out


async def _generate_remote(payload: GenerateRequest) -> str:
    if not settings.remote_base_url or not settings.remote_api_key:
        raise RuntimeError("Remote LLM not configured (set RLPRO_REMOTE_BASE_URL and RLPRO_REMOTE_API_KEY)")
    url = settings.remote_base_url.rstrip("/") + "/chat/completions"
    headers = {"Authorization": f"Bearer {settings.remote_api_key}"}
    model_name = payload.model or settings.remote_default_model
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": payload.prompt},
    ]
    data = {
        "model": model_name,
        "messages": messages,
        "max_tokens": payload.max_new_tokens,
        "temperature": payload.temperature if payload.temperature is not None else settings.temperature,
        "top_p": payload.top_p,
    }
    async with httpx.AsyncClient(timeout=settings.request_timeout) as client:
        resp = await client.post(url, headers=headers, json=data)
        resp.raise_for_status()
        body = resp.json()
        try:
            return body["choices"][0]["message"]["content"]
        except Exception as exc:
            raise RuntimeError(f"Invalid remote response: {body}") from exc


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "llm_endpoint": settings.llm_endpoint}


@app.post("/generate")
async def generate_text(payload: GenerateRequest) -> dict[str, str]:
    try:
        if payload.model and payload.model not in LOCAL_MODEL_PRESETS:
            text = await _generate_remote(payload)
        else:
            text = generate(
                payload.prompt,
                max_new_tokens=payload.max_new_tokens,
                temperature=payload.temperature,
                top_p=payload.top_p,
                model_key=payload.model,
            )
        # Log ad-hoc follow-up prompts for debugging missed-question reinforcement.
        prompt_lower = payload.prompt.lower()
        if "follow-up" in prompt_lower or "adhoc" in prompt_lower or "reinforce" in prompt_lower:
            log_dir = Path("logs")
            log_dir.mkdir(parents=True, exist_ok=True)
            stamp = datetime.utcnow().isoformat()
            entry = {
                "timestamp": stamp,
                "model": payload.model or "local",
                "max_new_tokens": payload.max_new_tokens,
                "prompt": payload.prompt,
                "response": text,
                "thinking_block": text.split("</think>")[0] + "</think>" if text.startswith("<think>") else "",
            }
            try:
                with (log_dir / "adhoc_generation.log").open("a", encoding="utf-8") as f:
                    f.write(json.dumps(entry, ensure_ascii=False) + "\n")
            except Exception:
                pass
        return {"text": text}
    except Exception as exc:  # pragma: no cover - surface any runtime issues
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/live_question")
async def live_question(payload: LiveQuestionRequest) -> StreamingResponse:
    """Generate a single question in real time from given content, validating JSON before streaming."""
    prompt = prompts.live_question_prompt(payload.content, payload.card_type)

    def streamer():
        try:
            raw = generate(prompt, max_new_tokens=payload.max_new_tokens, temperature=payload.temperature, top_p=payload.top_p)
            parsed = json.loads(raw)
            validated = LiveQuestionResponse.model_validate(parsed)
            yield validated.model_dump_json()
        except Exception as exc:
            yield json.dumps({"error": f"live_question schema error: {exc}", "raw": raw if "raw" in locals() else None})

    return StreamingResponse(streamer(), media_type="application/json")


@app.post("/chunk")
async def chunk_document(payload: ChunkRequest) -> dict:
    """Chunk a processed document JSON into segments JSONL."""
    proc_path = Path(settings.processed_dir) / f"{payload.doc_id}.json"
    if not proc_path.exists():
        raise HTTPException(status_code=404, detail=f"Processed file not found: {proc_path}")
    data = json.load(proc_path.open("r", encoding="utf-8"))
    pages = data.get("pages", [])
    chunker = Chunker(max_chars=payload.max_chars, overlap_chars=payload.overlap_chars)
    headings = chunker.detect_headings(pages)
    segments = chunker.chunk_pages(payload.doc_id, pages, headings=headings)
    out_path = chunker.save_segments(payload.doc_id, segments)
    return {"segments": len(segments), "out": str(out_path)}


@app.post("/generate_cards")
async def generate_cards_endpoint(payload: GenerateCardsRequest) -> dict:
    """Generate cards from segments JSONL; can skip LLM for speed (fallback heuristics)."""
    seg_path = Path(payload.segments_path or (Path(settings.processed_dir) / f"{payload.doc_id}_segments.jsonl"))
    if not seg_path.exists():
        raise HTTPException(status_code=404, detail=f"Segments file not found: {seg_path}")
    # Load segments
    segments: list[Segment] = []
    with seg_path.open("r", encoding="utf-8") as f:
        for line in f:
            segments.append(Segment.model_validate(json.loads(line)))
    gen = CardGenerator()
    cards, errors = await gen.generate_for_segments(segments, use_llm=payload.use_llm)
    # register cards to scheduler
    scheduler.register_cards(cards)
    out_path = Path(settings.artifacts_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    out_file = out_path / "cards.jsonl"
    with out_file.open("w", encoding="utf-8") as f:
        for card in cards:
            f.write(card.model_dump_json(ensure_ascii=False) + "\n")
    return {"cards": len(cards), "out": str(out_file), "schema_errors": errors}


@app.post("/grade")
async def grade_answer(payload: "GradeRequest") -> dict:
    """Grading via rule-based scorer, with scheduler update."""
    # Expect card info to be provided
    card = Card(
        id=payload.card_id,
        card_type=payload.card_type,
        question=payload.question,
        answer=payload.expected_answer,
        options=payload.options,
        source_id=payload.source_id,
        source_page=payload.source_page,
        source_snippet=payload.source_snippet,
        metadata=payload.metadata or {},
    )
    # Optional LLM grading for open-ended answers
    is_correct = False
    score = 0.0
    details: dict = {}
    if payload.use_llm and card.card_type in {"term", "concept", "cloze", "short_answer"}:
        prompt = (
            "You are grading a short answer. Return JSON only with keys is_correct (true/false), "
            "score (0-1 float), feedback (string). Do not include any other text.\n"
            f"Question: {card.question}\n"
            f"Expected answer: {card.answer}\n"
            f"User answer: {payload.user_answer}\n"
        )
        try:
            raw = generate(prompt, max_new_tokens=128, temperature=0.0, top_p=0.9)
            parsed = json.loads(raw)
            is_correct = bool(parsed.get("is_correct", False))
            score = float(parsed.get("score", 0.0))
            details = {"feedback": parsed.get("feedback", "")}
        except Exception:
            is_correct, score, details = grader.grade(card, payload.user_answer)
    else:
        is_correct, score, details = grader.grade(card, payload.user_answer)
    scheduler.update(card.id, is_correct)
    # Optional session logging
    if payload.session_id:
        record = AnswerRecord(
            card_id=card.id,
            card_type=card.card_type,
            user_answer=payload.user_answer,
            is_correct=is_correct,
            score=score,
            feedback=details.get("expected"),
            evidence_used=card.source_snippet,
        )
        session_store.append_answer(payload.session_id, record)
    return {"is_correct": is_correct, "score": score, "details": details}


@app.get("/schedule/next")
async def schedule_next() -> dict:
    """Return next card id based on current scheduler weights."""
    try:
        cid = scheduler.next_card()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"card_id": cid, "weight": scheduler.weights.get(cid)}


@app.post("/practice/next")
async def practice_next(payload: PracticeNextRequest | None = None) -> dict:
    """Return the next card payload for practice (uses scheduler; optional section filter)."""
    cards_path = Path(settings.artifacts_dir) / "cards.jsonl"
    if not cards_path.exists():
        raise HTTPException(status_code=404, detail="cards.jsonl not found")
    cards = []
    with cards_path.open("r", encoding="utf-8") as f:
        for line in f:
            clean = line.lstrip("\ufeff").strip()
            if not clean:
                continue
            cards.append(json.loads(clean))
    if not cards:
        raise HTTPException(status_code=400, detail="No cards available")
    allowed_sections = set(payload.sections) if payload and payload.sections else None
    if allowed_sections:
        filtered = []
        for c in cards:
            sec = c.get("metadata", {}).get("section", [])
            if any(s in allowed_sections for s in sec):
                filtered.append(c)
        if filtered:
            cards = filtered
    # pick by scheduler weight if present, else uniform
    candidate_ids = [c.get("id") for c in cards]
    weights = []
    total = 0.0
    for cid in candidate_ids:
        w = scheduler.weights.get(cid, 1.0)
        weights.append(w)
        total += w
    import random

    r = random.random() * total
    upto = 0.0
    chosen_id = candidate_ids[0]
    for cid, w in zip(candidate_ids, weights):
        upto += w
        if upto >= r:
            chosen_id = cid
            break
    card_obj = next((c for c in cards if c.get("id") == chosen_id), cards[0])
    return {"card": card_obj, "weight": scheduler.weights.get(chosen_id, 1.0)}


@app.post("/session/start")
async def start_session(payload: SessionStartRequest | None = None) -> dict:
    """Create and persist a new study session metadata file."""
    sid = payload.session_id or str(uuid4())
    meta = SessionMetadata(
        session_id=sid,
        model_name=payload.model_name or "qwen3-8b-openvino",
        temperature=payload.temperature or settings.temperature,
        seed=payload.seed or settings.seed,
    )
    path = session_store.save_session(meta)
    return {"session_id": sid, "path": str(path)}


def _fallback_explanation(text: str, min_words: int, max_words: int) -> str:
    """Heuristic expansion when LLM fails: pad with structure and reflection prompts."""
    base = text.strip()
    points = base.split(". ")
    summary = "This note covers: " + "; ".join(shorten(p.strip(), width=120, placeholder="...") for p in points if p.strip()) + "."
    example = "Example: Imagine applying this idea in a real-life study scenario—how would it change your approach?"
    reflect = "Reflect: How would you explain this to a friend, and where might it fail?"
    combined = " ".join([summary, example, reflect])
    # pad to minimum words if short
    words = combined.split()
    while len(words) < min_words:
        words.extend(reflect.split())
    return " ".join(words[: max_words])


@app.post("/expand")
async def expand_explanation(payload: ExpandRequest) -> ExpandResponse:
    """Expand a learning snippet into a 150-300 word pedagogical explanation with an example and a reflective question."""
    prompt = (
        "Write a concise teaching note for a new learner, grounded ONLY in the provided content. "
        f"Length: {payload.min_words}-{payload.max_words} words. "
        "Structure: 1) brief intro, 2) clear explanation in plain language, 3) one concrete example, "
        "4) end with an inviting question to prompt reflection. "
        "Do NOT reveal multiple-choice answers directly; focus on concept clarity."
        "\nContent:\n"
        f"{payload.content}"
    )
    try:
        text = generate(prompt, max_new_tokens=768, temperature=0.35, top_p=0.9)
        return ExpandResponse(text=text)
    except Exception as exc:
        fallback = _fallback_explanation(payload.content, payload.min_words, payload.max_words)
        return ExpandResponse(text=fallback + f" (fallback used due to: {exc})")


def _segment_text_from_source(source_id: str | None) -> str | None:
    if not source_id:
        return None
    # Check pre-generated learning cards first
    for entry in _learning_cards_cache():
        if entry.get("source_id") == source_id:
            lc = entry.get("learning_card", {})
            parts = [lc.get("text", ""), " ".join(lc.get("knowledge_points") or [])]
            combined = "\n".join(p for p in parts if p)
            if combined.strip():
                return combined.strip()
    proc_dir = Path(settings.processed_dir)
    for path in proc_dir.glob("*_segments.jsonl"):
        with path.open("r", encoding="utf-8") as f:
            for line in f:
                try:
                    row = json.loads(line)
                except Exception:
                    continue
                if row.get("id") == source_id:
                    parts = [row.get("text", ""), " ".join(row.get("evidence", []) or [])]
                    combined = "\n".join(p for p in parts if p)
                    return combined.strip()
    return None


@app.post("/learn_card")
async def learn_card(payload: LearnCardRequest) -> LearnCardResponse:
    """Produce a rich teaching note distinct from flashcards (180-320 words, example, Socratic prompts)."""
    # If pre-generated exists, return it directly.
    for entry in _learning_cards_cache():
        if payload.source_id and entry.get("source_id") == payload.source_id:
            lc = entry.get("learning_card", {})
            text = lc.get("text") or ""
            prompts = lc.get("socratic_prompts") or []
            if text.strip():
                return LearnCardResponse(text=text, prompts=prompts)
    context = payload.context or _segment_text_from_source(payload.source_id)
    if not context:
        context = "\n".join(filter(None, [payload.card_question, payload.card_answer])) or "No context provided."
    prompt = (
        "Create a teaching note for a new learner. DO NOT present it as a Q/A or flashcard. "
        f"Length: {payload.min_words}-{payload.max_words} words. "
        "Structure: intro to the idea; 3 key points (with brief elaboration); one concrete example; "
        "close with 2 Socratic questions that invite reflection. "
        "Stay strictly grounded in the provided context; do not invent citations. "
        "If the context is too thin, generalize cautiously and state assumptions."
        f"\nContext:\n{context}"
    )
    try:
        text = generate(prompt, max_new_tokens=900, temperature=0.35, top_p=0.9)
        words = text.split()
        # If too short, try once more with explicit length push; else fallback.
        if len(words) < payload.min_words:
            retry_prompt = prompt + f"\nIMPORTANT: ensure at least {payload.min_words} words; elaborate each key point with a sentence."
            text = generate(retry_prompt, max_new_tokens=1100, temperature=0.35, top_p=0.9)
            words = text.split()
        if len(words) < payload.min_words:
            raise ValueError(f"Learning card too short ({len(words)} words)")
        # Heuristic: split out Socratic questions if present
        prompts = []
        if "?" in text:
            prompts = [p.strip() + "?" for p in text.split("?") if p.strip()][-2:]
        else:
            prompts = ["What evidence supports this idea?", "How might this apply beyond the given context?"]
        return LearnCardResponse(text=" ".join(words[: payload.max_words]), prompts=prompts)
    except Exception as exc:
        fallback = _fallback_explanation(context, payload.min_words, payload.max_words)
        return LearnCardResponse(text=fallback + f" (fallback used due to: {exc})", prompts=[])


def _generate_tests_from_content(content: str, question_count: int, temperature: float | None, top_p: float | None) -> list[TestQuestion]:
    """Generate multiple test questions grounded in content."""
    prompt = (
        "Generate diverse test questions for the learner, grounded ONLY in the provided content. "
        "Return JSON array with items: card_type (single_choice|multiple_choice|short_answer|concept), question, answer, options (null or list). "
        f"Include {question_count} questions covering different knowledge points; at least one should be short_answer and one choice-based. "
        "Keep questions concise; answers should be correct but not verbose."
        "\nContent:\n"
        f"{content}"
    )
    raw = generate(
        prompt,
        max_new_tokens=800,
        temperature=temperature if temperature is not None else settings.temperature,
        top_p=top_p if top_p is not None else 0.9,
    )
    parsed = json.loads(raw)
    if not isinstance(parsed, list):
        raise ValueError("Generated tests not a list")
    out: list[TestQuestion] = []
    for item in parsed:
        try:
            out.append(TestQuestion.model_validate(item))
        except Exception:
            continue
    if not out:
        raise ValueError("No valid test questions parsed")
    # pad to requested count with simple short-answer if needed
    while len(out) < question_count:
        out.append(
            TestQuestion(
                card_type="short_answer",
                question="Summarize a key idea from the passage.",
                answer=content[:200],
                options=None,
            )
        )
    return out


async def _generate_module(text: str, language: str | None, model_name: str | None) -> ModulePayload:
    target_lang = language or "English"
    prompt = (
        f"You are creating a learning module in {target_lang}. "
        "Return JSON with fields: title, language, learning_note (~220-320 words), example (one sentence), "
        "prompts (array of 2 reflective questions), questions (3-5 items, each with id, card_type (single_choice|multiple_choice|short_answer), "
        "question, options (null or 4 options), answer, hint), checklist (3 items for flipped classroom progression). "
        "Ground the content ONLY in the provided text. Keep language natural and concise.\n"
        f"Source text:\n{text[:1000]}"
    )
    try:
        raw = await _generate_remote(
            GenerateRequest(prompt=prompt, max_new_tokens=900, temperature=0.3, top_p=0.9, model=model_name)
        )
    except Exception:
        raw = None
    data: dict = {}
    if raw:
        try:
            parsed = json.loads(raw if isinstance(raw, str) else raw.text)
            data = parsed
        except Exception:
            data = {}
    if not data:
        # fallback heuristic
        data = {
            "title": "Custom Module",
            "language": target_lang,
            "learning_note": text[:900],
            "example": "",
            "prompts": ["What stands out most?", "How would you apply this?"],
            "questions": [
                {
                    "id": "q1",
                    "card_type": "short_answer",
                    "question": "Summarize the main idea.",
                    "options": None,
                    "answer": text[:120],
                    "hint": "Stay grounded in the source text.",
                }
            ],
            "checklist": ["Explain main idea", "Give one example", "Pose real-life question"],
        }
    # ensure structure
    questions = []
    for idx, q in enumerate(data.get("questions", [])):
        try:
            questions.append(
                ModuleQuestion(
                    id=q.get("id") or f"q{idx+1}",
                    card_type=q.get("card_type") or "short_answer",
                    question=q.get("question") or "Question?",
                    options=q.get("options"),
                    answer=q.get("answer") or "",
                    hint=q.get("hint") or "",
                    forceWrong=False,
                )
            )
        except Exception:
            continue
    if not questions:
        questions = [
            ModuleQuestion(
                id="q1",
                card_type="short_answer",
                question="Summarize the main idea.",
                options=None,
                answer=text[:120],
                hint="Stay grounded in the source text.",
            )
        ]
    checklist = data.get("checklist") or ["Explain main idea", "Give one example", "Pose real-life question"]
    module = ModulePayload(
        id=str(uuid4()),
        title=data.get("title") or "Custom Module",
        language=data.get("language") or target_lang,
        learning_note=data.get("learning_note") or text[:900],
        example=data.get("example") or "",
        prompts=data.get("prompts") or [],
        questions=questions,
        checklist=checklist,
    )
    module_store.add(module.model_dump())
    return module


@app.post("/generate_tests")
async def generate_tests(payload: GenerateTestsRequest) -> GenerateTestsResponse:
    """Generate multiple test questions from a full segment."""
    content = payload.content or _segment_text_from_source(payload.source_id)
    if not content:
        raise HTTPException(status_code=400, detail="No content provided to generate tests.")
    try:
        questions = _generate_tests_from_content(content, payload.question_count, payload.temperature, payload.top_p)
        return GenerateTestsResponse(questions=questions)
    except Exception as exc:
        # minimal fallback: single short-answer
        fallback = TestQuestion(
            card_type="short_answer",
            question="Summarize the main idea in your own words.",
            answer=content[:200],
            options=None,
        )
        return GenerateTestsResponse(questions=[fallback])


@app.get("/modules")
async def list_modules() -> list[dict]:
    return module_store.list()


@app.get("/modules/{module_id}")
async def get_module(module_id: str) -> dict:
    module = module_store.get(module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return module


@app.delete("/modules/{module_id}")
async def delete_module(module_id: str) -> dict:
    deleted = module_store.delete(module_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Module not found")
    return {"deleted": module_id}


@app.post("/modules/generate")
async def generate_module(payload: GenerateModuleRequest) -> GenerateModuleResponse:
    if not payload.text or len(payload.text.split()) > 1000:
        raise HTTPException(status_code=400, detail="Text is required and must be <= 1000 words.")
    module = await _generate_module(payload.text, payload.language, payload.model_name)
    return GenerateModuleResponse(module=module)


@app.post("/ingest")
async def ingest_pdf(file: UploadFile = File(...)) -> dict[str, str]:
    """Ingest a PDF and return basic metadata."""
    try:
        tmp_path = Path(settings.data_dir) / "raw" / file.filename
        tmp_path.parent.mkdir(parents=True, exist_ok=True)
        with tmp_path.open("wb") as f:
            f.write(await file.read())
        ing = PDFIngestor()
        doc = ing.ingest(str(tmp_path), detect_sections=True)
        return {
            "id": doc.id,
            "title": doc.title,
            "sections": [s.model_dump() for s in doc.sections],
            "pages_cleaned": doc.metadata.get("pages_cleaned"),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/cards")
async def list_cards() -> list[dict]:
    """List pre-generated cards if available."""
    cards_path = Path(settings.artifacts_dir) / "cards.jsonl"
    if not cards_path.exists():
        raise HTTPException(status_code=404, detail="cards.jsonl not found")
    out = []
    with cards_path.open("r", encoding="utf-8") as f:
        for line in f:
            clean = line.lstrip("\ufeff").strip()
            if not clean:
                continue
            out.append(json.loads(clean))
    return out


@app.get("/learning_cards")
async def list_learning_cards() -> list[dict]:
    """List pre-generated learning cards if available."""
    return _learning_cards_cache()


@app.get("/export/csv")
async def export_csv() -> FileResponse:
    """Export cards to CSV."""
    cards_path = Path(settings.artifacts_dir) / "cards.jsonl"
    if not cards_path.exists():
        raise HTTPException(status_code=404, detail="cards.jsonl not found")
    csv_path = Path(settings.artifacts_dir) / "cards.csv"
    with cards_path.open("r", encoding="utf-8") as fin, csv_path.open("w", encoding="utf-8", newline="") as fout:
        import csv

        writer = csv.writer(fout)
        writer.writerow(["id", "type", "question", "answer", "options", "source_id", "page", "section"])
        for line in fin:
            row = json.loads(line)
            writer.writerow(
                [
                    row.get("id"),
                    row.get("card_type"),
                    row.get("question"),
                    row.get("answer"),
                    "|".join(row.get("options") or []),
                    row.get("source_id"),
                    row.get("source_page"),
                    "/".join(row.get("metadata", {}).get("section", [])),
                ]
            )
    return FileResponse(path=csv_path, filename="cards.csv", media_type="text/csv")


@app.get("/export/md")
async def export_md() -> FileResponse:
    """Export cards to Markdown."""
    cards_path = Path(settings.artifacts_dir) / "cards.jsonl"
    if not cards_path.exists():
        raise HTTPException(status_code=404, detail="cards.jsonl not found")
    md_path = Path(settings.artifacts_dir) / "cards.md"
    with cards_path.open("r", encoding="utf-8") as fin, md_path.open("w", encoding="utf-8") as fout:
        for line in fin:
            row = json.loads(line)
            fout.write(f"### {row.get('question','').strip()}\n\n")
            fout.write(f"- 类型: {row.get('card_type')}\n")
            if row.get("options"):
                fout.write(f"- 选项: {' | '.join(row['options'])}\n")
            fout.write(f"- 答案: {row.get('answer')}\n")
            if row.get("source_page"):
                fout.write(f"- 页码: {row['source_page']}\n")
            sec = row.get("metadata", {}).get("section", [])
            if sec:
                fout.write(f"- 章节: {' / '.join(sec)}\n")
            fout.write("\n")
    return FileResponse(path=md_path, filename="cards.md", media_type="text/markdown")


@app.get("/export/anki")
async def export_anki() -> FileResponse:
    """Export cards to a simple Anki-friendly TSV (Front<TAB>Back)."""
    cards_path = Path(settings.artifacts_dir) / "cards.jsonl"
    if not cards_path.exists():
        raise HTTPException(status_code=404, detail="cards.jsonl not found")
    anki_path = Path(settings.artifacts_dir) / "cards_anki.txt"
    with cards_path.open("r", encoding="utf-8") as fin, anki_path.open("w", encoding="utf-8") as fout:
        for line in fin:
            row = json.loads(line)
            front_parts = [row.get("question", "").strip()]
            if row.get("options"):
                front_parts.append(f"Options: {' | '.join(row['options'])}")
            front = "<br>".join(front_parts)
            back_parts = [row.get("answer", "").strip()]
            snippet = row.get("source_snippet")
            if snippet:
                back_parts.append(f"Source: {snippet}")
            fout.write(f"{front}\t{'<br>'.join(back_parts)}\n")
    return FileResponse(path=anki_path, filename="cards_anki.txt", media_type="text/plain")
