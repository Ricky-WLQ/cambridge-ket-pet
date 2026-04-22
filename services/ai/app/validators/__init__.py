"""Runtime format validators for AI-generated content. These are the
no-hallucination safeguards: agent output that fails a validator triggers
a regeneration attempt (up to 3 tries, then a hard error to the UI)."""
