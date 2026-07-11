## `packages/api`

**Entry point:** `src/index.js`

**Structure:**
```
src/
├── index.js            Express app, Socket.io setup, route registration, orphan cleanup
├── db/
│   ├── pool.js         PostgreSQL connection pool
│   ├── schema.sql      Table definitions + indexes + multi-tenancy backfill
│   ├── migrate.js      Runs schema.sql (also runs automatically on Docker container start)
│   ├── seed.js         600 demo records (org-scoped)
│   ├── seed-demo.js    Public showcase org + demo user + fake credentials (npm run seed:demo)
│   └── crypto.js       AES-256-GCM encrypt/decrypt for API keys (v2: format); CBC legacy fallback for old values
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
│   ├── team.js         Team member management + email invitations
│   └── webhooks.js     Outbound webhook endpoints CRUD + test delivery
├── services/
│   ├── email.js        Resend integration: activation, password reset, invitations
│   └── webhooks.js     deliverWebhooks() — HMAC-SHA256 signed POST, fire-and-forget
└── jobs/
    └── alertChecker.js Hourly cron: check spend per org → Discord alerts
```

**Database tables:**

Multi-tenancy tables (new):
- `organizations` — Tenant orgs. Columns: `id`, `name`, `slug` (unique), `created_at`
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
- `webhook_endpoints` — Outbound webhook URLs with HMAC secret. Columns: `org_id`, `name`, `url`, `secret` (plaintext, not hashed), `events` (TEXT[] default `{metric.created}`), `is_active`. Secret shown once on creation, never again. Partial index on `(org_id) WHERE is_active = true`.

Auth tables:
- `users` — Accounts with bcrypt passwords. Columns: `email`, `password_hash`, `is_active`, `activation_token`, `reset_token`, `reset_token_expires`
- `revoked_tokens` — JWT JTI blacklist for server-side logout. Columns: `jti` (PK), `exp`. Cleaned every 15 min by cron.

**Auth middleware (`middleware/auth.js`):**
- Public paths: `GET /health`, `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/activate`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `GET /api/auth/invite-info`, `POST /api/auth/accept-invite`
- `POST /api/metrics`: requires `Authorization: Bearer obs_sk_xxx` (Observatory token)
- All other routes: require `Authorization: Bearer <jwt>`
- Observatory token path: SHA-256 hash lookup → sets `req.user = { orgId, isObservatoryToken: true }`
- JWT path: verifies signature → checks `revoked_tokens` table by `jti` → sets `req.user = { id, email, orgId, role, jti, exp }`
- `requireAdmin`: blocks observatory tokens; requires `req.user.role === 'admin'`
- `POST /api/auth/logout`: inserts `jti` into `revoked_tokens` — token rejected on all subsequent requests

**Registration & password reset flow (changed 2026-06-28):**
- Registration **auto-activates** accounts (`is_active = true` on INSERT) — no activation email is sent and login does NOT check `is_active`. `GET /api/auth/activate` still exists but is legacy.
- Duplicate email on register always returns 409, even if the existing account is inactive (prevents account takeover via re-registration).
- Password reset is **support-mediated**: `sendPasswordResetEmail()` sends the reset link to `SUPPORT_EMAIL` (fallback `EMAIL_FROM`), not to the user — support forwards it manually. Reason: Resend cannot email arbitrary addresses without a verified custom domain.

**Rate limiting (`src/index.js`):** `express-rate-limit`, two limiters, both **1000 req/min** — `generalLimiter` (all routes) and `metricsLimiter` (`POST /api/metrics`). Was 300; raised because the dashboard's parallel fetches hit the limit.

**Data integrity — cascade delete:** `DELETE /api/credentials/:id` automatically deletes all `api_calls` where `api_key_hint = key_hint`. Admin key deletions also remove `sync:provider` records. All constrained by `org_id`.

**Orphan cleanup on startup:** Deletes `test:sdk_integration` records for providers with no credentials (scoped to org), and `sync:*` records for providers with no admin key.

**Time series logic:** `DATE_TRUNC('hour')` for ≤7d ranges, `DATE_TRUNC('day')` for >7d.

**Alert debounce:** 6 hours per rule to prevent spam. Checker groups by `${org_id}:${metric}`.

**Encryption format:** `v2:iv_hex:ciphertext_hex:tag_hex` (AES-256-GCM, 12-byte IV, 16-byte auth tag). Legacy CBC format `iv_hex:ciphertext_hex` still decrypts transparently — new writes always use GCM. No ENCRYPTION_KEY rotation needed.

**org_id in queries:** Every route uses `req.user.orgId` as the first param (`$1`) in all SQL queries. Dynamic filter params start at `$2` onwards.

## API Routes Reference

### Auth (public)
| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/auth/login` | POST | Public | Login → JWT |
| `/api/auth/register` | POST | Public | Register user + create org atomically (account queda activa de inmediato) |
| `/api/auth/me` | GET | JWT | Current session info |
| `/api/auth/activate` | GET | Public | Legacy — activation email ya no se envía en el registro |
| `/api/auth/forgot-password` | POST | Public | Request password reset (link se envía a `SUPPORT_EMAIL`, no al usuario) |
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

### Webhooks (outbound delivery)
| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/webhooks` | GET | JWT | List org's webhook endpoints (secret shown as `…xxxx` hint) |
| `/api/webhooks` | POST | JWT | Create endpoint — returns secret once in full |
| `/api/webhooks/:id` | DELETE | JWT | Delete endpoint |
| `/api/webhooks/:id/test` | POST | JWT | Send test payload (`webhook.test` event) |

**Webhook delivery:** After every `POST /api/metrics` insert, `deliverWebhooks(orgId, 'metric.created', row)` fires for all active endpoints of the org. Each POST includes headers:
- `X-Observatory-Signature: sha256=<hmac-hex>` — HMAC-SHA256 of the full JSON body using the endpoint secret
- `X-Observatory-Event: metric.created`

Delivery is fire-and-forget with 1 retry after 1s. Failures are silent (metric already saved).

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
