"""Unit and integration tests for the Paper & Ink FastAPI backend."""

from __future__ import annotations

import base64
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from server.main import app, create_app
from server.middleware.rate_limit import create_rate_limiter
from server.middleware.require_auth import AuthenticatedUser, require_auth
from server.services.news.article_fetcher import is_private_or_local_hostname
from server.services.news.types import NormalizedArticle, ProviderFetchResult


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def test_health_and_security_headers(client: TestClient) -> None:
    for path in ("/", "/api/health"):
        res = client.get(path, headers={"Origin": "http://localhost:5173"})
        assert res.status_code == 200
        assert res.json() == {"status": "ok", "service": "paper-and-ink-api"}
        assert res.headers.get("x-content-type-options") == "nosniff"
        assert res.headers.get("referrer-policy") == "strict-origin-when-cross-origin"
        assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_max_body_size_returns_413(client: TestClient) -> None:
    res = client.post(
        "/api/ai/book-brief",
        content=b"x",
        headers={"Content-Length": str(17 * 1024 * 1024), "Content-Type": "application/json"},
    )
    assert res.status_code == 413
    assert res.json() == {"error": "Payload exceeds maximum allowed size."}


def test_auth_me_requires_bearer_token(client: TestClient) -> None:
    res = client.get("/api/auth/me")
    assert res.status_code == 401
    assert res.json() == {"error": "Authentication required."}


def test_register_validation_errors(client: TestClient) -> None:
    res = client.post(
        "/api/auth/register",
        json={"username": "ab", "name": "Alice", "password": "password123"},
    )
    assert res.status_code == 400
    assert "Username must be 3 to 24" in res.json()["error"]

    res = client.post(
        "/api/auth/register",
        json={"username": "alice_1", "name": "", "password": "password123"},
    )
    assert res.status_code == 400
    assert "Name must be between 1 and 60" in res.json()["error"]

    res = client.post(
        "/api/auth/register",
        json={"username": "alice_1", "name": "Alice", "password": "short"},
    )
    assert res.status_code == 400
    assert "Password must be between 8 and 128" in res.json()["error"]

    res = client.post(
        "/api/auth/register",
        json={
            "username": "alice_1",
            "name": "Alice",
            "password": "password123",
            "avatarDataUrl": "data:image/gif;base64,R0lGODlh",
        },
    )
    assert res.status_code == 400
    assert "PNG, JPEG, or WebP" in res.json()["error"]


def test_register_and_login_success_with_mocked_supabase(client: TestClient) -> None:
    profile_row = {
        "id": "user-123",
        "username": "alice_ink",
        "display_name": "Alice Ink",
        "avatar_path": None,
        "created_at": "2026-11-16T00:00:00Z",
        "updated_at": "2026-11-16T00:00:00Z",
    }
    session_obj = SimpleNamespace(
        access_token="access-tok",
        refresh_token="refresh-tok",
        expires_in=3600,
        expires_at=9999999999,
        token_type="bearer",
    )

    mock_table = MagicMock()
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.single.return_value = mock_table
    mock_table.update.return_value = mock_table
    mock_table.execute = AsyncMock(return_value=SimpleNamespace(data=profile_row))

    mock_rpc_lookup = MagicMock()
    mock_rpc_lookup.execute = AsyncMock(return_value=SimpleNamespace(data=[]))
    mock_rpc_register = MagicMock()
    mock_rpc_register.execute = AsyncMock(return_value=SimpleNamespace(data=None))

    def rpc_side_effect(name: str, _params: dict) -> MagicMock:
        if name == "resolve_username_identity":
            return mock_rpc_lookup
        return mock_rpc_register

    mock_admin = MagicMock()
    mock_admin.rpc.side_effect = rpc_side_effect
    mock_admin.from_.return_value = mock_table
    mock_admin.auth.admin.create_user = AsyncMock(
        return_value=SimpleNamespace(user=SimpleNamespace(id="user-123"))
    )

    mock_public = MagicMock()
    mock_public.auth.sign_in_with_password = AsyncMock(
        return_value=SimpleNamespace(session=session_obj)
    )
    mock_public.auth.close = AsyncMock()

    class _PublicCtx:
        async def __aenter__(self):
            return mock_public

        async def __aexit__(self, *_args):
            return None

    with (
        patch("server.routes.auth.get_supabase_admin", AsyncMock(return_value=mock_admin)),
        patch("server.routes.auth.create_stateless_public_client", return_value=_PublicCtx()),
    ):
        reg_res = client.post(
            "/api/auth/register",
            json={
                "username": "Alice_Ink",
                "name": "Alice  Ink",
                "password": "password123",
            },
        )
        assert reg_res.status_code == 201
        body = reg_res.json()
        assert body["session"]["access_token"] == "access-tok"
        assert body["profile"]["username"] == "alice_ink"
        assert body["profile"]["displayName"] == "Alice Ink"

        mock_rpc_lookup.execute = AsyncMock(
            return_value=SimpleNamespace(
                data=[{"user_id": "user-123", "internal_email": "u_x@users.paperandink.local"}]
            )
        )
        login_res = client.post(
            "/api/auth/login",
            json={"username": "alice_ink", "password": "password123"},
        )
        assert login_res.status_code == 200
        assert login_res.json()["profile"]["id"] == "user-123"


def test_auth_me_and_profile_update_with_dependency_override() -> None:
    test_app = create_app()
    test_app.dependency_overrides[require_auth] = lambda: AuthenticatedUser(
        id="user-123", username="alice_ink", token="tok"
    )
    test_client = TestClient(test_app)

    profile_row = {
        "id": "user-123",
        "username": "alice_ink",
        "display_name": "Alice Updated",
        "avatar_path": None,
        "created_at": "2026-11-16T00:00:00Z",
        "updated_at": "2026-11-16T00:00:00Z",
    }
    mock_table = MagicMock()
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.single.return_value = mock_table
    mock_table.update.return_value = mock_table
    mock_table.execute = AsyncMock(return_value=SimpleNamespace(data=profile_row))

    mock_admin = MagicMock()
    mock_admin.from_.return_value = mock_table
    mock_admin.auth.admin.update_user_by_id = AsyncMock()

    with patch("server.routes.auth.get_supabase_admin", AsyncMock(return_value=mock_admin)):
        me_res = test_client.get("/api/auth/me")
        assert me_res.status_code == 200
        assert me_res.json()["profile"]["username"] == "alice_ink"

        patch_res = test_client.patch("/api/auth/profile", json={"name": "Alice Updated"})
        assert patch_res.status_code == 200
        assert patch_res.json()["profile"]["displayName"] == "Alice Updated"


def test_ai_routes_validation_and_mocked_completion(client: TestClient) -> None:
    assert client.post("/api/ai/ocr", json={}).status_code == 400
    assert client.post("/api/ai/pdf-extract", json={"pages": []}).status_code == 400
    assert client.post("/api/ai/book-brief", json={"title": "Test"}).status_code == 400

    png_b64 = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\x00" * 16).decode("ascii")
    ocr_json = (
        '{"rawTranscript":"Hello","cleanedText":"Hello","titleSuggestion":"Greeting",'
        '"summary":"Short note","keyPoints":["Point 1"],"tasks":[{"text":"Do it","done":false}]}'
    )
    with patch(
        "server.services.ai.ocr.run_model_completion",
        AsyncMock(return_value=ocr_json),
    ):
        res = client.post(
            "/api/ai/ocr",
            json={"imageDataUrl": f"data:image/png;base64,{png_b64}", "pageTitle": "Scratch"},
        )
        assert res.status_code == 200
        assert res.json()["titleSuggestion"] == "Greeting"
        assert res.json()["tasks"] == [{"text": "Do it", "done": False}]

    brief_json = '{"brief":"A calm study of ink and paper across centuries.","themes":["Typography","Craft"]}'
    with patch(
        "server.services.ai.book_brief.run_model_completion",
        AsyncMock(return_value=brief_json),
    ):
        res = client.post(
            "/api/ai/book-brief",
            json={"title": "On Paper", "excerpt": "Paper carries thought across generations."},
        )
        assert res.status_code == 200
        assert res.json()["themes"] == ["Typography", "Craft"]


def test_news_feed_and_summarize_mocked(client: TestClient) -> None:
    sample_article = NormalizedArticle(
        id="nd-123456789012",
        provider="newsdata",
        topic="Tech",
        source="Wire Daily",
        original_url="https://example.com/story",
        headline="Open Tools Reshape Publishing",
        description="Independent editors adopt calm digital workflows.",
        image_url=None,
        published_at="1h ago",
        published_iso="2026-11-16T17:00:00Z",
    )
    nd_res = ProviderFetchResult(provider="newsdata", status="ok", articles=[sample_article])
    ms_res = ProviderFetchResult(provider="mediastack", status="unconfigured", articles=[])

    with (
        patch("server.services.news.feed_service.fetch_newsdata_articles", AsyncMock(return_value=nd_res)),
        patch("server.services.news.feed_service.fetch_mediastack_articles", AsyncMock(return_value=ms_res)),
        patch("server.services.news.feed_service.server_config") as mock_cfg,
    ):
        mock_cfg.mediastack_api_key = ""
        mock_cfg.newsdata_api_key = "test-key"
        mock_cfg.gemini_model = "gemini-4-hydrogen"
        res = client.get("/api/news/feed?country=us&voice=brief&refresh=1")
        assert res.status_code == 200
        payload = res.json()
        assert payload["country"] == "us"
        assert payload["voice"] == "brief"
        assert len(payload["stories"]) == 1
        assert payload["stories"][0]["headline"] == "Open Tools Reshape Publishing"

    assert client.post("/api/news/summarize", json={}).status_code == 400

    with (
        patch("server.services.news.summarizer.fetch_full_article_text", AsyncMock(return_value=None)),
        patch(
            "server.services.news.summarizer.run_model_completion",
            AsyncMock(
                return_value='{"summary":"Editors shift tools.","pullQuote":"Calm workflows matter.","bodyParagraphs":["Paragraph one with enough content.","Paragraph two with enough content.","Paragraph three with enough content."]}'
            ),
        ),
    ):
        sum_res = client.post(
            "/api/news/summarize",
            json={
                "id": "nd-123456789012",
                "headline": "Open Tools Reshape Publishing",
                "snippet": "Independent editors adopt calm digital workflows.",
                "voice": "explainer",
            },
        )
        assert sum_res.status_code == 200
        assert sum_res.json()["voice"] == "explainer"
        assert sum_res.json()["aiGenerated"] is True


def test_ssrf_private_host_checks() -> None:
    assert is_private_or_local_hostname("localhost") is True
    assert is_private_or_local_hostname("127.0.0.1") is True
    assert is_private_or_local_hostname("192.168.1.10") is True
    assert is_private_or_local_hostname("169.254.169.254") is True
    assert is_private_or_local_hostname("::1") is True
    assert is_private_or_local_hostname("service.internal") is True
    assert is_private_or_local_hostname("example.com") is False


def test_rate_limiter_returns_429() -> None:
    from fastapi import Depends

    test_app = create_app()
    limiter = create_rate_limiter(window_ms=60_000, max_requests=2, message="Slow down.")

    @test_app.get("/limited", dependencies=[Depends(limiter)])
    async def limited_route():
        return {"ok": True}

    test_client = TestClient(test_app)
    assert test_client.get("/limited").status_code == 200
    assert test_client.get("/limited").status_code == 200
    blocked = test_client.get("/limited")
    assert blocked.status_code == 429
    assert blocked.json() == {"error": "Slow down."}
    assert int(blocked.headers["retry-after"]) >= 1
