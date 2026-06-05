from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import logging
import random
import time

import requests

from config.constants import REQUEST_USER_AGENT


@dataclass(frozen=True)
class FetchResponse:
    url: str
    status_code: int
    content_type: str
    text: str
    headers: dict[str, str] = field(default_factory=dict)
    crawler: str = "requests"


class RequestHandler:
    def __init__(
        self,
        timeout: int,
        retries: int,
        logger: logging.Logger,
        backoff_multiplier: float = 2.0,
        max_backoff_seconds: float = 120.0,
        rate_limit_retries: int = 5,
        rate_limit_base_seconds: float = 30.0,
    ) -> None:
        self.timeout = timeout
        self.retries = retries
        self.backoff_multiplier = max(1.0, backoff_multiplier)
        self.max_backoff_seconds = max_backoff_seconds
        self.rate_limit_retries = rate_limit_retries        # separate retry budget for 429s
        self.rate_limit_base_seconds = rate_limit_base_seconds  # minimum wait on 429
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
        rate_limit_hits = 0

        for attempt in range(1, self.retries + 2):
            try:
                response = self.session.get(
                    url,
                    timeout=self.timeout,
                    allow_redirects=True,
                )

                if response.status_code == 429:
                    rate_limit_hits += 1

                    if rate_limit_hits > self.rate_limit_retries:
                        self.logger.error(
                            "Rate limit retries exhausted for %s after %s 429 responses. Giving up.",
                            url,
                            rate_limit_hits,
                        )
                        # Return the 429 response so the caller can handle/skip gracefully
                        return FetchResponse(
                            url=url,
                            status_code=429,
                            content_type=response.headers.get("content-type", ""),
                            text="",
                            headers={str(k): str(v) for k, v in response.headers.items()},
                        )

                    # Respect Retry-After header if present
                    retry_after = self._retry_after_seconds(response)

                    if retry_after is not None:
                        # Add small jitter (±10%) to avoid synchronized retries
                        jitter = retry_after * random.uniform(-0.1, 0.1)
                        sleep_seconds = max(retry_after + jitter, 1.0)
                        self.logger.warning(
                            "Rate limited (429) on %s — Retry-After header says %.1fs "
                            "(attempt %s/%s, rate-limit hit %s/%s). Sleeping %.1fs.",
                            url, retry_after,
                            attempt, self.retries + 1,
                            rate_limit_hits, self.rate_limit_retries,
                            sleep_seconds,
                        )
                    else:
                        # Exponential backoff from rate_limit_base_seconds with jitter
                        base = self.rate_limit_base_seconds * (self.backoff_multiplier ** (rate_limit_hits - 1))
                        jitter = base * random.uniform(0.0, 0.25)
                        sleep_seconds = min(base + jitter, self.max_backoff_seconds)
                        self.logger.warning(
                            "Rate limited (429) on %s — no Retry-After header "
                            "(attempt %s/%s, rate-limit hit %s/%s). Backing off %.1fs.",
                            url,
                            attempt, self.retries + 1,
                            rate_limit_hits, self.rate_limit_retries,
                            sleep_seconds,
                        )

                    time.sleep(sleep_seconds)
                    # Don't count 429 against normal retry budget — continue without incrementing attempt
                    attempt -= 1  # neutralize the for-loop increment
                    continue

                return FetchResponse(
                    url=url,
                    status_code=response.status_code,
                    content_type=response.headers.get("content-type", ""),
                    text=response.text,
                    headers={str(k): str(v) for k, v in response.headers.items()},
                )

            except requests.Timeout as exc:
                last_error = exc
                self.logger.warning(
                    "Timeout fetching %s on attempt %s/%s",
                    url, attempt, self.retries + 1,
                )
            except requests.RequestException as exc:
                last_error = exc
                self.logger.warning(
                    "Request failed for %s on attempt %s/%s: %s",
                    url, attempt, self.retries + 1, exc,
                )

            if attempt <= self.retries:
                sleep_seconds = min(
                    self.backoff_multiplier ** (attempt - 1) + random.uniform(0.0, 1.0),
                    self.max_backoff_seconds,
                )
                self.logger.info(
                    "Retrying %s in %.1fs (attempt %s/%s)",
                    url, sleep_seconds, attempt + 1, self.retries + 1,
                )
                time.sleep(sleep_seconds)

        raise RuntimeError(f"Failed to fetch {url} after {self.retries + 1} attempts") from last_error

    @staticmethod
    def _retry_after_seconds(response: requests.Response) -> float | None:
        raw_retry_after = response.headers.get("Retry-After", "").strip()
        if not raw_retry_after:
            return None
        try:
            return max(float(raw_retry_after), 0.0)
        except ValueError:
            try:
                retry_at = parsedate_to_datetime(raw_retry_after)
            except (TypeError, ValueError, IndexError):
                return None
            if retry_at is None:
                return None
            if retry_at.tzinfo is None:
                retry_at = retry_at.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            return max((retry_at - now).total_seconds(), 0.0)