---
name: deploy-railway
description: Steps to deploy LLM Observatory (API + Web) to Railway, including the API_INTERNAL_URL gotcha. Use when the user asks to deploy, set up Railway, or configure Railway networking for this project.
---

## Deploy to Railway

1. Fork repo → push to GitHub
2. New Railway project → Add PostgreSQL plugin (auto-injects `DATABASE_URL`)
3. Two services:
   - **API** → Root: `packages/api`
   - **Web** → Root: `packages/web`, set `API_INTERNAL_URL=http://<service-name>.railway.internal:3001`
4. Enable Private Networking on API service

> **Nota sobre `API_INTERNAL_URL`:** Railway genera el hostname interno a partir del nombre del servicio en el dashboard (ej. `llm-observatory.railway.internal`). El valor por defecto `api.railway.internal` solo funciona si el servicio se llama exactamente `api`. Verifica el nombre real en Railway → servicio API → Settings → Networking.
