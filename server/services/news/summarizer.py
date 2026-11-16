"""AI editorial voice rewriting and in-memory voice caching for News."""

from __future__ import annotations

import asyncio
import json
import math
from dataclasses import dataclass
from typing import Any

from server.config import server_config
from server.services.ai.client import extract_json_object, run_model_completion
from server.services.news.article_fetcher import fetch_full_article_text
from server.services.news.types import VALID_VOICES, NormalizedArticle, WritingStyle

VOICE_INSTRUCTIONS: dict[WritingStyle, str] = {
    "brief": (
        "VOICE = BRIEF: Write like a crisp Reuters/AP senior wire editor. Front-load the essential "
        "who, what, when, and where with economy and precision — clean declarative sentences, exact "
        "attribution, zero filler adjectives."
    ),
    "explainer": (
        "VOICE = EXPLAINER: Write with the calm analytical clarity of a top explanatory desk. "
        "Unpack (1) what just happened, (2) the institutional, historical, or economic context "
        "behind it, and (3) what stakeholders or readers should watch next."
    ),
    "witty": (
        "VOICE = WITTY: Write with dry, understated, literary magazine wit (think The New Yorker "
        '"Talk of the Town" or FT Notebook) — perceptive, crisp, and lightly ironic only where '
        "the facts naturally invite it; never cheesy, never slangy, never glib on human tragedy."
    ),
    "plain": (
        "VOICE = PLAIN-ENGLISH: Write in warm, direct, everyday prose accessible to any reader. "
        "Translate legal, policy, financial, or scientific jargon cleanly into clear human meaning "
        "without talking down."
    ),
}


@dataclass
class VoiceRewriteResult:
    summary: str
    body_paragraphs: list[str]
    pull_quote: str | None = None
    full_article_loaded: bool = False


_voice_cache: dict[str, VoiceRewriteResult] = {}
_full_voice_cache: dict[str, VoiceRewriteResult] = {}


def _build_fallback_rewrite(article: NormalizedArticle, voice: WritingStyle) -> VoiceRewriteResult:
    lead = article.description or article.headline
    trimmed_lead = f"{lead[:277].strip()}..." if len(lead) > 280 else lead

    summary_map: dict[WritingStyle, str] = {
        "brief": trimmed_lead,
        "explainer": f"{article.source} reports in {article.topic}: {trimmed_lead}",
        "witty": f"{trimmed_lead} — via today's {article.topic.lower()} dispatch from {article.source}.",
        "plain": f"In short: {trimmed_lead}",
    }

    fallback_body = (
        article.description
        if article.description
        else f'{article.source} published coverage on "{article.headline}" under {article.topic}.'
    )
    return VoiceRewriteResult(summary=summary_map[voice], body_paragraphs=[fallback_body])


def build_story_for_voice(
    article: NormalizedArticle,
    voice: WritingStyle,
    index: int,
) -> dict[str, Any]:
    layout_variant = "featured" if index == 0 else ("image" if article.image_url else "typography")

    summary_by_style: dict[str, str] = {
        v: _build_fallback_rewrite(article, v).summary for v in VALID_VOICES
    }
    body_by_style: dict[str, list[str]] = {}
    rewritten_voices: list[WritingStyle] = []
    pull_quote: str | None = None

    for v in VALID_VOICES:
        cache_key = f"{article.id}:{v}"
        full_cached = _full_voice_cache.get(cache_key)
        cached = full_cached or _voice_cache.get(cache_key)
        if cached:
            summary_by_style[v] = cached.summary
            body_by_style[v] = cached.body_paragraphs
            rewritten_voices.append(v)
            if v == voice and cached.pull_quote:
                pull_quote = cached.pull_quote

    active_key = f"{article.id}:{voice}"
    active_full = _full_voice_cache.get(active_key)
    active_cached = active_full or _voice_cache.get(active_key)
    body_paragraphs = (
        active_cached.body_paragraphs
        if active_cached
        else _build_fallback_rewrite(article, voice).body_paragraphs
    )
    word_count = len(" ".join(body_paragraphs).split())
    read_minutes = max(1, min(8, math.ceil(word_count / 130) or 2))

    story: dict[str, Any] = {
        "id": article.id,
        "provider": article.provider,
        "topic": article.topic,
        "source": article.source,
        "originalUrl": article.original_url,
        "headline": article.headline,
        "summaryByStyle": summary_by_style,
        "bodyByStyle": body_by_style,
        "rewrittenVoices": rewritten_voices,
        "imageUrl": article.image_url,
        "imageAlt": article.headline,
        "bodyParagraphs": body_paragraphs,
        "publishedAt": article.published_at,
        "readMinutes": read_minutes,
        "layoutVariant": layout_variant,
        "aiGenerated": voice in rewritten_voices,
        "fullArticleLoaded": bool(active_full and active_full.full_article_loaded),
    }
    if pull_quote is not None:
        story["pullQuote"] = pull_quote
    return story


async def rewrite_articles_for_voice(
    articles: list[NormalizedArticle],
    voice: WritingStyle,
    max_ai_articles: int = 6,
) -> list[dict[str, Any]]:
    if server_config.gemini_api_key and articles:
        missing_for_voice = [
            a for a in articles[:max_ai_articles] if f"{a.id}:{voice}" not in _voice_cache
        ]
        chunks = [missing_for_voice[i : i + 4] for i in range(0, len(missing_for_voice), 4)]

        async def process_chunk(chunk: list[NormalizedArticle]) -> None:
            try:
                payload = [
                    {
                        "id": a.id,
                        "topic": a.topic,
                        "source": a.source,
                        "headline": a.headline,
                        "snippet": a.description or "(Headline-only dispatch)",
                    }
                    for a in chunk
                ]
                raw = await run_model_completion(
                    json_mode=True,
                    temperature=0.5 if voice == "witty" else 0.3,
                    max_tokens=4096,
                    messages=[
                        {
                            "role": "system",
                            "content": " ".join(
                                [
                                    "You are the Managing Desk Editor for Paper & Ink News — a calm, print-inspired daily edition.",
                                    VOICE_INSTRUCTIONS[voice],
                                    'For each article, craft a punchy 1–2 sentence card lead ("summary"), 1 memorable factual "pullQuote" (grounded in real facts or direct quotes from the source), and 3 cohesive editorial paragraphs ("bodyParagraphs").',
                                    'JOURNALISTIC INTEGRITY: Every name, number, date, location, and quote must come strictly from the provided source material — attribute claims cleanly ("officials said", "according to...") and never fabricate statistics, motives, or quotes.',
                                    "HYGIENE & LANGUAGE: Omit cookie prompts, newsletter CTAs, and meta-mentions of NewsData or Mediastack. Preserve non-English regional editions in their source language when supplied.",
                                    'Respond strictly as JSON: {"articles":[{"id":"...","summary":string,"pullQuote":string,"bodyParagraphs":string[]}]}. Keep the exact id for every item. Never output reasoning.',
                                ]
                            ),
                        },
                        {
                            "role": "user",
                            "content": json.dumps(
                                {"voice": voice, "articles": payload}, ensure_ascii=False
                            ),
                        },
                    ],
                )

                parsed = extract_json_object(raw)
                items = parsed.get("articles") if parsed else None
                if not isinstance(items, list):
                    return

                by_id = {c.id: c for c in chunk}
                for item in items:
                    if not isinstance(item, dict) or not isinstance(item.get("id"), str):
                        continue
                    item_id = item["id"]
                    summary = item["summary"].strip() if isinstance(item.get("summary"), str) else ""
                    raw_paragraphs = item.get("bodyParagraphs")
                    paragraphs = (
                        [
                            p
                            for p in raw_paragraphs
                            if isinstance(p, str) and len(p.strip()) > 12
                        ][:4]
                        if isinstance(raw_paragraphs, list)
                        else []
                    )
                    if not summary and not paragraphs:
                        continue

                    src_article = by_id.get(item_id)
                    fallback = _build_fallback_rewrite(src_article, voice) if src_article else None
                    raw_quote = item.get("pullQuote")
                    pull_quote = (
                        raw_quote.strip()
                        if isinstance(raw_quote, str) and len(raw_quote.strip()) > 8
                        else None
                    )
                    _voice_cache[f"{item_id}:{voice}"] = VoiceRewriteResult(
                        summary=summary or (fallback.summary if fallback else ""),
                        body_paragraphs=paragraphs
                        if paragraphs
                        else (fallback.body_paragraphs if fallback else []),
                        pull_quote=pull_quote,
                    )
            except Exception as exc:
                print(f"[News AI {voice} batch skipped] {exc}")

        if chunks:
            await asyncio.gather(*(process_chunk(chunk) for chunk in chunks))

    return [build_story_for_voice(article, voice, idx) for idx, article in enumerate(articles)]


async def rewrite_single_story_for_voice(
    *,
    id: str,
    topic: str,
    source: str,
    headline: str,
    snippet: str,
    original_url: str | None = None,
    voice: WritingStyle,
) -> dict[str, Any]:
    cache_key = f"{id}:{voice}"
    full_cached = _full_voice_cache.get(cache_key)
    if full_cached:
        res: dict[str, Any] = {
            "voice": voice,
            "summary": full_cached.summary,
            "bodyParagraphs": full_cached.body_paragraphs,
            "aiGenerated": True,
            "fullArticleLoaded": full_cached.full_article_loaded,
        }
        if full_cached.pull_quote is not None:
            res["pullQuote"] = full_cached.pull_quote
        return res

    fetched_article = await fetch_full_article_text(original_url)
    has_full_publisher_text = bool(fetched_article and len(fetched_article["paragraphs"]) >= 2)
    source_body = fetched_article["fullText"] if has_full_publisher_text and fetched_article else snippet

    try:
        user_payload: dict[str, Any] = {
            "topic": topic,
            "source": source,
            "headline": headline,
            "voice": voice,
        }
        if has_full_publisher_text:
            user_payload["fullArticleText"] = source_body
        else:
            user_payload["snippet"] = source_body or headline

        raw = await run_model_completion(
            json_mode=True,
            temperature=0.45 if voice == "witty" else 0.25,
            max_tokens=5000,
            messages=[
                {
                    "role": "system",
                    "content": " ".join(
                        [
                            "You are the Senior Feature & Dispatch Writer for Paper & Ink News.",
                            VOICE_INSTRUCTIONS[voice],
                            (
                                "You are provided the complete reporting fetched from the publisher. Compose a complete, deeply readable 5 to 9 paragraph article in the requested voice, preserving all key facts, timeline developments, named sources, figures, and direct quotes cleanly with varied narrative rhythm."
                                if has_full_publisher_text
                                else 'Craft BOTH a crisp 1–2 sentence lead ("summary") and a clean 3-paragraph editorial dispatch grounded strictly in the provided facts.'
                            ),
                            'JOURNALISTIC INTEGRITY & HYGIENE: Never invent facts, numbers, or quotes absent from the source text; preserve nuanced attribution ("according to...", "officials said"). Strip all subscription prompts, inbox newsletter banners, cookie notices, or references to wire aggregators.',
                            'Also choose 1 incisive factual highlight or real quoted line for "pullQuote" (or empty string if none fits). Preserve the source article language when non-English.',
                            'Respond strictly as JSON: {"summary":string,"pullQuote":string,"bodyParagraphs":string[]}. Never output chain-of-thought.',
                        ]
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(user_payload, ensure_ascii=False),
                },
            ],
        )

        parsed = extract_json_object(raw)
        fallback_paragraphs = (
            fetched_article["paragraphs"][:18]
            if has_full_publisher_text and fetched_article
            else [snippet or headline]
        )

        raw_summary = parsed.get("summary") if parsed else None
        summary = (
            raw_summary.strip()
            if isinstance(raw_summary, str) and raw_summary.strip()
            else fallback_paragraphs[0]
        )

        raw_ai_paragraphs = parsed.get("bodyParagraphs") if parsed else None
        ai_paragraphs = (
            [p for p in raw_ai_paragraphs if isinstance(p, str) and len(p.strip()) > 16][:12]
            if isinstance(raw_ai_paragraphs, list)
            else []
        )

        if has_full_publisher_text and len(ai_paragraphs) < 3 and fetched_article:
            body_paragraphs = fetched_article["paragraphs"][:18]
        elif ai_paragraphs:
            body_paragraphs = ai_paragraphs
        else:
            body_paragraphs = fallback_paragraphs

        raw_quote = parsed.get("pullQuote") if parsed else None
        pull_quote = (
            raw_quote.strip()
            if isinstance(raw_quote, str) and len(raw_quote.strip()) > 8
            else None
        )

        _full_voice_cache[cache_key] = VoiceRewriteResult(
            summary=summary,
            body_paragraphs=body_paragraphs,
            pull_quote=pull_quote,
            full_article_loaded=True,
        )

        result: dict[str, Any] = {
            "voice": voice,
            "summary": summary,
            "bodyParagraphs": body_paragraphs,
            "aiGenerated": True,
            "fullArticleLoaded": True,
        }
        if pull_quote is not None:
            result["pullQuote"] = pull_quote
        return result
    except Exception:
        if has_full_publisher_text and fetched_article:
            entry = VoiceRewriteResult(
                summary=snippet or fetched_article["paragraphs"][0],
                body_paragraphs=fetched_article["paragraphs"][:18],
                full_article_loaded=True,
            )
            _full_voice_cache[cache_key] = entry
            return {
                "voice": voice,
                "summary": entry.summary,
                "bodyParagraphs": entry.body_paragraphs,
                "fullArticleLoaded": True,
                "aiGenerated": False,
            }

        return {
            "voice": voice,
            "summary": snippet or headline,
            "bodyParagraphs": [snippet or headline],
            "aiGenerated": False,
            "fullArticleLoaded": True,
        }
