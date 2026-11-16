"""Handwriting OCR transcription service for Notes."""

from __future__ import annotations

import re
from typing import Any

from server.services.ai.client import extract_json_object, run_model_completion

IMAGE_DATA_URL_REGEX = re.compile(r"^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$")
MAX_IMAGE_DATA_URL_CHARS = 8_000_000


async def transcribe_handwritten_note(
    *,
    image_data_url: str,
    page_title: str | None = None,
    typed_context: str | None = None,
) -> dict[str, Any]:
    if not IMAGE_DATA_URL_REGEX.match(image_data_url):
        raise ValueError("Handwriting image must be a valid PNG, JPEG, or WebP data URL.")
    if len(image_data_url) > MAX_IMAGE_DATA_URL_CHARS:
        raise ValueError("Handwriting image is too large (maximum ~6 MB).")

    context_parts = [
        f"Page title: {page_title[:120]}" if page_title else "",
        f"Typed context on the page:\n{typed_context[:1500]}" if typed_context else "",
    ]
    context_hint = "\n\n".join(part for part in context_parts if part)

    raw_response = await run_model_completion(
        json_mode=True,
        temperature=0.15,
        max_tokens=3200,
        messages=[
            {
                "role": "system",
                "content": " ".join(
                    [
                        "You are an expert handwriting transcriptionist and personal notebook archivist for Paper & Ink Notes.",
                        "Decipher handwritten notebook photos (including skewed lighting, cursive, margin arrows, and ruled lines) as well as digital stylus ink strokes with high precision.",
                        'FAITHFUL TRANSCRIPTION: Preserve the author’s exact language, script (e.g., English, Arabic RTL, technical notation, formulas), tone, and intent — never translate or invent words that are not written. If a short word is genuinely illegible, write "[illegible]" rather than guessing nonsense.',
                        'CLEAN STRUCTURE: Format "cleanedText" in clean Markdown preserving logical hierarchy — ## section headings, concise - bullets, numbered steps where sequence matters, and - [ ] / - [x] checkboxes for handwritten boxes, stars, or crossed-off tasks.',
                        "EXTRACT SMART METADATA:",
                        '- "titleSuggestion": A crisp, specific 3–7 word note title in the note’s original language (avoid vague titles like "Notes" or "Untitled").',
                        '- "summary": A clear 1–2 sentence takeaway capturing the core purpose or conclusion of the note.',
                        '- "keyPoints": Concise, distinct bullet takeaways (up to 8) worth remembering at a glance.',
                        '- "tasks": Every explicit action item, follow-up, or to-do line (setting "done": true only when visibly checked/crossed out).',
                        'Respond strictly as valid JSON with keys {"rawTranscript": string, "cleanedText": string, "titleSuggestion": string, "summary": string, "keyPoints": string[], "tasks": [{"text": string, "done": boolean}]}. Never output reasoning or Markdown fences outside the JSON object.',
                    ]
                ),
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            f"Transcribe and lightly structure the handwritten notes in this image.\n\n{context_hint}"
                            if context_hint
                            else "Transcribe and lightly structure all handwritten notes visible in this image."
                        ),
                    },
                    {
                        "type": "image_url",
                        "imageUrl": {"url": image_data_url},
                    },
                ],
            },
        ],
    )

    parsed = extract_json_object(raw_response)
    if parsed and (
        isinstance(parsed.get("cleanedText"), str) or isinstance(parsed.get("rawTranscript"), str)
    ):
        raw_transcript = (
            (parsed.get("rawTranscript") or parsed.get("cleanedText") or "")
        ).strip()
        cleaned_text = (
            (parsed.get("cleanedText") or parsed.get("rawTranscript") or "")
        ).strip()

        title_suggestion_raw = parsed.get("titleSuggestion")
        title_suggestion = (
            title_suggestion_raw.strip()[:120]
            if isinstance(title_suggestion_raw, str) and title_suggestion_raw.strip()
            else (page_title or "Handwritten Note")
        )

        summary_raw = parsed.get("summary")
        summary = summary_raw.strip() if isinstance(summary_raw, str) else ""

        key_points_raw = parsed.get("keyPoints")
        key_points = (
            [k for k in key_points_raw if isinstance(k, str) and k.strip()][:12]
            if isinstance(key_points_raw, list)
            else []
        )

        tasks_raw = parsed.get("tasks")
        tasks = (
            [
                {"text": t["text"].strip(), "done": bool(t.get("done"))}
                for t in tasks_raw
                if isinstance(t, dict) and isinstance(t.get("text"), str) and t["text"].strip()
            ][:20]
            if isinstance(tasks_raw, list)
            else []
        )

        return {
            "rawTranscript": raw_transcript,
            "cleanedText": cleaned_text,
            "titleSuggestion": title_suggestion,
            "summary": summary,
            "keyPoints": key_points,
            "tasks": tasks,
        }

    fallback_text = raw_response.strip()
    return {
        "rawTranscript": fallback_text,
        "cleanedText": fallback_text,
        "titleSuggestion": page_title or "Handwritten Note",
        "summary": "",
        "keyPoints": [],
        "tasks": [],
    }
