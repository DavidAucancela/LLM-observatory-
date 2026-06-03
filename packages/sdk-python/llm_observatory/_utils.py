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


def classify_error(exc: Exception) -> dict[str, Any]:
    status = getattr(exc, "status_code", None) or getattr(exc, "status", None)
    msg = (str(exc) or "")[:500]
    if status in (401, 403):
        error_type = "auth_error"
    elif status == 429:
        error_type = "rate_limit"
    elif status == 400:
        error_type = "invalid_request"
    elif status and status >= 500:
        error_type = "server_error"
    elif isinstance(exc, (ConnectionError, OSError)):
        error_type = "network_error"
    elif isinstance(exc, TimeoutError):
        error_type = "timeout"
    else:
        error_type = "unknown_error"
    return {"error_type": error_type, "error_message": msg}


def _post_metric(url: str, data: dict[str, Any], token: str | None = None) -> None:
    body = json.dumps(data).encode()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(
        f"{url}/api/metrics",
        data=body,
        headers=headers,
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


def send_metric_background(url: str, data: dict[str, Any], token: str | None = None) -> None:
    """Fire-and-forget via daemon thread — never blocks the caller."""
    thread = threading.Thread(target=_post_metric, args=(url, data, token), daemon=True)
    thread.start()


async def send_metric_background_async(url: str, data: dict[str, Any], token: str | None = None) -> None:
    """Fire-and-forget via asyncio — runs the blocking POST in the thread pool."""
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _post_metric, url, data, token)


def extract_prompt_preview(messages: list[dict]) -> str:
    if not messages:
        return ""
    first = messages[0]
    content = first.get("content", "")
    if isinstance(content, str):
        return content[:200]
    # content can be a list of blocks (Anthropic format)
    return json.dumps(content)[:200]
