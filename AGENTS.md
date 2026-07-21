# AGENTS.md

## Commands

```bash
# Dev (api:3001 + web:5173)
npm run dev

# Run all workspace tests
npm test

# Run single workspace tests
npm test --workspace=packages/sdk
npm test --workspace=packages/api

# API tests require Postgres on :5432
DATABASE_URL=postgresql://postgres:changeme@localhost:5432/llm_observatory_test \
JWT_SECRET=<hex> ENCRYPTION_KEY=<hex> \
npm test --workspace=packages/api

# Python SDK tests
cd packages/sdk-python && pytest tests/ -v

# Seed 600 demo records
npm run seed

# Seed public demo org (demo@llm-observatory.com / Demo1234!)
npm run seed --workspace=packages/api

# Docker (postgres:16 + api:3001 + web:80)
docker-compose up -d --build
```

No lint/typecheck/formatter scripts exist. No TypeScript.

## Ports

| Service | Port |
|---------|------|
| Vite dev server | 5173 |
| Express API | 3001 |
| PostgreSQL | 5432 |
| Docker web (nginx) | 80 |

## Monorepo structure

4 packages under `npm workspaces`: `packages/api`, `packages/web`, `packages/sdk`, `packages/sdk-python`. Web has no tests.

## API tests

Jest with `--runInBand --forceExit`, 15s timeout. Setup in `packages/api/src/__tests__/env.js` + `globalSetup.js`. Tests live in `packages/api/src/__tests__/*.test.js`.

SDK uses Node's built-in test runner (`node --test`), not Jest.

## Critical conventions

- **org_id is always $1** in every SQL query. Never skip this or tenants leak.
- **Fire-and-forget metrics** — SDKs never await metric POSTs. Keep it that way.
- **Webhooks fire-and-forget** after metric insert: `deliverWebhooks(orgId, 'metric.created', row).catch(() => {})`. Never await.
- **Dark mode**: `.theme-light` / `.theme-dark` CSS classes. NOT Tailwind's `dark` strategy.
- **All UI strings** must use `useTranslation()` / `t('key')` — keys exist in both `en.json` and `es.json` (`packages/web/src/i18n/locales/`).
- **obs- CSS classes** for all UI patterns (`.obs-btn`, `.obs-table`, `.obs-field`, etc.) from `packages/web/src/index.css`. Do not create new Tailwind utilities.
- **Page layout**: Every page renders `<main className="obs-main">` with `obs-header` + `obs-content`.
- **API calls in frontend**: Always `useApi()` hook, not raw `fetch`.
- **Cost display**: Always `formatCost()` from `utils/fmt.js`.
- **Dashboard Sync button**: Only `fetchAll()` (local refresh). Never calls `POST /api/sync/:provider`.
- **Dashboard provider filter**: Reads from `/api/credentials`. Don't hardcode `['anthropic', 'openai']`.
- **Observatory token auth**: `POST /api/metrics` requires `Authorization: Bearer obs_sk_xxx`. Token hash is SHA-256, shown once at creation.
- **JWT 1h expiry**, server-side revocation via `POST /api/auth/logout`.
- **Encryption**: AES-256-GCM for stored API keys (`packages/api/src/db/crypto.js`).
- **Pricing tables** must stay in sync between `packages/sdk/src/index.js` and `packages/sdk-python/llm_observatory/_pricing.py`.
- **Registration auto-activates** — no activation email.
- **Password reset** is support-mediated (goes to `SUPPORT_EMAIL`, not user).

## Deployment

Railway + Docker. Auto-migrates on container start (`CREATE TABLE IF NOT EXISTS`). See `deploy-railway` skill for Railway-specific gotchas. DB backups: `scripts/backup.sh` → R2/S3 via GitHub Actions.

## Key files

- `packages/api/src/index.js` — Express app entrypoint, Socket.io, routes, cron
- `packages/api/src/db/schema.sql` — all DDL
- `packages/api/src/middleware/auth.js` — JWT + Observatory token + requireAdmin
- `packages/web/src/App.jsx` — route definitions + AppShell
- `packages/web/src/index.css` — all design tokens and obs-* classes
- `packages/web/src/hooks/useSocket.js` — Socket.io connection
- `packages/web/src/hooks/useApi.js` — apiFetch with auth + 401 handling
