"""Live news feed assembly, deduplication, and 15-minute country cache."""

from __future__ import annotations

import asyncio
import re
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from server.config import server_config
from server.services.news.providers import (
    fetch_mediastack_articles,
    fetch_newsdata_articles,
)
from server.services.news.summarizer import rewrite_articles_for_voice
from server.services.news.types import (
    NewsTopic,
    NormalizedArticle,
    WritingStyle,
    normalize_country_code,
)

RAW_CACHE_TTL_SECONDS = 15 * 60
_NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")
_URL_QUERY_RE = re.compile(r"[?#].*$")


@dataclass
class CachedRawEdition:
    country: str
    articles: list[NormalizedArticle]
    providers: dict[str, dict[str, Any]]
    edition_date: str
    expires_at: float


_cached_raw_by_country: dict[str, CachedRawEdition] = {}
_in_flight_raw_fetch_by_country: dict[str, asyncio.Task[CachedRawEdition]] = {}
_in_flight_voice_enrichment: dict[str, asyncio.Task[dict[str, Any]]] = {}


def _normalize_headline_key(title: str) -> str:
    return _NON_ALNUM_RE.sub(" ", title.lower()).strip()[:80]


def _deduplicate_and_select(
    articles: list[NormalizedArticle], max_total: int = 14
) -> list[NormalizedArticle]:
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()
    unique: list[NormalizedArticle] = []

    ranked = sorted(
        articles,
        key=lambda a: (
            (2 if len(a.description) > 40 else 0) + (1 if a.image_url else 0),
            a.published_iso,
        ),
        reverse=True,
    )

    for item in ranked:
        url_key = _URL_QUERY_RE.sub("", item.original_url).lower()
        title_key = _normalize_headline_key(item.headline)
        if url_key in seen_urls or (title_key and title_key in seen_titles):
            continue
        seen_urls.add(url_key)
        if title_key:
            seen_titles.add(title_key)
        unique.append(item)

    topic_order: tuple[NewsTopic, ...] = (
        "Top Story",
        "Tech",
        "Politics",
        "Science",
        "Culture",
        "Sports",
    )
    buckets: dict[NewsTopic, list[NormalizedArticle]] = {topic: [] for topic in topic_order}
    for item in unique:
        buckets[item.topic].append(item)

    selected: list[NormalizedArticle] = []
    added = True
    while len(selected) < max_total and added:
        added = False
        for topic in topic_order:
            bucket = buckets[topic]
            if bucket and len(selected) < max_total:
                selected.append(bucket.pop(0))
                added = True

    return selected


async def _fetch_raw_edition(
    country: str, force_refresh: bool
) -> tuple[CachedRawEdition, bool]:
    now = time.monotonic()
    cached = _cached_raw_by_country.get(country)
    if not force_refresh and cached and now < cached.expires_at:
        return cached, True

    existing_task = _in_flight_raw_fetch_by_country.get(country)
    if existing_task:
        return await existing_task, False

    async def do_fetch() -> CachedRawEdition:
        try:
            mediastack_res, newsdata_res = await asyncio.gather(
                fetch_mediastack_articles(server_config.mediastack_api_key, country),
                fetch_newsdata_articles(server_config.newsdata_api_key, country),
            )
            combined = [*newsdata_res.articles, *mediastack_res.articles]
            articles = _deduplicate_and_select(combined, 14)
            now_dt = datetime.now()
            edition_date = f"{now_dt.strftime('%B')} {now_dt.day}, {now_dt.year}"

            nd_info: dict[str, Any] = {
                "status": newsdata_res.status,
                "count": len(newsdata_res.articles),
            }
            if newsdata_res.message:
                nd_info["message"] = newsdata_res.message

            ms_info: dict[str, Any] = {
                "status": mediastack_res.status,
                "count": len(mediastack_res.articles),
            }
            if mediastack_res.message:
                ms_info["message"] = mediastack_res.message

            edition = CachedRawEdition(
                country=country,
                articles=articles,
                edition_date=edition_date,
                providers={"newsdata": nd_info, "mediastack": ms_info},
                expires_at=time.monotonic() + RAW_CACHE_TTL_SECONDS,
            )
            if articles:
                _cached_raw_by_country[country] = edition
            return edition
        finally:
            _in_flight_raw_fetch_by_country.pop(country, None)

    task = asyncio.create_task(do_fetch())
    _in_flight_raw_fetch_by_country[country] = task
    return await task, False


async def get_live_news_feed(
    *,
    force_refresh: bool = False,
    voice: WritingStyle = "brief",
    country: str | None = None,
) -> dict[str, Any]:
    normalized_country = normalize_country_code(country)
    lock_key = f"{normalized_country}:{voice}:{'refresh' if force_refresh else 'read'}"

    existing_lock = _in_flight_voice_enrichment.get(lock_key)
    if existing_lock:
        return await existing_lock

    async def do_enrich() -> dict[str, Any]:
        try:
            raw, from_cache = await _fetch_raw_edition(normalized_country, force_refresh)
            stories = await rewrite_articles_for_voice(raw.articles, voice, 4)
            return {
                "stories": stories,
                "editionDate": raw.edition_date,
                "country": normalized_country,
                "voice": voice,
                "providers": raw.providers,
                "aiModel": server_config.gemini_model,
                "aiSummarizedCount": sum(1 for s in stories if s.get("aiGenerated")),
                "cached": from_cache,
            }
        finally:
            _in_flight_voice_enrichment.pop(lock_key, None)

    task = asyncio.create_task(do_enrich())
    _in_flight_voice_enrichment[lock_key] = task
    return await task
