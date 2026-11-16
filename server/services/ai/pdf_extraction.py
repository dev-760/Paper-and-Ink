"""AI PDF page cleaning and OCR extraction service for Reader."""

from __future__ import annotations

import math
import re
from typing import Any

from server.services.ai.client import extract_json_object, run_model_completion

IMAGE_DATA_URL_REGEX = re.compile(r"^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$")
MAX_BATCH_PAGES = 6


async def extract_pdf_pages_with_ai(
    *,
    title_hint: str | None = None,
    pages: list[dict[str, Any]],
) -> dict[str, Any]:
    if not isinstance(pages, list) or len(pages) == 0:
        raise ValueError("Provide at least one PDF page for extraction.")
    if len(pages) > MAX_BATCH_PAGES:
        raise ValueError(f"Process at most {MAX_BATCH_PAGES} PDF pages per request.")

    intro_lines = [
        f"Document filename/title hint: {title_hint[:140]}" if title_hint else "",
        "Extract clean, readable book prose from each PDF page below.",
        "Always preserve the exact original script and language of the book (e.g. Arabic, Japanese, English) without translating.",
        "Remove running headers, page numbers, and hyphenated line-break artifacts where obvious, joining broken lines into natural paragraphs separated by blank lines (\\n\\n).",
        "Preserve exact book meaning, dialogue punctuation, and wording without summarizing or omitting text.",
        'Identify any chapter, part, prologue, or epilogue heading starting on a page in the original language (e.g. "PROLOGUE", "THE FIRST NOTEBOOK", "الفصل الأول", or null if none).',
        "Return strict JSON with keys:",
        '{"detectedTitle": string | null, "detectedAuthor": string | null, "pages": [{"pageNumber": number, "chapterHeading": string | null, "text": string}]}.',
    ]

    content_parts: list[dict[str, Any]] = [
        {"type": "text", "text": "\n".join(line for line in intro_lines if line)}
    ]

    for page in pages:
        page_number = page.get("pageNumber")
        if (
            isinstance(page_number, bool)
            or not isinstance(page_number, (int, float))
            or not math.isfinite(page_number)
            or page_number < 1
        ):
            raise ValueError("Each page must have a valid positive pageNumber.")

        page_num_int = int(page_number) if float(page_number).is_integer() else page_number
        label_parts = [f"--- Page {page_num_int} ---"]
        raw_text = page.get("rawText")
        if isinstance(raw_text, str) and raw_text.strip():
            label_parts.append(f"Embedded PDF text:\n{raw_text[:10000]}")

        content_parts.append({"type": "text", "text": "\n".join(label_parts)})

        image_data_url = page.get("imageDataUrl")
        if image_data_url:
            if (
                not isinstance(image_data_url, str)
                or not IMAGE_DATA_URL_REGEX.match(image_data_url)
                or len(image_data_url) > 6_000_000
            ):
                raise ValueError(f"Invalid or oversized image on page {page_num_int}.")
            content_parts.append({"type": "image_url", "imageUrl": {"url": image_data_url}})

    raw_response = await run_model_completion(
        json_mode=True,
        temperature=0.1,
        max_tokens=6000,
        messages=[
            {
                "role": "system",
                "content": " ".join(
                    [
                        "You are an archival book-digitization and scholarly typesetting specialist for Paper & Ink Reader.",
                        "Accurately transcribe and reconstruct clean, book-grade reflowable prose from scanned page images or messy embedded PDF text.",
                        "FIDELITY & SCRIPT RULE: Preserve the exact original language, script, spelling, punctuation, dialogue marks, and Arabic diacritics/tashkeel where present — never translate, summarize, modernize, or invent missing lines.",
                        "LAYOUT CLEANUP: Read multi-column pages in true reading order, strip running page headers/footers and isolated page numbers, rejoin end-of-line hyphenated words where clearly split, and separate natural paragraphs with double newlines (\\n\\n).",
                        'BOOK STRUCTURE: Populate "detectedTitle" and "detectedAuthor" ONLY when visibly printed on a cover, title page, or running book plate (otherwise null). Identify any chapter, prologue, epilogue, notebook, or part heading starting on a page in its original script inside "chapterHeading" (otherwise null).',
                        "Output strictly valid JSON matching the requested schema. Never include chain-of-thought or commentary.",
                    ]
                ),
            },
            {
                "role": "user",
                "content": content_parts,
            },
        ],
    )

    parsed = extract_json_object(raw_response)
    parsed_pages = parsed.get("pages") if parsed else None
    if parsed and isinstance(parsed_pages, list) and len(parsed_pages) > 0:
        normalized_pages: list[dict[str, Any]] = []
        for idx, p in enumerate(parsed_pages):
            if not isinstance(p, dict):
                p = {}
            p_num = p.get("pageNumber")
            fallback_num = pages[idx].get("pageNumber", idx + 1) if idx < len(pages) else idx + 1
            chapter_raw = p.get("chapterHeading")
            text_raw = p.get("text")
            normalized_pages.append(
                {
                    "pageNumber": (
                        p_num
                        if isinstance(p_num, (int, float)) and not isinstance(p_num, bool)
                        else fallback_num
                    ),
                    "chapterHeading": (
                        chapter_raw.strip()
                        if isinstance(chapter_raw, str) and chapter_raw.strip()
                        else None
                    ),
                    "text": text_raw.strip() if isinstance(text_raw, str) else "",
                }
            )

        result: dict[str, Any] = {"pages": normalized_pages}
        detected_title = parsed.get("detectedTitle")
        if isinstance(detected_title, str) and detected_title.strip():
            result["detectedTitle"] = detected_title.strip()
        detected_author = parsed.get("detectedAuthor")
        if isinstance(detected_author, str) and detected_author.strip():
            result["detectedAuthor"] = detected_author.strip()
        return result

    if len(pages) == 1:
        return {
            "pages": [
                {
                    "pageNumber": pages[0]["pageNumber"],
                    "chapterHeading": None,
                    "text": raw_response.strip(),
                }
            ]
        }

    raise RuntimeError("Could not parse structured PDF extraction output.")
