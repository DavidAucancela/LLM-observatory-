# CLAUDE.md — LLM Observatory

## Project Overview

**LLM Observatory** is an open-source observability platform for monitoring Claude API (and OpenAI) usage in real-time. It provides cost tracking, latency monitoring, token analysis, budget alerts, Discord notifications, and data export with a WebSocket-driven dashboard.

**Monorepo with 3 packages:**
- `packages/sdk` — Drop-in Node.js wrapper for Anthropic/OpenAI SDKs
- `packages/api` — Express + PostgreSQL backend with Socket.io
- `packages/web` — React + Vite + Tailwind frontend dashboard

---

## Architecture

```
User Application
  └─► MonitoredAnthropic / MonitoredOpenAI  (SDK)
      ├─► Claude / OpenAI API               (real request, awaited)
      └─► Observatory API                   (async metric POST, fire & forget)
          ├─► PostgreSQL                    (persists metrics)
          ├─► Socket.io                     (broadcasts to clients)
          └─► React Dashboard               (WebSocket real-time updates)
```

**Key principle:** SDK sends metrics asynchronously — zero latency overhead on user API calls.

---

## Development Commands

```bash
# Root (runs api + web concurrently)
npm install
npm run dev
npm run seed      # Populate 600 demo records

# API only
cd packages/api
npm run dev       # nodemon
npm run migrate   # Run schema.sql
npm run seed

# Web only
cd packages/web
npm run dev       # Vite dev server on port 5173
npm run build

# Tests
npm test          # Runs tests in all workspaces
```

**Ports:**
- Web dev server: `5173` (proxies `/api` and `/socket.io` to API)
- API server: `3001`
- PostgreSQL: `5432`

---

## Environment Variables

File: `.env` (copy from `.env.example`)

```bash
POSTGRES_USER=postgres
POSTGRES_PASSWORD=changeme
POSTGRES_DB=llm_observatory
DATABASE_URL=postgresql://postgres:changeme@localhost:5432/llm_observatory
PORT=3001
NODE_ENV=development
ENCRYPTION_KEY=<32-byte hex>   # For AES-256-CBC encryption of stored API keys
```

Frontend build-time:
```bash
VITE_API_URL=http://localhost:3001   # Empty string for Docker (nginx proxy handles it)
```

Docker/Railway internal networking:
```bash
API_INTERNAL_URL=http://api.railway.internal:3001
```

---

## Package Details

### `packages/sdk`

**Entry point:** `src/index.js`

**Exports:**
- `MonitoredAnthropic` — Wraps `@anthropic-ai/sdk`, intercepts `messages.create()`
- `MonitoredOpenAI` — Wraps `openai` SDK (optional peer dep), intercepts `chat.completions.create()`
- `calculateCost()`, `calculateOpenAICost()` — Pricing helpers

**Pattern:** Proxy pattern. Intercepts API calls, records timing, calculates cost, returns response immediately, then fires async POST to `/api/metrics`.

**Pricing tables** in `src/index.js` (update when providers change prices):
- Anthropic: claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5-20251001, claude-3-opus, claude-3-5-sonnet, claude-3-haiku
- OpenAI: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-4, gpt-3.5-turbo, o1, o1-mini, o3-mini

### `packages/api`

**Entry point:** `src/index.js`

**Structure:**
```
src/
├── index.js          Express app, Socket.io setup, route registration
├── db/
│   ├── pool.js       PostgreSQL connection pool
│   ├── schema.sql    Table definitions + indexes
│   ├── migrate.js    Runs schema.sql
│   ├── seed.js       600 demo records
│   └── crypto.js     AES-256-CBC encrypt/decrypt for API keys
├── routes/
│   ├── metrics.js    POST/GET metrics, summary, export, projection
│   ├── budgets.js    Budget CRUD
│   ├── balances.js   Provider balance tracking
│   ├── credentials.js API key storage + testing
│   ├── alerts.js     Alert rules + Discord webhooks
│   └── sync.js       Historical data sync from provider APIs
└── jobs/
    └── alertChecker.js  Hourly cron: check spend → Discord alerts
```

**Database tables:**
- `api_calls` — All metric records (main table)
- `budgets` — Spending limits (daily/weekly/monthly)
- `provider_balances` — Balance recharge tracking
- `provider_credentials` — Encrypted API keys
- `alert_rules` — Discord alert configs with thresholds
- `alert_history` — Alert audit log
- `sync_logs` — Data sync history

**Time series logic:** `DATE_TRUNC('hour')` for ≤7d ranges, `DATE_TRUNC('day')` for >7d.

**Alert debounce:** 6 hours per rule to prevent spam.

**Encryption format:** `iv_hex:encrypted_hex` (AES-256-CBC with random IV).

### `packages/web`

**Entry point:** `src/main.jsx`

**Pages (react-router-dom v6):**
- `/` → `Dashboard.jsx` — KPIs, time series charts, provider breakdown, projections
- `/requests` → `Requests.jsx` — Paginated table, filtering, detail drawer, CSV export
- `/models` → `Models.jsx` — Model comparison, cost breakdown, efficiency metrics
- `/providers` → `Providers.jsx` — Provider balance tracking, recharge management
- `/budgets` → `Budgets.jsx` — Budget creation, progress bars, warnings
- `/settings` → `Settings.jsx` — Credentials, API key testing, alert rules

**Key components:**
- `Sidebar.jsx` — Navigation + dark mode toggle
- `KPICard.jsx` — Reusable metric card
- `ProviderBadge.jsx` — Anthropic/OpenAI badge
- `RequestDrawer.jsx` — Detail view for individual API calls
- `hooks/useSocket.js` — Socket.io connection and event listeners

**Real-time pattern:** `useSocket` hook listens for `new-metric` event → triggers summary refetch.

**Styling:** Tailwind CSS with custom brand colors (see `tailwind.config.js`). Dark mode via Tailwind `class` strategy.

---

## API Routes Reference

| Route | Method | Description |
|-------|--------|-------------|
| `/api/metrics` | POST | Record metric from SDK |
| `/api/metrics` | GET | List (paginated + filtered) |
| `/api/metrics/summary` | GET | Aggregated stats + time series |
| `/api/metrics/projection` | GET | Monthly spend projection |
| `/api/metrics/export` | GET | CSV download |
| `/api/metrics/:id` | GET | Single metric detail |
| `/api/budgets` | GET/POST | List/create budgets |
| `/api/budgets/:id` | DELETE | Delete budget |
| `/api/balances` | GET/POST | Balance tracking |
| `/api/balances/:id` | DELETE | Remove balance record |
| `/api/credentials` | GET/POST | Credential management |
| `/api/credentials/:provider/test` | POST | Test API key validity |
| `/api/credentials/:provider/key` | GET | Decrypt key (internal) |
| `/api/credentials/:provider` | DELETE | Remove credential |
| `/api/credentials/openai/balance` | GET | Fetch OpenAI usage |
| `/api/alerts/rules` | GET/POST | Alert rule management |
| `/api/alerts/rules/:id` | PUT/DELETE | Update/delete rule |
| `/api/alerts/history` | GET | Alert audit log |
| `/api/alerts/rules/:id/test` | POST | Send test Discord alert |
| `/api/sync/:provider` | POST | Start historical sync |
| `/api/sync/logs` | GET | Sync history |
| `/api/sync/status` | GET | Latest sync status |
| `/health` | GET | Health check |

**Query params for GET /api/metrics:** `page`, `limit`, `range` (24h|7d|30d|60d|90d|custom), `sortBy`, `sortDir`, `model`, `provider`, `start`, `end`

---

## Docker Setup

```bash
docker-compose up -d --build
# API at http://localhost:3001
# Web at http://localhost:80
```

Services: `postgres:16`, `api` (Node 20 Alpine), `web` (Nginx with multi-stage build).

The web Dockerfile uses `entrypoint.sh` for runtime environment variable substitution in nginx config.

---

## Deploy to Railway

1. Fork repo → push to GitHub
2. New Railway project → Add PostgreSQL plugin (auto-injects `DATABASE_URL`)
3. Two services:
   - **API** → Root: `packages/api`
   - **Web** → Root: `packages/web`, set `API_INTERNAL_URL=http://api.railway.internal:3001`
4. Enable Private Networking on API service

---

## Important Patterns & Conventions

- **Fire-and-forget metrics:** SDK never awaits metric POSTs. Always keep it that way to preserve zero-latency guarantee.
- **SQL parameterization:** All DB queries use `$1, $2, ...` params. Never interpolate user input into SQL strings.
- **Zod validation:** All POST body inputs validated with Zod schemas in route files.
- **Async DB ops:** All database operations use async/await with the pg pool.
- **Socket.io broadcast:** After inserting a metric, always `io.emit('new-metric', metric)` so dashboards update in real-time.
- **Time zone:** All timestamps stored as `TIMESTAMPTZ`. Always use timezone-aware comparisons.
- **Cost precision:** Use `DECIMAL(10,6)` for costs. Don't round until display layer.
- **Encryption key:** Default key exists in code but should always be overridden via `ENCRYPTION_KEY` env var in production.

---

## Testing

```bash
cd packages/sdk
npm test    # Runs src/__tests__/wrapper.test.js via Node.js built-in test runner
```

Tests cover SDK wrapper behavior. API has no automated tests currently — manual testing via curl or the dashboard.

---

## Known Limitations / Production Considerations

- No authentication on API endpoints (assumes trusted network)
- No rate limiting on metrics ingestion
- HTTPS not enforced in code (delegate to reverse proxy)
- CORS allows all origins (`*`)
- Alert debounce is 6h — cannot be configured per rule
- Sync feature requires admin-level API keys from providers
