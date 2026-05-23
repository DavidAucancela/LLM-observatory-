# LLM Observatory

> Multi-tenant SaaS observability platform for Claude API (and OpenAI) usage. Track tokens, cost & latency in real-time with a drop-in SDK wrapper that adds zero overhead to your requests.

![Node.js](https://img.shields.io/badge/Node.js-20-green?logo=node.js)
![React](https://img.shields.io/badge/React-18-blue?logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **Drop-in SDK Wrapper** — Replace `new Anthropic()` with `new MonitoredAnthropic()`. Zero code changes elsewhere.
- **Multi-tenant** — Each organization gets isolated data, team members, and Observatory tokens. Self-registration creates an org automatically.
- **Real-time Dashboard** — Live metric updates via WebSocket. No page refresh required.
- **Cost Tracking** — Per-request cost calculation using model-aware pricing tables for Anthropic and OpenAI.
- **Monthly Projections** — Forecast end-of-month spend per provider based on current usage trends.
- **Model Analysis** — Compare cost, latency, and token usage across all models.
- **Budget Management** — Set daily, weekly, or monthly spending limits with visual progress bars.
- **Discord Alerts** — Hourly automated checks against configurable alert rules with webhook notifications.
- **Provider Sync** — Pull historical usage data from Anthropic Admin API or OpenAI Organization API.
- **Balance Tracking** — Record and visualize provider balance recharges.
- **CSV Export** — Download filtered request logs with all metrics included.
- **Team Management** — Invite teammates by email, manage roles (admin/member), cancel invitations.
- **Observatory Tokens** — `obs_sk_` tokens authenticate SDK metric ingestion and link calls to your org.
- **Authentication** — Self-registration with email activation, password reset, and JWT sessions.
- **Dark Mode** — Full dark/light theme toggle.
- **OpenAI Support** — Full parity with `MonitoredOpenAI` wrapper for multi-provider monitoring.

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/DavidAucancela/LLM-observatory-
cd llm-observatory
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with the required values:

```bash
DATABASE_URL=postgresql://postgres:changeme@localhost:5432/llm_observatory

# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=<32-byte hex>

# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=<64-byte hex>

# Email (Resend) — required for account activation and invitations
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
APP_URL=http://localhost:5173
```

### 3. Start with Docker (recommended)

```bash
docker-compose up -d --build
```

Open http://localhost — you'll be redirected to the register page to create your first account and organization.

### 4. Manual setup

**Requirements:** Node.js 20+, PostgreSQL 16

```bash
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:3001

---

## SDK Integration

### 1. Create an Observatory token

In the dashboard → Settings → Team tab → Observatory Tokens → **New token**.

Copy the full `obs_sk_...` value — it's shown only once.

### 2. Use the SDK

**Anthropic:**

```javascript
const { MonitoredAnthropic } = require('@llm-observatory/sdk');

const client = new MonitoredAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  observatoryUrl: 'http://localhost:3001',
  observatoryToken: process.env.OBSERVATORY_TOKEN  // obs_sk_...
});

// Use exactly like the official Anthropic SDK
const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

**OpenAI:**

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

Metrics are sent **asynchronously** — your API call returns immediately with zero latency overhead.

---

## Multi-tenancy

Each organization is fully isolated:

- All data (metrics, budgets, credentials, alerts) is scoped to `org_id`.
- Tenants never see each other's data — enforced at the database query level.
- Observatory tokens (`obs_sk_xxx`) are how the SDK identifies which org a metric belongs to. Store them in your app's environment variables.
- Team members are managed per-org. Admins can invite by email, manage roles, and revoke tokens.

**Registration flow:**
1. User registers at `/register` (email + optional org name + password).
2. Email activation link is sent (or check server terminal in development).
3. On first login the user lands in their org's dashboard.
4. Admin invites teammates via Settings → Team → Invite.
5. Invited user receives email → opens `/accept-invite?token=xxx` → sets password → joins org.

---

## Credential system

Settings manages two types of keys:

### SDK Keys
Keys your projects use with `MonitoredAnthropic` / `MonitoredOpenAI` to register metrics.

- Anthropic SDK Key: starts with `sk-ant-api03-`
- OpenAI SDK Key: starts with `sk-proj-`

### Admin Keys
Keys with elevated permissions needed for the **history sync** feature. Not the same as SDK keys.

- **Anthropic Admin Key**: generate at [console.anthropic.com](https://console.anthropic.com) → Settings → Admin Keys. Requires admin role in the Anthropic org. Starts with `sk-ant-admin-`
- **OpenAI Organization Key**: key with organization permissions to read usage via `/v1/organization/usage`

All keys are stored encrypted with AES-256-CBC. They are never shown in full in the UI.

---

## Architecture

```
User Application
  └─► MonitoredAnthropic / MonitoredOpenAI   (SDK)
      │   Authorization: Bearer obs_sk_xxx    ← org identity
      ├─► Claude / OpenAI API                (real request, awaited)
      └─► Observatory API                    (async metric POST, fire & forget)
          ├─► org_id resolution              (token hash → org)
          ├─► PostgreSQL                     (persists all metrics, scoped by org_id)
          ├─► Socket.io                      (broadcasts to connected dashboards)
          └─► React Dashboard                (WebSocket real-time updates)
```

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, Tailwind CSS 3, Socket.io Client |
| Backend | Node.js 20, Express 4, Socket.io 4, Zod, node-cron, bcrypt, jsonwebtoken |
| Database | PostgreSQL 16 — shared schema multi-tenancy with org_id scoping |
| Real-time | Socket.io WebSocket (auto-reconnect) |
| Auth | JWT (7d expiry) + bcrypt (cost 12) + Observatory tokens (SHA-256 hashed) |
| Email | Resend (account activation, password reset, team invitations) |
| Encryption | AES-256-CBC for stored provider API keys |
| Deployment | Docker Compose, Railway |

---


## License

MIT
