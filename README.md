# LLM Observatory

> Open-source observability dashboard for Claude API usage. Track tokens, cost & latency in real-time. Drop-in SDK wrapper with zero overhead.

![Node.js](https://img.shields.io/badge/Node.js-20-green?logo=node.js)
![React](https://img.shields.io/badge/React-18-blue?logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **SDK Wrapper** — Drop-in replacement for `@anthropic-ai/sdk`. Zero-change integration.
- **Real-time Dashboard** — Live updates via WebSocket. No page refresh needed.
- **Cost Tracking** — Per-request cost calculation with model-aware pricing.
- **Model Analysis** — Compare usage and cost across Claude models with smart recommendations.
- **Budget Alerts** — Set spending limits with visual progress bars and warning thresholds.
- **Export** — CSV export with applied filters.
- **Dark Mode** — Full dark/light theme toggle.

## Quick Start

### With Docker (recommended)

```bash
git clone https://github.com/your-username/llm-observatory
cd llm-observatory
cp .env.example .env
docker-compose up -d --build
```

Open http://localhost:80

### Manual Setup

**Prerequisites:** Node.js 20+, PostgreSQL 16

```bash
npm install
cp .env.example .env
# Edit .env with your DATABASE_URL
npm run dev
```

### Seed demo data

```bash
npm run seed
```

Generates 500+ realistic API call records with model distribution, latency variation, simulated peak hours, and occasional errors.

## SDK Integration

```javascript
const { MonitoredAnthropic } = require('@llm-observatory/sdk');

const client = new MonitoredAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  observatoryUrl: 'http://localhost:3001'  // your observatory instance
});

// Use exactly like the regular Anthropic SDK
const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

Metrics are sent **asynchronously** — zero latency overhead on your requests.

## Deploy to Railway

1. Fork this repo and push to GitHub
2. Create a new project at [railway.app](https://railway.app)
3. Add a **PostgreSQL** plugin — Railway injects `DATABASE_URL` automatically
4. Add two services from your repo:
   - **API** → Root Directory: `packages/api`
   - **Web** → Root Directory: `packages/web`, env var: `API_INTERNAL_URL=http://api.railway.internal:3001`
5. Enable **Private Networking** on the API service

## Architecture

```
Your App
  └─► MonitoredAnthropic (SDK wrapper)
          ├─► Claude API         (real request, awaited)
          └─► Observatory API    (async metric POST, fire & forget)
                    └─► PostgreSQL
                              └─► React Dashboard (WebSocket live updates)
```

## Project Structure

```
llm-observatory/
├── packages/
│   ├── sdk/          Node.js SDK wrapper
│   ├── api/          Express + Socket.io backend
│   └── web/          React + Vite frontend
├── docker-compose.yml
└── .env.example
```

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/metrics` | POST | Record an API call metric |
| `/api/metrics` | GET | List metrics (paginated) |
| `/api/metrics/summary` | GET | Aggregated stats + time series |
| `/api/metrics/export` | GET | CSV download |
| `/api/budgets` | GET | List budgets with current spend |
| `/api/budgets` | POST | Create budget |
| `/api/budgets/:id` | DELETE | Delete budget |

**Query params:** `range=24h|7d|30d`, `page`, `limit`, `model`, `sortBy`, `sortDir`

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, Tailwind CSS, Recharts |
| Backend | Node.js, Express, Socket.io, Zod |
| Database | PostgreSQL 16 |
| Realtime | Socket.io WebSocket |
| Infra | Docker Compose, Railway |

## Model Pricing

| Model | Input ($/1M) | Output ($/1M) |
|-------|-------------|--------------|
| claude-opus-4-6 | $15.00 | $75.00 |
| claude-sonnet-4-6 | $3.00 | $15.00 |
| claude-haiku-4-5 | $0.80 | $4.00 |
| claude-3-haiku | $0.25 | $1.25 |

## License

MIT
