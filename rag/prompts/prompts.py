from __future__ import annotations

import re

from rag.models.query_models import RetrievedChunk
from rag.prompts.defaults import DEFAULT_PROMPT_ROLE, MANDATORY_PROMPT_CONSTRAINT
from rag.prompts.prompt_settings import PromptSettings, merge_constraints
from rag.utils.text_utils import compact, content_body


GEMINI_MODEL = "gemini-3.1-flash-lite"
MAX_GEMINI_CHARS = 7000


def build_extractive_answer(chunks: list[RetrievedChunk]) -> str:
    if not chunks:
        return "I don't know from the indexed website content."

    parts: list[str] = []
    for chunk in chunks[:3]:
        body = compact(content_body(chunk.document), max_chars=250)
        if body:
            parts.append(body)

    combined = "\n\n".join(parts).strip()
    if not combined:
        return "I don't know from the indexed website content."
    return combined


def build_gemini_prompt(
    question: str,
    chunks: list[RetrievedChunk],
    *,
    prompt_settings: PromptSettings | None = None,
) -> str:
    settings = prompt_settings or PromptSettings()
    role = _sanitize_prompt_text(settings.role or DEFAULT_PROMPT_ROLE)
    question_text = _sanitize_prompt_text(question)
    user_constraints = list(settings.constraints or [])

    context_parts: list[str] = []
    for index, chunk in enumerate(chunks[:5], start=1):
        context_parts.append(
            f"""
[S{index}]

TITLE:
{_sanitize_prompt_text(chunk.title)}

HEADING:
{_sanitize_prompt_text(chunk.heading)}

CONTENT:
{_sanitize_prompt_text(compact(content_body(chunk.document), max_chars=1200))}
"""
        )

    context = "\n\n".join(context_parts)[:MAX_GEMINI_CHARS]
    formatted_constraints = _build_constraints_block(user_constraints)

    return f"""<role>
{role}
</role>

<context>
{context}
</context>

<question>
{question_text}
</question>

<constraints>
{formatted_constraints}

</constraints>

Answer:
"""


def clean_answer(text: str) -> str:
    cleaned = text.strip()
    cleaned = re.sub(r"^\s*answer\s*:\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    if not cleaned:
        return "I don't know from the indexed website content."
    return cleaned.strip()


def _format_constraint_line(constraint: str) -> str:
    lines = [line.strip() for line in constraint.splitlines() if line.strip()]
    if not lines:
        return ""

    formatted = [f"- {lines[0]}"]
    formatted.extend(f"  {line}" for line in lines[1:])
    return "\n".join(formatted)


def _sanitize_prompt_text(text: str) -> str:
    cleaned = str(text or "")
    cleaned = cleaned.replace("<", " ").replace(">", " ")
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", " ", cleaned)
    cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n")
    return cleaned.strip()


def _build_constraints_block(user_constraints: list[str]) -> str:
    base_lines = [
        f"- {MANDATORY_PROMPT_CONSTRAINT}",
        "- Do not invent facts.",
        "- List the multiple points with dash points.",
        "- If the answer is not present, respond exactly:",
        '  "I don\'t know based on the provided context."',
    ]

    base_keys = {_constraint_key(line) for line in base_lines if line.strip()}
    cleaned_user_constraints = merge_constraints(user_constraints)
    extra_constraints = [
        constraint
        for constraint in cleaned_user_constraints
        if _constraint_key(constraint) not in base_keys
    ]

    if extra_constraints:
        base_lines.append("")
        base_lines.extend(_format_constraint_line(constraint) for constraint in extra_constraints)

    return "\n".join(base_lines)


def _constraint_key(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()

