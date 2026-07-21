# Graph Report - LLM-observatory  (2026-07-19)

## Corpus Check
- 121 files · ~182,505 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1068 nodes · 1548 edges · 90 communities (57 shown, 33 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 98 edges (avg confidence: 0.58)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `263c6a56`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Frontend App Shell & Routing
- Python Async Anthropic Wrapper
- Node SDK Pricing & Cost Calc
- Metrics API Route
- SDK Package Manifest
- Web Package Dependencies
- API Server Route Registration
- Credential Encryption (AES-GCM)
- Python OpenAI Wrapper Tests
- Auth Routes (bcrypt/JWT)
- Activity & Finance Screens
- Landing Page Components
- Root Package Scripts
- Python Anthropic Wrapper Tests
- API Package Dependencies
- Demo Data Seeding
- Alert Checker Cron Job
- Sidebar Nav Icons
- Shared UI Components
- Architecture Docs & Screenshots
- DB Migration Scripts
- Design Canvas Tooling
- API Dev Dependencies
- Railway Deploy Config (API)
- Team Invitations Route
- Jest Test Config
- Root NPM Scripts
- Metrics Seed Script
- Observatory Tokens Route
- Railway Deploy Config (Web)
- Auth Middleware
- Balances Route
- Budgets Route
- Webhooks Route
- Activity Dashboard Docs
- Test DB Global Setup
- KPI Card Component
- Logger Utility
- express-rate-limit Dep
- jsonwebtoken Dep
- node-cron Dep
- pg Dep
- resend Dep
- Docker Entrypoint Script
- DB Backup Script
- Password Hash Generator
- Project Overview Doc
- Email Auth Guide Doc
- DB Backup Workflow Doc
- Settings UI Screenshot
- Project Logo Asset
- README
- Activity.jsx
- package 2.json
- CLAUDE.md — LLM Observatory
- App.jsx
- MetricSurface3D.jsx
- @llm-observatory/sdk
- budgets.js
- LLM Observatory — Python SDK
- graphify reference: extra exports and benchmark
- API Routes Reference
- graphify reference: query, path, explain
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- CLAUDE.md
- CLAUDE.md
- extraction-spec.md
- SKILL.md
- cors
- CLAUDE.md
- CLAUDE.md
- CLAUDE.md
- Dashboard UI Screenshot
- Multi-tenant SaaS Architecture
- PostgreSQL Schema
- Auth Middleware
- Webhook Delivery Service
- Zero-latency Async Metrics Pattern
- Account.jsx
- webhooks-service.test.js

## God Nodes (most connected - your core abstractions)
1. `useApi()` - 29 edges
2. `useAuth()` - 19 edges
3. `formatCost()` - 19 edges
4. `MonitoredAnthropic` - 15 edges
5. `calculate_cost()` - 13 edges
6. `classify_error()` - 13 edges
7. `LLM Observatory` - 13 edges
8. `send_metric_background()` - 12 edges
9. `send_metric_background_async()` - 12 edges
10. `What You Must Do When Invoked` - 12 edges

## Surprising Connections (you probably didn't know these)
- `CI Test Workflow` --references--> `Node.js SDK Entry Point`  [EXTRACTED]
  .github/workflows/test.yml → CLAUDE.md
- `CI Test Workflow` --references--> `Python SDK Entry Point`  [EXTRACTED]
  .github/workflows/test.yml → CLAUDE.md
- `Docker Compose Configuration` --references--> `API Server Entry Point`  [EXTRACTED]
  docker-compose.yml → CLAUDE.md
- `CI Test Workflow` --references--> `API Server Entry Point`  [EXTRACTED]
  .github/workflows/test.yml → CLAUDE.md
- `Docker Compose Configuration` --references--> `Web Frontend Entry Point`  [EXTRACTED]
  docker-compose.yml → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Monorepo Package Structure** — packages_sdk_index, packages_sdk_python_init, packages_api_index, packages_web_main [EXTRACTED 1.00]
- **Authentication & Multi-tenancy Flow** — packages_api_middleware_auth, packages_api_db_schema, docs_email_auth_guide [INFERRED 0.95]

## Communities (90 total, 33 thin omitted)

### Community 0 - "Frontend App Shell & Routing"
Cohesion: 0.19
Nodes (16): useApi(), RequestsTab(), BalancesTab(), BudgetsTab(), Finance(), FinanceOverview(), RANGES, Register() (+8 more)

### Community 1 - "Python Async Anthropic Wrapper"
Cohesion: 0.08
Nodes (37): _AsyncMessagesProxy, AsyncMonitoredAnthropic, _MessagesProxy, Any, Rebuild a response_details-shaped dict from accumulated stream events     (Anthr, Drop-in replacement for anthropic.AsyncAnthropic with Observatory metrics., _reconstruct_stream_response(), _accumulate_stream_delta() (+29 more)

### Community 2 - "Node SDK Pricing & Cost Calc"
Cohesion: 0.05
Nodes (47): Anthropic, ANTHROPIC_PRICING, calculateCost(), calculateGeminiCost(), calculateOpenAICost(), calculateOpenAIEmbeddingCost(), calculateTTSCost(), calculateWhisperCost() (+39 more)

### Community 3 - "Metrics API Route"
Cohesion: 0.09
Nodes (27): app, { app }, REGISTER_PAYLOAD, request, { resetDb, createOrg, pool }, bcrypt, createMember(), createOrg() (+19 more)

### Community 4 - "SDK Package Manifest"
Cohesion: 0.05
Nodes (45): @google/genai, author, dependencies, @anthropic-ai/sdk, description, devDependencies, @google/genai, openai (+37 more)

### Community 5 - "Web Package Dependencies"
Cohesion: 0.05
Nodes (42): autoprefixer, @babel/runtime, i18next, lucide-react, dependencies, @babel/runtime, i18next, lucide-react (+34 more)

### Community 6 - "API Server Route Registration"
Cohesion: 0.06
Nodes (30): alertsRouter, { authMiddleware }, authRouter, balancesRouter, budgetsRouter, { checkAlerts }, cors, credentialsRouter (+22 more)

### Community 7 - "Credential Encryption (AES-GCM)"
Cohesion: 0.08
Nodes (36): crypto, decrypt(), encrypt(), KEY, maskKey(), { decrypt }, {
  fetchAnthropicUsage, fetchOpenAIUsage, summarizeBuckets,
  fetchAnthropicRealCost, fetchOpenAIRealCost,
}, fetchProviderTotal() (+28 more)

### Community 8 - "Python OpenAI Wrapper Tests"
Cohesion: 0.13
Nodes (9): Exception, _ChatProxy, MonitoredOpenAI, Drop-in replacement for openai.OpenAI with Observatory metrics., _make_response(), openai_client(), Build a MonitoredOpenAI instance with a mocked underlying client., TestMonitoredOpenAINonStreaming (+1 more)

### Community 9 - "Auth Routes (bcrypt/JWT)"
Cohesion: 0.15
Nodes (22): bcrypt, ChangePasswordSchema, crypto, express, jwt, pool, ProfileSchema, RegisterSchema (+14 more)

### Community 10 - "Activity & Finance Screens"
Cohesion: 0.10
Nodes (10): ActivityRequests(), ANTH_LINE, HOURS, MODELS, OAI_LINE, REQUESTS, SPARK_COST, SPARK_LAT (+2 more)

### Community 11 - "Landing Page Components"
Cohesion: 0.10
Nodes (3): LandingPage(), SPARK_PATHS, TAB_VISUALS

### Community 12 - "Root Package Scripts"
Cohesion: 0.10
Nodes (19): concurrently, dependencies, react, react-dom, vite, devDependencies, concurrently, react (+11 more)

### Community 13 - "Python Anthropic Wrapper Tests"
Cohesion: 0.19
Nodes (6): MonitoredAnthropic, Drop-in replacement for anthropic.Anthropic with Observatory metrics., _make_response(), Metric fires even when caller closes stream before exhaustion., TestMonitoredAnthropicNonStreaming, TestMonitoredAnthropicStreaming

### Community 14 - "API Package Dependencies"
Cohesion: 0.13
Nodes (15): bcrypt, dotenv, express, helmet, node-cron, dependencies, bcrypt, dotenv (+7 more)

### Community 15 - "Demo Data Seeding"
Cohesion: 0.14
Nodes (14): ANTHROPIC_MODELS, bcrypt, crypto, ERROR_MSGS, ERROR_TYPES, MODEL_PRICING, normalRandom(), OPENAI_MODELS (+6 more)

### Community 16 - "Alert Checker Cron Job"
Cohesion: 0.19
Nodes (11): checkAlerts(), getSpendCondition(), pool, sendDiscordAlert(), express, pool, { requireAdmin }, router (+3 more)

### Community 19 - "Architecture Docs & Screenshots"
Cohesion: 0.33
Nodes (6): Docker Compose Configuration, CI Test Workflow, API Server Entry Point, Node.js SDK Entry Point, Python SDK Entry Point, Web Frontend Entry Point

### Community 20 - "DB Migration Scripts"
Cohesion: 0.12
Nodes (10): path, pool, fs, path, pool, path, { Pool }, express (+2 more)

### Community 22 - "API Dev Dependencies"
Cohesion: 0.18
Nodes (10): jest, nodemon, devDependencies, jest, nodemon, supertest, main, name (+2 more)

### Community 23 - "Railway Deploy Config (API)"
Cohesion: 0.20
Nodes (9): build, builder, dockerfilePath, deploy, healthcheckPath, healthcheckTimeout, restartPolicyMaxRetries, restartPolicyType (+1 more)

### Community 24 - "Team Invitations Route"
Cohesion: 0.22
Nodes (8): crypto, express, InviteSchema, pool, { requireAdmin }, router, { sendInviteEmail }, { z }

### Community 25 - "Jest Test Config"
Cohesion: 0.25
Nodes (8): jest, globalSetup, setupFiles, testEnvironment, testMatch, testTimeout, ./src/__tests__/env.js, **/__tests__/**/*.test.js

### Community 26 - "Root NPM Scripts"
Cohesion: 0.25
Nodes (8): scripts, dev, migrate, migrate-admin, seed, seed:demo, start, test

### Community 27 - "Metrics Seed Script"
Cohesion: 0.29
Nodes (7): ANTHROPIC_MODELS, MODEL_PRICING, normalRandom(), OPENAI_MODELS, pool, SAMPLE_PROMPTS, seed()

### Community 28 - "Observatory Tokens Route"
Cohesion: 0.29
Nodes (6): crypto, express, pool, { requireAdmin }, router, { z }

### Community 29 - "Railway Deploy Config (Web)"
Cohesion: 0.25
Nodes (7): build, builder, dockerfilePath, deploy, restartPolicyMaxRetries, restartPolicyType, $schema

### Community 30 - "Auth Middleware"
Cohesion: 0.16
Nodes (13): authMiddleware(), crypto, jwt, pool, PUBLIC_PATHS, requireAdmin(), resolveObservatoryToken(), BalanceSchema (+5 more)

### Community 31 - "Balances Route"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 32 - "Budgets Route"
Cohesion: 0.09
Nodes (21): 1.1 Architecture & Flow, 1.2 Core Packages (Monorepo), 1. Project Overview, 2.1 Pre-requisites & Environment Variables, 2.2 Core Development Commands, 2.3 Docker & Multi-container Compose, 2. Building and Running, 3.1 Multi-Tenancy & Database Security (Strict Rule) (+13 more)

### Community 33 - "Webhooks Route"
Cohesion: 0.29
Nodes (6): crypto, express, pool, router, WebhookSchema, { z }

### Community 35 - "Test DB Global Setup"
Cohesion: 0.50
Nodes (3): { Client }, fs, path

### Community 41 - "node-cron Dep"
Cohesion: 0.07
Nodes (37): HBar(), buildGrid(), extractMetric(), fmtCompact(), formatMetricValue(), MetricSurface3D(), MIN_CAMERA_DISTANCE_BY_RANGE, pickLabelIndices() (+29 more)

### Community 48 - "Email Auth Guide Doc"
Cohesion: 0.18
Nodes (10): Auth middleware (`packages/api/src/middleware/auth.js`), Auth routes (`packages/api/src/routes/auth.js`), Database (`packages/api/src/db/schema.sql`), Email Auth — Implementation Status, Email service (`packages/api/src/services/email.js`), Environment variables required, Frontend pages, Security decisions (+2 more)

### Community 57 - "README"
Cohesion: 0.07
Nodes (26): 1. Clone and install, 1. Create an Observatory token, 2. Configure environment, 2. Use the SDK, 3. Start with Docker (recommended), 4. Manual setup, Admin Keys, Architecture (+18 more)

### Community 58 - "Activity.jsx"
Cohesion: 0.18
Nodes (13): COLORS, LABELS, ProviderBadge(), parseJsonField(), RequestDrawer(), Activity(), fmt(), ModelsTab() (+5 more)

### Community 59 - "package 2.json"
Cohesion: 0.11
Nodes (17): dependencies, @anthropic-ai/sdk, devDependencies, sinon, @anthropic-ai/sdk, openai, sinon, main (+9 more)

### Community 60 - "CLAUDE.md — LLM Observatory"
Cohesion: 0.12
Nodes (15): Architecture, CLAUDE.md — LLM Observatory, Deploy to Railway, Development Commands, Docker Setup, Environment Variables, Important Patterns & Conventions, Known Limitations / Production Considerations (+7 more)

### Community 61 - "App.jsx"
Cohesion: 0.17
Nodes (12): App(), ProtectedRoute(), RootRoute(), AuthContext, AuthProvider(), useAuth(), Sidebar(), AcceptInvite() (+4 more)

### Community 62 - "MetricSurface3D.jsx"
Cohesion: 0.22
Nodes (7): API tests, Commands, Critical conventions, Deployment, Key files, Monorepo structure, Ports

### Community 63 - "@llm-observatory/sdk"
Cohesion: 0.15
Nodes (12): Anthropic, Constructor options, How it works, Installation, License, @llm-observatory/sdk, Metrics recorded, Observatory token (+4 more)

### Community 64 - "budgets.js"
Cohesion: 0.29
Nodes (6): BudgetSchema, express, pool, { requireAdmin }, router, { z }

### Community 65 - "LLM Observatory — Python SDK"
Cohesion: 0.17
Nodes (11): Anthropic, Async, Configuration, How it works, Installation, LLM Observatory — Python SDK, OpenAI, Quick start (+3 more)

### Community 66 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 67 - "API Routes Reference"
Cohesion: 0.22
Nodes (8): API Routes Reference, Auth (public), Metrics & data, Observatory tokens, Other resources (all JWT, all org-scoped), `packages/api`, Team management, Webhooks (outbound delivery)

### Community 69 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 70 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 71 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 72 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 89 - "Account.jsx"
Cohesion: 0.20
Nodes (6): SessionSection(), ObservatoryTokensSection(), TeamTab(), DATE_OPTS, fmtDate(), TIME_OPTS

### Community 90 - "webhooks-service.test.js"
Cohesion: 0.18
Nodes (9): { deliverWebhooks }, express, MetricSchema, pool, router, { z }, crypto, deliverWebhooks() (+1 more)

## Knowledge Gaps
- **483 isolated node(s):** `PROVIDER_COLORS`, `DC`, `DCCtx`, `SPARK_REQ`, `SPARK_TOK` (+478 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **33 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MonitoredAnthropic` connect `Python Anthropic Wrapper Tests` to `Python Async Anthropic Wrapper`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `MonitoredOpenAI` connect `Python OpenAI Wrapper Tests` to `Python Async Anthropic Wrapper`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Are the 11 inferred relationships involving `MonitoredAnthropic` (e.g. with `.test_api_key_hint_masked()` and `.test_prompt_preview_truncated()`) actually correct?**
  _`MonitoredAnthropic` has 11 INFERRED edges - model-reasoned connections that need verification._
- **What connects `PROVIDER_COLORS`, `DC`, `DCCtx` to the rest of the system?**
  _496 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Python Async Anthropic Wrapper` be split into smaller, more focused modules?**
  _Cohesion score 0.07684210526315789 - nodes in this community are weakly interconnected._
- **Should `Node SDK Pricing & Cost Calc` be split into smaller, more focused modules?**
  _Cohesion score 0.05081081081081081 - nodes in this community are weakly interconnected._
- **Should `Metrics API Route` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._