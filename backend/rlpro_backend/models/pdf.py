from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class Section(BaseModel):
    title: str
    level: int
    page_start: Optional[int] = None
    page_end: Optional[int] = None
    children: List["Section"] = Field(default_factory=list)


class Segment(BaseModel):
    """Chunked text unit derived from the PDF, used for card generation."""

    id: str
    section_path: List[str] = Field(default_factory=list)
    page: Optional[int] = None
    text: str
    evidence: List[str] = Field(default_factory=list)


class Document(BaseModel):
    """Represents a parsed PDF with hierarchical sections and segments."""

    id: str
    title: str
    sections: List[Section] = Field(default_factory=list)
    segments: List[Segment] = Field(default_factory=list)
    source_path: Optional[str] = None
    metadata: dict = Field(default_factory=dict)

    def section_titles(self) -> List[str]:
        return [sec.title for sec in self.sections]


Section.model_rebuild()
