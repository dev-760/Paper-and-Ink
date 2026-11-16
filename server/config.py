"""Server configuration loaded from the repository root .env and environment."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env", override=False)


def _dedupe_origins(origins: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for raw in origins:
        cleaned = raw.strip().rstrip("/")
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            result.append(cleaned)
    return result


@dataclass(frozen=True)
class ServerConfig:
    port: int
    supabase_url: str
    supabase_publishable_key: str
    supabase_secret_key: str
    supabase_jwks_url: str
    gemini_api_key: str
    gemini_model: str
    mediastack_api_key: str
    newsdata_api_key: str
    allowed_origins: list[str]


def load_server_config() -> ServerConfig:
    raw_supabase_url = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")
    raw_jwks_url = (os.getenv("SUPABASE_JWKS_URL") or "").strip()
    extra_allowed_origins = [
        o.strip().rstrip("/")
        for o in (os.getenv("ALLOWED_ORIGINS") or "").split(",")
        if o.strip()
    ]

    raw_port = (os.getenv("PORT") or "3001").strip()
    port = int(raw_port) if raw_port.isdigit() else 3001

    return ServerConfig(
        port=port,
        supabase_url=raw_supabase_url,
        supabase_publishable_key=(os.getenv("SUPABASE_PUBLISHABLE_KEY") or "").strip(),
        supabase_secret_key=(os.getenv("SUPABASE_SECRET_KEY") or "").strip(),
        supabase_jwks_url=raw_jwks_url
        or (f"{raw_supabase_url}/auth/v1/.well-known/jwks.json" if raw_supabase_url else ""),
        gemini_api_key=(os.getenv("GEMINI_API_KEY") or "").strip(),
        gemini_model=(os.getenv("GEMINI_MODEL") or "gemini-4-hydrogen").strip(),
        mediastack_api_key=(os.getenv("MEDIASTACK_API_KEY") or "").strip(),
        newsdata_api_key=(os.getenv("NEWSDATA_API_KEY") or "").strip(),
        allowed_origins=_dedupe_origins(
            [
                "http://localhost:5173",
                "http://localhost:5174",
                "http://localhost:5175",
                "http://127.0.0.1:5173",
                "http://127.0.0.1:5174",
                "http://127.0.0.1:5175",
                os.getenv("VITE_NOTES_URL") or "",
                os.getenv("VITE_READER_URL") or "",
                os.getenv("VITE_NEWS_URL") or "",
                *extra_allowed_origins,
            ]
        ),
    )


server_config = load_server_config()


def assert_supabase_configured() -> None:
    if (
        not server_config.supabase_url
        or not server_config.supabase_publishable_key
        or not server_config.supabase_secret_key
    ):
        raise RuntimeError("Supabase server environment variables are not configured.")


def assert_gemini_configured() -> None:
    if not server_config.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured.")
