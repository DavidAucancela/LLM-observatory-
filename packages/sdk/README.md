# @llm-observatory/sdk

Drop-in Node.js wrapper for the Anthropic and OpenAI SDKs that streams usage metrics to your [LLM Observatory](https://github.com/DavidAucancela/llm-observatory) dashboard with **zero latency overhead**.

## How it works

The SDK wraps the official provider clients. Your API call returns immediately — metrics are sent to Observatory **asynchronously** (fire and forget) after the response arrives.

```
Your app ──► MonitoredAnthropic.messages.create()
               │
               ├──► Anthropic API        (awaited — your response)
               └──► Observatory API      (async, non-blocking)
```

## Installation

```bash
npm install @llm-observatory/sdk
# If using OpenAI:
npm install openai
```

## Usage

### Anthropic

```javascript
const { MonitoredAnthropic } = require('@llm-observatory/sdk');

const client = new MonitoredAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,       // your Anthropic API key
  observatoryUrl: 'http://localhost:3001',      // your Observatory API URL
  observatoryToken: process.env.OBSERVATORY_TOKEN  // obs_sk_... token from dashboard
});

// Use exactly like the official Anthropic SDK
const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

### OpenAI

```javascript
const { MonitoredOpenAI } = require('@llm-observatory/sdk');

const client = new MonitoredOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  observatoryUrl: 'http://localhost:3001',
  observatoryToken: process.env.OBSERVATORY_TOKEN
});

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

### Constructor options

| Option | Required | Description |
|--------|----------|-------------|
| `apiKey` | Yes | Your provider API key (Anthropic or OpenAI) |
| `observatoryUrl` | Yes | Base URL of your Observatory API (e.g. `http://localhost:3001`) |
| `observatoryToken` | Yes | `obs_sk_...` token created in Settings → Team → Observatory Tokens |

All other options are forwarded to the underlying provider SDK.

## Observatory token

Create a token in your Observatory dashboard:

**Settings → Team tab → Observatory Tokens → New token**

The full `obs_sk_...` value is shown **once** at creation. Store it as an environment variable in your application.

The token identifies which organization the metrics belong to. Each application/project can have its own token.

## Metrics recorded

Each API call records:

| Field | Description |
|-------|-------------|
| `model` | Model name |
| `provider` | `anthropic` or `openai` |
| `input_tokens` | Prompt tokens used |
| `output_tokens` | Completion tokens used |
| `cost_usd` | Estimated cost (USD) |
| `latency_ms` | End-to-end request latency |
| `status` | `success` or `error` |
| `prompt_preview` | First 200 chars of the user message |
| `api_key_hint` | Masked key (`sk-ant-…xxxx`) for credential linkage |

## Supported models

**Anthropic:** claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5-20251001, claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022, claude-3-opus-20240229, claude-3-haiku-20240307

**OpenAI:** gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-4, gpt-3.5-turbo, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, o1, o1-mini, o3, o3-mini

Unknown models are tracked with `cost_usd = 0` and a warning is logged.

## OpenAI extended support

`MonitoredOpenAI` also instruments:

- **Embeddings** — `client.embeddings.create()`
- **Transcription** — `client.audio.transcriptions.create()` (Whisper)
- **Text-to-speech** — `client.audio.speech.create()`

## License

MIT
