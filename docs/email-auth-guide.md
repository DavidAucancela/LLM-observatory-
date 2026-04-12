# Guía: Email Auth con Resend (Password Reset + Activación de Cuenta)

## Contexto del sistema actual

El auth hoy es un usuario único definido en `.env`:
```
AUTH_EMAIL=admin@example.com
AUTH_PASSWORD_HASH=<bcrypt>
JWT_SECRET=...
```

Para soportar reset de contraseña y activación de cuenta necesitamos:
1. Migrar a una tabla `users` en PostgreSQL (el usuario admin se migra automáticamente)
2. Añadir tokens de un solo uso para reset/activación
3. Integrar Resend para el envío de emails
4. Nuevas rutas en la API y páginas en el frontend

---

## Arquitectura del flujo completo

```
REGISTRO (futuro multi-user)
  POST /api/auth/register
    → Crea user con is_active=false
    → Genera activation_token (crypto.randomBytes)
    → Resend: envía email con link /activate?token=xxx
    → Usuario hace clic → POST /api/auth/activate
    → is_active=true, borra token

RESET DE CONTRASEÑA
  POST /api/auth/forgot-password
    → Busca user por email
    → Genera reset_token + reset_token_expires (1h)
    → Resend: envía email con link /reset-password?token=xxx
    → Usuario abre link → frontend muestra form nueva contraseña
    → POST /api/auth/reset-password { token, new_password }
    → Verifica token no expirado, bcrypt nueva contraseña
    → Borra token, responde OK
```

---

## Fase 1 — Instalar dependencias

```bash
cd packages/api
npm install resend
```

No se necesita nada extra en el frontend (todo es routing nativo).

---

## Fase 2 — Variables de entorno

Añadir en `.env` (y `.env.example`):

```bash
# ── Resend (email) ────────────────────────────────────────────────────────────
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@tudominio.com        # debe ser un dominio verificado en Resend
APP_URL=http://localhost:5173           # URL del frontend (para los links en los emails)
```

> En Resend puedes usar `onboarding@resend.dev` como remitente en modo sandbox
> sin verificar dominio. Para producción verifica tu dominio en resend.com/domains.

---

## Fase 3 — Base de datos

### 3.1 Tabla `users` — añadir a `schema.sql`

```sql
-- ── users ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                  SERIAL PRIMARY KEY,
  email               VARCHAR(255) NOT NULL UNIQUE,
  password_hash       TEXT NOT NULL,
  role                VARCHAR(20)  NOT NULL DEFAULT 'admin',
  is_active           BOOLEAN      NOT NULL DEFAULT false,
  activation_token    TEXT,
  reset_token         TEXT,
  reset_token_expires TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_login_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email         ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_reset_token   ON users(reset_token) WHERE reset_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_activation    ON users(activation_token) WHERE activation_token IS NOT NULL;
```

### 3.2 Script de migración del usuario admin — nuevo archivo `packages/api/src/db/migrate-admin.js`

Este script toma el `AUTH_EMAIL` y `AUTH_PASSWORD_HASH` del `.env` y los inserta
en la tabla `users` como primer usuario activo. Ejecutar **una sola vez** después
de crear la tabla.

```js
// packages/api/src/db/migrate-admin.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../../../../.env') });
const pool = require('./pool');

async function migrateAdmin() {
  const email = process.env.AUTH_EMAIL;
  const hash  = process.env.AUTH_PASSWORD_HASH;

  if (!email || !hash) {
    console.error('AUTH_EMAIL y AUTH_PASSWORD_HASH deben estar definidos en .env');
    process.exit(1);
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      console.log(`✓ El usuario ${email} ya existe en la tabla users`);
      process.exit(0);
    }

    await pool.query(
      `INSERT INTO users (email, password_hash, role, is_active)
       VALUES ($1, $2, 'admin', true)`,
      [email, hash]
    );
    console.log(`✅ Admin migrado: ${email}`);
  } catch (err) {
    console.error('Error en migración:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateAdmin();
```

Añadir el script a `packages/api/package.json`:
```json
"scripts": {
  "migrate-admin": "node src/db/migrate-admin.js"
}
```

Ejecutar: `npm run migrate-admin`

---

## Fase 4 — Servicio de email (Resend)

Crear `packages/api/src/services/email.js`:

```js
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.EMAIL_FROM || 'noreply@resend.dev';
const APP_URL= process.env.APP_URL    || 'http://localhost:5173';

/**
 * Envía email de activación de cuenta al registrarse.
 */
async function sendActivationEmail(to, token) {
  const link = `${APP_URL}/activate?token=${token}`;

  await resend.emails.send({
    from:    FROM,
    to,
    subject: 'Activa tu cuenta — LLM Observatory',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="color:#0f172a;margin-bottom:8px">Activa tu cuenta</h2>
        <p style="color:#475569;margin-bottom:24px">
          Haz clic en el botón de abajo para activar tu cuenta en LLM Observatory.
          Este link expira en <strong>24 horas</strong>.
        </p>
        <a href="${link}"
           style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;
                  padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">
          Activar cuenta
        </a>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px">
          Si no creaste esta cuenta, ignora este email.<br>
          O copia este link: ${link}
        </p>
      </div>
    `,
  });
}

/**
 * Envía email de restablecimiento de contraseña.
 */
async function sendPasswordResetEmail(to, token) {
  const link = `${APP_URL}/reset-password?token=${token}`;

  await resend.emails.send({
    from:    FROM,
    to,
    subject: 'Restablece tu contraseña — LLM Observatory',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="color:#0f172a;margin-bottom:8px">Restablecer contraseña</h2>
        <p style="color:#475569;margin-bottom:24px">
          Recibimos una solicitud para restablecer la contraseña de <strong>${to}</strong>.
          Este link expira en <strong>1 hora</strong>.
        </p>
        <a href="${link}"
           style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;
                  padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">
          Cambiar contraseña
        </a>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px">
          Si no solicitaste esto, ignora este email. Tu contraseña no cambiará.<br>
          O copia este link: ${link}
        </p>
      </div>
    `,
  });
}

module.exports = { sendActivationEmail, sendPasswordResetEmail };
```

---

## Fase 5 — Rutas de autenticación

Reemplazar `packages/api/src/routes/auth.js` con la versión completa:

### 5.1 Estructura de rutas a implementar

| Método | Ruta                       | Auth | Descripción                              |
|--------|----------------------------|------|------------------------------------------|
| POST   | `/api/auth/login`          | No   | Login — ahora consulta tabla `users`     |
| GET    | `/api/auth/me`             | Sí   | Sesión actual (no cambia)                |
| POST   | `/api/auth/register`       | No   | Crear cuenta → envía email activación    |
| GET    | `/api/auth/activate`       | No   | `?token=xxx` → activa cuenta             |
| POST   | `/api/auth/forgot-password`| No   | Solicitar reset → envía email            |
| POST   | `/api/auth/reset-password` | No   | `{ token, new_password }` → cambia pass  |

Añadir las nuevas rutas públicas en `middleware/auth.js`:

```js
const PUBLIC_PATHS = [
  { method: 'GET',  regex: /^\/health$/ },
  { method: 'POST', regex: /^\/api\/auth\/login$/ },
  { method: 'POST', regex: /^\/api\/auth\/register$/ },
  { method: 'GET',  regex: /^\/api\/auth\/activate$/ },
  { method: 'POST', regex: /^\/api\/auth\/forgot-password$/ },
  { method: 'POST', regex: /^\/api\/auth\/reset-password$/ },
  { method: 'POST', regex: /^\/api\/metrics$/ },
];
```

### 5.2 Código de las nuevas rutas

```js
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const { z }  = require('zod');
const pool   = require('../db/pool');
const { sendActivationEmail, sendPasswordResetEmail } = require('../services/email');

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email y password son requeridos' });

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user   = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Credenciales incorrectas' });

    if (!user.is_active)
      return res.status(403).json({ error: 'Cuenta no activada. Revisa tu email.' });

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    res.json({ token, email: user.email });
  } catch (err) { next(err); }
});

// ── POST /api/auth/register ───────────────────────────────────────────────────
const RegisterSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = RegisterSchema.parse(req.body);

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length)
      return res.status(409).json({ error: 'Email ya registrado' });

    const hash  = await bcrypt.hash(password, 12);
    const token = crypto.randomBytes(32).toString('hex');

    await pool.query(
      `INSERT INTO users (email, password_hash, role, is_active, activation_token)
       VALUES ($1, $2, 'viewer', false, $3)`,
      [email, hash, token]
    );

    await sendActivationEmail(email, token);

    res.status(201).json({ message: 'Cuenta creada. Revisa tu email para activarla.' });
  } catch (err) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ error: err.errors[0].message });
    next(err);
  }
});

// ── GET /api/auth/activate?token=xxx ─────────────────────────────────────────
router.get('/activate', async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token requerido' });

    const result = await pool.query(
      'SELECT id FROM users WHERE activation_token = $1 AND is_active = false',
      [token]
    );
    if (!result.rows.length)
      return res.status(400).json({ error: 'Token inválido o ya usado' });

    await pool.query(
      'UPDATE users SET is_active = true, activation_token = NULL WHERE id = $1',
      [result.rows[0].id]
    );

    // Redirigir al frontend con mensaje de éxito
    res.redirect(`${process.env.APP_URL}/login?activated=1`);
  } catch (err) { next(err); }
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

    // Respuesta genérica — no revelar si el email existe o no
    if (result.rows.length) {
      const token   = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      await pool.query(
        'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
        [token, expires.toISOString(), result.rows[0].id]
      );

      await sendPasswordResetEmail(email, token);
    }

    res.json({ message: 'Si el email existe recibirás un link en breve.' });
  } catch (err) { next(err); }
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────
const ResetSchema = z.object({
  token:        z.string().min(1),
  new_password: z.string().min(8, 'Mínimo 8 caracteres'),
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, new_password } = ResetSchema.parse(req.body);

    const result = await pool.query(
      `SELECT id FROM users
       WHERE reset_token = $1 AND reset_token_expires > NOW()`,
      [token]
    );
    if (!result.rows.length)
      return res.status(400).json({ error: 'Token inválido o expirado' });

    const hash = await bcrypt.hash(new_password, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [hash, result.rows[0].id]
    );

    res.json({ message: 'Contraseña actualizada correctamente.' });
  } catch (err) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ error: err.errors[0].message });
    next(err);
  }
});
```

---

## Fase 6 — Frontend

### 6.1 Páginas a crear

#### `packages/web/src/pages/ForgotPassword.jsx`

Formulario simple con un input de email. Al enviar llama a
`POST /api/auth/forgot-password` y muestra el mensaje de confirmación.

```
Estado: email → enviando → "Revisa tu email"
```

Campos:
- `email` (input type="email")
- Botón "Enviar instrucciones"
- Link "← Volver al login"

Llamada a la API:
```js
await fetch('/api/auth/forgot-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email })
});
```

---

#### `packages/web/src/pages/ResetPassword.jsx`

Lee `?token=` de la URL. Muestra un formulario con nueva contraseña + confirmación.

```
Estado: loading validación → form → enviando → éxito/error
```

Campos:
- `new_password` (input type="password", min 8 chars)
- `confirm_password` (validación client-side: deben coincidir)
- Botón "Cambiar contraseña"

Al éxito: redirigir a `/login?reset=1`.

Llamada a la API:
```js
const params = new URLSearchParams(window.location.search);
const token  = params.get('token');

await fetch('/api/auth/reset-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token, new_password })
});
```

---

#### `packages/web/src/pages/Activate.jsx`

Página que se abre cuando el usuario hace clic en el link del email de activación.
En realidad la activación la hace el **backend con un redirect**, así que esta
página solo necesita leer `?activated=1` en `/login` y mostrar un toast/banner
"Cuenta activada. Ya puedes ingresar."

Alternativa si prefieres SPA pura (sin redirect del backend):
- El link del email apunta a `/activate?token=xxx` en el frontend
- Esta página llama a `GET /api/auth/activate?token=xxx`
- Muestra éxito y redirige a `/login`

---

### 6.2 Modificar `Login.jsx`

Añadir debajo del formulario:

```jsx
{/* Forgot password link */}
<div className="text-center mt-4">
  <Link to="/forgot-password"
    className="text-xs text-slate-500 hover:text-blue-400 transition-colors">
    ¿Olvidaste tu contraseña?
  </Link>
</div>
```

Leer el param `?activated=1` y `?reset=1` para mostrar banners de éxito:

```jsx
const params = new URLSearchParams(window.location.search);
const justActivated = params.get('activated') === '1';
const justReset     = params.get('reset')     === '1';

// En el JSX, encima del formulario:
{justActivated && (
  <div className="...text-emerald-400 bg-emerald-900/20 border border-emerald-800/40 rounded-lg px-3 py-2.5 mb-4 text-sm">
    ✓ Cuenta activada. Ya puedes ingresar.
  </div>
)}
{justReset && (
  <div className="...">
    ✓ Contraseña actualizada. Ingresa con tu nueva contraseña.
  </div>
)}
```

---

### 6.3 Añadir rutas en `App.jsx`

```jsx
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword  from './pages/ResetPassword';

// Dentro del bloque de rutas públicas (junto a /login):
<Route path="/forgot-password" element={<ForgotPassword />} />
<Route path="/reset-password"  element={<ResetPassword  />} />
```

Estas rutas **no** deben estar dentro del `ProtectedRoute`.

---

## Fase 7 — Orden de implementación recomendado

```
1. Añadir variables de entorno al .env
2. Actualizar schema.sql con la tabla users
3. Ejecutar: npm run migrate (crea la tabla)
4. Ejecutar: npm run migrate-admin (migra el usuario admin)
5. Crear packages/api/src/services/email.js
6. Actualizar packages/api/src/routes/auth.js con las nuevas rutas
7. Actualizar packages/api/src/middleware/auth.js con las rutas públicas
8. Crear ForgotPassword.jsx y ResetPassword.jsx
9. Modificar Login.jsx (link + banners)
10. Añadir las nuevas rutas en App.jsx
11. Probar el flujo completo
```

---

## Consideraciones de seguridad

| Punto | Decisión tomada |
|-------|----------------|
| Tokens de reset | `crypto.randomBytes(32)` — 256 bits de entropía, imposible de adivinar |
| Expiración reset | 1 hora — ventana corta para minimizar exposición |
| Expiración activación | 24 horas — más tiempo para que el usuario revise el email |
| Respuesta forgot-password | Siempre el mismo mensaje, tanto si el email existe como si no. Evita email enumeration |
| Tokens de un solo uso | Tras usar un token (activación o reset) se borra de la BD inmediatamente |
| bcrypt rounds | 12 — balance entre seguridad y velocidad en 2026 |

---

## Testing del flujo

```bash
# 1. Solicitar reset
curl -X POST http://localhost:3001/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com"}'

# 2. Tomar el token de la BD para probar
psql $DATABASE_URL -c "SELECT reset_token FROM users WHERE email='admin@example.com';"

# 3. Cambiar contraseña
curl -X POST http://localhost:3001/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"<token_del_paso_2>","new_password":"nuevapass123"}'

# 4. Login con nueva contraseña
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"nuevapass123"}'
```
