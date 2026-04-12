const jwt = require('jsonwebtoken');

// Routes that bypass auth — the SDK must be able to POST metrics without a token
const PUBLIC_PATHS = [
  { method: 'GET',  regex: /^\/health$/ },
  { method: 'POST', regex: /^\/api\/auth\/login$/ },
  { method: 'POST', regex: /^\/api\/auth\/register$/ },
  { method: 'GET',  regex: /^\/api\/auth\/activate$/ },
  { method: 'POST', regex: /^\/api\/auth\/forgot-password$/ },
  { method: 'POST', regex: /^\/api\/auth\/reset-password$/ },
  { method: 'POST', regex: /^\/api\/metrics$/ },    // SDK ingest — no auth required
];

/**
 * Auth middleware — validates Bearer JWT token.
 * Skips public routes defined above.
 */
function authMiddleware(req, res, next) {
  const isPublic = PUBLIC_PATHS.some(
    p => p.method === req.method && p.regex.test(req.path)
  );
  if (isPublic) return next();

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado — token requerido' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = { authMiddleware };
