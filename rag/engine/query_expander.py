from __future__ import annotations

import asyncio
import json
import re


_EXPANSION_PROMPT = """You are a query expansion assistant for a RAG search system.

Given a user question, generate a list of focused sub-queries that together cover all the information needs in the original question. Each sub-query should target one specific piece of information.

Rules:
- If the question already asks about one specific thing, return just that one question as-is.
- If the question asks about multiple things (e.g. list A, B and C / compare X and Y / tell me about P, Q, R), split into one sub-query per thing.
- Each sub-query must be a complete, standalone question.
- Return ONLY a JSON array of strings. No explanation, no markdown, no preamble.

Examples:
Q: "who is the CEO?"
["who is the CEO?"]

Q: "list the CEO, CFO and CTO"
["who is the CEO?", "who is the CFO?", "who is the CTO?"]

Q: "what are the courses offered and their fees?"
["what courses are offered?", "what are the course fees?"]

Q: "tell me about admission process, eligibility and last date"
["what is the admission process?", "what is the eligibility criteria?", "what is the last date for admission?"]

Now expand this question:
Q: "{question}"
"""


async def expand_query(
    question: str,
    gemini_client: object | None,
) -> list[str]:
    """
    Use Gemini to expand a question into focused sub-queries.
    Falls back to the original question if Gemini is unavailable or fails.
    """
    if gemini_client is None:
        return [question]

    prompt = _EXPANSION_PROMPT.format(question=question.strip())

    try:
        response = await asyncio.to_thread(
            gemini_client.models.generate_content,
            model="gemini-2.0-flash-lite",
            contents=prompt,
            config={
                "temperature": 0.0,
                "top_p": 1.0,
                "top_k": 1,
            },
        )
        text = getattr(response, "text", None)
        if not isinstance(text, str) or not text.strip():
            return [question]

        # strip markdown fences if present
        cleaned = re.sub(r"```json|```", "", text).strip()
        parsed = json.loads(cleaned)

        if isinstance(parsed, list):
            sub_questions = [str(q).strip() for q in parsed if str(q).strip()]
            if sub_questions:
                return sub_questions

    except Exception:
        pass

    return [question]