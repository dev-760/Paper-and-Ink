"""Safe server-side publisher article fetcher with SSRF guards and TTL cache."""

from __future__ import annotations

import html
import ipaddress
import json
import re
import time
from typing import Any
from urllib.parse import urlparse

import httpx

_ARTICLE_CACHE_TTL_SECONDS = 30 * 60
_cached_articles: dict[str, tuple[list[str], str, float]] = {}

_BOILERPLATE_LINE_RE = re.compile(
    r"^(?:accept(?:\s+all)?|manage\s+cookies?|cookie\s+(?:policy|settings)|subscribe\s+(?:now|to)|"
    r"sign\s+(?:in|up)|log\s+in|register\s+(?:now|to)|all\s+rights\s+reserved|advertisement|"
    r"sponsored\s+content|share\s+this(?:\s+article)?|follow\s+us|read\s+more:|related\s+articles?|"
    r"copyright\s+©|you\s+have\s+permission|please\s+enable\s+javascript|get\s+our\s+pick\b|"
    r"download\s+(?:the|our)\s+app\b|listen\s+to\s+this\s+article\b|scroll\s+to\s+continue\b)"
    r"|in\s+your\s+inbox\.?$",
    re.IGNORECASE,
)
_JSON_LD_RE = re.compile(
    r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>([\s\S]*?)</script>',
    re.IGNORECASE,
)
_NOISE_TAGS_RE = re.compile(
    r"<(script|style|noscript|svg|header|footer|nav|aside|form|iframe)\b[\s\S]*?</\1>",
    re.IGNORECASE,
)
_COMMENT_RE = re.compile(r"<!--[\s\S]*?-->")
_ARTICLE_TAG_RE = re.compile(r"<article\b[\s\S]*?</article>", re.IGNORECASE)
_MAIN_TAG_RE = re.compile(r"<main\b[\s\S]*?</main>", re.IGNORECASE)
_P_TAG_RE = re.compile(r"<p\b[^>]*>([\s\S]*?)</p>", re.IGNORECASE)
_TAG_RE = re.compile(r"<[^>]*>")
_WS_RE = re.compile(r"\s+")
_SENTENCE_RE = re.compile(r"[^.!?]+[.!?]+(?:\s+|$)")


def is_private_or_local_hostname(hostname: str) -> bool:
    host = hostname.strip().lower().rstrip(".")
    if not host:
        return True
    if (
        host in ("localhost", "127.0.0.1", "0.0.0.0", "::1")
        or host.endswith(".local")
        or host.endswith(".internal")
    ):
        return True

    try:
        ip = ipaddress.ip_address(host.strip("[]"))
        return (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        )
    except ValueError:
        return False


def _clean_text_fragment(raw: str) -> str:
    without_tags = _TAG_RE.sub(" ", raw)
    unescaped = html.unescape(without_tags)
    return _WS_RE.sub(" ", unescaped).strip()


def _find_article_body(node: Any) -> str | None:
    if isinstance(node, list):
        for item in node:
            found = _find_article_body(item)
            if found:
                return found
        return None
    if not isinstance(node, dict):
        return None
    body = node.get("articleBody")
    if isinstance(body, str) and len(body.strip()) > 220:
        return body.strip()
    if "@graph" in node:
        return _find_article_body(node["@graph"])
    return None


def _extract_article_body_from_json_ld(page_html: str) -> list[str]:
    for match in _JSON_LD_RE.finditer(page_html):
        try:
            parsed = json.loads(match.group(1).strip())
        except Exception:
            continue

        body = _find_article_body(parsed)
        if not body:
            continue

        split_paragraphs = [
            cleaned
            for p in re.split(r"\n{2,}|\r\n\r\n", body)
            if (cleaned := _clean_text_fragment(p))
            and len(cleaned) >= 40
            and not _BOILERPLATE_LINE_RE.search(cleaned)
        ]
        if len(split_paragraphs) >= 2:
            return split_paragraphs[:18]

        sentences = _SENTENCE_RE.findall(_clean_text_fragment(body))
        if len(sentences) >= 4:
            chunks: list[str] = []
            for i in range(0, len(sentences), 3):
                chunk = " ".join(sentences[i : i + 3]).strip()
                if len(chunk) >= 40:
                    chunks.append(chunk)
            if len(chunks) >= 2:
                return chunks[:14]

    return []


def _extract_paragraphs_from_html(page_html: str) -> list[str]:
    stripped_noise = _COMMENT_RE.sub(" ", _NOISE_TAGS_RE.sub(" ", page_html))
    article_match = _ARTICLE_TAG_RE.search(stripped_noise) or _MAIN_TAG_RE.search(stripped_noise)
    scope = article_match.group(0) if article_match else stripped_noise

    seen: set[str] = set()
    paragraphs: list[str] = []
    for match in _P_TAG_RE.finditer(scope):
        text = _clean_text_fragment(match.group(1))
        if len(text) < 48 or len(text) > 2200:
            continue
        if _BOILERPLATE_LINE_RE.search(text) or text in seen:
            continue
        seen.add(text)
        paragraphs.append(text)
        if len(paragraphs) >= 18:
            break

    return paragraphs


async def fetch_full_article_text(
    original_url: str | None,
) -> dict[str, Any] | None:
    """Fetch full publisher reporting paragraphs from an article URL safely on the server."""
    if not original_url:
        return None
    try:
        parsed = urlparse(original_url)
    except Exception:
        return None

    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return None
    if is_private_or_local_hostname(parsed.hostname):
        return None

    cache_key = parsed.geturl()
    cached = _cached_articles.get(cache_key)
    if cached and time.monotonic() < cached[2]:
        return {"paragraphs": cached[0], "fullText": cached[1]}

    try:
        async with httpx.AsyncClient(timeout=7.0, follow_redirects=True) as client:
            res = await client.get(
                cache_key,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/131.0.0.0 Safari/537.36"
                    ),
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                },
            )
            # Also guard final redirected host against SSRF.
            if res.url.host and is_private_or_local_hostname(res.url.host):
                return None

        if not res.is_success:
            return None
        content_type = res.headers.get("content-type") or ""
        if not re.search(r"html|xml|text", content_type, re.IGNORECASE):
            return None

        page_html = res.text[:800_000]
        json_ld_paragraphs = _extract_article_body_from_json_ld(page_html)
        html_paragraphs = (
            json_ld_paragraphs
            if len(json_ld_paragraphs) >= 2
            else _extract_paragraphs_from_html(page_html)
        )

        if len(html_paragraphs) < 2:
            return None

        full_text = "\n\n".join(html_paragraphs)[:7500]
        _cached_articles[cache_key] = (
            html_paragraphs,
            full_text,
            time.monotonic() + _ARTICLE_CACHE_TTL_SECONDS,
        )
        return {"paragraphs": html_paragraphs, "fullText": full_text}
    except Exception:
        return None
