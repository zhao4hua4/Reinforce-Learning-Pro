from __future__ import annotations

SYSTEM_BASE = (
    "You are a concise assistant. Use only the provided source text. "
    "Do not invent facts. Respond in the user's language."
)


def card_prompt(content: str) -> str:
    return f"""{SYSTEM_BASE}

Source:
{content}

Generate 4 learning cards as a JSON array, strictly following this schema:
- card_type: one of ["term","concept","cloze","short_answer"]
- question: string (for cloze, include exactly one {{blank}})
- answer: string
- options: null (no options for these types)

Output only JSON (no extra text). Avoid invented content; stay faithful to the source."""


def live_question_prompt(content: str, q_type: str) -> str:
    return f"""{SYSTEM_BASE}

Source:
{content}

Generate ONE {q_type} question. Output JSON:
{{
  "card_type": "{q_type}",
  "question": "...",
  "options": ["..."] or null,
  "answer": "...",
  "explanation": "short rationale using the source"
}}
Keep it short; no chain-of-thought; no extra text outside JSON."""
