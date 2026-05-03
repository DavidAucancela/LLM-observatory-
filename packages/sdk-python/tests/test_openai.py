import pytest
from unittest.mock import MagicMock, patch


def _make_response(prompt_tokens=100, completion_tokens=50):
    response = MagicMock()
    response.usage.prompt_tokens = prompt_tokens
    response.usage.completion_tokens = completion_tokens
    return response


@pytest.fixture()
def mock_send():
    with patch("llm_observatory.openai.send_metric_background") as m:
        yield m


@pytest.fixture()
def openai_client(mock_send):
    """Build a MonitoredOpenAI instance with a mocked underlying client."""
    from llm_observatory.openai import MonitoredOpenAI, _ChatProxy

    instance = object.__new__(MonitoredOpenAI)
    instance._observatory_url = "http://obs:3001"
    instance._tags = {}
    instance._api_key_hint = "sk-proj-…5678"
    instance._client = MagicMock()
    instance.chat = _ChatProxy(instance)
    return instance


class TestMonitoredOpenAINonStreaming:
    def test_returns_response(self, openai_client, mock_send):
        openai_client._client.chat.completions.create.return_value = _make_response()

        result = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": "Hello"}],
        )

        assert result is not None

    def test_sends_metric_with_correct_tokens(self, openai_client, mock_send):
        openai_client._client.chat.completions.create.return_value = _make_response(100, 50)

        openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": "Hello"}],
        )

        mock_send.assert_called_once()
        metric = mock_send.call_args[0][1]
        assert metric["input_tokens"] == 100
        assert metric["output_tokens"] == 50
        assert metric["total_tokens"] == 150
        assert metric["provider"] == "openai"
        assert metric["status_code"] == 200

    def test_sends_correct_cost(self, openai_client, mock_send):
        # 1M input + 1M output for gpt-4o = $12.50
        openai_client._client.chat.completions.create.return_value = _make_response(1_000_000, 1_000_000)

        openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": "Hello"}],
        )

        metric = mock_send.call_args[0][1]
        assert metric["cost_usd"] == pytest.approx(12.50)

    def test_sends_metric_on_error(self, openai_client, mock_send):
        err = Exception("rate limited")
        err.status_code = 429
        openai_client._client.chat.completions.create.side_effect = err

        with pytest.raises(Exception, match="rate limited"):
            openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": "Hi"}],
            )

        mock_send.assert_called_once()
        metric = mock_send.call_args[0][1]
        assert metric["status_code"] == 429
        assert metric["cost_usd"] == 0.0

    def test_prompt_preview_truncated(self, openai_client, mock_send):
        openai_client._client.chat.completions.create.return_value = _make_response()

        openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": "A" * 500}],
        )

        metric = mock_send.call_args[0][1]
        assert len(metric["prompt_preview"]) <= 200

    def test_tags_forwarded(self, mock_send):
        from llm_observatory.openai import MonitoredOpenAI, _ChatProxy

        instance = object.__new__(MonitoredOpenAI)
        instance._observatory_url = "http://obs:3001"
        instance._tags = {"env": "staging", "team": "ml"}
        instance._api_key_hint = "sk-proj-…5678"
        instance._client = MagicMock()
        instance._client.chat.completions.create.return_value = _make_response()
        instance.chat = _ChatProxy(instance)

        instance.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": "Hi"}],
        )

        metric = mock_send.call_args[0][1]
        assert metric["tags"] == {"env": "staging", "team": "ml"}

    def test_tools_extracted_from_function_schema(self, openai_client, mock_send):
        openai_client._client.chat.completions.create.return_value = _make_response()

        openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": "Hi"}],
            tools=[
                {"function": {"name": "get_weather"}},
                {"function": {"name": "search_web"}},
            ],
        )

        metric = mock_send.call_args[0][1]
        assert metric["tools_used"] == ["get_weather", "search_web"]


class TestMonitoredOpenAIStreaming:
    def test_stream_injects_include_usage(self, openai_client, mock_send):
        openai_client._client.chat.completions.create.return_value = iter([])

        list(openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": "Hi"}],
            stream=True,
        ))

        call_kwargs = openai_client._client.chat.completions.create.call_args[1]
        assert call_kwargs["stream_options"]["include_usage"] is True

    def test_stream_yields_all_chunks(self, openai_client, mock_send):
        chunks = [MagicMock() for _ in range(3)]
        for c in chunks:
            c.usage = None
        openai_client._client.chat.completions.create.return_value = iter(chunks)

        result = list(openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": "Hi"}],
            stream=True,
        ))

        assert len(result) == 3

    def test_stream_captures_usage_from_final_chunk(self, openai_client, mock_send):
        chunk1 = MagicMock()
        chunk1.usage = None
        chunk2 = MagicMock()
        chunk2.usage.prompt_tokens = 120
        chunk2.usage.completion_tokens = 60
        openai_client._client.chat.completions.create.return_value = iter([chunk1, chunk2])

        list(openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": "Hi"}],
            stream=True,
        ))

        mock_send.assert_called_once()
        metric = mock_send.call_args[0][1]
        assert metric["input_tokens"] == 120
        assert metric["output_tokens"] == 60

    def test_stream_metric_sent_on_early_close(self, openai_client, mock_send):
        openai_client._client.chat.completions.create.return_value = iter([MagicMock(), MagicMock()])

        stream = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": "Hi"}],
            stream=True,
        )

        for _ in stream:
            break
        stream.close()  # explicitly trigger finally block

        mock_send.assert_called_once()
