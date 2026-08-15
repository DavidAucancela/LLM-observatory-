import pytest
from unittest.mock import MagicMock, patch


def _make_response(prompt_tokens=100, completion_tokens=50):
    response = MagicMock()
    response.usage.prompt_tokens = prompt_tokens
    response.usage.completion_tokens = completion_tokens
    return response


@pytest.fixture()
def mock_send():
    with patch("llm_observatory.grok.send_metric_background") as m:
        yield m


@pytest.fixture()
def grok_client(mock_send):
    """Build a MonitoredGrok instance with a mocked underlying client."""
    from llm_observatory.grok import MonitoredGrok, _GrokChatProxy

    instance = object.__new__(MonitoredGrok)
    instance._observatory_url = "http://obs:3001"
    instance._observatory_token = "obs_sk_test"
    instance._tags = {}
    instance._api_key_hint = "xai-…5678"
    instance._client = MagicMock()
    instance.chat = _GrokChatProxy(instance)
    return instance


class TestMonitoredGrokNonStreaming:
    def test_returns_response(self, grok_client, mock_send):
        grok_client._client.chat.completions.create.return_value = _make_response()

        result = grok_client.chat.completions.create(
            model="grok-4.6",
            messages=[{"role": "user", "content": "Hello"}],
        )

        assert result is not None

    def test_sends_metric_with_correct_tokens_and_provider(self, grok_client, mock_send):
        grok_client._client.chat.completions.create.return_value = _make_response(100, 50)

        grok_client.chat.completions.create(
            model="grok-4.6",
            messages=[{"role": "user", "content": "Hello"}],
        )

        mock_send.assert_called_once()
        metric = mock_send.call_args[0][1]
        assert metric["input_tokens"] == 100
        assert metric["output_tokens"] == 50
        assert metric["total_tokens"] == 150
        assert metric["provider"] == "grok"
        assert metric["status_code"] == 200

    def test_sends_correct_cost(self, grok_client, mock_send):
        # 1M input + 1M output for grok-4.6 = $8.00
        grok_client._client.chat.completions.create.return_value = _make_response(1_000_000, 1_000_000)

        grok_client.chat.completions.create(
            model="grok-4.6",
            messages=[{"role": "user", "content": "Hello"}],
        )

        metric = mock_send.call_args[0][1]
        assert metric["cost_usd"] == pytest.approx(8.0)

    def test_sends_metric_on_error(self, grok_client, mock_send):
        err = Exception("rate limited")
        err.status_code = 429
        grok_client._client.chat.completions.create.side_effect = err

        with pytest.raises(Exception, match="rate limited"):
            grok_client.chat.completions.create(
                model="grok-4.6",
                messages=[{"role": "user", "content": "Hi"}],
            )

        mock_send.assert_called_once()
        metric = mock_send.call_args[0][1]
        assert metric["status_code"] == 429
        assert metric["cost_usd"] == 0.0

    def test_tags_forwarded(self, mock_send):
        from llm_observatory.grok import MonitoredGrok, _GrokChatProxy

        instance = object.__new__(MonitoredGrok)
        instance._observatory_url = "http://obs:3001"
        instance._observatory_token = "obs_sk_test"
        instance._tags = {"env": "staging", "team": "ml"}
        instance._api_key_hint = "xai-…5678"
        instance._client = MagicMock()
        instance._client.chat.completions.create.return_value = _make_response()
        instance.chat = _GrokChatProxy(instance)

        instance.chat.completions.create(
            model="grok-4.6",
            messages=[{"role": "user", "content": "Hi"}],
        )

        metric = mock_send.call_args[0][1]
        assert metric["tags"] == {"env": "staging", "team": "ml"}


class TestMonitoredGrokStreaming:
    def test_stream_yields_all_chunks(self, grok_client, mock_send):
        chunks = [MagicMock() for _ in range(3)]
        for c in chunks:
            c.usage = None
        grok_client._client.chat.completions.create.return_value = iter(chunks)

        result = list(grok_client.chat.completions.create(
            model="grok-4.6",
            messages=[{"role": "user", "content": "Hi"}],
            stream=True,
        ))

        assert len(result) == 3

    def test_stream_captures_usage_from_final_chunk(self, grok_client, mock_send):
        chunk1 = MagicMock()
        chunk1.usage = None
        chunk2 = MagicMock()
        chunk2.usage.prompt_tokens = 120
        chunk2.usage.completion_tokens = 60
        grok_client._client.chat.completions.create.return_value = iter([chunk1, chunk2])

        list(grok_client.chat.completions.create(
            model="grok-4.6",
            messages=[{"role": "user", "content": "Hi"}],
            stream=True,
        ))

        mock_send.assert_called_once()
        metric = mock_send.call_args[0][1]
        assert metric["input_tokens"] == 120
        assert metric["output_tokens"] == 60
        assert metric["provider"] == "grok"

    def test_stream_metric_sent_on_early_close(self, grok_client, mock_send):
        grok_client._client.chat.completions.create.return_value = iter([MagicMock(), MagicMock()])

        stream = grok_client.chat.completions.create(
            model="grok-4.6",
            messages=[{"role": "user", "content": "Hi"}],
            stream=True,
        )

        for _ in stream:
            break
        stream.close()  # explicitly trigger finally block

        mock_send.assert_called_once()


class TestMonitoredGrokConstructor:
    def test_defaults_base_url_to_xai(self, mock_send):
        from llm_observatory.grok import MonitoredGrok, XAI_BASE_URL

        with patch("openai.OpenAI") as mock_openai_cls:
            MonitoredGrok(api_key="xai-test-key-0000000000")
            _, kwargs = mock_openai_cls.call_args
            assert kwargs["base_url"] == XAI_BASE_URL == "https://api.x.ai/v1"
