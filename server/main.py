"""Paper & Ink FastAPI application entrypoint."""

from __future__ import annotations

from collections.abc import Awaitable, Callable

import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from server.config import server_config
from server.middleware.rate_limit import RateLimitExceeded, rate_limit_exception_handler
from server.routes.ai import router as ai_router
from server.routes.auth import router as auth_router
from server.routes.news import router as news_router

MAX_REQUEST_BODY_BYTES = 16 * 1024 * 1024


class MaxBodySizeMiddleware:
    """ASGI middleware enforcing a 16 MB request body cap (matching Express json limit)."""

    def __init__(self, app: ASGIApp, max_bytes: int = MAX_REQUEST_BODY_BYTES) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers") or [])
        raw_content_length = headers.get(b"content-length")
        if raw_content_length is not None:
            try:
                if int(raw_content_length) > self.max_bytes:
                    response = JSONResponse(
                        status_code=413,
                        content={"error": "Payload exceeds maximum allowed size."},
                    )
                    await response(scope, receive, send)
                    return
            except ValueError:
                pass

        method = scope.get("method", "GET")
        if method not in ("POST", "PUT", "PATCH"):
            await self.app(scope, receive, send)
            return

        chunks: list[bytes] = []
        total = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            if message["type"] == "http.request":
                chunk = message.get("body", b"")
                total += len(chunk)
                if total > self.max_bytes:
                    response = JSONResponse(
                        status_code=413,
                        content={"error": "Payload exceeds maximum allowed size."},
                    )
                    await response(scope, receive, send)
                    return
                if chunk:
                    chunks.append(chunk)
                if not message.get("more_body", False):
                    break

        full_body = b"".join(chunks)
        sent = False

        async def replay_receive() -> Message:
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": full_body, "more_body": False}
            return {"type": "http.disconnect"}

        await self.app(scope, replay_receive, send)


def create_app() -> FastAPI:
    application = FastAPI(
        title="Paper & Ink API",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    @application.middleware("http")
    async def security_headers_middleware(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        return response

    application.add_middleware(MaxBodySizeMiddleware, max_bytes=MAX_REQUEST_BODY_BYTES)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=server_config.allowed_origins,
        allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.add_exception_handler(RateLimitExceeded, rate_limit_exception_handler)

    @application.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        _request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": str(exc.detail)},
            headers=exc.headers,
        )

    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        errors = exc.errors()
        detail = errors[0].get("msg", "Invalid request.") if errors else "Invalid request."
        return JSONResponse(status_code=400, content={"error": detail})

    @application.exception_handler(Exception)
    async def unhandled_exception_handler(_request: Request, _exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=500, content={"error": "Internal server error."})

    @application.get("/")
    async def root_health() -> dict[str, str]:
        return {"status": "ok", "service": "paper-and-ink-api"}

    @application.get("/api/health")
    async def api_health() -> dict[str, str]:
        return {"status": "ok", "service": "paper-and-ink-api"}

    application.include_router(auth_router)
    application.include_router(ai_router)
    application.include_router(news_router)

    return application


app = create_app()


if __name__ == "__main__":
    print(f"[Paper & Ink API] Listening on http://0.0.0.0:{server_config.port}")
    uvicorn.run(
        "server.main:app",
        host="0.0.0.0",
        port=server_config.port,
    )
