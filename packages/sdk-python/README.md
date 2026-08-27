# LLM Observatory — Python SDK

Drop-in observability wrapper for Anthropic and OpenAI Python SDKs. Two lines changed, zero performance overhead.

## Installation

```bash
pip install llm-observatory

# With OpenAI support
pip install "llm-observatory[openai]"

# With Gemini support
pip install "llm-observatory[gemini]"
```

> If the package is not yet available on PyPI, install directly from GitHub:
> ```bash
> pip install "git+https://github.com/DavidAucancela/llm-observatory.git#subdirectory=packages/sdk-python"
> # With OpenAI support:
> pip install "llm-observatory[openai] @ git+https://github.com/DavidAucancela/llm-observatory.git#subdirectory=packages/sdk-python"
> ```

## Quick start

### Anthropic

```python
# Before
from anthropic import Anthropic
client = Anthropic()

# After — only these two lines change
from llm_observatory import MonitoredAnthropic
client = MonitoredAnthropic(
    observatory_url="https://your-observatory.railway.app"
)

# Everything else stays identical
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.content[0].text)
```

### OpenAI

```python
# Before
from openai import OpenAI
client = OpenAI()

# After
from llm_observatory import MonitoredOpenAI
client = MonitoredOpenAI(
    observatory_url="https://your-observatory.railway.app"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)
```

### Gemini

```python
# Before
from google import genai
client = genai.Client()

# After
from llm_observatory import MonitoredGemini
client = MonitoredGemini(
    observatory_url="https://your-observatory.railway.app"
)

response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="Hello!",
)
print(response.text)
```

## Streaming

Works exactly the same — the metric is sent after the last chunk:

```python
stream = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Write me a poem"}],
    stream=True,
)
for event in stream:
    if hasattr(event, "delta") and hasattr(event.delta, "text"):
        print(event.delta.text, end="", flush=True)
```

## Tags

Tag your calls to filter and group metrics in the dashboard:

```python
client = MonitoredAnthropic(
    observatory_url="https://your-observatory.railway.app",
    tags={
        "env": "production",
        "feature": "document-summarizer",
        "team": "ml-platform",
    }
)
```

## Async

```python
import asyncio
from llm_observatory import AsyncMonitoredAnthropic

async def main():
    client = AsyncMonitoredAnthropic(
        observatory_url="https://your-observatory.railway.app"
    )
    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        messages=[{"role": "user", "content": "Hello async!"}]
    )
    print(response.content[0].text)

asyncio.run(main())
```

## How it works

The wrapper intercepts each API call, records timing, calculates cost, and returns the response immediately. The metric POST to Observatory runs in a background daemon thread — your code never waits for it.

```
your code
  └─► MonitoredAnthropic.messages.create()
      ├─► claude API          (awaited — you get the response)
      └─► Observatory POST    (daemon thread — fire & forget)
```

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `api_key` | `ANTHROPIC_API_KEY` env | Your provider API key |
| `observatory_url` | `http://localhost:3001` | URL of your Observatory instance |
| `tags` | `{}` | Key-value tags attached to every metric |

All other keyword arguments are forwarded to the underlying SDK constructor.

## Running tests

```bash
cd packages/sdk-python
PYTHONPATH=. python3 -m pytest tests/ -v
```
