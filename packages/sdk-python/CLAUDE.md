## `packages/sdk-python`

**Entry point:** `llm_observatory/__init__.py` — published to PyPI as `llm-observatory`

**Exports:**
- `MonitoredAnthropic`, `AsyncMonitoredAnthropic` — Wraps `anthropic.Anthropic` / `anthropic.AsyncAnthropic`
- `MonitoredOpenAI`, `AsyncMonitoredOpenAI` — Wraps `openai.OpenAI` / `openai.AsyncOpenAI`
- `calculate_cost()`, `calculate_openai_cost()` — Pricing helpers
- `ANTHROPIC_PRICING`, `OPENAI_PRICING` — Pricing tables

**Install:**
```bash
pip install -e packages/sdk-python              # Anthropic only
pip install -e "packages/sdk-python[openai]"    # With OpenAI support
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
- `cache_read_tokens` / `cache_write_tokens` — from `usage.cache_read_input_tokens` / `usage.cache_creation_input_tokens`
- `error_type` — classified by `classify_error()`: `auth_error`, `rate_limit`, `invalid_request`, `network_error`, `timeout`, `server_error`, `unknown_error`
- `error_message` — raw exception message, truncated to 500 chars

**Key files:**
```
llm_observatory/
├── __init__.py      Exports
├── anthropic.py     MonitoredAnthropic + AsyncMonitoredAnthropic
├── openai.py        MonitoredOpenAI + AsyncMonitoredOpenAI
├── _utils.py        _post_metric(), send_metric_background(), classify_error(), mask_key()
└── _pricing.py      Pricing tables (keep in sync with Node.js SDK)
```

**Tests:**
```bash
cd packages/sdk-python
pytest tests/ -v
```
