from __future__ import annotations

from typing import List, Protocol

from rlpro_backend.models import Card, Document, SessionMetadata


class Repository(Protocol):
    """Persistence interface (e.g., file, SQLite, or vector store-backed)."""

    def save_document(self, document: Document) -> None: ...

    def save_cards(self, cards: List[Card]) -> None: ...

    def load_cards(self) -> List[Card]: ...

    def save_session(self, session: SessionMetadata) -> None: ...


class LocalJsonRepository:
    """JSON-file-based placeholder implementation."""

    def __init__(self, base_path: str):
        self.base_path = base_path

    def save_document(self, document: Document) -> None:
        raise NotImplementedError("Document persistence is not implemented yet.")

    def save_cards(self, cards: List[Card]) -> None:
        raise NotImplementedError("Card persistence is not implemented yet.")

    def load_cards(self) -> List[Card]:
        raise NotImplementedError("Card loading is not implemented yet.")

    def save_session(self, session: SessionMetadata) -> None:
        raise NotImplementedError("Session persistence is not implemented yet.")
