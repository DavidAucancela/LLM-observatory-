import asyncio
import json
import threading
import time
import urllib.request
import warnings
from typing import Any


def mask_key(key: str | None) -> str | None:
    if not key or len(key) < 12:
        return None
    return key[:8] + "…" + key[-4:]


def _post_metric(url: str, data: dict[str, Any]) -> None:
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        f"{url}/api/metrics",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=5)
    except Exception:
        # One retry after 1 s — still inside daemon thread, never blocks the caller
        time.sleep(1)
        try:
            urllib.request.urlopen(req, timeout=5)
        except Exception as e:
            warnings.warn(f"[LLM Observatory] Failed to send metric: {e}", stacklevel=2)


def send_metric_background(url: str, data: dict[str, Any]) -> None:
    """Fire-and-forget via daemon thread — never blocks the caller."""
    thread = threading.Thread(target=_post_metric, args=(url, data), daemon=True)
    thread.start()


async def send_metric_background_async(url: str, data: dict[str, Any]) -> None:
    """Fire-and-forget via asyncio — runs the blocking POST in the thread pool."""
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _post_metric, url, data)


def extract_prompt_preview(messages: list[dict]) -> str:
    if not messages:
        return ""
    first = messages[0]
    content = first.get("content", "")
    if isinstance(content, str):
        return content[:200]
    # content can be a list of blocks (Anthropic format)
    return json.dumps(content)[:200]
