from rlpro_backend.services.grading import Grader
from rlpro_backend.models import Card, CardType
from rlpro_backend.services.chunking import Chunker
from rlpro_backend.services.card_generation import CardGenerator
from rlpro_backend.models import Segment


def test_grade_short_answer_keyword_and_similarity():
    grader = Grader()
    card = Card(id="c1", card_type=CardType.SHORT_ANSWER, question="Q", answer="Working memory capacity")
    is_correct, score, details = grader.grade(card, "memory capacity")
    assert is_correct is True
    assert score >= 0.6
    assert "matched_keywords" in details


def test_grade_multiple_choice_partial_credit():
    grader = Grader()
    card = Card(
        id="c2",
        card_type="multiple_choice",
        question="Pick all",
        answer="a;b;c",
        options=["a", "b", "c", "d"],
    )
    is_correct, score, _ = grader.grade(card, "a; b")
    assert is_correct is False
    assert 0 < score < 1


def test_chunker_headings_and_overlap():
    ch = Chunker(max_chars=40, overlap_chars=5)
    pages = ["Intro line\n\nParagraph one is long enough.", "Heading Two\n\nMore text here."]
    headings = ch.detect_headings(pages)
    assert headings[2].startswith("Heading")
    segments = ch.chunk_pages("doc", pages, headings=headings)
    assert segments[0].section_path == []
    assert "Heading Two" in segments[-1].section_path
    # ensure overlap contributed to second buffer
    assert len(segments) >= 2


def test_card_generator_fallback_uses_evidence():
    gen = CardGenerator(client=None)
    seg = Segment(id="s1", section_path=["sec"], page=1, text="Some content.", evidence=["Evidence sentence."])
    cards, errors = gen._parse_cards(None, seg)
    assert cards and cards[0].metadata.get("fallback") is True
    assert errors == []
