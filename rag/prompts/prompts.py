from __future__ import annotations

import re

from rag.models.query_models import RetrievedChunk
from rag.prompts.defaults import default_prompt_role, mandatory_prompt_constraint
from rag.prompts.prompt_settings import PromptSettings, merge_constraints
from rag.utils.text_utils import compact, content_body


GEMINI_MODEL = "gemini-3.1-flash-lite"
MAX_GEMINI_CHARS = 7000


def build_extractive_answer(chunks: list[RetrievedChunk]) -> str:
    if not chunks:
        return "I couldn't find specific information about that. You may want to browse the website directly or try rephrasing your question."

    parts: list[str] = []
    for chunk in chunks[:3]:
        body = compact(content_body(chunk.document), max_chars=250)
        if body:
            parts.append(body)

    combined = "\n\n".join(parts).strip()
    if not combined:
        return "I couldn't find specific information about that. You may want to browse the website directly or try rephrasing your question."
    return combined


def build_gemini_prompt(
    question: str,
    chunks: list[RetrievedChunk],
    *,
    prompt_settings: PromptSettings | None = None,
) -> str:
    settings = prompt_settings or PromptSettings()
    role = _sanitize_prompt_text(settings.role or default_prompt_role())
    question_text = _sanitize_prompt_text(question)
    user_constraints = list(settings.constraints or [])

    context_parts: list[str] = []
    for index, chunk in enumerate(chunks[:10], start=1):
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
    # Base grounding rules that always apply — these are safety/quality
    # guardrails and must always be present.
    base_lines = [
        f"- {mandatory_prompt_constraint()}",
        "- Respond in a warm, friendly, conversational tone like a real customer support agent.",
        "- Address the user directly. Use 'you' and 'your'.",
        "- Write in short paragraphs or clean bullet points. Never write walls of text.",
        "- If the answer is fully available, give it confidently and clearly.",
        "- If the answer is only partially available, share what you know and naturally suggest the user visit the website or contact support for more.",
        "- Never say 'I don't know', 'not in the context', or anything that makes the user feel dismissed.",
        "- Never mention chunks, context, sources, or any internal technical details.",
        "- Never invent facts not present in the provided context.",
    ]

    base_keys = {_constraint_key(line) for line in base_lines if line.strip()}
    cleaned_user_constraints = merge_constraints(user_constraints)
    extra_constraints = [
        constraint
        for constraint in cleaned_user_constraints
        if _constraint_key(constraint) not in base_keys
    ]

    if not extra_constraints:
        return "\n".join(base_lines)

    # FIX: user constraints go FIRST so Gemini treats them as highest priority.
    # Base grounding rules follow — they act as a safety floor, not the lead.
    result_lines: list[str] = []

    result_lines.append("IMPORTANT — follow these custom instructions first:")
    result_lines.extend(_format_constraint_line(c) for c in extra_constraints)
    result_lines.append("")
    result_lines.append("Then also follow these grounding rules:")
    result_lines.extend(base_lines)

    return "\n".join(result_lines)


def _constraint_key(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()
