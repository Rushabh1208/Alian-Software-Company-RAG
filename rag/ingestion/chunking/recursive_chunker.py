from __future__ import annotations

import tiktoken
from langchain_text_splitters import RecursiveCharacterTextSplitter


class RecursiveChunker:
    def __init__(self) -> None:
        self.encoding = tiktoken.get_encoding("cl100k_base")

    def split(self, text: str, chunk_size: int, overlap: int) -> list[str]:
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size * 4,
            chunk_overlap=overlap * 4,
            separators=["\n\n", "\n", ". ", " ", ""],
            keep_separator=True,
        )
        chunks: list[str] = []
        for chunk in splitter.split_text(text or ""):
            cleaned = chunk.strip()
            if not cleaned:
                continue
            if len(self.encoding.encode(cleaned)) <= chunk_size:
                chunks.append(cleaned)
                continue
            chunks.extend(self._split_by_tokens(cleaned, chunk_size, overlap))
        return chunks

    def _split_by_tokens(self, text: str, chunk_size: int, overlap: int) -> list[str]:
        tokens = self.encoding.encode(text)
        chunks: list[str] = []
        start = 0
        step = max(chunk_size - overlap, 1)
        while start < len(tokens):
            window = tokens[start : start + chunk_size]
            chunks.append(self.encoding.decode(window).strip())
            start += step
        return [chunk for chunk in chunks if chunk]

