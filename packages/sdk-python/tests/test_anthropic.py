import pytest
from unittest.mock import MagicMock, patch


def _make_response(input_tokens=100, output_tokens=50):
    response = MagicMock()
    response.usage.input_tokens = input_tokens
    response.usage.output_tokens = output_tokens
    return response


# Patch at point-of-use: anthropic.py has its own bound reference to send_metric_background
@pytest.fixture()
def mock_send():
    with patch("llm_observatory.anthropic.send_metric_background") as m:
        yield m


@pytest.fixture()
def mock_anthropic_sdk():
    with patch("llm_observatory.anthropic._anthropic.Anthropic") as m:
        yield m


class TestMonitoredAnthropicNonStreaming:
    def test_returns_response(self, mock_anthropic_sdk, mock_send):
        mock_anthropic_sdk.return_value.messages.create.return_value = _make_response()

        from llm_observatory import MonitoredAnthropic
        client = MonitoredAnthropic(api_key="sk-ant-test1234567890", observatory_url="http://obs:3001")
        result = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=100,
            messages=[{"role": "user", "content": "Hello"}],
        )

        assert result is not None

    def test_sends_metric_with_correct_tokens(self, mock_anthropic_sdk, mock_send):
        mock_anthropic_sdk.return_value.messages.create.return_value = _make_response(100, 50)

        from llm_observatory import MonitoredAnthropic
        client = MonitoredAnthropic(api_key="sk-ant-test1234567890", observatory_url="http://obs:3001")
        client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=100,
            messages=[{"role": "user", "content": "Hello"}],
        )

        mock_send.assert_called_once()
        metric = mock_send.call_args[0][1]
        assert metric["input_tokens"] == 100
        assert metric["output_tokens"] == 50
        assert metric["total_tokens"] == 150
        assert metric["status_code"] == 200

    def test_sends_correct_cost(self, mock_anthropic_sdk, mock_send):
        # 1M input + 1M output for sonnet = $18
        mock_anthropic_sdk.return_value.messages.create.return_value = _make_response(1_000_000, 1_000_000)

        from llm_observatory import MonitoredAnthropic
        client = MonitoredAnthropic(api_key="sk-ant-test1234567890", observatory_url="http://obs:3001")
        client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=100,
            messages=[{"role": "user", "content": "Hello"}],
        )

        metric = mock_send.call_args[0][1]
        assert metric["cost_usd"] == pytest.approx(18.0)

    def test_api_key_hint_masked(self, mock_anthropic_sdk, mock_send):
        mock_anthropic_sdk.return_value.messages.create.return_value = _make_response()

        from llm_observatory import MonitoredAnthropic
        client = MonitoredAnthropic(api_key="sk-ant-api03-ABCDEF1234", observatory_url="http://obs:3001")
        client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=10,
            messages=[{"role": "user", "content": "Hi"}],
        )

        metric = mock_send.call_args[0][1]
        assert metric["api_key_hint"] == "sk-ant-a…1234"

    def test_sends_metric_on_api_error(self, mock_anthropic_sdk, mock_send):
        import anthropic as _anthropic
        err = _anthropic.APIStatusError(
            "rate limited",
            response=MagicMock(status_code=429),
            body={},
        )
        mock_anthropic_sdk.return_value.messages.create.side_effect = err

        from llm_observatory import MonitoredAnthropic
        client = MonitoredAnthropic(api_key="sk-ant-test1234567890", observatory_url="http://obs:3001")

        with pytest.raises(_anthropic.APIStatusError):
            client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=10,
                messages=[{"role": "user", "content": "Hi"}],
            )

        mock_send.assert_called_once()
        metric = mock_send.call_args[0][1]
        assert metric["status_code"] == 429
        assert metric["cost_usd"] == 0.0

    def test_prompt_preview_truncated(self, mock_anthropic_sdk, mock_send):
        mock_anthropic_sdk.return_value.messages.create.return_value = _make_response()
        long_prompt = "A" * 500

        from llm_observatory import MonitoredAnthropic
        client = MonitoredAnthropic(api_key="sk-ant-test1234567890", observatory_url="http://obs:3001")
        client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=10,
            messages=[{"role": "user", "content": long_prompt}],
        )

        metric = mock_send.call_args[0][1]
        assert len(metric["prompt_preview"]) <= 200

    def test_tags_forwarded(self, mock_anthropic_sdk, mock_send):
        mock_anthropic_sdk.return_value.messages.create.return_value = _make_response()

        from llm_observatory import MonitoredAnthropic
        client = MonitoredAnthropic(
            api_key="sk-ant-test1234567890",
            observatory_url="http://obs:3001",
            tags={"env": "production", "feature": "summarizer"},
        )
        client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=10,
            messages=[{"role": "user", "content": "Hi"}],
        )

        metric = mock_send.call_args[0][1]
        assert metric["tags"] == {"env": "production", "feature": "summarizer"}

    def test_tools_names_captured(self, mock_anthropic_sdk, mock_send):
        mock_anthropic_sdk.return_value.messages.create.return_value = _make_response()

        from llm_observatory import MonitoredAnthropic
        client = MonitoredAnthropic(api_key="sk-ant-test1234567890", observatory_url="http://obs:3001")
        client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=10,
            messages=[{"role": "user", "content": "Use tool"}],
            tools=[{"name": "get_weather"}, {"name": "search_web"}],
        )

        metric = mock_send.call_args[0][1]
        assert metric["tools_used"] == ["get_weather", "search_web"]


class TestMonitoredAnthropicStreaming:
    def test_stream_yields_all_events(self, mock_anthropic_sdk, mock_send):
        events = [MagicMock(), MagicMock(), MagicMock()]
        for e in events:
            e.usage = None
        mock_anthropic_sdk.return_value.messages.create.return_value = iter(events)

        from llm_observatory import MonitoredAnthropic
        client = MonitoredAnthropic(api_key="sk-ant-test1234567890", observatory_url="http://obs:3001")
        stream = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=100,
            messages=[{"role": "user", "content": "Hello"}],
            stream=True,
        )

        collected = list(stream)
        assert len(collected) == 3

    def test_stream_sends_metric_after_completion(self, mock_anthropic_sdk, mock_send):
        event1 = MagicMock()
        event1.usage = None
        event2 = MagicMock()
        event2.usage.input_tokens = 80
        event2.usage.output_tokens = 40
        mock_anthropic_sdk.return_value.messages.create.return_value = iter([event1, event2])

        from llm_observatory import MonitoredAnthropic
        client = MonitoredAnthropic(api_key="sk-ant-test1234567890", observatory_url="http://obs:3001")
        stream = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=100,
            messages=[{"role": "user", "content": "Hello"}],
            stream=True,
        )

        list(stream)  # consume fully

        mock_send.assert_called_once()
        metric = mock_send.call_args[0][1]
        assert metric["input_tokens"] == 80
        assert metric["output_tokens"] == 40

    def test_stream_metric_sent_on_early_close(self, mock_anthropic_sdk, mock_send):
        """Metric fires even when caller closes stream before exhaustion."""
        mock_anthropic_sdk.return_value.messages.create.return_value = iter([MagicMock(), MagicMock()])

        from llm_observatory import MonitoredAnthropic
        client = MonitoredAnthropic(api_key="sk-ant-test1234567890", observatory_url="http://obs:3001")
        stream = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=100,
            messages=[{"role": "user", "content": "Hello"}],
            stream=True,
        )

        for _ in stream:
            break
        stream.close()  # explicitly trigger the finally block

        mock_send.assert_called_once()
