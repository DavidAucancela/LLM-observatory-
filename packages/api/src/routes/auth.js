const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const { z }   = require('zod');
const pool    = require('../db/pool');
const { sendActivationEmail, sendPasswordResetEmail } = require('../services/email');

const router = express.Router();

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email y password son requeridos' });

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user   = result.rows[0];

    // Generic message — don't reveal whether the email exists
    const invalid = !user || !(await bcrypt.compare(password, user.password_hash));
    if (invalid)
      return res.status(401).json({ error: 'Credenciales incorrectas' });

    if (!user.is_active)
      return res.status(403).json({ error: 'Cuenta no activada. Revisa tu email para el link de activación.' });

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    res.json({ token, email: user.email });
  } catch (err) { next(err); }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  res.json({ email: req.user.email, role: req.user.role });
});

// ── POST /api/auth/register ───────────────────────────────────────────────────
const RegisterSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = RegisterSchema.parse(req.body);

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length)
      return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });

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
      `SELECT id FROM users
       WHERE activation_token = $1 AND is_active = false`,
      [token]
    );

    if (!result.rows.length)
      return res.status(400).json({ error: 'Token inválido o ya utilizado' });

    await pool.query(
      `UPDATE users SET is_active = true, activation_token = NULL WHERE id = $1`,
      [result.rows[0].id]
    );

    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    res.redirect(`${appUrl}/login?activated=1`);
  } catch (err) { next(err); }
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

    // Always return the same response to avoid email enumeration
    if (result.rows.length) {
      const token   = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await pool.query(
        `UPDATE users
         SET reset_token = $1, reset_token_expires = $2
         WHERE id = $3`,
        [token, expires.toISOString(), result.rows[0].id]
      );

      // Fire-and-forget but log errors
      sendPasswordResetEmail(email, token).catch(err =>
        console.error('[email] sendPasswordResetEmail failed:', err.message)
      );
    }

    res.json({ message: 'Si el email está registrado recibirás un link en breve.' });
  } catch (err) { next(err); }
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────
const ResetSchema = z.object({
  token:        z.string().min(1, 'Token requerido'),
  new_password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
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
      `UPDATE users
       SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL
       WHERE id = $2`,
      [hash, result.rows[0].id]
    );

    res.json({ message: 'Contraseña actualizada correctamente.' });
  } catch (err) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ error: err.errors[0].message });
    next(err);
  }
});

module.exports = router;
