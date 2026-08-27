# GEMINI.md — LLM Observatory Project Instructions

Welcome to the **LLM Observatory** codebase. This document serves as the repository-wide engineering instruction manual and source of truth for architecture, development commands, design patterns, and coding conventions.

---

## 1. Project Overview

**LLM Observatory** is a production-grade, multi-tenant SaaS observability platform designed to monitor LLM usage (Anthropic Claude, OpenAI, Google Gemini, xAI Grok, and Moonshot AI Kimi API calls) in real-time. It provides real-time spend/token tracking, latency monitoring, cost projection, budgeting alerts, outbound webhooks, CSV exports, Discord notifications, and a WebSocket-driven interactive dashboard.

### 1.1 Architecture & Flow
```
User Application
  └─► MonitoredAnthropic / MonitoredOpenAI / MonitoredGemini / MonitoredGrok / MonitoredKimi  (SDK — Node.js or Python)
      │   Authorization: Bearer obs_sk_xxx   ← Observatory token (org identity)
      ├─► Claude / OpenAI / Gemini / Grok / Kimi API   (real request, awaited)
      └─► Observatory API                   (async metric POST, fire & forget)
          ├─► org_id resolution             (token hash → org)
          ├─► PostgreSQL                    (persisting metrics scoped by org_id)
          ├─► Socket.io                     (broadcasting to dashboard clients)
          ├─► React Dashboard               (WebSocket real-time updates)
          └─► Outbound Webhooks             (HMAC-signed POST to customer URLs, fire & forget)
```

### 1.2 Core Packages (Monorepo)
*   **`packages/api`**: Node.js, Express, and PostgreSQL backend with Socket.io real-time notifications.
*   **`packages/web`**: React, Vite, Tailwind CSS, and Three.js frontend web dashboard.
*   **`packages/sdk`**: Drop-in wrapper SDK for Node.js (intercepts Anthropic, OpenAI, Gemini, Grok, and Kimi SDKs).
*   **`packages/sdk-python`**: Drop-in wrapper SDK for Python (intercepts Anthropic, OpenAI, Gemini, Grok, and Kimi SDKs).

---

## 2. Building and Running

### 2.1 Pre-requisites & Environment Variables
Create a `.env` file in the root workspace or in `packages/api` (copying `.env.example` as a template):
```bash
POSTGRES_USER=postgres
POSTGRES_PASSWORD=changeme
POSTGRES_DB=llm_observatory
DATABASE_URL=postgresql://postgres:changeme@localhost:5432/llm_observatory
PORT=3001
NODE_ENV=development
ENCRYPTION_KEY=<32-byte hex>   # AES-256-GCM encryption of stored API keys
JWT_SECRET=<64-byte hex>       # Sign JWTs for dashboard users
JWT_EXPIRES_IN=1h              # JWT expiry limit (default 1h)
RESEND_API_KEY=<resend api key> # For transactional emails
EMAIL_FROM=onboarding@resend.dev
APP_URL=http://localhost:5173
SUPPORT_EMAIL=<support inbox>  # Fallback for manual support forwarding
```

For the frontend, build-time env:
```bash
VITE_API_URL=http://localhost:3001
```

### 2.2 Core Development Commands

#### Root Workspace
Run api and web concurrently, or run seed:
```bash
npm install
npm run dev      # Launches api (3001) and web (5173) simultaneously
npm run seed     # Populates database with 600 org-scoped demo records
npm test         # Executes tests across all workspaces
```

#### Backend API Only (`packages/api`)
```bash
cd packages/api
npm run dev       # nodemon
npm run migrate   # Run schema.sql
npm run seed
npm run seed:demo # Public showcase setup (demo@llm-observatory.com / Demo1234!)
```

#### Frontend Web Only (`packages/web`)
```bash
cd packages/web
npm run dev       # Runs Vite on http://localhost:5173
npm run build     # Compiles production assets
```

#### Node SDK Only (`packages/sdk`)
```bash
cd packages/sdk
npm install
npm test          # Runs 39 unit/integration tests
```

#### Python SDK Only (`packages/sdk-python`)
```bash
cd packages/sdk-python
pip install -e .               # Install basic package
pip install -e ".[openai]"     # Install with optional OpenAI support
pip install -e ".[gemini]"     # Install with optional Gemini support
pytest tests/ -v               # Run unit/integration tests
```

### 2.3 Docker & Multi-container Compose
To spin up the entire application locally including PostgreSQL 16:
```bash
docker-compose up -d --build
# Backend API at http://localhost:3001
# Frontend Web at http://localhost:80
```
*Schema migrations run automatically on start inside the API container.*

---

## 3. Core Development Conventions

### 3.1 Multi-Tenancy & Database Security (Strict Rule)
Every single database table storing metrics, credentials, budgets, or rule alerts has an `org_id` column.
*   **Rule 1**: All database queries MUST be scoped by `orgId`.
*   **Rule 2**: `orgId` MUST always be the first parameter in your SQL query parameter list (`$1`). All dynamic filters must start at `$2` onwards.
    ```javascript
    // Correct
    const orgId = req.user.orgId;
    const query = 'SELECT * FROM api_calls WHERE org_id = $1 AND provider = $2';
    const params = [orgId, req.query.provider];
    ```
*   **Rule 3**: Never interpolate user input directly into SQL strings. Always use parameterized parameters (`$1, $2, ...`).

### 3.2 Security & Authentication Patterns
*   **Authentication Middleware (`packages/api/src/middleware/auth.js`)**:
    *   `POST /api/metrics` allows Observatory SDK authentication using `Authorization: Bearer obs_sk_xxx`. This is mapped to the org by hashing the token with SHA-256 and querying `observatory_tokens`.
    *   Dashboard routes require standard JWT tokens: `Authorization: Bearer <jwt>`.
    *   The `requireAdmin` middleware blocks observatory tokens and checks if `req.user.role === 'admin'`. Only admins can manage members, keys, tokens, webhooks, or alerts.
*   **JWT Expiration & Revocation**:
    *   JWTs have a default lifespan of 1 hour.
    *   Logging out (`POST /api/auth/logout`) blacklists the JTI (`jti` claim) by writing it to the `revoked_tokens` table. Expired entries are automatically purged via 15-minute cron jobs.
*   **Encryption System**:
    *   API keys stored in the database are encrypted using AES-256-GCM.
    *   The encrypted string format is `v2:iv_hex:ciphertext_hex:tag_hex` (using a 12-byte IV and 16-byte auth tag).
    *   Legacy `iv_hex:ciphertext_hex` (AES-256-CBC) is transparently decrypted on reads for backwards compatibility. All writes MUST use AES-256-GCM encryption.

### 3.3 Outbound Webhooks & Event Flow
After successfully writing an LLM metric:
1.  **Dashboard Broadcast**: Emit real-time statistics via Socket.io: `io.emit('new-metric', metric)`.
2.  **Webhook Dispatch**: Deliver outbound webhooks asynchronously using fire-and-forget:
    ```javascript
    deliverWebhooks(req.user.orgId, 'metric.created', row).catch(() => {});
    ```
    *   Do NOT await the webhook POST request so response times to client requests or SDK metrics ingestion remain as low as possible.
    *   Webhooks are signed using HMAC-SHA256 of the event body against the endpoint secret, and sent as the `X-Observatory-Signature` header (prefixed with `sha256=`).

### 3.4 Ingestion & SDK Rules
*   **Proxy Pattern**: SDKs act as lightweight wrappers around Anthropic, OpenAI, Gemini, Grok, or Kimi. They intercept completion calls, record timestamps, analyze token usages, calculate pricing, and return the provider's completion response immediately.
*   **Asynchronous Ingestion**: Metric POSTs to `/api/metrics` are always fired in a non-blocking/asynchronous manner (daemons, thread pools, or event loop executor tasks). The client request must never wait for the metrics post to finish.
*   **Key Hint Linkage**: Every metric payload MUST send `api_key_hint` computed using the constructor's masked API key. This is the critical linkage between `api_calls` and credentials stored in the DB.

### 3.5 Frontend (Web Dashboard) Styling & Layout Rules
*   **Strict Design System**: Do not use arbitrary Tailwind styling or dark-mode class rules. Use CSS custom properties in `index.css`.
*   **Theming**: The root `div` element is styled dynamically with `.theme-light` or `.theme-dark` according to user settings. Mode is read and saved to local storage with dark mode as default.
*   **Predefined Utility CSS Classes**: Always use the following semantic classes from `index.css` rather than re-inventing components:
    *   Buttons: `.obs-btn`, `.obs-btn-primary`
    *   Inputs: `.obs-input`, `.obs-select`, `.obs-field`
    *   Tables: `.obs-table`
    *   Sections & Layout: `.obs-main`, `.obs-header` (56px), `.obs-content` (internal scroll), `.obs-tabbar` & `.obs-tab` (for in-page navigation tabs).
*   **Localization (i18n)**: All UI text elements MUST be translated using `react-i18next` and the `useTranslation()` hook. All literal text should live in `packages/web/src/i18n/locales/en.json` and `es.json`. Never hardcode user-visible strings in JSX.
*   **API Requests**: Always use the `useApi()` hook which exposes `apiFetch`. This automatically manages authenticating headers and automatically logs out / redirects to `/login` if a 401 is encountered.
*   **Dual Charts (2D & 3D)**:
    *   Main dashboard leverages both `MetricSurface3D` (Three.js/@react-three/fiber) and `ModelTrendChart2D` (Recharts).
    *   Charts are lazy-loaded on-demand using `React.lazy` to maintain clean chunk splits.
    *   Both views must use the shared formatting and grouping helpers exported by `MetricSurface3D` to ensure absolute parity of values.

### 3.6 Testing & CI Standards
*   **Node SDK**: pricing, provider wrappers (Anthropic/OpenAI/Gemini/Grok/Kimi), helpers. Run `npm test` inside `packages/sdk`.
*   **Python SDK**: same provider coverage. Run `pytest tests/ -v` inside `packages/sdk-python`.
*   **API Integrations (42 tests)**: Scoping, auth, rate-limiting, and webhook routing. Run test scripts inside `packages/api` (requires active PostgreSQL on `:5432` pointing to test database URL).
*   **CI Configuration**: `.github/workflows/test.yml` automatically executes jobs in parallel for each package upon PR commits.

---

## 4. Operational Limits & Production Gaps
Keep these known architectural patterns in mind when implementing or debugging:
*   **No Webhook Queue**: Webhook dispatches are currently executed once. Failures are dropped after 1 retry. For critical production pipelines, we want to construct a reliable database-backed queue or delivery log table.
*   **Support-Mediated Resets**: User password reset links do not directly email users. Instead, they are sent to `SUPPORT_EMAIL` where admins must manually forward them (this is due to domain restrictions on transactional email services).
*   **Alert Debounce**: spending limit alerts are debounced for a static period of 6 hours per rule to prevent notification storms.
