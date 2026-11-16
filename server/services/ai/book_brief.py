"""Editorial AI book brief and theme tag generator for Reader."""

from __future__ import annotations

import json
from typing import Any

from server.services.ai.client import extract_json_object, run_model_completion


async def generate_book_brief(
    *,
    title: str,
    author: str | None = None,
    total_pages: int | float | None = None,
    chapter_titles: list[str] | None = None,
    excerpt: str,
) -> dict[str, Any]:
    clean_title = title.strip()[:160]
    clean_author = (author or "").strip()[:120]
    clean_excerpt = excerpt.strip()[:7500]
    chapter_list = (
        [c for c in chapter_titles if isinstance(c, str) and c.strip()][:20]
        if isinstance(chapter_titles, list)
        else []
    )

    if not clean_title or not clean_excerpt:
        raise ValueError("Book title and text excerpt are required to generate a brief.")

    user_payload: dict[str, Any] = {"title": clean_title, "excerpt": clean_excerpt}
    if clean_author:
        user_payload["author"] = clean_author
    if total_pages:
        user_payload["totalPages"] = total_pages
    if chapter_list:
        user_payload["chapterTitles"] = chapter_list

    raw_response = await run_model_completion(
        json_mode=True,
        temperature=0.25,
        max_tokens=4096,
        messages=[
            {
                "role": "system",
                "content": " ".join(
                    [
                        "You are the Senior Literary Editor for Paper & Ink Reader — a calm, thoughtful independent reading salon.",
                        "Write a refined, deeply engaging editorial brief (2 to 4 crisp, evocative sentences) introducing the imported book strictly from its title, author, chapter titles, and excerpt.",
                        "Structure the brief so it naturally conveys: (1) the book’s central premise, setting, or core inquiry; (2) its narrative voice, style, or intellectual lens; and (3) what makes it compelling for the reader — without spoilers or invented plot claims.",
                        'Avoid hollow clichés ("In this compelling masterpiece", "must-read", "delves into") and write concrete, vivid prose.',
                        "LANGUAGE RULE: Always write the brief and theme tags in the primary script and language of the book’s title and excerpt (e.g., fluent literary Arabic for an Arabic book, natural editorial English for an English book).",
                        'Also provide 2 to 4 sharp, specific thematic tags (1 to 3 words each; Title Case in English) avoiding generic tags like "Book", "Reading", or "Story".',
                        'Respond strictly as valid JSON: {"brief": string, "themes": string[]}. Never include commentary or chain-of-thought.',
                    ]
                ),
            },
            {
                "role": "user",
                "content": json.dumps(user_payload, ensure_ascii=False),
            },
        ],
    )

    parsed = extract_json_object(raw_response)
    parsed_brief = parsed.get("brief") if parsed else None
    brief = (
        parsed_brief.strip()
        if isinstance(parsed_brief, str) and len(parsed_brief.strip()) > 15
        else raw_response.strip()
    )

    raw_themes = parsed.get("themes") if parsed else None
    themes = (
        [
            t.strip()[:32]
            for t in raw_themes
            if isinstance(t, str) and t.strip()
        ][:4]
        if isinstance(raw_themes, list)
        else []
    )

    if not brief:
        raise RuntimeError("Could not generate a brief for this book.")

    return {"brief": brief, "themes": themes}
