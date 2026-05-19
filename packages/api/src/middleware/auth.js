const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const pool   = require('../db/pool');

const OBS_PREFIX = 'obs_sk_';

// Routes that bypass auth entirely
const PUBLIC_PATHS = [
  { method: 'GET',  regex: /^\/health$/ },
  { method: 'POST', regex: /^\/api\/auth\/login$/ },
  { method: 'POST', regex: /^\/api\/auth\/register$/ },
  { method: 'GET',  regex: /^\/api\/auth\/activate$/ },
  { method: 'GET',  regex: /^\/api\/auth\/invite-info$/ },
  { method: 'POST', regex: /^\/api\/auth\/accept-invite$/ },
  { method: 'POST', regex: /^\/api\/auth\/forgot-password$/ },
  { method: 'POST', regex: /^\/api\/auth\/reset-password$/ },
];

async function resolveObservatoryToken(raw) {
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const result = await pool.query(
    `SELECT org_id FROM observatory_tokens WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hash]
  );
  if (!result.rows.length) return null;
  pool.query('UPDATE observatory_tokens SET last_used_at = NOW() WHERE token_hash = $1', [hash])
    .catch(() => {});
  return result.rows[0].org_id;
}

// Validates Bearer JWT or observatory token (obs_sk_*).
// POST /api/metrics now requires an observatory token — no longer public.
function authMiddleware(req, res, next) {
  const isPublic = PUBLIC_PATHS.some(p => p.method === req.method && p.regex.test(req.path));
  if (isPublic) return next();

  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado — token requerido' });
  }

  const token = authHeader.slice(7);

  if (token.startsWith(OBS_PREFIX)) {
    return resolveObservatoryToken(token)
      .then(orgId => {
        if (!orgId) return res.status(401).json({ error: 'Observatory token inválido o revocado' });
        req.user = { orgId, isObservatoryToken: true };
        next();
      })
      .catch(() => res.status(500).json({ error: 'Internal server error' }));
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.isObservatoryToken) {
    return res.status(403).json({ error: 'Se requiere autenticación de usuario' });
  }
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Se requiere rol administrador' });
  }
  next();
}

module.exports = { authMiddleware, requireAdmin };
