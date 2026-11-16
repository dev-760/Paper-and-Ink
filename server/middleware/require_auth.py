"""Bearer JWT authentication dependency backed by Supabase JWKS + get_user."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass

import jwt
from fastapi import HTTPException, Request

from server.config import server_config
from server.services.supabase.admin import get_supabase_admin


@dataclass(frozen=True)
class AuthenticatedUser:
    id: str
    username: str | None
    token: str


_jwks_client: jwt.PyJWKClient | None = None


def _get_jwks_client() -> jwt.PyJWKClient | None:
    global _jwks_client
    if _jwks_client is None and server_config.supabase_jwks_url:
        _jwks_client = jwt.PyJWKClient(server_config.supabase_jwks_url)
    return _jwks_client


def _verify_asymmetric_jwt(token: str, alg: str) -> None:
    jwks_client = _get_jwks_client()
    if jwks_client is None:
        return
    signing_key = jwks_client.get_signing_key_from_jwt(token)
    jwt.decode(
        token,
        signing_key.key,
        algorithms=[alg],
        issuer=f"{server_config.supabase_url}/auth/v1",
        audience="authenticated",
    )


async def require_auth(request: Request) -> AuthenticatedUser:
    """Verify Bearer Supabase token using JWKS (when asymmetric) and active Supabase user status."""
    header = request.headers.get("authorization")
    if not header or not header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required.")

    token = header[len("Bearer ") :].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required.")

    try:
        protected_header = jwt.get_unverified_header(token)
        alg = protected_header.get("alg")
        if isinstance(alg, str) and alg and alg != "HS256":
            await asyncio.to_thread(_verify_asymmetric_jwt, token, alg)

        admin = await get_supabase_admin()
        user_response = await admin.auth.get_user(token)
        user = user_response.user if user_response else None
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session.")

        meta = user.user_metadata if isinstance(user.user_metadata, dict) else {}
        username = meta.get("username") if isinstance(meta.get("username"), str) else None
        auth_user = AuthenticatedUser(id=user.id, username=username, token=token)
        request.state.auth_user = auth_user
        return auth_user
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired session.") from exc
