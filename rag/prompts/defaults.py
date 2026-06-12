from __future__ import annotations

from config.admin_config import get_prompt_seed


def default_prompt_role() -> str:
    return str(get_prompt_seed()["role"])


def default_prompt_constraints() -> tuple[str, ...]:
    return tuple(str(item) for item in get_prompt_seed()["constraints"])


def mandatory_prompt_constraint() -> str:
    return "Answer ONLY from the provided context."


MAX_PROMPT_ROLE_CHARS = 500
MAX_PROMPT_CONSTRAINT_CHARS = 240
MAX_PROMPT_CONSTRAINTS = 12
