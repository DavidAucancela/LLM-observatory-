# Email Auth — Implementation Status

> **Status: IMPLEMENTED** — All phases described here have been completed as part of the multi-tenancy milestone. This document is kept as a reference for the design decisions made.

---

## What was implemented

### Database (`packages/api/src/db/schema.sql`)

- `users` table: `email`, `password_hash`, `is_active`, `activation_token`, `reset_token`, `reset_token_expires`, `last_login_at`
- `organizations` table: one org per registered account (or shared org for invited members)
- `org_members` table: `user_id`, `org_id`, `role` (`admin` | `member`)
- `invitations` table: email invitations with 7-day expiry tokens
- `observatory_tokens` table: `obs_sk_` tokens for SDK metric auth (SHA-256 hash stored)
- Backfill migration: existing data assigned to a "Default Organization"

### Email service (`packages/api/src/services/email.js`)

Uses Resend SDK. Three email types:
- `sendActivationEmail(to, token)` — account activation link (`/activate?token=`)
- `sendPasswordResetEmail(to, token)` — 1-hour password reset link (`/reset-password?token=`)
- `sendInviteEmail(to, token, orgName)` — team invitation link (`/accept-invite?token=`)

### Auth routes (`packages/api/src/routes/auth.js`)

| Route | Description |
|-------|-------------|
| `POST /api/auth/register` | Creates user + org + org_member in a DB transaction. Sends activation email. |
| `POST /api/auth/login` | Queries `org_members JOIN organizations` for role + org data. JWT includes `orgId`, `role`. |
| `GET /api/auth/me` | Returns `{ id, email, role, orgId, orgName }`. |
| `GET /api/auth/activate` | Activates account with token. Redirects to `/login?activated=1`. |
| `POST /api/auth/forgot-password` | Generates reset token (1h), sends email. Generic response to prevent email enumeration. |
| `POST /api/auth/reset-password` | Validates token expiry, bcrypt-hashes new password, clears token. |
| `GET /api/auth/invite-info` | Public — returns org name + inviter email for AcceptInvite page. |
| `POST /api/auth/accept-invite` | Handles: new user creation OR existing user login; adds to org; marks invite accepted. |

### Auth middleware (`packages/api/src/middleware/auth.js`)

- Public paths listed explicitly (all auth routes, `/health`)
- `POST /api/metrics` requires Observatory token (`obs_sk_` prefix), not JWT
- `resolveObservatoryToken(raw)`: SHA-256 hash lookup → sets `req.user = { orgId, isObservatoryToken: true }`
- `requireAdmin`: blocks observatory tokens + checks `role === 'admin'`

### Frontend pages

- `Register.jsx` — email + optional org name + password + confirm. On success shows "check your email" message.
- `Login.jsx` — shows banners for `?activated=1` and `?reset=1` query params.
- `ForgotPassword.jsx` — email input → "check your email" state.
- `ResetPassword.jsx` — reads `?token=` from URL, password + confirm form.
- `AcceptInvite.jsx` — reads `?token=` from URL, fetches invite-info, shows org name + email + password form.

All pages use `.theme-light obs-login-root` layout with the Observatory brand mark.

---

## Security decisions

| Point | Decision |
|-------|----------|
| Activation tokens | `crypto.randomBytes(32)` — 256-bit entropy |
| Reset token expiry | 1 hour |
| Invite token expiry | 7 days |
| Password hashing | bcrypt cost 12 |
| Forgot-password response | Always same message regardless of email existence (prevents enumeration) |
| Tokens are single-use | Cleared from DB immediately after use |
| Observatory tokens | SHA-256 hash stored; full value shown once at creation only |
| org_id scoping | All queries include `org_id = $1` — tenant isolation enforced at DB layer |

---

## Testing the flows

```bash
# Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"mypassword","org_name":"Acme"}'

# Check activation token (dev only — in prod check email)
psql $DATABASE_URL -c "SELECT activation_token FROM users WHERE email='you@example.com';"

# Activate
curl "http://localhost:3001/api/auth/activate?token=<token>"

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"mypassword"}'

# Request password reset
curl -X POST http://localhost:3001/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}'

# Get reset token (dev only)
psql $DATABASE_URL -c "SELECT reset_token FROM users WHERE email='you@example.com';"

# Reset password
curl -X POST http://localhost:3001/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"<reset_token>","new_password":"newpassword123"}'

# Create Observatory token (requires JWT)
curl -X POST http://localhost:3001/api/tokens \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-app-production"}'
# Returns obs_sk_... — store it, shown only once

# Invite a team member (requires JWT + admin role)
curl -X POST http://localhost:3001/api/team/invite \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"email":"colleague@example.com"}'
```

---

## Environment variables required

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com    # Must be verified domain in Resend (or use onboarding@resend.dev in sandbox)
APP_URL=http://localhost:5173        # Used in email links
JWT_SECRET=<64-byte hex>
ENCRYPTION_KEY=<32-byte hex>
```
