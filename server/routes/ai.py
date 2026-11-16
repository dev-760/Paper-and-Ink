"""AI OCR, PDF extraction, and book brief routes."""

from __future__ import annotations

import math
import re
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from server.middleware.rate_limit import (
    create_rate_limiter,
    get_client_ip,
    read_json_body_safe,
)
from server.middleware.require_auth import AuthenticatedUser
from server.services.ai.book_brief import generate_book_brief
from server.services.ai.ocr import transcribe_handwritten_note
from server.services.ai.pdf_extraction import extract_pdf_pages_with_ai

router = APIRouter(prefix="/api/ai", tags=["ai"])

_OCR_VALIDATION_RE = re.compile(r"must be|too large|valid|required", re.IGNORECASE)
_PDF_VALIDATION_RE = re.compile(r"must have|at most|at least|invalid|oversized", re.IGNORECASE)
_BRIEF_VALIDATION_RE = re.compile(r"required", re.IGNORECASE)


def _ai_key(request: Request, _body: dict[str, Any]) -> str:
    auth_user: AuthenticatedUser | None = getattr(request.state, "auth_user", None)
    identifier = auth_user.id if auth_user else get_client_ip(request)
    return f"ai:{identifier}"


ai_limiter = create_rate_limiter(
    window_ms=5 * 60 * 1000,
    max_requests=30,
    key_builder=_ai_key,
    message="AI processing limit reached briefly. Please wait a moment and try again.",
)


@router.post("/ocr", dependencies=[Depends(ai_limiter)])
async def ocr_endpoint(request: Request) -> JSONResponse:
    """Transcribe handwritten notes or canvas snapshots using the Gemini API."""
    try:
        body = await read_json_body_safe(request)
        image_data_url = (
            body["imageDataUrl"] if isinstance(body.get("imageDataUrl"), str) else ""
        )
        page_title = body["pageTitle"] if isinstance(body.get("pageTitle"), str) else None
        typed_context = (
            body["typedContext"] if isinstance(body.get("typedContext"), str) else None
        )

        if not image_data_url:
            return JSONResponse(
                status_code=400,
                content={"error": "An image is required for handwriting OCR."},
            )

        result = await transcribe_handwritten_note(
            image_data_url=image_data_url,
            page_title=page_title,
            typed_context=typed_context,
        )
        return JSONResponse(status_code=200, content=result)
    except Exception as exc:
        message = str(exc) or "Handwriting transcription failed."
        is_validation = bool(_OCR_VALIDATION_RE.search(message))
        return JSONResponse(status_code=400 if is_validation else 502, content={"error": message})


@router.post("/pdf-extract", dependencies=[Depends(ai_limiter)])
async def pdf_extract_endpoint(request: Request) -> JSONResponse:
    """Clean embedded PDF text or OCR rendered scanned PDF pages into book chapters/pages."""
    try:
        body = await read_json_body_safe(request)
        title_hint = body["titleHint"] if isinstance(body.get("titleHint"), str) else None
        raw_pages = body.get("pages")
        pages = raw_pages if isinstance(raw_pages, list) else []

        if len(pages) == 0:
            return JSONResponse(
                status_code=400,
                content={"error": "At least one PDF page is required."},
            )

        result = await extract_pdf_pages_with_ai(title_hint=title_hint, pages=pages)
        return JSONResponse(status_code=200, content=result)
    except Exception as exc:
        message = str(exc) or "PDF text extraction failed."
        is_validation = bool(_PDF_VALIDATION_RE.search(message))
        return JSONResponse(status_code=400 if is_validation else 502, content={"error": message})


@router.post("/book-brief", dependencies=[Depends(ai_limiter)])
async def book_brief_endpoint(request: Request) -> JSONResponse:
    """Generate an editorial AI brief and theme tags for an imported Reader book."""
    try:
        body = await read_json_body_safe(request)
        title = body["title"].strip() if isinstance(body.get("title"), str) else ""
        author = body["author"].strip() if isinstance(body.get("author"), str) else None
        raw_total = body.get("totalPages")
        total_pages = (
            raw_total
            if not isinstance(raw_total, bool)
            and isinstance(raw_total, (int, float))
            and math.isfinite(raw_total)
            else None
        )
        raw_chapters = body.get("chapterTitles")
        chapter_titles = (
            [c for c in raw_chapters if isinstance(c, str)]
            if isinstance(raw_chapters, list)
            else None
        )
        excerpt = body["excerpt"].strip() if isinstance(body.get("excerpt"), str) else ""

        if not title or not excerpt:
            return JSONResponse(
                status_code=400,
                content={"error": "Book title and text excerpt are required."},
            )

        result = await generate_book_brief(
            title=title,
            author=author,
            total_pages=total_pages,
            chapter_titles=chapter_titles,
            excerpt=excerpt,
        )
        return JSONResponse(status_code=200, content=result)
    except Exception as exc:
        message = str(exc) or "Could not generate AI book brief."
        is_validation = bool(_BRIEF_VALIDATION_RE.search(message))
        return JSONResponse(status_code=400 if is_validation else 502, content={"error": message})
