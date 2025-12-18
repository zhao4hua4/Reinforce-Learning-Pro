from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from rlpro_backend.config import settings
from rlpro_backend.models import SessionMetadata, AnswerRecord


class SessionStore:
    """Simple JSONL session logger."""

    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = Path(base_dir or settings.data_dir) / "sessions"
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def session_path(self, session_id: str) -> Path:
        return self.base_dir / f"{session_id}.jsonl"

    def save_session(self, session: SessionMetadata) -> Path:
        path = self.session_path(session.session_id)
        with path.open("w", encoding="utf-8") as f:
            f.write(session.model_dump_json(ensure_ascii=False, indent=2))
        return path

    def append_answer(self, session_id: str, record: AnswerRecord) -> Path:
        path = self.session_path(session_id)
        with path.open("a", encoding="utf-8") as f:
            f.write(record.model_dump_json(ensure_ascii=False) + "\n")
        return path
