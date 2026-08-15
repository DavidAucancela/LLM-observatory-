## `packages/sdk-python`

**Entry point:** `llm_observatory/__init__.py` — published to PyPI as `llm-observatory`

**Exports:**
- `MonitoredAnthropic`, `AsyncMonitoredAnthropic` — Wraps `anthropic.Anthropic` / `anthropic.AsyncAnthropic`
- `MonitoredOpenAI`, `AsyncMonitoredOpenAI` — Wraps `openai.OpenAI` / `openai.AsyncOpenAI`
- `MonitoredGrok`, `AsyncMonitoredGrok` — xAI's Grok. Also wraps `openai.OpenAI` / `openai.AsyncOpenAI` (Grok's API is OpenAI-compatible), pinned to `base_url="https://api.x.ai/v1"`
- `MonitoredKimi`, `AsyncMonitoredKimi` — Moonshot AI's Kimi. Same pattern, `base_url="https://api.moonshot.ai/v1"`
- `calculate_cost()`, `calculate_openai_cost()`, `calculate_grok_cost()`, `calculate_kimi_cost()` — Pricing helpers
- `ANTHROPIC_PRICING`, `OPENAI_PRICING`, `GROK_PRICING`, `KIMI_PRICING` — Pricing tables

No Gemini wrapper exists yet in this package (Node SDK only).

**Install:**
```bash
pip install -e packages/sdk-python              # Anthropic only
pip install -e "packages/sdk-python[openai]"    # With OpenAI support
pip install -e "packages/sdk-python[grok]"      # With Grok support (installs openai — same underlying package)
pip install -e "packages/sdk-python[kimi]"      # With Kimi support (installs openai — same underlying package)
```

**Constructor options (all 4 classes share the same signature):**
```python
MonitoredAnthropic(
    api_key="sk-ant-...",           # Optional — falls back to ANTHROPIC_API_KEY env var
    observatory_url="http://localhost:3001",
    observatory_token="obs_sk_...", # Required for multi-tenant mode
    tags={"env": "prod"},           # Optional key-value metadata
    # Any other kwargs forwarded to anthropic.Anthropic()
)
```

**Fire-and-forget mechanism:**
- Sync classes: spawn daemon thread (`threading.Thread(daemon=True)`)
- Async classes: `loop.run_in_executor(None, ...)` — never blocks the event loop
- Both: 1 retry after 1s on failure, 5s timeout per attempt

**Metric payload:** same shape as Node.js SDK, including:
- `cache_read_tokens` / `cache_write_tokens` — from `usage.cache_read_input_tokens` / `usage.cache_creation_input_tokens`. Anthropic only — unlike the Node SDK, `openai.py` (and `grok.py`/`kimi.py`, which mirror it) don't populate these fields at all here yet.
- `error_type` — classified by `classify_error()`: `auth_error`, `rate_limit`, `invalid_request`, `network_error`, `timeout`, `server_error`, `unknown_error`
- `error_message` — raw exception message, truncated to 500 chars

**Key files:**
```
llm_observatory/
├── __init__.py      Exports
├── anthropic.py     MonitoredAnthropic + AsyncMonitoredAnthropic
├── openai.py        MonitoredOpenAI + AsyncMonitoredOpenAI. Also exports module-level
│                    _accumulate_stream_delta()/_finalize_stream_response() — generic
│                    OpenAI-chunk stream-accumulation helpers reused (imported directly)
│                    by grok.py and kimi.py rather than duplicated.
├── grok.py          MonitoredGrok + AsyncMonitoredGrok — same structure as openai.py,
│                    provider='grok', calculate_grok_cost, base_url=api.x.ai/v1,
│                    falls back to XAI_API_KEY env var
├── kimi.py          MonitoredKimi + AsyncMonitoredKimi — same structure as openai.py,
│                    provider='kimi', calculate_kimi_cost, base_url=api.moonshot.ai/v1,
│                    falls back to MOONSHOT_API_KEY env var
├── _utils.py        _post_metric(), send_metric_background(), classify_error(), mask_key()
└── _pricing.py      Pricing tables (keep in sync with Node.js SDK)
```

**Grok/Kimi implementation note:** both providers expose an OpenAI-shaped `chat.completions` API, so `grok.py`/`kimi.py` construct a real `openai.OpenAI`/`openai.AsyncOpenAI` client pointed at the provider's `base_url` rather than talking to the provider directly — same approach as the Node SDK. Neither file duplicates the streaming/tool-call-accumulation logic; both import `_accumulate_stream_delta`/`_finalize_stream_response` straight from `openai.py`. No admin-key historical sync or Costs-API reconciliation for either provider (see `packages/sdk/CLAUDE.md` — neither xAI's nor Moonshot's API exposes an org-level usage/billing endpoint).

**Tests:**
```bash
cd packages/sdk-python
pytest tests/ -v
```
