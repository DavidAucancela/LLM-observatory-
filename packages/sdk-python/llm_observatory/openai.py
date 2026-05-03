import os
import time
from typing import Any, AsyncIterator, Iterator

from ._pricing import calculate_openai_cost
from ._utils import (
    extract_prompt_preview,
    mask_key,
    send_metric_background,
    send_metric_background_async,
)


# ---------------------------------------------------------------------------
# Sync
# ---------------------------------------------------------------------------

class _CompletionsProxy:
    def __init__(self, wrapper: "MonitoredOpenAI") -> None:
        self._w = wrapper

    def create(self, **params: Any) -> Any:
        start = time.perf_counter()
        prompt_preview = extract_prompt_preview(params.get("messages", []))
        tools = [
            t.get("function", {}).get("name") or t.get("name", "")
            for t in params.get("tools", [])
        ]

        if params.get("stream"):
            return self._create_stream(params, start, prompt_preview, tools)

        response = None
        status_code = 200
        error = None

        try:
            response = self._w._client.chat.completions.create(**params)
        except Exception as err:
            status_code = getattr(err, "status_code", 500) or 500
            error = err

        usage = getattr(response, "usage", None) if response else None
        input_t  = getattr(usage, "prompt_tokens",     0) if usage else 0
        output_t = getattr(usage, "completion_tokens", 0) if usage else 0

        send_metric_background(self._w._observatory_url, {
            "provider":      "openai",
            "model":         params["model"],
            "input_tokens":  input_t,
            "output_tokens": output_t,
            "total_tokens":  input_t + output_t,
            "cost_usd":      calculate_openai_cost(params["model"], input_t, output_t),
            "latency_ms":    int((time.perf_counter() - start) * 1000),
            "status_code":   status_code,
            "tools_used":    tools,
            "prompt_preview": prompt_preview,
            "tags":          self._w._tags,
            "api_key_hint":  self._w._api_key_hint,
        })

        if error:
            raise error
        return response

    def _create_stream(
        self,
        params: dict[str, Any],
        start: float,
        prompt_preview: str,
        tools: list[str],
    ) -> Iterator[Any]:
        # include_usage ensures the final chunk carries token counts
        stream_params = {
            **params,
            "stream_options": {"include_usage": True, **params.get("stream_options", {})},
        }

        try:
            raw_stream = self._w._client.chat.completions.create(**stream_params)
        except Exception as err:
            send_metric_background(self._w._observatory_url, {
                "provider": "openai", "model": params["model"],
                "input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "cost_usd": 0.0,
                "latency_ms": int((time.perf_counter() - start) * 1000),
                "status_code": getattr(err, "status_code", 500) or 500,
                "tools_used": tools, "prompt_preview": prompt_preview,
                "tags": self._w._tags, "api_key_hint": self._w._api_key_hint,
            })
            raise

        return self._stream_generator(raw_stream, params, start, prompt_preview, tools)

    def _stream_generator(
        self,
        raw_stream: Any,
        params: dict[str, Any],
        start: float,
        prompt_preview: str,
        tools: list[str],
    ) -> Iterator[Any]:
        input_t = output_t = 0
        try:
            for chunk in raw_stream:
                usage = getattr(chunk, "usage", None)
                if usage:
                    input_t  = getattr(usage, "prompt_tokens",     input_t)
                    output_t = getattr(usage, "completion_tokens", output_t)
                yield chunk
        finally:
            send_metric_background(self._w._observatory_url, {
                "provider":      "openai",
                "model":         params["model"],
                "input_tokens":  input_t,
                "output_tokens": output_t,
                "total_tokens":  input_t + output_t,
                "cost_usd":      calculate_openai_cost(params["model"], input_t, output_t),
                "latency_ms":    int((time.perf_counter() - start) * 1000),
                "status_code":   200,
                "tools_used":    tools,
                "prompt_preview": prompt_preview,
                "tags":          self._w._tags,
                "api_key_hint":  self._w._api_key_hint,
            })


class _ChatProxy:
    def __init__(self, wrapper: "MonitoredOpenAI") -> None:
        self.completions = _CompletionsProxy(wrapper)


class MonitoredOpenAI:
    """Drop-in replacement for openai.OpenAI with Observatory metrics."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        observatory_url: str = "http://localhost:3001",
        tags: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> None:
        try:
            from openai import OpenAI as _OpenAI
        except ImportError as e:
            raise ImportError(
                "openai package is required for MonitoredOpenAI. "
                'Install it with: pip install "llm-observatory[openai]"'
            ) from e

        resolved_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        self._observatory_url = observatory_url
        self._tags = tags or {}
        self._api_key_hint = mask_key(resolved_key)
        self._client = _OpenAI(api_key=api_key, **kwargs)
        self.chat = _ChatProxy(self)


# ---------------------------------------------------------------------------
# Async
# ---------------------------------------------------------------------------

class _AsyncCompletionsProxy:
    def __init__(self, wrapper: "AsyncMonitoredOpenAI") -> None:
        self._w = wrapper

    async def create(self, **params: Any) -> Any:
        start = time.perf_counter()
        prompt_preview = extract_prompt_preview(params.get("messages", []))
        tools = [
            t.get("function", {}).get("name") or t.get("name", "")
            for t in params.get("tools", [])
        ]

        if params.get("stream"):
            return self._create_stream(params, start, prompt_preview, tools)

        response = None
        status_code = 200
        error = None

        try:
            response = await self._w._client.chat.completions.create(**params)
        except Exception as err:
            status_code = getattr(err, "status_code", 500) or 500
            error = err

        usage = getattr(response, "usage", None) if response else None
        input_t  = getattr(usage, "prompt_tokens",     0) if usage else 0
        output_t = getattr(usage, "completion_tokens", 0) if usage else 0

        await send_metric_background_async(self._w._observatory_url, {
            "provider":      "openai",
            "model":         params["model"],
            "input_tokens":  input_t,
            "output_tokens": output_t,
            "total_tokens":  input_t + output_t,
            "cost_usd":      calculate_openai_cost(params["model"], input_t, output_t),
            "latency_ms":    int((time.perf_counter() - start) * 1000),
            "status_code":   status_code,
            "tools_used":    tools,
            "prompt_preview": prompt_preview,
            "tags":          self._w._tags,
            "api_key_hint":  self._w._api_key_hint,
        })

        if error:
            raise error
        return response

    async def _create_stream(
        self,
        params: dict[str, Any],
        start: float,
        prompt_preview: str,
        tools: list[str],
    ) -> AsyncIterator[Any]:
        stream_params = {
            **params,
            "stream_options": {"include_usage": True, **params.get("stream_options", {})},
        }

        try:
            raw_stream = await self._w._client.chat.completions.create(**stream_params)
        except Exception as err:
            await send_metric_background_async(self._w._observatory_url, {
                "provider": "openai", "model": params["model"],
                "input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "cost_usd": 0.0,
                "latency_ms": int((time.perf_counter() - start) * 1000),
                "status_code": getattr(err, "status_code", 500) or 500,
                "tools_used": tools, "prompt_preview": prompt_preview,
                "tags": self._w._tags, "api_key_hint": self._w._api_key_hint,
            })
            raise

        return self._stream_generator(raw_stream, params, start, prompt_preview, tools)

    async def _stream_generator(
        self,
        raw_stream: Any,
        params: dict[str, Any],
        start: float,
        prompt_preview: str,
        tools: list[str],
    ) -> AsyncIterator[Any]:
        input_t = output_t = 0
        try:
            async for chunk in raw_stream:
                usage = getattr(chunk, "usage", None)
                if usage:
                    input_t  = getattr(usage, "prompt_tokens",     input_t)
                    output_t = getattr(usage, "completion_tokens", output_t)
                yield chunk
        finally:
            await send_metric_background_async(self._w._observatory_url, {
                "provider":      "openai",
                "model":         params["model"],
                "input_tokens":  input_t,
                "output_tokens": output_t,
                "total_tokens":  input_t + output_t,
                "cost_usd":      calculate_openai_cost(params["model"], input_t, output_t),
                "latency_ms":    int((time.perf_counter() - start) * 1000),
                "status_code":   200,
                "tools_used":    tools,
                "prompt_preview": prompt_preview,
                "tags":          self._w._tags,
                "api_key_hint":  self._w._api_key_hint,
            })


class _AsyncChatProxy:
    def __init__(self, wrapper: "AsyncMonitoredOpenAI") -> None:
        self.completions = _AsyncCompletionsProxy(wrapper)


class AsyncMonitoredOpenAI:
    """Drop-in replacement for openai.AsyncOpenAI with Observatory metrics."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        observatory_url: str = "http://localhost:3001",
        tags: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> None:
        try:
            from openai import AsyncOpenAI as _AsyncOpenAI
        except ImportError as e:
            raise ImportError(
                "openai package is required for AsyncMonitoredOpenAI. "
                'Install it with: pip install "llm-observatory[openai]"'
            ) from e

        resolved_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        self._observatory_url = observatory_url
        self._tags = tags or {}
        self._api_key_hint = mask_key(resolved_key)
        self._client = _AsyncOpenAI(api_key=api_key, **kwargs)
        self.chat = _AsyncChatProxy(self)
