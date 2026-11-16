"""Username authentication and profile routes backed by Supabase."""

from __future__ import annotations

import asyncio
import base64
import binascii
import re
import time
import uuid
from dataclasses import dataclass
from typing import Any, Literal

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from server.middleware.rate_limit import create_rate_limiter, read_json_body_safe
from server.middleware.require_auth import AuthenticatedUser, require_auth
from server.services.supabase.admin import (
    create_stateless_public_client,
    get_supabase_admin,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

_USERNAME_RE = re.compile(r"^[a-z0-9_]{3,24}$")
_AVATAR_DATA_URL_RE = re.compile(r"^data:(image/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$")
_MAX_AVATAR_BYTES = 2 * 1024 * 1024
_ALLOWED_AVATAR_MIME = {"image/png", "image/jpeg", "image/webp"}
_PROFILE_COLUMNS = "id, username, display_name, avatar_path, created_at, updated_at"


def _login_key(request: Request, body: dict[str, Any]) -> str:
    raw = body.get("username")
    cleaned = raw.strip().lower() if isinstance(raw, str) else ""
    return f"login:{cleaned[:24]}"


def _profile_key(request: Request, _body: dict[str, Any]) -> str:
    auth_user: AuthenticatedUser | None = getattr(request.state, "auth_user", None)
    user_id = auth_user.id if auth_user else "anon"
    return f"profile:{user_id}"


login_limiter = create_rate_limiter(
    window_ms=10 * 60 * 1000,
    max_requests=15,
    key_builder=_login_key,
    message="Too many sign-in attempts. Please wait a few minutes and try again.",
)

register_limiter = create_rate_limiter(
    window_ms=15 * 60 * 1000,
    max_requests=10,
    key_builder=lambda _req, _body: "register",
    message="Too many registration attempts. Please try again shortly.",
)

profile_limiter = create_rate_limiter(
    window_ms=5 * 60 * 1000,
    max_requests=30,
    key_builder=_profile_key,
)


@dataclass
class ParsedAvatar:
    data: bytes
    mime_type: Literal["image/png", "image/jpeg", "image/webp"]
    ext: Literal["png", "jpg", "webp"]


def _detect_image_mime_from_bytes(buf: bytes) -> Literal["image/png", "image/jpeg", "image/webp"] | None:
    if len(buf) >= 8 and buf[:4] == b"\x89PNG":
        return "image/png"
    if len(buf) >= 3 and buf[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if len(buf) >= 12 and buf[:4] == b"RIFF" and buf[8:12] == b"WEBP":
        return "image/webp"
    return None


def _parse_avatar_data_url(raw_data_url: Any) -> ParsedAvatar | None:
    if not isinstance(raw_data_url, str) or not raw_data_url.strip():
        return None

    match = _AVATAR_DATA_URL_RE.match(raw_data_url.strip())
    if not match:
        raise ValueError("Profile photo must be a PNG, JPEG, or WebP image.")

    declared_mime = match.group(1)
    if declared_mime not in _ALLOWED_AVATAR_MIME:
        raise ValueError("Profile photo must be a PNG, JPEG, or WebP image.")

    try:
        raw_bytes = base64.b64decode(match.group(2), validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Invalid image file contents.") from exc

    if len(raw_bytes) == 0 or len(raw_bytes) > _MAX_AVATAR_BYTES:
        raise ValueError("Profile photo must be 2 MB or smaller.")

    detected = _detect_image_mime_from_bytes(raw_bytes)
    if not detected or detected != declared_mime:
        raise ValueError("Invalid image file contents.")

    ext: Literal["png", "jpg", "webp"] = (
        "png" if detected == "image/png" else ("jpg" if detected == "image/jpeg" else "webp")
    )
    return ParsedAvatar(data=raw_bytes, mime_type=detected, ext=ext)


def _normalize_username(raw: Any) -> str:
    return raw.strip().lower() if isinstance(raw, str) else ""


def _normalize_display_name(raw: Any) -> str:
    if not isinstance(raw, str):
        return ""
    return re.sub(r"\s+", " ", raw.strip())


async def _minimum_failure_delay(started_at: float, target_seconds: float = 0.180) -> None:
    elapsed = time.monotonic() - started_at
    if elapsed < target_seconds:
        await asyncio.sleep(target_seconds - elapsed)


async def _build_client_profile(row: dict[str, Any]) -> dict[str, Any]:
    avatar_url: str | None = None
    avatar_path = row.get("avatar_path")
    if isinstance(avatar_path, str) and avatar_path:
        try:
            admin = await get_supabase_admin()
            signed = await admin.storage.from_("avatars").create_signed_url(avatar_path, 3600)
            if isinstance(signed, dict):
                avatar_url = signed.get("signedURL") or signed.get("signedUrl") or None
        except Exception:
            avatar_url = None

    return {
        "id": row["id"],
        "username": row["username"],
        "displayName": row["display_name"],
        "avatarUrl": avatar_url,
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _serialize_session(session: Any) -> dict[str, Any]:
    return {
        "access_token": session.access_token,
        "refresh_token": session.refresh_token,
        "expires_in": session.expires_in,
        "expires_at": session.expires_at,
        "token_type": session.token_type,
    }


@router.post("/register", dependencies=[Depends(register_limiter)])
async def register(request: Request) -> JSONResponse:
    """Register an account using username, displayName (or name), password, and optional avatarDataUrl."""
    try:
        body = await read_json_body_safe(request)
        username = _normalize_username(body.get("username"))
        raw_name = body.get("name") if body.get("name") is not None else body.get("displayName")
        display_name = _normalize_display_name(raw_name)
        password = body.get("password") if isinstance(body.get("password"), str) else ""

        if not _USERNAME_RE.match(username):
            return JSONResponse(
                status_code=400,
                content={
                    "error": "Username must be 3 to 24 characters using lowercase letters, numbers, or underscores."
                },
            )

        if len(display_name) < 1 or len(display_name) > 60:
            return JSONResponse(
                status_code=400,
                content={"error": "Name must be between 1 and 60 characters."},
            )

        if len(password) < 8 or len(password) > 128:
            return JSONResponse(
                status_code=400,
                content={"error": "Password must be between 8 and 128 characters."},
            )

        try:
            parsed_avatar = _parse_avatar_data_url(body.get("avatarDataUrl"))
        except ValueError as avatar_err:
            return JSONResponse(status_code=400, content={"error": str(avatar_err)})

        admin = await get_supabase_admin()
        try:
            lookup_res = await admin.rpc(
                "resolve_username_identity", {"p_username": username}
            ).execute()
        except Exception:
            return JSONResponse(
                status_code=500,
                content={"error": "Could not verify username availability."},
            )

        if isinstance(lookup_res.data, list) and len(lookup_res.data) > 0:
            return JSONResponse(
                status_code=409,
                content={"error": "That username is already taken."},
            )

        internal_email = f"u_{uuid.uuid4().hex}@users.paperandink.local"
        try:
            created_user = await admin.auth.admin.create_user(
                {
                    "email": internal_email,
                    "password": password,
                    "email_confirm": True,
                    "user_metadata": {
                        "username": username,
                        "display_name": display_name,
                    },
                }
            )
        except Exception:
            created_user = None

        if not created_user or not created_user.user:
            return JSONResponse(
                status_code=500,
                content={"error": "Could not create account. Please try again."},
            )

        user_id = created_user.user.id
        try:
            await admin.rpc(
                "register_username_identity",
                {
                    "p_user_id": user_id,
                    "p_username": username,
                    "p_internal_email": internal_email,
                    "p_display_name": display_name,
                },
            ).execute()
        except Exception as map_err:
            try:
                await admin.auth.admin.delete_user(user_id)
            except Exception:
                pass
            err_str = str(map_err)
            is_duplicate = "23505" in err_str or "duplicate" in err_str.lower()
            return JSONResponse(
                status_code=409 if is_duplicate else 500,
                content={
                    "error": (
                        "That username is already taken."
                        if is_duplicate
                        else "Could not complete registration."
                    )
                },
            )

        if parsed_avatar:
            storage_path = f"{user_id}/avatar.{parsed_avatar.ext}"
            try:
                await admin.storage.from_("avatars").upload(
                    storage_path,
                    parsed_avatar.data,
                    file_options={
                        "content-type": parsed_avatar.mime_type,
                        "upsert": "true",
                    },
                )
                await admin.from_("profiles").update({"avatar_path": storage_path}).eq(
                    "id", user_id
                ).execute()
            except Exception:
                pass

        try:
            async with create_stateless_public_client() as public_client:
                sign_in_data = await public_client.auth.sign_in_with_password(
                    {"email": internal_email, "password": password}
                )
        except Exception:
            sign_in_data = None

        if not sign_in_data or not sign_in_data.session:
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Account created, but automatic sign-in failed. Please sign in."
                },
            )

        try:
            profile_res = (
                await admin.from_("profiles")
                .select(_PROFILE_COLUMNS)
                .eq("id", user_id)
                .single()
                .execute()
            )
            profile_row = profile_res.data
        except Exception:
            profile_row = None

        if not isinstance(profile_row, dict):
            return JSONResponse(
                status_code=500,
                content={"error": "Could not load created profile."},
            )

        return JSONResponse(
            status_code=201,
            content={
                "session": _serialize_session(sign_in_data.session),
                "profile": await _build_client_profile(profile_row),
            },
        )
    except Exception:
        return JSONResponse(
            status_code=500,
            content={"error": "Unexpected registration error."},
        )


@router.post("/login", dependencies=[Depends(login_limiter)])
async def login(request: Request) -> JSONResponse:
    """Resolve username server-side and return generic 401 on bad credentials."""
    started_at = time.monotonic()
    try:
        body = await read_json_body_safe(request)
        username = _normalize_username(body.get("username"))
        password = body.get("password") if isinstance(body.get("password"), str) else ""

        if not _USERNAME_RE.match(username) or not password or len(password) > 128:
            await _minimum_failure_delay(started_at)
            return JSONResponse(
                status_code=401,
                content={"error": "Invalid username or password."},
            )

        admin = await get_supabase_admin()
        try:
            resolve_res = await admin.rpc(
                "resolve_username_identity", {"p_username": username}
            ).execute()
            identity_rows = resolve_res.data
        except Exception:
            identity_rows = None

        if not isinstance(identity_rows, list) or len(identity_rows) == 0:
            await _minimum_failure_delay(started_at)
            return JSONResponse(
                status_code=401,
                content={"error": "Invalid username or password."},
            )

        identity = identity_rows[0]
        try:
            async with create_stateless_public_client() as public_client:
                sign_in_data = await public_client.auth.sign_in_with_password(
                    {"email": identity["internal_email"], "password": password}
                )
        except Exception:
            sign_in_data = None

        if not sign_in_data or not sign_in_data.session:
            await _minimum_failure_delay(started_at)
            return JSONResponse(
                status_code=401,
                content={"error": "Invalid username or password."},
            )

        try:
            profile_res = (
                await admin.from_("profiles")
                .select(_PROFILE_COLUMNS)
                .eq("id", identity["user_id"])
                .single()
                .execute()
            )
            profile_row = profile_res.data
        except Exception:
            profile_row = None

        if not isinstance(profile_row, dict):
            return JSONResponse(
                status_code=500,
                content={"error": "Could not load profile."},
            )

        return JSONResponse(
            status_code=200,
            content={
                "session": _serialize_session(sign_in_data.session),
                "profile": await _build_client_profile(profile_row),
            },
        )
    except Exception:
        await _minimum_failure_delay(started_at)
        return JSONResponse(
            status_code=401,
            content={"error": "Invalid username or password."},
        )


@router.get("/me")
async def get_me(
    auth_user: AuthenticatedUser = Depends(require_auth),
    _rate_limit: None = Depends(profile_limiter),
) -> JSONResponse:
    """Return verified profile metadata and a short-lived signed avatar URL."""
    try:
        admin = await get_supabase_admin()
        try:
            profile_res = (
                await admin.from_("profiles")
                .select(_PROFILE_COLUMNS)
                .eq("id", auth_user.id)
                .single()
                .execute()
            )
            profile_row = profile_res.data
        except Exception:
            profile_row = None

        if not isinstance(profile_row, dict):
            return JSONResponse(status_code=404, content={"error": "Profile not found."})

        return JSONResponse(
            status_code=200,
            content={"profile": await _build_client_profile(profile_row)},
        )
    except Exception:
        return JSONResponse(status_code=500, content={"error": "Could not load profile."})


@router.patch("/profile")
async def update_profile(
    request: Request,
    auth_user: AuthenticatedUser = Depends(require_auth),
    _rate_limit: None = Depends(profile_limiter),
) -> JSONResponse:
    """Update display name and/or profile avatar for the authenticated user."""
    try:
        body = await read_json_body_safe(request)
        user_id = auth_user.id
        admin = await get_supabase_admin()
        updates: dict[str, Any] = {}

        if "name" in body or "displayName" in body:
            raw_name = body.get("name") if body.get("name") is not None else body.get("displayName")
            display_name = _normalize_display_name(raw_name)
            if len(display_name) < 1 or len(display_name) > 60:
                return JSONResponse(
                    status_code=400,
                    content={"error": "Name must be between 1 and 60 characters."},
                )
            updates["display_name"] = display_name
            await admin.auth.admin.update_user_by_id(
                user_id,
                {
                    "user_metadata": {
                        "username": auth_user.username,
                        "display_name": display_name,
                    }
                },
            )

        if body.get("removeAvatar") is True:
            try:
                existing_res = (
                    await admin.from_("profiles")
                    .select("avatar_path")
                    .eq("id", user_id)
                    .single()
                    .execute()
                )
                existing_path = (
                    existing_res.data.get("avatar_path")
                    if isinstance(existing_res.data, dict)
                    else None
                )
                if isinstance(existing_path, str) and existing_path:
                    await admin.storage.from_("avatars").remove([existing_path])
            except Exception:
                pass
            updates["avatar_path"] = None
        elif body.get("avatarDataUrl"):
            try:
                parsed_avatar = _parse_avatar_data_url(body.get("avatarDataUrl"))
            except ValueError as avatar_err:
                return JSONResponse(status_code=400, content={"error": str(avatar_err)})
            if parsed_avatar:
                storage_path = f"{user_id}/avatar.{parsed_avatar.ext}"
                try:
                    await admin.storage.from_("avatars").upload(
                        storage_path,
                        parsed_avatar.data,
                        file_options={
                            "content-type": parsed_avatar.mime_type,
                            "upsert": "true",
                        },
                    )
                except Exception:
                    return JSONResponse(
                        status_code=500,
                        content={"error": "Could not store profile photo."},
                    )
                updates["avatar_path"] = storage_path

        if updates:
            try:
                await admin.from_("profiles").update(updates).eq("id", user_id).execute()
            except Exception:
                return JSONResponse(
                    status_code=500,
                    content={"error": "Could not update profile."},
                )

        try:
            refreshed_res = (
                await admin.from_("profiles")
                .select(_PROFILE_COLUMNS)
                .eq("id", user_id)
                .single()
                .execute()
            )
            refreshed = refreshed_res.data
        except Exception:
            refreshed = None

        if not isinstance(refreshed, dict):
            return JSONResponse(
                status_code=500,
                content={"error": "Could not reload profile."},
            )

        return JSONResponse(
            status_code=200,
            content={"profile": await _build_client_profile(refreshed)},
        )
    except Exception:
        return JSONResponse(
            status_code=500,
            content={"error": "Unexpected profile update error."},
        )
