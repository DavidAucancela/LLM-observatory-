## `packages/web`

**Entry point:** `src/main.jsx`

**Pages (react-router-dom v6):**
- `/` → `LandingPage.jsx` (público, con su propio `LandingPage.css`); si hay sesión activa redirige a `/dashboard`
- `/dashboard` → `Dashboard.jsx` — KPI strip con sparklines (cada card clickeable, dirige `activeMetric`), chart card con toggle 3D/2D (`MetricSurface3D` / `ModelTrendChart2D`, ver abajo), provider breakdown, proyección mensual
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
- `HBar.jsx` — Barra horizontal: label | barra | valor
- `MetricSurface3D.jsx` / `ModelTrendChart2D.jsx` — vista dual del chart principal del Dashboard, toggle guardado en `localStorage('obs-chart-view')`, default `3d`. Ambos reciben las mismas props (`modelTimeSeries`, `metric`, `xLabels`, `loading`) y ambos se lazy-load (`React.lazy`) — three.js/@react-three/fiber (3D, ~975KB) y recharts (2D, ~380KB) solo se descargan si el usuario efectivamente usa esa vista. `MetricSurface3D.jsx` exporta `buildGrid`/`extractMetric`/`formatMetricValue` — únicas funciones compartidas por el 2D, para que ambas vistas nunca difieran en cómo agregan un bucket o formatean un valor. El orden y color por modelo (`colorForModelIndex` en `utils/chartColors.js`) es el mismo en las dos vistas.
  - **3D light-mode/legibility fix:** el piso/grid y la `ContactShadows` usan `palette.gridLine`/`palette.shadow` (`utils/chartColors.js`) en vez de `palette.border` — ese token es casi invisible en modo claro (`#E4E7EC` sobre `#FFFFFF`), por eso el 3D necesita colores de grid propios, fijos por tema, no derivados de las CSS vars de las cards.
  - **Densidad (30d/90d):** por encima de `DENSE_THRESHOLD` (14 buckets) las barras se adelgazan y la cámara se aplana (`cameraYRatio`) para reducir oclusión entre filas — ver constantes al inicio de `MetricSurface3D.jsx`.
  - **Etiquetas de eje X:** `pickLabelIndices()` limita a ~7 fechas visibles (primero, último, pasos intermedios), renderizadas con `<Billboard><Text>` de drei para que siempre miren a la cámara sin importar la rotación.
  - **Navegación (pan) + reset de vista:** `OrbitControls` tiene `enablePan` habilitado (clic derecho/dos dedos) para poder desplazarse entre fechas en 30d/90d. El botón `.ms3d-reset-btn` NO usa `OrbitControls.reset()` — ese método solo restaura la posición que tenía la cámara al construirse los controles, y como el `Canvas` persiste entre cambios de rango (no hay `key` que fuerce remount), quedaría desincronizado si el usuario cambió de rango después de montar. En vez de eso, recalcula la posición/target ideal a partir de `cameraDistance`/`cameraYRatio` actuales y los aplica directo sobre `controls.object.position`/`controls.target`.
  - **Límite de zoom:** `minDistance` se capea en `MIN_CAMERA_DISTANCE` (8 unidades) en vez de escalar como `cameraDistance * 0.4` sin límite — con muchos buckets (90d) esa fórmula vieja dejaba el zoom mínimo a ~47 unidades, demasiado lejos para distinguir barras individuales sin importar cuánto scroll hicieras.
  - **Tarjeta de controles:** `.ms3d-controls-card` (esquina inferior izquierda) reemplaza el texto plano de ayuda — tres filas con icono + texto (`dashboard.controlRotate/Zoom/Pan`) explicando drag/scroll/clic-derecho.
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
