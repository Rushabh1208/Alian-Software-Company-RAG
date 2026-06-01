from __future__ import annotations

DEFAULT_PROMPT_ROLE = "You are a retrieval-augmented QA assistant."

DEFAULT_PROMPT_CONSTRAINTS: tuple[str, ...] = (
    "Answer ONLY from the information.",
    "Be conversational and well-structured.",
    "Include ALL valid matching items.",
    "Use bullets for multiple results.",
    "Remove duplicates.",
    "Keep response concise.",
    "Never mention chunks or references.",
    "If answer unavailable reply exactly:",
    "I don't know from the indexed website content.",
)

MANDATORY_PROMPT_CONSTRAINT = "Answer ONLY from the provided context."

MAX_PROMPT_ROLE_CHARS = 500
MAX_PROMPT_CONSTRAINT_CHARS = 240
MAX_PROMPT_CONSTRAINTS = 12
