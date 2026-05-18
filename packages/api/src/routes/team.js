const express = require('express');
const crypto  = require('crypto');
const { z }   = require('zod');
const pool    = require('../db/pool');
const { requireAdmin } = require('../middleware/auth');
const { sendInviteEmail } = require('../services/email');

const router = express.Router();

// GET /api/team/members
router.get('/members', async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const result = await pool.query(
      `SELECT u.id, u.email, m.role, m.joined_at, ib.email as invited_by_email
       FROM org_members m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN users ib ON ib.id = m.invited_by
       WHERE m.org_id = $1 ORDER BY m.joined_at ASC`,
      [orgId]
    );
    res.json({ members: result.rows });
  } catch (err) { next(err); }
});

// DELETE /api/team/members/:userId — remove member (admin only, cannot remove self)
router.delete('/members/:userId', requireAdmin, async (req, res, next) => {
  try {
    const { orgId, id: currentUserId } = req.user;
    const targetId = parseInt(req.params.userId);
    if (isNaN(targetId)) return res.status(400).json({ error: 'ID inválido' });
    if (targetId === currentUserId) return res.status(400).json({ error: 'No puedes removerte a ti mismo' });

    await pool.query(
      'DELETE FROM org_members WHERE org_id = $1 AND user_id = $2',
      [orgId, targetId]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/team/invitations — list pending invitations
router.get('/invitations', requireAdmin, async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const result = await pool.query(
      `SELECT i.id, i.email, i.role, i.expires_at, i.created_at, u.email as invited_by_email
       FROM invitations i
       LEFT JOIN users u ON u.id = i.invited_by
       WHERE i.org_id = $1 AND i.accepted_at IS NULL AND i.expires_at > NOW()
       ORDER BY i.created_at DESC`,
      [orgId]
    );
    res.json({ invitations: result.rows });
  } catch (err) { next(err); }
});

const InviteSchema = z.object({
  email: z.string().email('Email inválido'),
  role:  z.enum(['admin', 'member']).default('member'),
});

// POST /api/team/invite — send invitation
router.post('/invite', requireAdmin, async (req, res, next) => {
  try {
    const { email, role } = InviteSchema.parse(req.body);
    const { orgId, id: invitedBy } = req.user;

    const existing = await pool.query(
      `SELECT m.id FROM org_members m JOIN users u ON u.id = m.user_id
       WHERE m.org_id = $1 AND u.email = $2`,
      [orgId, email]
    );
    if (existing.rows.length)
      return res.status(409).json({ error: 'Este usuario ya es miembro de la organización' });

    await pool.query(
      'DELETE FROM invitations WHERE org_id = $1 AND email = $2 AND accepted_at IS NULL',
      [orgId, email]
    );

    const token    = crypto.randomBytes(32).toString('hex');
    const orgResult = await pool.query('SELECT name FROM organizations WHERE id = $1', [orgId]);

    await pool.query(
      `INSERT INTO invitations (org_id, email, role, token, invited_by) VALUES ($1, $2, $3, $4, $5)`,
      [orgId, email, role, token, invitedBy]
    );

    sendInviteEmail(email, token, orgResult.rows[0]?.name || 'Observatory').catch(err =>
      console.error('[email] sendInviteEmail failed:', err.message)
    );

    res.status(201).json({ success: true, message: 'Invitación enviada' });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    next(err);
  }
});

// DELETE /api/team/invitations/:id — cancel invitation
router.delete('/invitations/:id', requireAdmin, async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    await pool.query(
      'DELETE FROM invitations WHERE id = $1 AND org_id = $2 AND accepted_at IS NULL',
      [id, orgId]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
