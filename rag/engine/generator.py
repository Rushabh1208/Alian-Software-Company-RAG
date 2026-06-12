from __future__ import annotations

import asyncio

from rag.models.query_models import RetrievedChunk
from rag.prompts.prompt_settings import PromptSettings
from rag.prompts.prompts import build_extractive_answer, build_gemini_prompt, clean_answer, GEMINI_MODEL
from rag.prompts.defaults import default_prompt_role, mandatory_prompt_constraint
from rag.utils.text_utils import is_bad_answer
from rag.utils.token_utils import estimate_tokens


async def generate_answer(
    *,
    gemini_client: object | None,
    question: str,
    chunks: list[RetrievedChunk],
    prompt_settings: PromptSettings | None = None,
) -> tuple[str, int, int]:
    prompt = build_gemini_prompt(question, chunks, prompt_settings=prompt_settings)
    input_tokens = estimate_tokens(prompt)

    if gemini_client is None:
        answer = build_extractive_answer(chunks)
        return answer, input_tokens, estimate_tokens(answer)

    try:
        response = await asyncio.to_thread(
            gemini_client.models.generate_content,
            model=GEMINI_MODEL,
            contents=prompt,
            config={
                "temperature": 0.1,
                "top_p": 0.8,
                "top_k": 20,
                "system_instruction": _build_system_instruction(prompt_settings),
            },
        )
        text = getattr(response, "text", None)
        if isinstance(text, str) and text.strip():
            answer = clean_answer(text)
            if is_bad_answer(answer):
                answer = "I couldn't find a specific answer to that in the indexed content. Please try rephrasing your question, or explore the website directly for more details."
            return answer, input_tokens, estimate_tokens(answer)
    except Exception:
        pass

    answer = "I couldn't find a specific answer to that in the indexed content. Please try rephrasing your question, or explore the website directly for more details."
    return answer, input_tokens, estimate_tokens(answer)

def _build_system_instruction(prompt_settings: PromptSettings | None) -> str:
    settings = prompt_settings or PromptSettings()
    role = str(settings.role or default_prompt_role()).strip()
    constraints = list(settings.constraints or [])

    lines = [role, ""]
    if constraints:
        lines.append("IMPORTANT — follow these custom instructions:")
        lines.extend(f"- {c}" for c in constraints)
        lines.append("")
    lines.append(f"GROUNDING RULES (always apply):")
    lines.append(f"- {mandatory_prompt_constraint()}")
    lines.append("- Never invent facts not in the provided context.")
    lines.append("- Never mention chunks, context, or internal system details.")
    return "\n".join(lines)
