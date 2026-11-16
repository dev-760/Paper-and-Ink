"""In-memory sliding-window rate limiter dependency for auth, AI, and news endpoints."""

from __future__ import annotations

import math
import time
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse


class RateLimitExceeded(Exception):
    """Raised when a client exceeds the configured sliding-window rate limit."""

    def __init__(self, message: str, retry_after_seconds: int) -> None:
        super().__init__(message)
        self.message = message
        self.retry_after_seconds = retry_after_seconds


def get_client_ip(request: Request) -> str:
    """Extract client IP honoring X-Forwarded-For (matching Express trust proxy = 1)."""
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        first = forwarded_for.split(",")[0].strip()
        if first:
            return first
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


async def read_json_body_safe(request: Request) -> dict[str, Any]:
    """Read and cache JSON body safely without failing downstream FastAPI body parsing."""
    try:
        payload = await request.json()
        return payload if isinstance(payload, dict) else {}
    except Exception:
        return {}


def create_rate_limiter(
    *,
    window_ms: int,
    max_requests: int,
    key_builder: Callable[[Request, dict[str, Any]], str] | None = None,
    message: str = "Too many requests. Please wait a moment and try again.",
) -> Callable[[Request], Awaitable[None]]:
    """Create a FastAPI dependency implementing an in-memory sliding-window rate limiter."""
    window_seconds = window_ms / 1000.0
    store: dict[str, list[float]] = {}

    async def rate_limit_dependency(request: Request) -> None:
        now = time.monotonic()
        cutoff = now - window_seconds
        base_ip = get_client_ip(request)

        if key_builder is not None:
            body = await read_json_body_safe(request) if request.method in ("POST", "PUT", "PATCH") else {}
            key = f"{base_ip}:{key_builder(request, body)}"
        else:
            key = base_ip

        existing = store.get(key)
        active = [ts for ts in existing if ts > cutoff] if existing else []

        if len(active) >= max_requests:
            oldest = active[0] if active else now
            retry_after_seconds = max(1, math.ceil(oldest + window_seconds - now))
            raise RateLimitExceeded(message=message, retry_after_seconds=retry_after_seconds)

        active.append(now)
        store[key] = active

        if len(store) > 5000:
            stale_keys = [
                entry_key
                for entry_key, timestamps in store.items()
                if all(ts <= cutoff for ts in timestamps)
            ]
            for entry_key in stale_keys:
                del store[entry_key]

    return rate_limit_dependency


def rate_limit_exception_handler(_request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"error": exc.message},
        headers={"Retry-After": str(exc.retry_after_seconds)},
    )
