from __future__ import annotations

import json
from pathlib import Path
from typing import List, Dict, Any

from rlpro_backend.config import settings


class ModuleStore:
    """Lightweight file-backed store for generated learning modules."""

    def __init__(self, path: str | None = None) -> None:
        self.path = Path(path or (Path(settings.data_dir) / "modules.json"))
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def _load(self) -> List[Dict[str, Any]]:
        if not self.path.exists():
            return []
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except Exception:
            return []

    def _save(self, data: List[Dict[str, Any]]) -> None:
        self.path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def list(self) -> List[Dict[str, Any]]:
        return self._load()

    def get(self, module_id: str) -> Dict[str, Any] | None:
        return next((m for m in self._load() if m.get("id") == module_id), None)

    def add(self, module: Dict[str, Any]) -> Dict[str, Any]:
        data = self._load()
        data.append(module)
        self._save(data)
        return module

    def delete(self, module_id: str) -> bool:
        data = self._load()
        new_data = [m for m in data if m.get("id") != module_id]
        self._save(new_data)
        return len(new_data) != len(data)
