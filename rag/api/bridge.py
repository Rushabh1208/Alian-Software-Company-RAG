from __future__ import annotations

import argparse
import asyncio
import json
from typing import Any

from config.constants import DEFAULT_BASE_COLLECTION_NAME
from rag.services.web_ingestion.service import WebsiteIngestionService


def _json_dump(payload: Any) -> None:
    print(json.dumps(payload, indent=2, ensure_ascii=False))


async def _index(args: argparse.Namespace) -> None:
    service = WebsiteIngestionService()
    result = await service.index_website(args.url, force=bool(args.force))
    _json_dump(result.to_dict())


async def _query(args: argparse.Namespace) -> None:
    service = WebsiteIngestionService()
    result = await service.query(
        args.question,
        collection_name=str(args.collection or DEFAULT_BASE_COLLECTION_NAME),
        top_k=int(args.top_k),
    )
    _json_dump(result.to_dict())


def _list(_: argparse.Namespace) -> None:
    service = WebsiteIngestionService()
    _json_dump({"websites": service.list_websites()})


def _delete(args: argparse.Namespace) -> None:
    service = WebsiteIngestionService()
    _json_dump(service.delete_website(str(args.id)))


def main() -> None:
    parser = argparse.ArgumentParser(description="JSON bridge for the RAG website backend")
    subparsers = parser.add_subparsers(dest="command", required=True)

    index_parser = subparsers.add_parser("index-website", help="Index a website into ChromaDB")
    index_parser.add_argument("--url", required=True)
    index_parser.add_argument("--force", action="store_true")
    index_parser.set_defaults(handler=_index)

    query_parser = subparsers.add_parser("query", help="Query the current RAG collection")
    query_parser.add_argument("--question", required=True)
    query_parser.add_argument("--collection", default=DEFAULT_BASE_COLLECTION_NAME)
    query_parser.add_argument("--top-k", default=5, type=int)
    query_parser.set_defaults(handler=_query)

    list_parser = subparsers.add_parser("list-websites", help="List indexed websites")
    list_parser.set_defaults(handler=_list)

    delete_parser = subparsers.add_parser("delete-website", help="Delete an indexed website")
    delete_parser.add_argument("--id", required=True)
    delete_parser.set_defaults(handler=_delete)

    args = parser.parse_args()
    handler = getattr(args, "handler", None)
    if handler is None:
        parser.error("Missing command handler")

    result = handler(args)
    if asyncio.iscoroutine(result):
        asyncio.run(result)


if __name__ == "__main__":
    main()
