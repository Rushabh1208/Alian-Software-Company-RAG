from __future__ import annotations

import logging
import time
from dataclasses import dataclass

import requests

from config.constants import REQUEST_USER_AGENT


@dataclass(frozen=True)
class FetchResponse:
    url: str
    status_code: int
    content_type: str
    text: str
    crawler: str = "requests"


class RequestHandler:
    def __init__(
        self,
        timeout: int,
        retries: int,
        logger: logging.Logger,
    ) -> None:
        self.timeout = timeout
        self.retries = retries
        self.logger = logger
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": REQUEST_USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            }
        )

    def fetch(self, url: str) -> FetchResponse:
        last_error: Exception | None = None

        for attempt in range(1, self.retries + 2):
            try:
                response = self.session.get(
                    url,
                    timeout=self.timeout,
                    allow_redirects=True,
                )
                return FetchResponse(
                    url=url,
                    status_code=response.status_code,
                    content_type=response.headers.get("content-type", ""),
                    text=response.text,
                )
            except requests.Timeout as exc:
                last_error = exc
                self.logger.warning(
                    "Timeout fetching %s with requests on attempt %s",
                    url,
                    attempt,
                )
            except requests.RequestException as exc:
                last_error = exc
                self.logger.warning(
                    "Request failed for %s with requests on attempt %s: %s",
                    url,
                    attempt,
                    exc,
                )

            if attempt <= self.retries:
                sleep_seconds = min(2 ** (attempt - 1), 8)
                self.logger.info(
                    "Retrying %s with requests in %s seconds",
                    url,
                    sleep_seconds,
                )
                time.sleep(sleep_seconds)

        raise RuntimeError(f"Failed to fetch {url} with requests") from last_error

