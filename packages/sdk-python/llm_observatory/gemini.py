from __future__ import annotations

import os
import time
from typing import Any, AsyncIterator, Iterator

from ._pricing import calculate_gemini_cost
from ._utils import (
    classify_error,
    extract_gemini_prompt_preview,
    extract_gemini_request_details,
    extract_gemini_response_details,
    extract_gemini_tool_names,
    mask_key,
    send_metric_background,
    send_metric_background_async,
    truncate,
)

# Gemini's API is not OpenAI-shaped (unlike Grok/Kimi), so this module talks to
# google-genai directly rather than reusing openai.py's helpers. Behavior is
# translated 1:1 from MonitoredGemini in packages/sdk/src/index.js.


# ---------------------------------------------------------------------------
# Sync
# ---------------------------------------------------------------------------

class _GeminiModelsProxy:
    def __init__(self, wrapper: "MonitoredGemini") -> None:
        self._w = wrapper

    def generate_content(self, **params: Any) -> Any:
        start = time.perf_counter()
        prompt_preview = extract_gemini_prompt_preview(params.get("contents"))
        tools = extract_gemini_tool_names(params)
        request_details = extract_gemini_request_details(params)

        response = None
        status_code = 200
        error = None
        try:
            response = self._w._client.models.generate_content(**params)
        except Exception as err:
            # google.genai.errors.APIError exposes .code (int), not .status_code
            status_code = getattr(err, "code", 500) or 500
            error = err

        usage = getattr(response, "usage_metadata", None) if response else None
        input_t      = getattr(usage, "prompt_token_count",        0) or 0 if usage else 0
        output_t     = getattr(usage, "candidates_token_count",    0) or 0 if usage else 0
        cache_read_t = getattr(usage, "cached_content_token_count", 0) or 0 if usage else 0
        response_details = extract_gemini_response_details(response) if response else {
            "response_full": None, "tool_calls": [], "stop_reason": None,
        }

        metric = {
            "provider":           "gemini",
            "model":              params["model"],
            "input_tokens":       input_t,
            "output_tokens":      output_t,
            "total_tokens":       input_t + output_t,
            "cost_usd":           calculate_gemini_cost(params["model"], input_t, output_t),
            "latency_ms":         int((time.perf_counter() - start) * 1000),
            "status_code":        status_code,
            "cache_read_tokens":  cache_read_t,
            "cache_write_tokens": 0,
            "tools_used":         tools,
            "prompt_preview":     prompt_preview,
            "tags":               self._w._tags,
            "api_key_hint":       self._w._api_key_hint,
            **request_details,
            **response_details,
        }
        if error:
            metric.update(classify_error(error))

        send_metric_background(self._w._observatory_url, metric, token=self._w._observatory_token)

        if error:
            raise error
        return response

    def generate_content_stream(self, **params: Any) -> Iterator[Any]:
        start = time.perf_counter()
        prompt_preview = extract_gemini_prompt_preview(params.get("contents"))
        tools = extract_gemini_tool_names(params)
        request_details = extract_gemini_request_details(params)

        try:
            stream = self._w._client.models.generate_content_stream(**params)
        except Exception as err:
            metric = {
                "provider": "gemini", "model": params["model"],
                "input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "cost_usd": 0.0,
                "latency_ms": int((time.perf_counter() - start) * 1000),
                "status_code": getattr(err, "code", 500) or 500,
                "cache_read_tokens": 0, "cache_write_tokens": 0,
                "tools_used": tools, "prompt_preview": prompt_preview,
                "tags": self._w._tags, "api_key_hint": self._w._api_key_hint,
                **request_details,
                **classify_error(err),
            }
            send_metric_background(self._w._observatory_url, metric, token=self._w._observatory_token)
            raise

        return self._stream_generator(stream, params, start, prompt_preview, tools, request_details)

    def _stream_generator(
        self,
        stream: Any,
        params: dict[str, Any],
        start: float,
        prompt_preview: str,
        tools: list[str],
        request_details: dict[str, Any],
    ) -> Iterator[Any]:
        # usage_metadata is cumulative per chunk (per Gemini's documented behavior) —
        # the last chunk that carries it holds the final totals, so just keep
        # overwriting rather than summing.
        usage = None
        response_text = ""
        stop_reason = None
        tool_calls_acc: list[dict[str, Any]] = []
        try:
            for chunk in stream:
                chunk_usage = getattr(chunk, "usage_metadata", None)
                if chunk_usage:
                    usage = chunk_usage
                text = getattr(chunk, "text", None)
                if text:
                    response_text += text
                function_calls = getattr(chunk, "function_calls", None)
                if function_calls:
                    tool_calls_acc.extend(
                        {"name": getattr(fc, "name", None), "arguments": getattr(fc, "args", None)}
                        for fc in function_calls
                    )
                candidates = getattr(chunk, "candidates", None) or []
                finish_reason = getattr(candidates[0], "finish_reason", None) if candidates else None
                if finish_reason:
                    stop_reason = finish_reason
                yield chunk
        finally:
            input_t      = getattr(usage, "prompt_token_count",         0) or 0 if usage else 0
            output_t     = getattr(usage, "candidates_token_count",     0) or 0 if usage else 0
            cache_read_t = getattr(usage, "cached_content_token_count", 0) or 0 if usage else 0
            send_metric_background(self._w._observatory_url, {
                "provider":           "gemini",
                "model":              params["model"],
                "input_tokens":       input_t,
                "output_tokens":      output_t,
                "total_tokens":       input_t + output_t,
                "cost_usd":           calculate_gemini_cost(params["model"], input_t, output_t),
                "latency_ms":         int((time.perf_counter() - start) * 1000),
                "status_code":        200,
                "cache_read_tokens":  cache_read_t,
                "cache_write_tokens": 0,
                "tools_used":         tools,
                "prompt_preview":     prompt_preview,
                "tags":               self._w._tags,
                "api_key_hint":       self._w._api_key_hint,
                **request_details,
                "response_full": truncate(response_text, 20000),
                "tool_calls":    tool_calls_acc,
                "stop_reason":   stop_reason,
            }, token=self._w._observatory_token)


class MonitoredGemini:
    """Drop-in Gemini client with Observatory metrics. Wraps google.genai.Client."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        observatory_url: str = "http://localhost:3001",
        observatory_token: str | None = None,
        tags: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> None:
        try:
            from google import genai
        except ImportError as e:
            raise ImportError(
                "google-genai package is required for MonitoredGemini. "
                'Install it with: pip install "llm-observatory[gemini]"'
            ) from e

        resolved_key = api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or ""
        self._observatory_url   = observatory_url
        self._observatory_token = observatory_token
        self._tags              = tags or {}
        self._api_key_hint      = mask_key(resolved_key)
        self._client            = genai.Client(api_key=resolved_key, **kwargs)
        self.models             = _GeminiModelsProxy(self)


# ---------------------------------------------------------------------------
# Async
# ---------------------------------------------------------------------------

class _AsyncGeminiModelsProxy:
    def __init__(self, wrapper: "AsyncMonitoredGemini") -> None:
        self._w = wrapper

    async def generate_content(self, **params: Any) -> Any:
        start = time.perf_counter()
        prompt_preview = extract_gemini_prompt_preview(params.get("contents"))
        tools = extract_gemini_tool_names(params)
        request_details = extract_gemini_request_details(params)

        response = None
        status_code = 200
        error = None
        try:
            response = await self._w._client.aio.models.generate_content(**params)
        except Exception as err:
            status_code = getattr(err, "code", 500) or 500
            error = err

        usage = getattr(response, "usage_metadata", None) if response else None
        input_t      = getattr(usage, "prompt_token_count",        0) or 0 if usage else 0
        output_t     = getattr(usage, "candidates_token_count",    0) or 0 if usage else 0
        cache_read_t = getattr(usage, "cached_content_token_count", 0) or 0 if usage else 0
        response_details = extract_gemini_response_details(response) if response else {
            "response_full": None, "tool_calls": [], "stop_reason": None,
        }

        metric = {
            "provider":           "gemini",
            "model":              params["model"],
            "input_tokens":       input_t,
            "output_tokens":      output_t,
            "total_tokens":       input_t + output_t,
            "cost_usd":           calculate_gemini_cost(params["model"], input_t, output_t),
            "latency_ms":         int((time.perf_counter() - start) * 1000),
            "status_code":        status_code,
            "cache_read_tokens":  cache_read_t,
            "cache_write_tokens": 0,
            "tools_used":         tools,
            "prompt_preview":     prompt_preview,
            "tags":               self._w._tags,
            "api_key_hint":       self._w._api_key_hint,
            **request_details,
            **response_details,
        }
        if error:
            metric.update(classify_error(error))

        await send_metric_background_async(self._w._observatory_url, metric, token=self._w._observatory_token)

        if error:
            raise error
        return response

    async def generate_content_stream(self, **params: Any) -> AsyncIterator[Any]:
        start = time.perf_counter()
        prompt_preview = extract_gemini_prompt_preview(params.get("contents"))
        tools = extract_gemini_tool_names(params)
        request_details = extract_gemini_request_details(params)

        try:
            stream = await self._w._client.aio.models.generate_content_stream(**params)
        except Exception as err:
            metric = {
                "provider": "gemini", "model": params["model"],
                "input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "cost_usd": 0.0,
                "latency_ms": int((time.perf_counter() - start) * 1000),
                "status_code": getattr(err, "code", 500) or 500,
                "cache_read_tokens": 0, "cache_write_tokens": 0,
                "tools_used": tools, "prompt_preview": prompt_preview,
                "tags": self._w._tags, "api_key_hint": self._w._api_key_hint,
                **request_details,
                **classify_error(err),
            }
            await send_metric_background_async(self._w._observatory_url, metric, token=self._w._observatory_token)
            raise

        return self._stream_generator(stream, params, start, prompt_preview, tools, request_details)

    async def _stream_generator(
        self,
        stream: Any,
        params: dict[str, Any],
        start: float,
        prompt_preview: str,
        tools: list[str],
        request_details: dict[str, Any],
    ) -> AsyncIterator[Any]:
        usage = None
        response_text = ""
        stop_reason = None
        tool_calls_acc: list[dict[str, Any]] = []
        try:
            async for chunk in stream:
                chunk_usage = getattr(chunk, "usage_metadata", None)
                if chunk_usage:
                    usage = chunk_usage
                text = getattr(chunk, "text", None)
                if text:
                    response_text += text
                function_calls = getattr(chunk, "function_calls", None)
                if function_calls:
                    tool_calls_acc.extend(
                        {"name": getattr(fc, "name", None), "arguments": getattr(fc, "args", None)}
                        for fc in function_calls
                    )
                candidates = getattr(chunk, "candidates", None) or []
                finish_reason = getattr(candidates[0], "finish_reason", None) if candidates else None
                if finish_reason:
                    stop_reason = finish_reason
                yield chunk
        finally:
            input_t      = getattr(usage, "prompt_token_count",         0) or 0 if usage else 0
            output_t     = getattr(usage, "candidates_token_count",     0) or 0 if usage else 0
            cache_read_t = getattr(usage, "cached_content_token_count", 0) or 0 if usage else 0
            await send_metric_background_async(self._w._observatory_url, {
                "provider":           "gemini",
                "model":              params["model"],
                "input_tokens":       input_t,
                "output_tokens":      output_t,
                "total_tokens":       input_t + output_t,
                "cost_usd":           calculate_gemini_cost(params["model"], input_t, output_t),
                "latency_ms":         int((time.perf_counter() - start) * 1000),
                "status_code":        200,
                "cache_read_tokens":  cache_read_t,
                "cache_write_tokens": 0,
                "tools_used":         tools,
                "prompt_preview":     prompt_preview,
                "tags":               self._w._tags,
                "api_key_hint":       self._w._api_key_hint,
                **request_details,
                "response_full": truncate(response_text, 20000),
                "tool_calls":    tool_calls_acc,
                "stop_reason":   stop_reason,
            }, token=self._w._observatory_token)


class AsyncMonitoredGemini:
    """Drop-in Gemini client with Observatory metrics — async variant.

    google-genai has no separate async client class: a single genai.Client
    exposes both the sync surface and an .aio namespace for async calls, so
    this wraps the same Client and points the proxy at client.aio.models.
    """

    def __init__(
        self,
        *,
        api_key: str | None = None,
        observatory_url: str = "http://localhost:3001",
        observatory_token: str | None = None,
        tags: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> None:
        try:
            from google import genai
        except ImportError as e:
            raise ImportError(
                "google-genai package is required for AsyncMonitoredGemini. "
                'Install it with: pip install "llm-observatory[gemini]"'
            ) from e

        resolved_key = api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or ""
        self._observatory_url   = observatory_url
        self._observatory_token = observatory_token
        self._tags              = tags or {}
        self._api_key_hint      = mask_key(resolved_key)
        self._client            = genai.Client(api_key=resolved_key, **kwargs)
        self.models             = _AsyncGeminiModelsProxy(self)
