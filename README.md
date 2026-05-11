# LLM Observatory

> Open-source observability dashboard for Claude API (and OpenAI) usage. Track tokens, cost & latency in real-time with a drop-in SDK wrapper that adds zero overhead to your requests.

![Node.js](https://img.shields.io/badge/Node.js-20-green?logo=node.js)
![React](https://img.shields.io/badge/React-18-blue?logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **Drop-in SDK Wrapper** — Replace `new Anthropic()` with `new MonitoredAnthropic()`. Zero code changes elsewhere.
- **Real-time Dashboard** — Live metric updates via WebSocket. No page refresh required.
- **Cost Tracking** — Per-request cost calculation using model-aware pricing tables for Anthropic and OpenAI.
- **Monthly Projections** — Forecast end-of-month spend per provider based on current usage trends.
- **Model Analysis** — Compare cost, latency, and token usage across all models.
- **Budget Management** — Set daily, weekly, or monthly spending limits with visual progress bars.
- **Discord Alerts** — Hourly automated checks against configurable alert rules with webhook notifications.
- **Provider Sync** — Pull historical usage data from Anthropic Admin API or OpenAI Organization API.
- **Balance Tracking** — Record and visualize provider balance recharges.
- **CSV Export** — Download filtered request logs with all metrics included.
- **Authentication** — Single-admin login with JWT. No public registration.
- **Dark Mode** — Full dark/light theme toggle.
- **OpenAI Support** — Full parity with `MonitoredOpenAI` wrapper for multi-provider monitoring.

---

## Setup inicial

### 1. Generar el password hash para el admin

```bash
git clone https://github.com/your-username/llm-observatory
cd llm-observatory
npm install
node scripts/generate-password-hash.js tupassword
```

Copia el hash resultante al `.env`.

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` y completa los campos obligatorios:

```bash
# Genera con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=<32-byte hex>

# El hash generado con scripts/generate-password-hash.js
AUTH_EMAIL=admin@example.com
AUTH_PASSWORD_HASH=$2b$10$...

# Genera con: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=<64-byte hex>
```

### 3. Levantar con Docker (recomendado)

```bash
docker-compose up -d --build
```

Abre http://localhost — serás redirigido al login.

### 4. Setup manual

**Requisitos:** Node.js 20+, PostgreSQL 16

```bash
npm install
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:3001

### 5. Poblar datos de ejemplo (opcional)

```bash
npm run seed
```

Genera 600 registros realistas con distribución de modelos, horas pico, variación de latencia y una tasa de error simulada.

---

## SDK Integration

### Anthropic

```javascript
const { MonitoredAnthropic } = require('@llm-observatory/sdk');

const client = new MonitoredAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  observatoryUrl: 'http://localhost:3001'  // tu instancia
});

// Úsalo exactamente igual que el SDK oficial de Anthropic
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
  observatoryUrl: 'http://localhost:3001'
});

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

Las métricas se envían **asincrónicamente** — tu llamada a la API retorna inmediatamente, sin overhead de latencia.

> **Nota:** El endpoint `POST /api/metrics` es **público** para que el SDK pueda reportar desde proyectos externos sin necesitar un token. Todos los demás endpoints requieren autenticación.

---

## Sistema de credenciales

Settings gestiona dos tipos de keys que son conceptualmente distintos:

### SDK Keys
Las keys que usan tus proyectos con `MonitoredAnthropic` / `MonitoredOpenAI` para registrar métricas en el dashboard.

- Anthropic SDK Key: empieza con `sk-ant-api03-`
- OpenAI SDK Key: empieza con `sk-proj-`

### Admin Keys
Keys con permisos elevados, necesarias para la función de **sincronización de historial**. No son las mismas que las SDK keys.

- **Anthropic Admin Key**: genera en [console.anthropic.com](https://console.anthropic.com) → Settings → Admin Keys. Requiere rol de admin en la organización. Empieza con `sk-ant-admin-`
- **OpenAI Organization Key**: key con permisos de organización para leer datos de uso vía `/v1/organization/usage`

Todas las keys se almacenan cifradas con AES-256-CBC. Nunca se muestran completas en la UI.

---

## Architecture

```
Your Application
  └─► MonitoredAnthropic / MonitoredOpenAI   (SDK)
      ├─► Claude / OpenAI API                (real request, awaited)
      └─► Observatory API                    (async metric POST, fire & forget)
          ├─► PostgreSQL                     (persists all metrics)
          ├─► Socket.io                      (broadcasts to connected dashboards)
          └─► React Dashboard                (WebSocket real-time updates)
```

---

## Project Structure

```
llm-observatory/
├── scripts/
│   └── generate-password-hash.js   Genera bcrypt hash para AUTH_PASSWORD_HASH
├── packages/
│   ├── sdk/                        Node.js SDK wrapper (MonitoredAnthropic, MonitoredOpenAI)
│   ├── api/                        Express + Socket.io + PostgreSQL backend
│   │   └── src/
│   │       ├── index.js            App entry, env validation, auth middleware
│   │       ├── middleware/auth.js  JWT validation middleware
│   │       ├── db/                 Pool, schema, migrations, seed, crypto
│   │       ├── routes/             auth, metrics, budgets, balances, credentials, alerts, sync
│   │       └── jobs/               alertChecker.js (hourly cron)
│   └── web/                        React + Vite + Tailwind frontend
│       └── src/
│           ├── auth/AuthProvider.jsx  Auth context (JWT storage + login/logout)
│           ├── hooks/useApi.js        Fetch wrapper with auto Authorization header
│           ├── pages/                 Login, Dashboard, Requests, Models, Providers, Budgets, Settings
│           └── components/            Sidebar (con logout), KPICard, ProviderBadge, RequestDrawer
├── docker-compose.yml
├── .env.example
└── package.json                    Workspace root (npm workspaces)
```

---

## Authentication

El sistema usa un único usuario administrador definido en el `.env`. No hay registro público.

- Login: `POST /api/auth/login` — retorna JWT con expiración configurable (default 7d)
- El JWT se guarda en `localStorage` y se incluye en todas las peticiones al API
- Si el API devuelve 401, el frontend limpia la sesión y redirige a `/login`
- `POST /api/metrics` y `GET /health` son las únicas rutas públicas

Para regenerar las credenciales:
```bash
# Nuevo password
node scripts/generate-password-hash.js mi_nuevo_password

# Nueva ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Nuevo JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Deploy to Railway

1. Fork este repo y sube a GitHub
2. Crea un nuevo proyecto en [railway.app](https://railway.app)
3. Agrega el plugin **PostgreSQL** — Railway inyecta `DATABASE_URL` automáticamente
4. Agrega dos servicios desde tu repo:
   - **API** → Root Directory: `packages/api`
   - **Web** → Root Directory: `packages/web`
5. En el servicio Web, agrega: `API_INTERNAL_URL=http://<nombre-servicio-api>.railway.internal:3001`
6. En ambos servicios, agrega las variables de `.env.example` (ENCRYPTION_KEY, AUTH_*, JWT_*)
7. Habilita **Private Networking** en el servicio API

> **¿Cuál es el hostname del API?** Railway genera el hostname interno a partir del nombre del servicio en el dashboard. Ve a Railway → servicio API → Settings → Networking para ver el hostname exacto (ej. `llm-observatory.railway.internal`). Usar `api.railway.internal` solo funciona si el servicio se llama exactamente `api`.

> **DNS dinámico:** el nginx del web service re-resuelve el hostname del API en cada request usando el resolver del contenedor (`/etc/resolv.conf`). Esto significa que si el servicio API se redespliega y cambia de IP interna, el web service lo detecta automáticamente sin necesitar un redeploy.

---

## API Reference

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/auth/login` | Pública | Login, retorna JWT |
| `GET /api/auth/me` | JWT | Info del usuario actual |
| `POST /api/metrics` | **Pública** | Record métrica desde SDK |
| `GET /api/metrics` | JWT | List metrics (paginado, filtrado) |
| `GET /api/metrics/summary` | JWT | Stats agregados + time series |
| `GET /api/metrics/projection` | JWT | Proyección de gasto mensual |
| `GET /api/metrics/export` | JWT | CSV download |
| `GET /api/credentials` | JWT | Listar credenciales (keys masqueadas) |
| `POST /api/credentials` | JWT | Agregar credencial |
| `POST /api/credentials/:id/test` | JWT | Validar key contra el provider real |
| `DELETE /api/credentials/:id` | JWT | Eliminar credencial por ID |
| `GET /api/credentials/openai/balance` | JWT | Uso mensual OpenAI |
| `POST /api/sync/:provider` | JWT | Iniciar sync histórico (requiere Admin Key) |
| `GET /api/sync/logs` | JWT | Historial de sync |
| `GET /api/alerts/rules` | JWT | Listar reglas de alerta |
| `POST /api/alerts/rules` | JWT | Crear regla de alerta |
| `GET /health` | **Pública** | Health check |

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, Tailwind CSS 3, Recharts, Socket.io Client, Lucide Icons |
| Backend | Node.js 20, Express 4, Socket.io 4, Zod validation, node-cron, bcrypt, jsonwebtoken |
| Database | PostgreSQL 16 con índices en timestamp, model, provider |
| Real-time | Socket.io WebSocket (auto-reconnect) |
| Auth | JWT (7d expiry) + bcrypt (cost 10) |
| Encryption | AES-256-CBC para API keys almacenadas |
| Deployment | Docker Compose, Railway |

---

## Model Pricing (April 2026)

| Model | Input ($/1M) | Output ($/1M) |
|-------|-------------|--------------|
| claude-opus-4-6 | $15.00 | $75.00 |
| claude-sonnet-4-6 | $3.00 | $15.00 |
| claude-haiku-4-5-20251001 | $0.80 | $4.00 |
| claude-3-5-sonnet-20241022 | $3.00 | $15.00 |
| claude-3-5-haiku-20241022 | $0.80 | $4.00 |
| claude-3-opus-20240229 | $15.00 | $75.00 |
| claude-3-haiku-20240307 | $0.25 | $1.25 |
| gpt-4o | $2.50 | $10.00 |
| gpt-4o-mini | $0.15 | $0.60 |
| gpt-4-turbo | $10.00 | $30.00 |
| o1 | $15.00 | $60.00 |
| o1-mini | $3.00 | $12.00 |
| o3-mini | $1.10 | $4.40 |
| o3 | $10.00 | $40.00 |

---

## License

MIT
