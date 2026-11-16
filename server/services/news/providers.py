"""External news provider integrations (NewsData.io and Mediastack)."""

from __future__ import annotations

import hashlib
import re
from typing import Any

import httpx

from server.services.news.types import (
    NormalizedArticle,
    ProviderFetchResult,
    format_relative_published,
    map_categories_to_topic,
    sanitize_news_text,
)

_HTTP_URL_RE = re.compile(r"^https?://", re.IGNORECASE)


def _stable_id(prefix: str, seed: str) -> str:
    digest = hashlib.sha1(seed.encode("utf-8")).hexdigest()[:12]
    return f"{prefix}-{digest}"


def _normalize_image_url(raw: object) -> str | None:
    if not isinstance(raw, str):
        return None
    trimmed = raw.strip()
    if not trimmed or not _HTTP_URL_RE.match(trimmed):
        return None
    return trimmed


async def fetch_newsdata_articles(api_key: str, country: str = "us") -> ProviderFetchResult:
    if not api_key:
        return ProviderFetchResult(provider="newsdata", status="unconfigured", articles=[])

    batches = ["top,politics,science", "technology,entertainment,sports"]
    collected: list[NormalizedArticle] = []
    errors: list[str] = []

    async def run_batches(with_english_filter: bool) -> None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            for categories in batches:
                try:
                    params: dict[str, str] = {
                        "apikey": api_key,
                        "category": categories,
                        "size": "10",
                    }
                    if with_english_filter:
                        params["language"] = "en"
                    if country and country != "world":
                        params["country"] = country

                    response = await client.get("https://newsdata.io/api/1/latest", params=params)
                    data: dict[str, Any] = response.json()

                    if not response.is_success or data.get("status") != "success":
                        errors.append(str(data.get("message") or f"HTTP {response.status_code}"))
                        continue

                    for item in data.get("results") or []:
                        if not isinstance(item, dict) or item.get("duplicate"):
                            continue
                        headline = sanitize_news_text(item.get("title"))
                        raw_link = item.get("link")
                        original_url = raw_link.strip() if isinstance(raw_link, str) else ""
                        if not headline or not original_url or not _HTTP_URL_RE.match(original_url):
                            continue

                        desc = sanitize_news_text(item.get("description")) or sanitize_news_text(
                            item.get("content")
                        )
                        label, iso = format_relative_published(
                            item.get("pubDate") if isinstance(item.get("pubDate"), str) else None
                        )
                        raw_cats = item.get("category")
                        cats = raw_cats if isinstance(raw_cats, list) else []
                        source_name = (
                            sanitize_news_text(item.get("source_name") or item.get("source_id"))
                            or "Wire Report"
                        )
                        seed = (
                            item["article_id"]
                            if isinstance(item.get("article_id"), str) and item["article_id"]
                            else original_url
                        )

                        collected.append(
                            NormalizedArticle(
                                id=_stable_id("nd", seed),
                                provider="newsdata",
                                topic=map_categories_to_topic(cats, headline),
                                source=source_name,
                                original_url=original_url,
                                headline=headline,
                                description=desc,
                                image_url=_normalize_image_url(item.get("image_url")),
                                published_at=label,
                                published_iso=iso,
                            )
                        )
                except Exception as exc:
                    errors.append(str(exc) or "Request failed")

    await run_batches(True)
    if len(collected) == 0 and country and country != "world":
        await run_batches(False)

    if len(collected) == 0 and errors:
        return ProviderFetchResult(
            provider="newsdata",
            status="error",
            articles=[],
            message=errors[0],
        )

    return ProviderFetchResult(
        provider="newsdata",
        status="ok",
        articles=collected,
        message=errors[0] if errors else None,
    )


async def fetch_mediastack_articles(api_key: str, country: str = "us") -> ProviderFetchResult:
    if not api_key:
        return ProviderFetchResult(provider="mediastack", status="unconfigured", articles=[])

    # Free Mediastack plans use HTTP; try HTTP first then HTTPS if needed.
    endpoints = [
        "http://api.mediastack.com/v1/news",
        "https://api.mediastack.com/v1/news",
    ]
    last_error = "Mediastack request failed."

    async with httpx.AsyncClient(timeout=10.0) as client:
        for base in endpoints:
            try:
                params: dict[str, str] = {
                    "access_key": api_key,
                    "languages": "en",
                    "sort": "published_desc",
                    "limit": "15",
                }
                if country and country != "world":
                    params["countries"] = country

                response = await client.get(base, params=params)
                data: dict[str, Any] = response.json()

                err_obj = data.get("error")
                if not response.is_success or err_obj:
                    if isinstance(err_obj, dict):
                        last_error = str(err_obj.get("message") or f"HTTP {response.status_code}")
                        if err_obj.get("code") == "invalid_access_key":
                            return ProviderFetchResult(
                                provider="mediastack",
                                status="error",
                                articles=[],
                                message=last_error,
                            )
                    else:
                        last_error = f"HTTP {response.status_code}"
                    continue

                collected: list[NormalizedArticle] = []
                for item in data.get("data") or []:
                    if not isinstance(item, dict):
                        continue
                    headline = sanitize_news_text(item.get("title"))
                    raw_url = item.get("url")
                    original_url = raw_url.strip() if isinstance(raw_url, str) else ""
                    if not headline or not original_url or not _HTTP_URL_RE.match(original_url):
                        continue

                    desc = sanitize_news_text(item.get("description"))
                    label, iso = format_relative_published(
                        item.get("published_at")
                        if isinstance(item.get("published_at"), str)
                        else None
                    )
                    category = item.get("category") if isinstance(item.get("category"), str) else None

                    collected.append(
                        NormalizedArticle(
                            id=_stable_id("ms", original_url),
                            provider="mediastack",
                            topic=map_categories_to_topic([category], headline),
                            source=sanitize_news_text(item.get("source")) or "Mediastack Wire",
                            original_url=original_url,
                            headline=headline,
                            description=desc,
                            image_url=_normalize_image_url(item.get("image")),
                            published_at=label,
                            published_iso=iso,
                        )
                    )

                return ProviderFetchResult(
                    provider="mediastack",
                    status="ok",
                    articles=collected,
                )
            except Exception as exc:
                last_error = str(exc) or "Request failed"

    return ProviderFetchResult(
        provider="mediastack",
        status="error",
        articles=[],
        message=last_error,
    )
