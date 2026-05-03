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

Email (Resend) y URLs públicas:
```bash
RESEND_API_KEY=<resend api key>
EMAIL_FROM=noreply@tudominio.com
APP_URL=http://localhost:5173   # URL pública del frontend — usada en links de email (activación y reset)
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

**`api_key_hint` in metrics:** Both `MonitoredAnthropic` and `MonitoredOpenAI` compute `maskKey(apiKey)` in the constructor and include it as `api_key_hint` in every metric POST. This links each `api_calls` record to the credential that generated it.

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
- `api_calls` — All metric records. Key columns: `api_key_hint` (links to credential), `prompt_preview` (`sync:provider` for admin sync imports, `test:sdk_integration` for SDK ping tests)
- `budgets` — Spending limits (daily/weekly/monthly)
- `provider_balances` — Balance recharge tracking
- `provider_credentials` — Encrypted API keys (`key_type`: `sdk` | `admin`)
- `alert_rules` — Discord alert configs with thresholds
- `alert_history` — Alert audit log
- `sync_logs` — Data sync history

**Data integrity — cascade delete:** `DELETE /api/credentials/:id` automatically deletes all `api_calls` where `api_key_hint = key_hint`. Admin key deletions also remove `sync:provider` records.

**Orphan cleanup on startup:** `index.js` deletes `test:sdk_integration` records for providers with no credentials, and `sync:*` records for providers with no admin key.

**Time series logic:** `DATE_TRUNC('hour')` for ≤7d ranges, `DATE_TRUNC('day')` for >7d.

**Alert debounce:** 6 hours per rule to prevent spam.

**Encryption format:** `iv_hex:encrypted_hex` (AES-256-CBC with random IV).

### `packages/web`

**Entry point:** `src/main.jsx`

**Pages (react-router-dom v6) — 4 páginas con tabs:**
- `/` → `Dashboard.jsx` — KPI strip con sparklines, MultiLineChart tokens over time, provider breakdown, proyección mensual
- `/activity` → `Activity.jsx` — Tab **Requests** (tabla paginada, filtros, drawer, CSV export) + Tab **Models** (HBar chart, tabla comparativa)
- `/finance` → `Finance.jsx` — Tab **Balances** (saldo por provider, historial recargas) + Tab **Budgets** (límites de gasto con progress bars)
- `/settings` → `Settings.jsx` — Tab **Keys** (SDK + Admin keys) + Tab **Sync** (historial sync por provider) + Tab **Alerts** (reglas Discord)

**Redirects legacy:** `/requests` → `/activity`, `/models` → `/activity?tab=models`, `/providers` → `/finance`, `/budgets` → `/finance?tab=budgets`

**Páginas que ya no están en rutas** (archivos existen pero sin ruta): `Requests.jsx`, `Models.jsx`, `Providers.jsx`, `Budgets.jsx`

**Key components:**
- `Sidebar.jsx` — 220px fijo, 4 nav items, indicador borde izquierdo, provider status con dots pulsantes, sin collapse
- `ProviderBadge.jsx` — dot cuadrado amber/green. Props: `provider` (lowercase), `size` (`sm`|`lg`)
- `RequestDrawer.jsx` — Panel derecho con metadata, token breakdown, prompt preview
- `Sparkline.jsx` — SVG sparkline inline (sin Recharts)
- `MultiLineChart.jsx` — SVG multi-línea con gridlines y tick labels
- `HBar.jsx` — Barra horizontal: label | barra | valor
- `hooks/useSocket.js` — Socket.io connection and event listeners

**Real-time pattern:** `useSocket` hook listens for `new-metric` event → triggers summary refetch.

**Sistema de diseño:** CSS custom properties en `index.css` — NO usar clase `dark` de Tailwind. Usar `.theme-light` / `.theme-dark` en el div raíz. Variables: `--page`, `--surface`, `--border`, `--text`, `--muted`, `--accent`, `--anthropic`, `--openai`. Fuentes: Inter (sans) + JetBrains Mono (mono via `var(--font-mono)`).

**Layout obligatorio por página:**
```jsx
<main className="obs-main">
  <div className="obs-header">...</div>   // 56px
  <div className="obs-content">...</div>  // flex:1, scroll interno
</main>
```

**Tabs dentro de página:**
```jsx
<div className="obs-tabbar">
  <button className={`obs-tab${tab==='x'?' active':''}`} onClick={()=>setTab('x')}>X</button>
</div>
```

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
| `/api/credentials/:id/test` | POST | Validate key against provider API |
| `/api/credentials/:id/ping` | POST | Idempotent SDK test metric (replaces previous) |
| `/api/credentials/:id` | DELETE | Remove credential + cascade delete its api_calls |
| `/api/credentials/openai/balance` | GET | Fetch OpenAI usage |
| `/api/alerts/rules` | GET/POST | Alert rule management |
| `/api/alerts/rules/:id` | PUT/DELETE | Update/delete rule |
| `/api/alerts/history` | GET | Alert audit log |
| `/api/alerts/rules/:id/test` | POST | Send test Discord alert |
| `/api/sync/:provider` | POST | Start historical sync (requires admin key) |
| `/api/sync/:provider/data` | DELETE | Delete ALL api_calls for provider (sync + SDK) |
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
- **api_key_hint linkage:** Every metric must carry `api_key_hint` (set by SDK). Never remove this field — it's the only link between `api_calls` and `provider_credentials`.
- **Dashboard Sync button:** Only calls `fetchAll()` (local DB refresh). Never call `POST /api/sync/:provider` from the dashboard header — that requires an admin key and belongs in Settings → Sync tab only.
- **Dashboard provider filter:** Dashboard reads configured providers from `/api/credentials` and filters projection/chart series to only show those providers. Don't hardcode `['anthropic', 'openai']` in UI loops.
- **Dark mode:** Use `theme-light` / `theme-dark` CSS classes (CSS custom properties), NOT Tailwind's `dark` class strategy. The App.jsx shell applies `className={darkMode ? 'theme-dark' : 'theme-light'}` on the root div.
- **New page pattern:** Every new page must render `<main className="obs-main">` with `obs-header` + `obs-content` children. Use `obs-tabbar` + `obs-tab` for sub-navigation within a page.
- **CSS classes:** Use `.obs-btn`, `.obs-btn-primary`, `.obs-table`, `.obs-section-label`, `.obs-field`, `.obs-input`, `.obs-select`, `.kchip`, `.vbadge`, `.tsw`, `.iprog-bar/.iprog-fill`, `.dot/.dot-pulse` from `index.css`. Do not create new Tailwind utility classes for these patterns.

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
