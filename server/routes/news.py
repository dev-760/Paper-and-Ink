"""Live news feed and single-story AI rewriting routes."""

from __future__ import annotations

from typing import Any, cast

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from server.middleware.rate_limit import (
    create_rate_limiter,
    get_client_ip,
    read_json_body_safe,
)
from server.services.news.feed_service import get_live_news_feed
from server.services.news.summarizer import rewrite_single_story_for_voice
from server.services.news.types import VALID_VOICES, WritingStyle, normalize_country_code

router = APIRouter(prefix="/api/news", tags=["news"])


def _parse_voice(raw: Any) -> WritingStyle:
    if isinstance(raw, str) and raw in VALID_VOICES:
        return cast(WritingStyle, raw)
    return "brief"


news_feed_limiter = create_rate_limiter(
    window_ms=5 * 60 * 1000,
    max_requests=40,
    key_builder=lambda req, _body: f"news-feed:{get_client_ip(req)}",
    message="Too many edition refreshes briefly. Please wait a moment.",
)

news_ai_limiter = create_rate_limiter(
    window_ms=5 * 60 * 1000,
    max_requests=35,
    key_builder=lambda req, _body: f"news-ai:{get_client_ip(req)}",
    message="AI rewriting limit reached briefly. Please try again in a moment.",
)


@router.get("/feed", dependencies=[Depends(news_feed_limiter)])
async def get_feed(request: Request) -> JSONResponse:
    """Fetch live country-scoped stories and rewrite them in the selected Voice."""
    try:
        refresh_param = request.query_params.get("refresh")
        force_refresh = refresh_param in ("1", "true")
        voice = _parse_voice(request.query_params.get("voice"))
        country = normalize_country_code(request.query_params.get("country"))
        bundle = await get_live_news_feed(
            force_refresh=force_refresh,
            voice=voice,
            country=country,
        )
        return JSONResponse(status_code=200, content=bundle)
    except Exception as exc:
        message = str(exc) or "Unable to assemble live news edition."
        return JSONResponse(status_code=502, content={"error": message})


@router.post("/summarize", dependencies=[Depends(news_ai_limiter)])
async def summarize_story(request: Request) -> JSONResponse:
    """Rewrite an individual story (card summary + full article prose) in the chosen Voice."""
    try:
        body = await read_json_body_safe(request)
        story_id = body["id"][:100] if isinstance(body.get("id"), str) else ""
        headline = body["headline"].strip()[:300] if isinstance(body.get("headline"), str) else ""
        source = (
            body["source"].strip()[:120]
            if isinstance(body.get("source"), str) and body["source"].strip()
            else "Wire"
        )
        topic = (
            body["topic"].strip()[:40]
            if isinstance(body.get("topic"), str) and body["topic"].strip()
            else "Top Story"
        )
        snippet = body["snippet"].strip()[:2000] if isinstance(body.get("snippet"), str) else ""
        original_url = (
            body["originalUrl"].strip()[:1000]
            if isinstance(body.get("originalUrl"), str)
            else ""
        )
        voice = _parse_voice(body.get("voice"))

        if not story_id or not headline:
            return JSONResponse(
                status_code=400,
                content={"error": "Story id and headline are required."},
            )

        result = await rewrite_single_story_for_voice(
            id=story_id,
            topic=topic,
            source=source,
            headline=headline,
            snippet=snippet,
            original_url=original_url,
            voice=voice,
        )
        return JSONResponse(status_code=200, content=result)
    except Exception as exc:
        message = str(exc) or "Unable to rewrite story with AI."
        return JSONResponse(status_code=502, content={"error": message})
