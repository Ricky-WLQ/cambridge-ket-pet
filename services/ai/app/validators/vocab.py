"""Post-generation validators for the vocab_gloss agent.

Each validator raises ValueError on bad output. The Pydantic AI agent
catches these and triggers retry (up to 3 attempts per spec).

Note: cefrLevel field on VocabGlossItem is validated by Pydantic's Literal type
(A1|A2|B1|B2|C1|C2). No extra validator function needed.

Note: the per-item example-contains-headword check was removed (2026-04-26)
because its substring-match heuristic produced too many false positives for
multi-token headwords ("look after") and irregular inflections (find→found).
The schema's required example: str (min_length=3) is sufficient. Schema-level
CJK check on glossZh remains the primary gloss validator.
"""
from app.schemas.vocab import VocabGlossItem, VocabWordInput


def validate_response_covers_all_words(
    inputs: list[VocabWordInput],
    items: list[VocabGlossItem],
) -> None:
    """Every input.cambridgeId must appear in items. Raises ValueError on gap."""
    have = {it.cambridgeId for it in items}
    missing = [w.cambridgeId for w in inputs if w.cambridgeId not in have]
    if missing:
        raise ValueError(
            f"response missing {len(missing)} of {len(inputs)} requested words: "
            f"first few: {missing[:5]}",
        )
