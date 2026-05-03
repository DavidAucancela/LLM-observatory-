import os
import time
from typing import Any, AsyncIterator, Iterator

import anthropic as _anthropic

from ._pricing import calculate_cost
from ._utils import (
    extract_prompt_preview,
    mask_key,
    send_metric_background,
    send_metric_background_async,
)


# ---------------------------------------------------------------------------
# Sync
# ---------------------------------------------------------------------------

class _MessagesProxy:
    def __init__(self, wrapper: "MonitoredAnthropic") -> None:
        self._w = wrapper

    def create(self, **params: Any) -> Any:
        start = time.perf_counter()
        prompt_preview = extract_prompt_preview(params.get("messages", []))
        tools = [t.get("name", "") for t in params.get("tools", [])]

        if params.get("stream"):
            return self._create_stream(params, start, prompt_preview, tools)

        # Non-streaming path
        response = None
        status_code = 200
        error = None

        try:
            response = self._w._client.messages.create(**params)
        except _anthropic.APIError as err:
            status_code = err.status_code or 500
            error = err

        input_t  = getattr(getattr(response, "usage", None), "input_tokens",  0) if response else 0
        output_t = getattr(getattr(response, "usage", None), "output_tokens", 0) if response else 0

        send_metric_background(self._w._observatory_url, {
            "model":         params["model"],
            "input_tokens":  input_t,
            "output_tokens": output_t,
            "total_tokens":  input_t + output_t,
            "cost_usd":      calculate_cost(params["model"], input_t, output_t),
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
        try:
            raw_stream = self._w._client.messages.create(**params)
        except _anthropic.APIError as err:
            send_metric_background(self._w._observatory_url, {
                "model": params["model"], "input_tokens": 0, "output_tokens": 0,
                "total_tokens": 0, "cost_usd": 0.0,
                "latency_ms": int((time.perf_counter() - start) * 1000),
                "status_code": err.status_code or 500,
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
            for event in raw_stream:
                # message_delta carries cumulative usage
                usage = getattr(event, "usage", None)
                if usage:
                    input_t  = getattr(usage, "input_tokens",  input_t)
                    output_t = getattr(usage, "output_tokens", output_t)
                yield event
        finally:
            # Always fires — even on break or exception in caller
            send_metric_background(self._w._observatory_url, {
                "model":         params["model"],
                "input_tokens":  input_t,
                "output_tokens": output_t,
                "total_tokens":  input_t + output_t,
                "cost_usd":      calculate_cost(params["model"], input_t, output_t),
                "latency_ms":    int((time.perf_counter() - start) * 1000),
                "status_code":   200,
                "tools_used":    tools,
                "prompt_preview": prompt_preview,
                "tags":          self._w._tags,
                "api_key_hint":  self._w._api_key_hint,
            })


class MonitoredAnthropic:
    """Drop-in replacement for anthropic.Anthropic with Observatory metrics."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        observatory_url: str = "http://localhost:3001",
        tags: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> None:
        resolved_key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")
        self._observatory_url = observatory_url
        self._tags = tags or {}
        self._api_key_hint = mask_key(resolved_key)
        self._client = _anthropic.Anthropic(api_key=api_key, **kwargs)
        self.messages = _MessagesProxy(self)


# ---------------------------------------------------------------------------
# Async
# ---------------------------------------------------------------------------

class _AsyncMessagesProxy:
    def __init__(self, wrapper: "AsyncMonitoredAnthropic") -> None:
        self._w = wrapper

    async def create(self, **params: Any) -> Any:
        start = time.perf_counter()
        prompt_preview = extract_prompt_preview(params.get("messages", []))
        tools = [t.get("name", "") for t in params.get("tools", [])]

        if params.get("stream"):
            return self._create_stream(params, start, prompt_preview, tools)

        response = None
        status_code = 200
        error = None

        try:
            response = await self._w._client.messages.create(**params)
        except _anthropic.APIError as err:
            status_code = err.status_code or 500
            error = err

        input_t  = getattr(getattr(response, "usage", None), "input_tokens",  0) if response else 0
        output_t = getattr(getattr(response, "usage", None), "output_tokens", 0) if response else 0

        await send_metric_background_async(self._w._observatory_url, {
            "model":         params["model"],
            "input_tokens":  input_t,
            "output_tokens": output_t,
            "total_tokens":  input_t + output_t,
            "cost_usd":      calculate_cost(params["model"], input_t, output_t),
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
        try:
            raw_stream = await self._w._client.messages.create(**params)
        except _anthropic.APIError as err:
            await send_metric_background_async(self._w._observatory_url, {
                "model": params["model"], "input_tokens": 0, "output_tokens": 0,
                "total_tokens": 0, "cost_usd": 0.0,
                "latency_ms": int((time.perf_counter() - start) * 1000),
                "status_code": err.status_code or 500,
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
            async for event in raw_stream:
                usage = getattr(event, "usage", None)
                if usage:
                    input_t  = getattr(usage, "input_tokens",  input_t)
                    output_t = getattr(usage, "output_tokens", output_t)
                yield event
        finally:
            await send_metric_background_async(self._w._observatory_url, {
                "model":         params["model"],
                "input_tokens":  input_t,
                "output_tokens": output_t,
                "total_tokens":  input_t + output_t,
                "cost_usd":      calculate_cost(params["model"], input_t, output_t),
                "latency_ms":    int((time.perf_counter() - start) * 1000),
                "status_code":   200,
                "tools_used":    tools,
                "prompt_preview": prompt_preview,
                "tags":          self._w._tags,
                "api_key_hint":  self._w._api_key_hint,
            })


class AsyncMonitoredAnthropic:
    """Drop-in replacement for anthropic.AsyncAnthropic with Observatory metrics."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        observatory_url: str = "http://localhost:3001",
        tags: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> None:
        resolved_key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")
        self._observatory_url = observatory_url
        self._tags = tags or {}
        self._api_key_hint = mask_key(resolved_key)
        self._client = _anthropic.AsyncAnthropic(api_key=api_key, **kwargs)
        self.messages = _AsyncMessagesProxy(self)
