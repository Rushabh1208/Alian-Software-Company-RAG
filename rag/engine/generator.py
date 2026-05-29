from __future__ import annotations

import asyncio

from rag.models.query_models import RetrievedChunk
from rag.prompts.prompts import build_extractive_answer, build_gemini_prompt, clean_answer, GEMINI_MODEL
from rag.utils.text_utils import is_bad_answer
from rag.utils.token_utils import estimate_tokens


async def generate_answer(
    *,
    gemini_client: object | None,
    question: str,
    chunks: list[RetrievedChunk],
) -> tuple[str, int, int]:
    prompt = build_gemini_prompt(question, chunks)
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
                "temperature": 0.2,
                "top_p": 0.8,
                "top_k": 20,
            },
        )
        text = getattr(response, "text", None)
        if isinstance(text, str) and text.strip():
            answer = clean_answer(text)
            if is_bad_answer(answer):
                answer = "I don't know from the indexed website content."
            return answer, input_tokens, estimate_tokens(answer)
    except Exception:
        pass

    answer = "I don't know from the indexed website content."
    return answer, input_tokens, estimate_tokens(answer)

