"""News domain types and text/date/topic normalization helpers."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

NewsTopic = Literal["Top Story", "Tech", "Politics", "Culture", "Sports", "Science"]
WritingStyle = Literal["brief", "explainer", "witty", "plain"]

VALID_VOICES: tuple[WritingStyle, ...] = ("brief", "explainer", "witty", "plain")

_COUNTRY_RE = re.compile(r"^[a-z]{2}$")
_TAG_RE = re.compile(r"<[^>]*>")
_WS_RE = re.compile(r"\s+")
_PAID_PLANS_RE = re.compile(r"^ONLY AVAILABLE IN PAID PLANS$", re.IGNORECASE)

_TECH_RE = re.compile(
    r"\b(tech|technology|software|ai|cyber|silicon|apple|google|microsoft|chip|digital|robotics)\b"
)
_SCIENCE_RE = re.compile(
    r"\b(science|environment|climate|space|nasa|physics|biology|health|medicine|research)\b"
)
_POLITICS_RE = re.compile(
    r"\b(politics|government|election|parliament|senate|congress|diplomacy|policy|minister)\b"
)
_SPORTS_RE = re.compile(
    r"\b(sports|football|soccer|nba|tennis|olympic|formula 1|f1|cricket|premier league|champions)\b"
)
_CULTURE_RE = re.compile(
    r"\b(culture|entertainment|art|arts|music|film|cinema|book|books|museum|lifestyle|design|architecture)\b"
)


@dataclass
class NormalizedArticle:
    id: str
    provider: Literal["newsdata", "mediastack"]
    topic: NewsTopic
    source: str
    original_url: str
    headline: str
    description: str
    image_url: str | None
    published_at: str
    published_iso: str


@dataclass
class ProviderFetchResult:
    provider: Literal["newsdata", "mediastack"]
    status: Literal["ok", "error", "unconfigured"]
    articles: list[NormalizedArticle]
    message: str | None = None


def normalize_country_code(raw: object) -> str:
    if not isinstance(raw, str):
        return "us"
    cleaned = raw.strip().lower()
    if cleaned in ("world", "all"):
        return "world"
    if _COUNTRY_RE.match(cleaned):
        return cleaned
    return "us"


def sanitize_news_text(raw: object) -> str:
    if not isinstance(raw, str):
        return ""
    stripped = _WS_RE.sub(" ", _TAG_RE.sub(" ", raw)).strip()
    if not stripped or _PAID_PLANS_RE.match(stripped):
        return ""
    return stripped


def map_categories_to_topic(
    raw_categories: list[str | None], headline: str = ""
) -> NewsTopic:
    joined = f"{' '.join(c for c in raw_categories if c)} {headline}".lower()
    if _TECH_RE.search(joined):
        return "Tech"
    if _SCIENCE_RE.search(joined):
        return "Science"
    if _POLITICS_RE.search(joined):
        return "Politics"
    if _SPORTS_RE.search(joined):
        return "Sports"
    if _CULTURE_RE.search(joined):
        return "Culture"
    return "Top Story"


def format_relative_published(date_input: str | None) -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    if not date_input:
        return "Today", now.isoformat()

    normalized = date_input.strip()
    if "T" not in normalized:
        normalized = normalized.replace(" ", "T") + "Z"
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"

    try:
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        else:
            parsed = parsed.astimezone(timezone.utc)
    except ValueError:
        return "Today", now.isoformat()

    iso = parsed.isoformat().replace("+00:00", "Z")
    diff_hours = max(0, int((now - parsed).total_seconds() // 3600))
    if diff_hours < 1:
        return "Just now", iso
    if diff_hours < 24:
        return f"{diff_hours}h ago", iso
    diff_days = diff_hours // 24
    if diff_days == 1:
        return "Yesterday", iso
    return f"{parsed.strftime('%b')} {parsed.day}", iso
