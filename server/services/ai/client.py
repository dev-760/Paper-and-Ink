"""Google Gemini REST client and JSON response helpers."""

from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import quote

import httpx

from server.config import assert_gemini_configured, server_config

_THINK_RE = re.compile(r"<think>[\s\S]*?</think>", re.IGNORECASE)
_THOUGHT_RE = re.compile(r"<thought>[\s\S]*?</thought>", re.IGNORECASE)
_DATA_URL_RE = re.compile(r"^data:(image/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$")


def strip_reasoning_artifacts(raw: str) -> str:
    cleaned = _THINK_RE.sub("", raw)
    cleaned = _THOUGHT_RE.sub("", cleaned)
    return cleaned.strip()


def _to_gemini_parts(content: str | list[dict[str, Any]]) -> list[dict[str, Any]]:
    if isinstance(content, str):
        return [{"text": content}] if content.strip() else []

    parts: list[dict[str, Any]] = []
    for item in content:
        item_type = item.get("type")
        if item_type == "text":
            text = item.get("text")
            if isinstance(text, str) and text.strip():
                parts.append({"text": text})
            continue

        if item_type == "image_url":
            image_url_obj = item.get("imageUrl") or item.get("image_url") or {}
            url = image_url_obj.get("url") if isinstance(image_url_obj, dict) else ""
            if isinstance(url, str):
                match = _DATA_URL_RE.match(url)
                if match:
                    parts.append(
                        {
                            "inlineData": {
                                "mimeType": match.group(1),
                                "data": match.group(2),
                            }
                        }
                    )
    return parts


async def run_model_completion(
    *,
    messages: list[dict[str, Any]],
    max_tokens: int | None = None,
    temperature: float | None = None,
    json_mode: bool = False,
) -> str:
    """Invoke the configured Gemini model via the Generative Language REST API."""
    assert_gemini_configured()

    system_parts: list[dict[str, Any]] = []
    contents: list[dict[str, Any]] = []

    for msg in messages:
        role = msg.get("role")
        content = msg.get("content", "")
        if role == "system":
            system_parts.extend(_to_gemini_parts(content))
            continue

        parts = _to_gemini_parts(content)
        if parts:
            contents.append(
                {
                    "role": "model" if role == "assistant" else "user",
                    "parts": parts,
                }
            )

    endpoint = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{quote(server_config.gemini_model, safe='')}:generateContent"
    )

    generation_config: dict[str, Any] = {
        "temperature": 0.2 if temperature is None else temperature,
        "maxOutputTokens": max(max_tokens or 4096, 3072),
    }
    if json_mode:
        generation_config["responseMimeType"] = "application/json"

    payload: dict[str, Any] = {
        "contents": contents,
        "generationConfig": generation_config,
    }
    if system_parts:
        payload["systemInstruction"] = {"parts": system_parts}

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            endpoint,
            headers={
                "Content-Type": "application/json",
                "X-goog-api-key": server_config.gemini_api_key,
            },
            json=payload,
        )

    try:
        data = response.json()
    except Exception:
        data = {}

    if not response.is_success:
        err_msg = (
            data.get("error", {}).get("message")
            if isinstance(data, dict) and isinstance(data.get("error"), dict)
            else None
        )
        raise RuntimeError(err_msg or f"Gemini API request failed (HTTP {response.status_code}).")

    candidates = data.get("candidates") if isinstance(data, dict) else None
    first = candidates[0] if isinstance(candidates, list) and candidates else {}
    parts = (
        first.get("content", {}).get("parts", [])
        if isinstance(first, dict) and isinstance(first.get("content"), dict)
        else []
    )
    raw_text = "\n".join(
        p["text"]
        for p in parts
        if isinstance(p, dict) and not p.get("thought") and isinstance(p.get("text"), str)
    )
    text = strip_reasoning_artifacts(raw_text)

    if not text:
        raise RuntimeError("The AI model returned an empty response.")
    return text


def extract_json_object(raw_text: str) -> dict[str, Any] | None:
    """Parse a JSON object from model output, tolerating Markdown fences or leading prose."""
    cleaned = strip_reasoning_artifacts(raw_text)
    cleaned = re.sub(r"^```json\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^```\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned).strip()

    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end > start:
            try:
                parsed = json.loads(cleaned[start : end + 1])
                return parsed if isinstance(parsed, dict) else None
            except Exception:
                return None
        return None
