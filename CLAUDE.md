# CLAUDE.md — LLM Observatory

## Project Overview

**LLM Observatory** is a multi-tenant SaaS observability platform for monitoring Claude API (and OpenAI) usage in real-time. It provides cost tracking, latency monitoring, token analysis, budget alerts, Discord notifications, team management, and data export with a WebSocket-driven dashboard.

**Monorepo with 3 packages:**
- `packages/sdk` — Drop-in Node.js wrapper for Anthropic/OpenAI SDKs
- `packages/api` — Express + PostgreSQL backend with Socket.io
- `packages/web` — React + Vite + Tailwind frontend dashboard

---

## Architecture

```
User Application
  └─► MonitoredAnthropic / MonitoredOpenAI  (SDK)
      │   Authorization: Bearer obs_sk_xxx   ← Observatory token (org identity)
      ├─► Claude / OpenAI API               (real request, awaited)
      └─► Observatory API                   (async metric POST, fire & forget)
          ├─► org_id resolution             (token hash → org)
          ├─► PostgreSQL                    (persists metrics, scoped by org_id)
          ├─► Socket.io                     (broadcasts to clients)
          └─► React Dashboard               (WebSocket real-time updates)
```

**Key principles:**
- SDK sends metrics asynchronously — zero latency overhead on user API calls.
- Every metric is attributed to an organization via Observatory token (`obs_sk_`).
- All DB queries are scoped by `org_id` — tenants never see each other's data.

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
JWT_SECRET=<64-byte hex>       # For signing JWTs
```

Frontend build-time:
```bash
VITE_API_URL=http://localhost:3001   # Empty string for Docker (nginx proxy handles it)
```

Email (Resend) y URLs públicas:
```bash
RESEND_API_KEY=<resend api key>
EMAIL_FROM=noreply@tudominio.com
APP_URL=http://localhost:5173   # URL pública del frontend — usada en links de email
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

**Pattern:** Proxy pattern. Intercepts API calls, records timing, calculates cost, returns response immediately, then fires async POST to `/api/metrics` with `Authorization: Bearer obs_sk_xxx`.

**Constructor options:**
```js
new MonitoredAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  observatoryUrl: 'http://localhost:3001',
  observatoryToken: 'obs_sk_...'   // Required for multi-tenant mode
})
```

**Pricing tables** in `src/index.js` (update when providers change prices):
- Anthropic: claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5-20251001, claude-3-opus, claude-3-5-sonnet, claude-3-haiku
- OpenAI: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-4, gpt-3.5-turbo, o1, o1-mini, o3-mini

**`api_key_hint` in metrics:** Both wrappers compute `maskKey(apiKey)` in the constructor and include it as `api_key_hint` in every metric POST. This links each `api_calls` record to the credential that generated it.

### `packages/api`

**Entry point:** `src/index.js`

**Structure:**
```
src/
├── index.js            Express app, Socket.io setup, route registration, orphan cleanup
├── db/
│   ├── pool.js         PostgreSQL connection pool
│   ├── schema.sql      Table definitions + indexes + multi-tenancy backfill
│   ├── migrate.js      Runs schema.sql
│   ├── seed.js         600 demo records (org-scoped)
│   └── crypto.js       AES-256-CBC encrypt/decrypt for API keys
├── middleware/
│   └── auth.js         JWT + Observatory token resolution; requireAdmin guard
├── routes/
│   ├── auth.js         Login, register (creates org), invite flow, password reset
│   ├── metrics.js      POST/GET metrics, summary, export, projection (org-scoped)
│   ├── budgets.js      Budget CRUD (org-scoped)
│   ├── balances.js     Provider balance tracking (org-scoped)
│   ├── credentials.js  API key storage + testing (org-scoped)
│   ├── alerts.js       Alert rules + Discord webhooks (org-scoped)
│   ├── sync.js         Historical data sync from provider APIs (org-scoped)
│   ├── tokens.js       Observatory token CRUD (create/list/revoke)
│   └── team.js         Team member management + email invitations
├── services/
│   └── email.js        Resend integration: activation, password reset, invitations
└── jobs/
    └── alertChecker.js Hourly cron: check spend per org → Discord alerts
```

**Database tables:**

Multi-tenancy tables (new):
- `organizations` — Tenant orgs. Columns: `id`, `name`, `created_at`
- `org_members` — User ↔ org membership with role. Columns: `org_id`, `user_id`, `role` (`admin`|`member`), `joined_at`
- `invitations` — Email invitations with 7-day expiry tokens. Columns: `org_id`, `email`, `token`, `invited_by`, `expires_at`, `accepted_at`
- `observatory_tokens` — SDK auth tokens (hash stored, never plaintext). Columns: `org_id`, `name`, `token_hash`, `token_prefix`, `created_by`, `last_used_at`, `revoked_at`

Tenant-scoped tables (existing, all have `org_id`):
- `api_calls` — All metric records. Key columns: `org_id`, `api_key_hint` (links to credential), `prompt_preview` (`sync:provider` for sync imports, `test:sdk_integration` for ping tests)
- `budgets` — Spending limits (daily/weekly/monthly), `org_id`
- `provider_balances` — Balance recharge tracking, `org_id`
- `provider_credentials` — Encrypted API keys (`key_type`: `sdk` | `admin`), `org_id`
- `alert_rules` — Discord alert configs with thresholds, `org_id`
- `alert_history` — Alert audit log, `org_id`
- `sync_logs` — Data sync history, `org_id`

Auth tables:
- `users` — Accounts with bcrypt passwords. Columns: `email`, `password_hash`, `is_active`, `activation_token`, `reset_token`, `reset_token_expires`

**Auth middleware (`middleware/auth.js`):**
- Public paths: `GET /health`, `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/activate`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `GET /api/auth/invite-info`, `POST /api/auth/accept-invite`
- `POST /api/metrics`: requires `Authorization: Bearer obs_sk_xxx` (Observatory token)
- All other routes: require `Authorization: Bearer <jwt>`
- Observatory token path: SHA-256 hash lookup → sets `req.user = { orgId, isObservatoryToken: true }`
- JWT path: verifies signature → sets `req.user = { id, email, orgId, role }`
- `requireAdmin`: blocks observatory tokens; requires `req.user.role === 'admin'`

**Data integrity — cascade delete:** `DELETE /api/credentials/:id` automatically deletes all `api_calls` where `api_key_hint = key_hint`. Admin key deletions also remove `sync:provider` records. All constrained by `org_id`.

**Orphan cleanup on startup:** Deletes `test:sdk_integration` records for providers with no credentials (scoped to org), and `sync:*` records for providers with no admin key.

**Time series logic:** `DATE_TRUNC('hour')` for ≤7d ranges, `DATE_TRUNC('day')` for >7d.

**Alert debounce:** 6 hours per rule to prevent spam. Checker groups by `${org_id}:${metric}`.

**Encryption format:** `iv_hex:encrypted_hex` (AES-256-CBC with random IV).

**org_id in queries:** Every route uses `req.user.orgId` as the first param (`$1`) in all SQL queries. Dynamic filter params start at `$2` onwards.

### `packages/web`

**Entry point:** `src/main.jsx`

**Pages (react-router-dom v6):**
- `/` → `Dashboard.jsx` — KPI strip con sparklines, MultiLineChart tokens over time, provider breakdown, proyección mensual
- `/activity` → `Activity.jsx` — Tab **Requests** (tabla paginada, filtros, drawer, CSV export) + Tab **Models** (HBar chart, tabla comparativa)
- `/finance` → `Finance.jsx` — Tab **Balances** (saldo por provider, historial recargas) + Tab **Budgets** (límites de gasto con progress bars)
- `/settings` → `Settings.jsx` — Tab **Keys** (SDK + Admin keys) + Tab **Sync** (historial sync por provider) + Tab **Alerts** (reglas Discord) + Tab **Team** (members + invitations + Observatory tokens)

**Public pages (outside ProtectedRoute):**
- `/login` → `Login.jsx`
- `/register` → `Register.jsx` — email + optional org name + password
- `/forgot-password` → `ForgotPassword.jsx`
- `/reset-password` → `ResetPassword.jsx`
- `/accept-invite` → `AcceptInvite.jsx` — accept team invitation with token from URL

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

**Settings.jsx internal components:**
- `ObservatoryTokensSection` — Create/list/revoke `obs_sk_` tokens; shows full token once on creation with copy button
- `TeamTab` — Invite by email, list members with role badges, remove members, cancel pending invitations

**Auth context (`auth/AuthProvider.jsx`):**
- Stores `{ email, role, orgId, orgName }` from login and `/me` responses
- `useAuth()` exposes `user`, `token`, `isAuthenticated`, `isLoading`, `login`, `logout`

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

### Auth (public)
| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/auth/login` | POST | Public | Login → JWT |
| `/api/auth/register` | POST | Public | Register user + create org atomically |
| `/api/auth/me` | GET | JWT | Current session info |
| `/api/auth/activate` | GET | Public | Activate account with email token |
| `/api/auth/forgot-password` | POST | Public | Request password reset email |
| `/api/auth/reset-password` | POST | Public | Reset password with token |
| `/api/auth/invite-info` | GET | Public | Get invite details (`?token=`) |
| `/api/auth/accept-invite` | POST | Public | Accept invite, create/login account |

### Observatory tokens
| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/tokens` | GET | JWT | List org's Observatory tokens |
| `/api/tokens` | POST | JWT | Create token (returns full `obs_sk_` once) |
| `/api/tokens/:id` | DELETE | JWT | Revoke token |

### Team management
| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/team/members` | GET | JWT | List org members |
| `/api/team/members/:userId` | DELETE | JWT (admin) | Remove member |
| `/api/team/invitations` | GET | JWT | List pending invitations |
| `/api/team/invite` | POST | JWT (admin) | Send email invitation |
| `/api/team/invitations/:id` | DELETE | JWT (admin) | Cancel invitation |

### Metrics & data
| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/metrics` | POST | Observatory token | Record metric from SDK |
| `/api/metrics` | GET | JWT | List (paginated + filtered) |
| `/api/metrics/summary` | GET | JWT | Aggregated stats + time series |
| `/api/metrics/projection` | GET | JWT | Monthly spend projection |
| `/api/metrics/export` | GET | JWT | CSV download |
| `/api/metrics/:id` | GET | JWT | Single metric detail |

### Other resources (all JWT, all org-scoped)
| Route | Method | Description |
|-------|--------|-------------|
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
| `/api/sync/:provider/data` | DELETE | Delete ALL api_calls for provider |
| `/api/sync/logs` | GET | Sync history |
| `/api/sync/status` | GET | Latest sync status |
| `/health` | GET | Health check (public) |

**Query params for GET /api/metrics:** `page`, `limit`, `range` (24h|7d|30d|60d|90d|custom), `sortBy`, `sortDir`, `model`, `provider`, `start`, `end`

---

## Docker Setup

```bash
docker-compose up -d --build
# API at http://localhost:3001
# Web at http://localhost:80
```

Services: `postgres:16`, `api` (Node 20 Alpine), `web` (Nginx with multi-stage build).

The web Dockerfile uses `entrypoint.sh` for runtime environment variable substitution in nginx config. `entrypoint.sh` also reads the DNS resolver from `/etc/resolv.conf` at container start and injects it as `${RESOLVER}` into the nginx template — this allows nginx to re-resolve `api.railway.internal` dynamically on each request (IPv6 nameservers are wrapped in `[brackets]` automatically).

---

## Deploy to Railway

1. Fork repo → push to GitHub
2. New Railway project → Add PostgreSQL plugin (auto-injects `DATABASE_URL`)
3. Two services:
   - **API** → Root: `packages/api`
   - **Web** → Root: `packages/web`, set `API_INTERNAL_URL=http://<service-name>.railway.internal:3001`
4. Enable Private Networking on API service

> **Nota sobre `API_INTERNAL_URL`:** Railway genera el hostname interno a partir del nombre del servicio en el dashboard (ej. `llm-observatory.railway.internal`). El valor por defecto `api.railway.internal` solo funciona si el servicio se llama exactamente `api`. Verifica el nombre real en Railway → servicio API → Settings → Networking.

---

## Important Patterns & Conventions

- **Fire-and-forget metrics:** SDK never awaits metric POSTs. Always keep it that way to preserve zero-latency guarantee.
- **Observatory token required:** `POST /api/metrics` requires `Authorization: Bearer obs_sk_xxx`. Without it the request is rejected. Create tokens in Settings → Team tab.
- **org_id first param:** In every route handler, `const orgId = req.user.orgId` is the first value pushed to the params array (`$1`). All other dynamic filters start at `$2`. Never skip this or data leaks across tenants.
- **SQL parameterization:** All DB queries use `$1, $2, ...` params. Never interpolate user input into SQL strings.
- **Zod validation:** All POST body inputs validated with Zod schemas in route files.
- **Async DB ops:** All database operations use async/await with the pg pool.
- **Socket.io broadcast:** After inserting a metric, always `io.emit('new-metric', metric)` so dashboards update in real-time.
- **Time zone:** All timestamps stored as `TIMESTAMPTZ`. Always use timezone-aware comparisons.
- **Cost precision:** Use `DECIMAL(10,6)` for costs. Don't round until display layer.
- **Encryption key:** Default key exists in code but should always be overridden via `ENCRYPTION_KEY` env var in production.
- **api_key_hint linkage:** Every metric must carry `api_key_hint` (set by SDK). Never remove this field — it's the only link between `api_calls` and `provider_credentials`.
- **Observatory token hash:** Token hash stored as SHA-256 hex. Full `obs_sk_` value is shown once at creation and never stored. Index on `token_hash WHERE revoked_at IS NULL` keeps lookup fast.
- **Dashboard Sync button:** Only calls `fetchAll()` (local DB refresh). Never call `POST /api/sync/:provider` from the dashboard header — that requires an admin key and belongs in Settings → Sync tab only.
- **Dashboard provider filter:** Dashboard reads configured providers from `/api/credentials` and filters projection/chart series to only show those providers. Don't hardcode `['anthropic', 'openai']` in UI loops.
- **Dark mode:** Use `theme-light` / `theme-dark` CSS classes (CSS custom properties), NOT Tailwind's `dark` class strategy. The App.jsx shell applies `className={darkMode ? 'theme-dark' : 'theme-light'}` on the root div.
- **New page pattern:** Every new page must render `<main className="obs-main">` with `obs-header` + `obs-content` children. Use `obs-tabbar` + `obs-tab` for sub-navigation within a page.
- **CSS classes:** Use `.obs-btn`, `.obs-btn-primary`, `.obs-table`, `.obs-section-label`, `.obs-field`, `.obs-input`, `.obs-select`, `.kchip`, `.vbadge`, `.tsw`, `.iprog-bar/.iprog-fill`, `.dot/.dot-pulse` from `index.css`. Do not create new Tailwind utility classes for these patterns.
- **Role checks:** `requireAdmin` middleware blocks non-admins and observatory tokens. For frontend-only role gating, read `user.role` from `useAuth()`. Admins can invite/remove members and manage tokens.

---

## Testing

```bash
cd packages/sdk
npm test    # Runs src/__tests__/wrapper.test.js via Node.js built-in test runner
```

Tests cover SDK wrapper behavior. API has no automated tests currently — manual testing via curl or the dashboard.

---

## Known Limitations / Production Considerations

- Rate limiting not implemented on metrics ingestion — add nginx limit or Express middleware in production
- HTTPS not enforced in code (delegate to reverse proxy)
- CORS allows all origins (`*`) — restrict in production
- Alert debounce is 6h — cannot be configured per rule
- Sync feature requires admin-level API keys from providers
- No superadmin panel — org management done directly in DB for now
- Observatory tokens do not expire automatically — revoke manually via Settings or `DELETE /api/tokens/:id`
- `AUTH_EMAIL` / `AUTH_PASSWORD_HASH` env vars still supported for legacy single-admin bootstrapping; on startup the API creates an org + org_member for that user if none exists

---

## Roadmap / Pending Work

### Short-term
- [ ] Frontend role-based UI — hide admin actions (invite, remove member) from `member` role users
- [ ] Rate limiting on `POST /api/metrics` — protect against token abuse
- [ ] Observatory token `last_used_at` update on each metric POST
- [ ] Pagination on team member list and invitations list

### Medium-term
- [ ] Superadmin panel — cross-org visibility for platform operators
- [ ] Per-org usage quotas — hard limits on metrics volume
- [ ] Audit log — record sensitive actions (member added/removed, token revoked, key deleted)
- [ ] SSO / OAuth login (Google, GitHub) via passport.js
- [ ] Granular roles beyond admin/member (e.g. viewer with read-only access)

### Long-term / SaaS
- [ ] Billing integration (Stripe) — free tier + paid plans per org
- [ ] Self-serve org deletion with data purge
- [ ] Python SDK (`packages/sdk-python`) — stub exists, needs full implementation
- [ ] Webhook delivery for metric events (outbound to customer systems)
