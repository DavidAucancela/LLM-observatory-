const express = require('express');
const crypto  = require('crypto');
const { z }   = require('zod');
const pool    = require('../db/pool');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
const OBS_PREFIX = 'obs_sk_';

// GET /api/tokens — list org tokens (hash never returned)
router.get('/', async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const result = await pool.query(
      `SELECT id, name, token_prefix, last_used_at, created_at, revoked_at
       FROM observatory_tokens WHERE org_id = $1 ORDER BY created_at DESC`,
      [orgId]
    );
    res.json({ tokens: result.rows });
  } catch (err) { next(err); }
});

// POST /api/tokens — create token (returns full value once, never again)
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { name } = z.object({ name: z.string().min(1).max(100) }).parse(req.body);
    const { orgId, id: userId } = req.user;

    const raw    = OBS_PREFIX + crypto.randomBytes(32).toString('hex');
    const hash   = crypto.createHash('sha256').update(raw).digest('hex');
    const prefix = raw.slice(0, 20);

    const result = await pool.query(
      `INSERT INTO observatory_tokens (org_id, name, token_hash, token_prefix, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, token_prefix, created_at`,
      [orgId, name, hash, prefix, userId]
    );

    res.status(201).json({ success: true, data: { ...result.rows[0], token: raw } });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    next(err);
  }
});

// DELETE /api/tokens/:id — revoke token
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const { orgId } = req.user;

    const result = await pool.query(
      `UPDATE observatory_tokens SET revoked_at = NOW()
       WHERE id = $1 AND org_id = $2 AND revoked_at IS NULL RETURNING id`,
      [id, orgId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Token no encontrado' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
