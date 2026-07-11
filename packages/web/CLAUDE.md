## `packages/web`

**Entry point:** `src/main.jsx`

**Pages (react-router-dom v6):**
- `/` → `LandingPage.jsx` (público, con su propio `LandingPage.css`); si hay sesión activa redirige a `/dashboard`
- `/dashboard` → `Dashboard.jsx` — KPI strip con sparklines, MultiLineChart tokens over time, provider breakdown, proyección mensual
- `/activity` → `Activity.jsx` — Tab **Requests** (tabla paginada, filtros, drawer, CSV export) + Tab **Models** (HBar chart, tabla comparativa)
- `/finance` → `Finance.jsx` — Tab **Balances** (saldo por provider, historial recargas) + Tab **Budgets** (límites de gasto con progress bars)
- `/settings` → `Settings.jsx` — Tab **Keys** (SDK + Admin keys) + Tab **Sync** (historial sync por provider) + Tab **Alerts** (reglas Discord) + Tab **Webhooks** (outbound endpoints) + Tab **Team** (members + invitations + Observatory tokens)
- `/account` → `Account.jsx` — Mi cuenta (perfil del usuario)

**Public pages (outside ProtectedRoute):**
- `/login` → `Login.jsx`
- `/register` → `Register.jsx` — email + optional org name + password
- `/forgot-password` → `ForgotPassword.jsx`
- `/reset-password` → `ResetPassword.jsx`
- `/accept-invite` → `AcceptInvite.jsx` — accept team invitation with token from URL

Las páginas de auth (Login/Register/ForgotPassword/ResetPassword) usan el tema dark navy con clases `obs-auth-*` de `index.css`.

**Redirects legacy:** `/requests` → `/activity`, `/models` → `/activity?tab=models`, `/providers` → `/finance`, `/budgets` → `/finance?tab=budgets` (los archivos `Requests.jsx`, `Models.jsx`, `Providers.jsx`, `Budgets.jsx` fueron eliminados)

**i18n (react-i18next):** `src/i18n/index.js` + `src/i18n/locales/{en,es}.json`. Idioma en `localStorage('lang')`, default `en`. Toda string visible en UI debe ir vía `useTranslation()` / `t('key')` y añadirse a **ambos** locale files — nunca hardcodear texto en JSX.

**Key components:**
- `Sidebar.jsx` — 220px fijo, colapsable a 64px. Nav items con icono 18px + label + subtítulo descriptivo. User block (sin avatar): org + email + role badge; click abre dropdown con Mi cuenta / Tema / Idioma / Logout. Sin sección de proveedores. Props: `darkMode`, `setDarkMode`, `isOpen`, `onClose`, `collapsed`, `onToggleCollapse`.
- `ProviderBadge.jsx` — dot cuadrado amber/green. Props: `provider` (lowercase), `size` (`sm`|`lg`)
- `RequestDrawer.jsx` — Panel derecho con metadata, token breakdown, prompt preview
- `Sparkline.jsx` — SVG sparkline inline (sin Recharts)
- `MultiLineChart.jsx` — SVG multi-línea con gridlines y tick labels
- `HBar.jsx` — Barra horizontal: label | barra | valor
- `hooks/useSocket.js` — Socket.io connection and event listeners (una sola conexión — no crear sockets adicionales por componente)
- `hooks/useApi.js` — `useApi()` devuelve `apiFetch` (referencia estable, segura en deps de useEffect): inyecta el header Authorization y en 401 hace logout + redirect a /login. Usar siempre este hook para llamadas a la API, no `fetch` directo.
- `utils/fmt.js` — `formatCost(usd, { small })`, `fmtDate()`, `fmtDateTime()`. Usar `formatCost` para todo costo mostrado en UI (consistencia de decimales).

**Settings.jsx internal components:**
- `ObservatoryTokensSection` — Create/list/revoke `obs_sk_` tokens; shows full token once on creation with copy button
- `WebhooksTab` — Create/list/delete outbound webhook endpoints; shows secret once on creation with copy button; Test button sends sample payload
- `TeamTab` — Invite by email, list members with role badges, remove members, cancel pending invitations

**Auth context (`auth/AuthProvider.jsx`):**
- Stores `{ email, role, orgId, orgName }` from login and `/me` responses
- `useAuth()` exposes `user`, `token`, `isAuthenticated`, `isLoading`, `login`, `logout`

**Real-time pattern:** `useSocket` hook listens for `new-metric` event → triggers summary refetch.

**Sistema de diseño:** CSS custom properties en `index.css` — NO usar clase `dark` de Tailwind. Usar `.theme-light` / `.theme-dark` en el div raíz. Variables: `--page`, `--surface`, `--border`, `--text`, `--muted`, `--accent`, `--anthropic`, `--openai`. Fuentes: Inter (sans) + JetBrains Mono (mono via `var(--font-mono)`).

**Paleta de colores (alineada al logo):**
- Dark mode: navy profundo — `--d-page: #080D1A`, `--d-surface: #0D1628`, `--d-accent: #06B6D4` (cyan)
- Light mode: `--l-accent: #0891B2` (cyan-600)
- Metric colors: `--tokens-color: #06B6D4`, `--cost-color: #7C3AED`, `--latency-color: #F59E0B`
- Dark mode es el default para nuevos usuarios (`localStorage.getItem('dark-mode') !== 'false'`)

**Logo:** `packages/web/public/logoMain.png` — referenciado como `/logoMain.png` en Sidebar, Login, Register, LandingPage. Clase `.obs-brand-logo` (28×28px, border-radius 6px, object-fit cover). También usado como favicon en `index.html`.

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
