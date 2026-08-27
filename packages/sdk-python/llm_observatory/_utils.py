from __future__ import annotations

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
    # google.genai.errors.APIError (Gemini) exposes .code (int) instead of .status_code
    status = getattr(exc, "status_code", None) or getattr(exc, "code", None) or getattr(exc, "status", None)
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


def truncate(s: Any, max_len: int) -> Any:
    if not isinstance(s, str):
        return s
    return s[:max_len] if len(s) > max_len else s


def extract_full_prompt(messages: list[dict]) -> str:
    return truncate(json.dumps(messages or []), 20000)


def extract_request_params(params: dict) -> dict[str, Any]:
    return {
        "temperature": params.get("temperature"),
        "max_tokens":  params.get("max_tokens"),
        "top_p":       params.get("top_p"),
        "stream":      bool(params.get("stream", False)),
    }


def extract_system_prompt_anthropic(params: dict) -> str | None:
    system = params.get("system")
    if not system:
        return None
    return truncate(system if isinstance(system, str) else json.dumps(system), 4000)


def extract_system_prompt_openai(messages: list[dict]) -> str | None:
    system_msg = next((m for m in (messages or []) if m.get("role") == "system"), None)
    if not system_msg:
        return None
    content = system_msg.get("content", "")
    return truncate(content if isinstance(content, str) else json.dumps(content), 4000)


def extract_anthropic_response_details(message: Any) -> dict[str, Any]:
    """message: an Anthropic Message object (or dict with equivalent shape)."""
    raw_blocks = getattr(message, "content", None) if not isinstance(message, dict) else message.get("content")
    blocks = raw_blocks if isinstance(raw_blocks, list) else []
    text_parts = []
    tool_calls = []
    for block in blocks:
        is_dict = isinstance(block, dict)
        block_type = block.get("type") if is_dict else getattr(block, "type", None)
        if block_type == "text":
            text = block.get("text") if is_dict else getattr(block, "text", None)
            text_parts.append(text if isinstance(text, str) else "")
        elif block_type == "tool_use":
            name   = block.get("name")  if is_dict else getattr(block, "name", None)
            input_ = block.get("input") if is_dict else getattr(block, "input", None)
            tool_calls.append({"name": name, "arguments": input_})
    stop_reason = message.get("stop_reason") if isinstance(message, dict) else getattr(message, "stop_reason", None)
    if not isinstance(stop_reason, (str, type(None))):
        stop_reason = None
    return {
        "response_full": truncate("\n".join(text_parts), 20000),
        "tool_calls":    tool_calls,
        "stop_reason":   stop_reason,
    }


def extract_gemini_prompt_preview(contents: Any) -> str:
    if isinstance(contents, str):
        return contents[:200]
    first = contents[0] if isinstance(contents, list) and contents else contents
    parts = first.get("parts") if isinstance(first, dict) else getattr(first, "parts", None)
    if parts:
        text = " ".join(
            (p.get("text") if isinstance(p, dict) else getattr(p, "text", None)) or ""
            for p in parts
        ).strip()
        if text:
            return text[:200]
    return json.dumps(first if first is not None else "")[:200]


def extract_gemini_request_details(params: dict) -> dict[str, Any]:
    contents = params.get("contents")
    prompt_full = truncate(contents if isinstance(contents, str) else json.dumps(contents or ""), 20000)
    config = params.get("config")
    system_instruction = getattr(config, "system_instruction", None) if config is not None else None
    system_prompt = (
        truncate(system_instruction if isinstance(system_instruction, str) else json.dumps(system_instruction), 4000)
        if system_instruction else None
    )
    request_params = {
        "temperature": getattr(config, "temperature", None) if config is not None else None,
        "max_tokens":  getattr(config, "max_output_tokens", None) if config is not None else None,
        "top_p":       getattr(config, "top_p", None) if config is not None else None,
    }
    return {"prompt_full": prompt_full, "system_prompt": system_prompt, "request_params": request_params}


def extract_gemini_tool_names(params: dict) -> list[str]:
    config = params.get("config")
    tools = getattr(config, "tools", None) if config is not None else None
    names = []
    for t in (tools or []):
        declarations = getattr(t, "function_declarations", None) or []
        for fd in declarations:
            name = getattr(fd, "name", None)
            if name:
                names.append(name)
    return names


def extract_gemini_response_details(response: Any) -> dict[str, Any]:
    text = getattr(response, "text", None)
    function_calls = getattr(response, "function_calls", None) or []
    tool_calls = [
        {"name": getattr(fc, "name", None), "arguments": getattr(fc, "args", None)}
        for fc in function_calls
    ]
    candidates = getattr(response, "candidates", None) or []
    stop_reason = getattr(candidates[0], "finish_reason", None) if candidates else None
    return {
        "response_full": truncate(text or "", 20000),
        "tool_calls":    tool_calls,
        "stop_reason":   stop_reason,
    }


def extract_openai_response_details(response: Any) -> dict[str, Any]:
    choices = getattr(response, "choices", None)
    choice = choices[0] if isinstance(choices, list) and choices else None
    message = getattr(choice, "message", None) if choice else None
    content = getattr(message, "content", None) if message else None
    if not isinstance(content, str):
        content = ""
    raw_tool_calls = getattr(message, "tool_calls", None) if message else None
    tool_calls = []
    for tc in (raw_tool_calls if isinstance(raw_tool_calls, list) else []):
        fn = getattr(tc, "function", None)
        name = getattr(fn, "name", None) if fn else None
        args_raw = getattr(fn, "arguments", None) if fn else None
        if not isinstance(name, str):
            continue
        try:
            args = json.loads(args_raw) if isinstance(args_raw, str) and args_raw else None
        except (TypeError, ValueError):
            args = args_raw
        tool_calls.append({"name": name, "arguments": args})
    finish_reason = getattr(choice, "finish_reason", None) if choice else None
    if not isinstance(finish_reason, (str, type(None))):
        finish_reason = None
    return {
        "response_full": truncate(content or "", 20000),
        "tool_calls":    tool_calls,
        "stop_reason":   finish_reason,
    }
