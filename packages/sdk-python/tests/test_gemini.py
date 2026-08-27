import pytest
from unittest.mock import MagicMock, patch


def _make_response(prompt_tokens=100, candidates_tokens=50, cached_tokens=0, text="hi there"):
    response = MagicMock()
    response.usage_metadata.prompt_token_count = prompt_tokens
    response.usage_metadata.candidates_token_count = candidates_tokens
    response.usage_metadata.cached_content_token_count = cached_tokens
    response.text = text
    response.function_calls = []
    candidate = MagicMock()
    candidate.finish_reason = "STOP"
    response.candidates = [candidate]
    return response


@pytest.fixture()
def mock_send():
    with patch("llm_observatory.gemini.send_metric_background") as m:
        yield m


@pytest.fixture()
def gemini_client(mock_send):
    """Build a MonitoredGemini instance with a mocked underlying client."""
    from llm_observatory.gemini import MonitoredGemini, _GeminiModelsProxy

    instance = object.__new__(MonitoredGemini)
    instance._observatory_url = "http://obs:3001"
    instance._observatory_token = "obs_sk_test"
    instance._tags = {}
    instance._api_key_hint = "AIza…5678"
    instance._client = MagicMock()
    instance.models = _GeminiModelsProxy(instance)
    return instance


class TestMonitoredGeminiNonStreaming:
    def test_returns_response(self, gemini_client, mock_send):
        resp = _make_response()
        gemini_client._client.models.generate_content.return_value = resp

        result = gemini_client.models.generate_content(model="gemini-2.5-flash", contents="Hi")

        assert result is resp

    def test_sends_metric_with_correct_tokens_and_provider(self, gemini_client, mock_send):
        gemini_client._client.models.generate_content.return_value = _make_response(100, 50)

        gemini_client.models.generate_content(model="gemini-2.5-flash", contents="Hi")

        mock_send.assert_called_once()
        metric = mock_send.call_args[0][1]
        assert metric["input_tokens"] == 100
        assert metric["output_tokens"] == 50
        assert metric["total_tokens"] == 150
        assert metric["provider"] == "gemini"
        assert metric["status_code"] == 200

    def test_sends_correct_cost(self, gemini_client, mock_send):
        # 1M input + 1M output for gemini-2.5-flash = $2.80
        gemini_client._client.models.generate_content.return_value = _make_response(1_000_000, 1_000_000)

        gemini_client.models.generate_content(model="gemini-2.5-flash", contents="Hi")

        metric = mock_send.call_args[0][1]
        assert metric["cost_usd"] == pytest.approx(2.80)

    def test_truncates_prompt_preview_for_string_contents(self, gemini_client, mock_send):
        gemini_client._client.models.generate_content.return_value = _make_response()

        gemini_client.models.generate_content(model="gemini-2.5-flash", contents="X" * 500)

        metric = mock_send.call_args[0][1]
        assert len(metric["prompt_preview"]) <= 200

    def test_extracts_prompt_preview_from_content_list(self, gemini_client, mock_send):
        gemini_client._client.models.generate_content.return_value = _make_response()

        gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[{"role": "user", "parts": [{"text": "What is the weather?"}]}],
        )

        metric = mock_send.call_args[0][1]
        assert metric["prompt_preview"] == "What is the weather?"

    def test_extracts_tool_names_from_function_declarations(self, gemini_client, mock_send):
        gemini_client._client.models.generate_content.return_value = _make_response()
        config = MagicMock()
        config.system_instruction = None
        config.temperature = None
        config.max_output_tokens = None
        config.top_p = None
        tool = MagicMock()
        fd = MagicMock()
        fd.name = "controlLight"
        tool.function_declarations = [fd]
        config.tools = [tool]

        gemini_client.models.generate_content(model="gemini-2.5-flash", contents="Dim the lights", config=config)

        metric = mock_send.call_args[0][1]
        assert metric["tools_used"] == ["controlLight"]

    def test_captures_cache_read_tokens(self, gemini_client, mock_send):
        gemini_client._client.models.generate_content.return_value = _make_response(
            prompt_tokens=100, candidates_tokens=50, cached_tokens=40,
        )

        gemini_client.models.generate_content(model="gemini-2.5-flash", contents="Hi")

        metric = mock_send.call_args[0][1]
        assert metric["cache_read_tokens"] == 40
        assert metric["cache_write_tokens"] == 0

    def test_sends_metric_on_error(self, gemini_client, mock_send):
        err = Exception("rate limited")
        err.code = 429
        gemini_client._client.models.generate_content.side_effect = err

        with pytest.raises(Exception, match="rate limited"):
            gemini_client.models.generate_content(model="gemini-2.5-flash", contents="Hi")

        mock_send.assert_called_once()
        metric = mock_send.call_args[0][1]
        assert metric["status_code"] == 429
        assert metric["cost_usd"] == 0.0

    def test_tags_forwarded(self, mock_send):
        from llm_observatory.gemini import MonitoredGemini, _GeminiModelsProxy

        instance = object.__new__(MonitoredGemini)
        instance._observatory_url = "http://obs:3001"
        instance._observatory_token = "obs_sk_test"
        instance._tags = {"env": "staging", "team": "ml"}
        instance._api_key_hint = "AIza…5678"
        instance._client = MagicMock()
        instance._client.models.generate_content.return_value = _make_response()
        instance.models = _GeminiModelsProxy(instance)

        instance.models.generate_content(model="gemini-2.5-flash", contents="Hi")

        metric = mock_send.call_args[0][1]
        assert metric["tags"] == {"env": "staging", "team": "ml"}


class TestMonitoredGeminiStreaming:
    def test_stream_yields_all_chunks(self, gemini_client, mock_send):
        def make_chunk(text):
            c = MagicMock()
            c.text = text
            c.usage_metadata = None
            c.function_calls = None
            c.candidates = []
            return c

        chunks = [make_chunk("Hello"), make_chunk(" world")]
        gemini_client._client.models.generate_content_stream.return_value = iter(chunks)

        result = list(gemini_client.models.generate_content_stream(model="gemini-2.5-flash", contents="Hi"))

        assert len(result) == 2

    def test_stream_captures_cumulative_usage_from_last_chunk(self, gemini_client, mock_send):
        chunk1 = MagicMock()
        chunk1.text = "Hel"
        chunk1.usage_metadata = None
        chunk1.function_calls = None
        chunk1.candidates = []

        chunk2 = MagicMock()
        chunk2.text = "lo"
        chunk2.usage_metadata.prompt_token_count = 120
        chunk2.usage_metadata.candidates_token_count = 60
        chunk2.usage_metadata.cached_content_token_count = 0
        chunk2.function_calls = None
        candidate = MagicMock()
        candidate.finish_reason = "STOP"
        chunk2.candidates = [candidate]

        gemini_client._client.models.generate_content_stream.return_value = iter([chunk1, chunk2])

        list(gemini_client.models.generate_content_stream(model="gemini-2.5-flash", contents="Hi"))

        mock_send.assert_called_once()
        metric = mock_send.call_args[0][1]
        assert metric["input_tokens"] == 120
        assert metric["output_tokens"] == 60
        assert metric["provider"] == "gemini"
        assert metric["response_full"] == "Hello"

    def test_stream_metric_sent_on_early_close(self, gemini_client, mock_send):
        def make_chunk():
            c = MagicMock()
            c.text = "x"
            c.usage_metadata = None
            c.function_calls = None
            c.candidates = []
            return c

        gemini_client._client.models.generate_content_stream.return_value = iter([make_chunk(), make_chunk()])

        stream = gemini_client.models.generate_content_stream(model="gemini-2.5-flash", contents="Hi")

        for _ in stream:
            break
        stream.close()  # explicitly trigger finally block

        mock_send.assert_called_once()


class TestMonitoredGeminiConstructor:
    def test_api_key_falls_back_to_gemini_then_google_env_var(self, monkeypatch, mock_send):
        from llm_observatory.gemini import MonitoredGemini

        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        monkeypatch.setenv("GOOGLE_API_KEY", "google-fallback-key-000000")

        with patch("google.genai.Client") as mock_client_cls:
            MonitoredGemini()
            _, kwargs = mock_client_cls.call_args
            assert kwargs["api_key"] == "google-fallback-key-000000"

        monkeypatch.setenv("GEMINI_API_KEY", "gemini-primary-key-00000000")
        with patch("google.genai.Client") as mock_client_cls:
            MonitoredGemini()
            _, kwargs = mock_client_cls.call_args
            assert kwargs["api_key"] == "gemini-primary-key-00000000"

    def test_raises_clear_import_error_without_google_genai(self, mock_send):
        from llm_observatory.gemini import MonitoredGemini

        with patch.dict("sys.modules", {"google": None, "google.genai": None}):
            with pytest.raises(ImportError, match=r"llm-observatory\[gemini\]"):
                MonitoredGemini(api_key="test-key-000000000000")
