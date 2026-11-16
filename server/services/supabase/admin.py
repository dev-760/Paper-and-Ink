"""Trusted Supabase admin and stateless public clients."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from supabase import AsyncClient, AsyncClientOptions, acreate_client

from server.config import assert_supabase_configured, server_config

_admin_client: AsyncClient | None = None


async def get_supabase_admin() -> AsyncClient:
    """Return the singleton server-only Supabase admin client authenticated with SUPABASE_SECRET_KEY."""
    global _admin_client
    assert_supabase_configured()
    if _admin_client is None:
        _admin_client = await acreate_client(
            server_config.supabase_url,
            server_config.supabase_secret_key,
            options=AsyncClientOptions(
                auto_refresh_token=False,
                persist_session=False,
            ),
        )
    return _admin_client


@asynccontextmanager
async def create_stateless_public_client() -> AsyncIterator[AsyncClient]:
    """Yield an ephemeral stateless client using the publishable key for password sign-in."""
    assert_supabase_configured()
    client = await acreate_client(
        server_config.supabase_url,
        server_config.supabase_publishable_key,
        options=AsyncClientOptions(
            auto_refresh_token=False,
            persist_session=False,
        ),
    )
    try:
        yield client
    finally:
        await client.auth.close()
