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

    const invalid = !user || !(await bcrypt.compare(password, user.password_hash));
    if (invalid)
      return res.status(401).json({ error: 'Credenciales incorrectas' });

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const memberRes = await pool.query(
      `SELECT m.org_id, m.role, o.name as org_name
       FROM org_members m JOIN organizations o ON o.id = m.org_id
       WHERE m.user_id = $1 ORDER BY m.joined_at ASC LIMIT 1`,
      [user.id]
    );

    if (!memberRes.rows.length)
      return res.status(403).json({ error: 'No perteneces a ninguna organización' });

    const { org_id, role, org_name } = memberRes.rows[0];

    const token = jwt.sign(
      { id: user.id, email: user.email, orgId: org_id, role, jti: crypto.randomUUID() },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    res.json({ token, email: user.email, orgId: org_id, orgName: org_name, role });
  } catch (err) { next(err); }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', async (req, res, next) => {
  try {
    const [userRes, orgRes] = await Promise.all([
      pool.query('SELECT created_at, last_login_at FROM users WHERE id = $1', [req.user.id]),
      pool.query('SELECT name FROM organizations WHERE id = $1', [req.user.orgId]),
    ]);
    res.json({
      id:          req.user.id,
      email:       req.user.email,
      role:        req.user.role,
      orgId:       req.user.orgId,
      orgName:     orgRes.rows[0]?.name || null,
      createdAt:   userRes.rows[0]?.created_at || null,
      lastLoginAt: userRes.rows[0]?.last_login_at || null,
    });
  } catch (err) { next(err); }
});

// ── POST /api/auth/register ───────────────────────────────────────────────────
const RegisterSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  org_name: z.string().min(1).max(100).optional(),
});

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, org_name } = RegisterSchema.parse(req.body);

    const existing = await pool.query('SELECT id, is_active FROM users WHERE email = $1', [email]);

    if (existing.rows.length)
      return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const hash  = await bcrypt.hash(password, 12);

      const userRes = await client.query(
        `INSERT INTO users (email, password_hash, role, is_active)
         VALUES ($1, $2, 'admin', true) RETURNING id`,
        [email, hash]
      );
      const userId = userRes.rows[0].id;

      const rawName = (org_name?.trim()) || (email.split('@')[0] + "'s Organization");
      let slug = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
      const slugExists = await client.query('SELECT id FROM organizations WHERE slug = $1', [slug]);
      if (slugExists.rows.length) slug = slug + '-' + Date.now();

      const orgRes = await client.query(
        `INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id`,
        [rawName, slug]
      );
      const orgId = orgRes.rows[0].id;

      await client.query(
        `INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'admin')`,
        [orgId, userId]
      );

      await client.query('COMMIT');

      res.status(201).json({ message: 'Cuenta creada exitosamente.' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
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
      `SELECT id FROM users WHERE activation_token = $1 AND is_active = false`,
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

// ── GET /api/auth/invite-info?token=xxx (public) ──────────────────────────────
router.get('/invite-info', async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token requerido' });

    const result = await pool.query(
      `SELECT i.email, i.role, o.name as org_name, u.email as invited_by_email
       FROM invitations i
       JOIN organizations o ON o.id = i.org_id
       LEFT JOIN users u ON u.id = i.invited_by
       WHERE i.token = $1 AND i.accepted_at IS NULL AND i.expires_at > NOW()`,
      [token]
    );

    if (!result.rows.length)
      return res.status(400).json({ error: 'Invitación inválida o expirada' });

    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// ── POST /api/auth/accept-invite (public) ─────────────────────────────────────
router.post('/accept-invite', async (req, res, next) => {
  try {
    const { token, email, password } = req.body;
    if (!token) return res.status(400).json({ error: 'Token requerido' });

    const inviteRes = await pool.query(
      `SELECT * FROM invitations
       WHERE token = $1 AND accepted_at IS NULL AND expires_at > NOW()`,
      [token]
    );

    if (!inviteRes.rows.length)
      return res.status(400).json({ error: 'Invitación inválida o expirada' });

    const invite = inviteRes.rows[0];

    // Logged-in user accepting
    const authHeader = req.headers['authorization'];
    let userId, userEmail;

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
        userId    = payload.id;
        userEmail = payload.email;
      } catch {
        return res.status(401).json({ error: 'Token de autenticación inválido' });
      }
    } else {
      if (!email || !password)
        return res.status(400).json({ error: 'Email y contraseña requeridos' });
      if (password.length < 8)
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

      const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

      if (existingUser.rows.length) {
        const user = existingUser.rows[0];
        if (!user.is_active)
          return res.status(403).json({ error: 'Cuenta no activada' });
        if (!(await bcrypt.compare(password, user.password_hash)))
          return res.status(401).json({ error: 'Contraseña incorrecta' });
        userId    = user.id;
        userEmail = user.email;
      } else {
        const hash    = await bcrypt.hash(password, 12);
        const newUser = await pool.query(
          `INSERT INTO users (email, password_hash, role, is_active)
           VALUES ($1, $2, 'member', true) RETURNING id, email`,
          [email || invite.email, hash]
        );
        userId    = newUser.rows[0].id;
        userEmail = newUser.rows[0].email;
      }
    }

    const already = await pool.query(
      'SELECT id FROM org_members WHERE org_id = $1 AND user_id = $2',
      [invite.org_id, userId]
    );
    if (!already.rows.length) {
      await pool.query(
        `INSERT INTO org_members (org_id, user_id, role, invited_by)
         VALUES ($1, $2, $3, $4)`,
        [invite.org_id, userId, invite.role, invite.invited_by]
      );
    }

    await pool.query('UPDATE invitations SET accepted_at = NOW() WHERE id = $1', [invite.id]);

    const orgRes = await pool.query('SELECT name FROM organizations WHERE id = $1', [invite.org_id]);
    const orgName = orgRes.rows[0]?.name;

    const jwtToken = jwt.sign(
      { id: userId, email: userEmail, orgId: invite.org_id, role: invite.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ token: jwtToken, email: userEmail, orgId: invite.org_id, orgName, role: invite.role });
  } catch (err) { next(err); }
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

    if (result.rows.length) {
      const token   = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000);

      await pool.query(
        `UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3`,
        [token, expires.toISOString(), result.rows[0].id]
      );

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
      `SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()`,
      [token]
    );

    if (!result.rows.length)
      return res.status(400).json({ error: 'Token inválido o expirado' });

    const hash = await bcrypt.hash(new_password, 12);
    await pool.query(
      `UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2`,
      [hash, result.rows[0].id]
    );

    res.json({ message: 'Contraseña actualizada correctamente.' });
  } catch (err) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ error: err.errors[0].message });
    next(err);
  }
});

// ── PUT /api/auth/profile ─────────────────────────────────────────────────────
const ProfileSchema = z.object({
  email:    z.string().email('Email inválido').optional(),
  org_name: z.string().min(1, 'El nombre no puede estar vacío').max(100).optional(),
});

router.put('/profile', async (req, res, next) => {
  try {
    const { email, org_name } = ProfileSchema.parse(req.body);
    const userId = req.user.id;
    const orgId  = req.user.orgId;

    if (email && email !== req.user.email) {
      const dup = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId]
      );
      if (dup.rows.length)
        return res.status(409).json({ error: 'Ese email ya está en uso por otra cuenta' });

      await pool.query('UPDATE users SET email = $1 WHERE id = $2', [email, userId]);
    }

    if (org_name && req.user.role === 'admin') {
      await pool.query(
        'UPDATE organizations SET name = $1 WHERE id = $2',
        [org_name.trim(), orgId]
      );
    }

    const [userRow, orgRow] = await Promise.all([
      pool.query('SELECT email, created_at, last_login_at FROM users WHERE id = $1', [userId]),
      pool.query('SELECT name FROM organizations WHERE id = $1', [orgId]),
    ]);

    res.json({
      email:       userRow.rows[0].email,
      orgName:     orgRow.rows[0]?.name || null,
      createdAt:   userRow.rows[0].created_at,
      lastLoginAt: userRow.rows[0].last_login_at,
    });
  } catch (err) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ error: err.errors[0].message });
    next(err);
  }
});

// ── PUT /api/auth/password ────────────────────────────────────────────────────
const ChangePasswordSchema = z.object({
  current_password: z.string().min(1, 'Contraseña actual requerida'),
  new_password:     z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
});

router.put('/password', async (req, res, next) => {
  try {
    const { current_password, new_password } = ChangePasswordSchema.parse(req.body);
    const userId = req.user.id;

    const userRes = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );
    const valid = await bcrypt.compare(current_password, userRes.rows[0].password_hash);
    if (!valid)
      return res.status(401).json({ error: 'La contraseña actual es incorrecta' });

    if (current_password === new_password)
      return res.status(400).json({ error: 'La nueva contraseña debe ser diferente a la actual' });

    const hash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);

    res.json({ message: 'Contraseña actualizada correctamente.' });
  } catch (err) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ error: err.errors[0].message });
    next(err);
  }
});

// ── POST /api/auth/logout — server-side JWT revocation via JTI blacklist ───────
router.post('/logout', async (req, res, next) => {
  try {
    const { jti, exp } = req.user;
    if (jti && exp) {
      await pool.query(
        `INSERT INTO revoked_tokens (jti, exp) VALUES ($1, to_timestamp($2)) ON CONFLICT DO NOTHING`,
        [jti, exp]
      );
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
