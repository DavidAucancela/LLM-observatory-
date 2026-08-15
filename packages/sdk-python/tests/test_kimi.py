import pytest
from unittest.mock import MagicMock, patch


def _make_response(prompt_tokens=100, completion_tokens=50):
    response = MagicMock()
    response.usage.prompt_tokens = prompt_tokens
    response.usage.completion_tokens = completion_tokens
    return response


@pytest.fixture()
def mock_send():
    with patch("llm_observatory.kimi.send_metric_background") as m:
        yield m


@pytest.fixture()
def kimi_client(mock_send):
    """Build a MonitoredKimi instance with a mocked underlying client."""
    from llm_observatory.kimi import MonitoredKimi, _KimiChatProxy

    instance = object.__new__(MonitoredKimi)
    instance._observatory_url = "http://obs:3001"
    instance._observatory_token = "obs_sk_test"
    instance._tags = {}
    instance._api_key_hint = "sk-…5678"
    instance._client = MagicMock()
    instance.chat = _KimiChatProxy(instance)
    return instance


class TestMonitoredKimiNonStreaming:
    def test_returns_response(self, kimi_client, mock_send):
        kimi_client._client.chat.completions.create.return_value = _make_response()

        result = kimi_client.chat.completions.create(
            model="kimi-k3",
            messages=[{"role": "user", "content": "Hello"}],
        )

        assert result is not None

    def test_sends_metric_with_correct_tokens_and_provider(self, kimi_client, mock_send):
        kimi_client._client.chat.completions.create.return_value = _make_response(100, 50)

        kimi_client.chat.completions.create(
            model="kimi-k3",
            messages=[{"role": "user", "content": "Hello"}],
        )

        mock_send.assert_called_once()
        metric = mock_send.call_args[0][1]
        assert metric["input_tokens"] == 100
        assert metric["output_tokens"] == 50
        assert metric["total_tokens"] == 150
        assert metric["provider"] == "kimi"
        assert metric["status_code"] == 200

    def test_sends_correct_cost(self, kimi_client, mock_send):
        # 1M input + 1M output for kimi-k3 = $18.00
        kimi_client._client.chat.completions.create.return_value = _make_response(1_000_000, 1_000_000)

        kimi_client.chat.completions.create(
            model="kimi-k3",
            messages=[{"role": "user", "content": "Hello"}],
        )

        metric = mock_send.call_args[0][1]
        assert metric["cost_usd"] == pytest.approx(18.0)

    def test_sends_metric_on_error(self, kimi_client, mock_send):
        err = Exception("rate limited")
        err.status_code = 429
        kimi_client._client.chat.completions.create.side_effect = err

        with pytest.raises(Exception, match="rate limited"):
            kimi_client.chat.completions.create(
                model="kimi-k3",
                messages=[{"role": "user", "content": "Hi"}],
            )

        mock_send.assert_called_once()
        metric = mock_send.call_args[0][1]
        assert metric["status_code"] == 429
        assert metric["cost_usd"] == 0.0

    def test_tags_forwarded(self, mock_send):
        from llm_observatory.kimi import MonitoredKimi, _KimiChatProxy

        instance = object.__new__(MonitoredKimi)
        instance._observatory_url = "http://obs:3001"
        instance._observatory_token = "obs_sk_test"
        instance._tags = {"env": "staging", "team": "ml"}
        instance._api_key_hint = "sk-…5678"
        instance._client = MagicMock()
        instance._client.chat.completions.create.return_value = _make_response()
        instance.chat = _KimiChatProxy(instance)

        instance.chat.completions.create(
            model="kimi-k3",
            messages=[{"role": "user", "content": "Hi"}],
        )

        metric = mock_send.call_args[0][1]
        assert metric["tags"] == {"env": "staging", "team": "ml"}


class TestMonitoredKimiStreaming:
    def test_stream_yields_all_chunks(self, kimi_client, mock_send):
        chunks = [MagicMock() for _ in range(3)]
        for c in chunks:
            c.usage = None
        kimi_client._client.chat.completions.create.return_value = iter(chunks)

        result = list(kimi_client.chat.completions.create(
            model="kimi-k3",
            messages=[{"role": "user", "content": "Hi"}],
            stream=True,
        ))

        assert len(result) == 3

    def test_stream_captures_usage_from_final_chunk(self, kimi_client, mock_send):
        chunk1 = MagicMock()
        chunk1.usage = None
        chunk2 = MagicMock()
        chunk2.usage.prompt_tokens = 120
        chunk2.usage.completion_tokens = 60
        kimi_client._client.chat.completions.create.return_value = iter([chunk1, chunk2])

        list(kimi_client.chat.completions.create(
            model="kimi-k3",
            messages=[{"role": "user", "content": "Hi"}],
            stream=True,
        ))

        mock_send.assert_called_once()
        metric = mock_send.call_args[0][1]
        assert metric["input_tokens"] == 120
        assert metric["output_tokens"] == 60
        assert metric["provider"] == "kimi"

    def test_stream_metric_sent_on_early_close(self, kimi_client, mock_send):
        kimi_client._client.chat.completions.create.return_value = iter([MagicMock(), MagicMock()])

        stream = kimi_client.chat.completions.create(
            model="kimi-k3",
            messages=[{"role": "user", "content": "Hi"}],
            stream=True,
        )

        for _ in stream:
            break
        stream.close()  # explicitly trigger finally block

        mock_send.assert_called_once()


class TestMonitoredKimiConstructor:
    def test_defaults_base_url_to_moonshot(self, mock_send):
        from llm_observatory.kimi import MonitoredKimi, MOONSHOT_BASE_URL

        with patch("openai.OpenAI") as mock_openai_cls:
            MonitoredKimi(api_key="sk-test-key-0000000000")
            _, kwargs = mock_openai_cls.call_args
            assert kwargs["base_url"] == MOONSHOT_BASE_URL == "https://api.moonshot.ai/v1"
