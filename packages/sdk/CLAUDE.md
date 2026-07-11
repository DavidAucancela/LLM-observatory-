## `packages/sdk`

**Entry point:** `src/index.js` — published to npm as `@llm-observatory/sdk`

**Exports:**
- `MonitoredAnthropic` — Wraps `@anthropic-ai/sdk`, intercepts `messages.create()`
- `MonitoredOpenAI` — Wraps `openai` SDK (optional peer dep), intercepts `chat.completions.create()`
- `calculateCost()`, `calculateOpenAICost()` — Pricing helpers

**Pattern:** Proxy pattern. Intercepts API calls, records timing, calculates cost, returns response immediately, then fires async POST to `/api/metrics` with `Authorization: Bearer obs_sk_xxx`.

**Constructor options:**
```js
new MonitoredAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  observatoryUrl: 'http://localhost:3001',
  observatoryToken: 'obs_sk_...'   // Required for multi-tenant mode
})
```

**Pricing tables** in `src/index.js` (update when providers change prices; keep in sync with `packages/sdk-python/llm_observatory/_pricing.py`):
- Anthropic: claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5-20251001 (+ alias claude-haiku-4-5), claude-3-opus, claude-3-5-sonnet, claude-3-haiku
- OpenAI: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-4, gpt-3.5-turbo, o1, o1-mini, o3-mini

**`api_key_hint` in metrics:** Both wrappers compute `maskKey(apiKey)` in the constructor and include it as `api_key_hint` in every metric POST. This links each `api_calls` record to the credential that generated it.
