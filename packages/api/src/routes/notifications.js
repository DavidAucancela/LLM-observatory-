const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// Deliberately not a persisted notification feed — assembled on every GET
// from tables that already carry a real event timestamp. See schema.sql's
// comment on notification_reads for why "budget at 92%" isn't one of these
// sources (it's live state, not a dated event).
const MAX_NOTIFICATIONS = 20;

router.get('/', async (req, res) => {
  try {
    const { orgId, id: userId } = req.user;

    const [alerts, reconciliations, joins, readRow] = await Promise.all([
      pool.query(
        `SELECT id, provider, current_value, threshold_usd, success, sent_at
         FROM alert_history WHERE org_id = $1 ORDER BY sent_at DESC LIMIT $2`,
        [orgId, MAX_NOTIFICATIONS]
      ),
      pool.query(
        `SELECT id, provider, deviation_pct, status, source, created_at
         FROM reconciliation_runs
         WHERE org_id = $1 AND status IN ('alert', 'error')
         ORDER BY created_at DESC LIMIT $2`,
        [orgId, MAX_NOTIFICATIONS]
      ),
      pool.query(
        `SELECT id, email, accepted_at FROM invitations
         WHERE org_id = $1 AND accepted_at IS NOT NULL
         ORDER BY accepted_at DESC LIMIT $2`,
        [orgId, MAX_NOTIFICATIONS]
      ),
      pool.query(`SELECT last_read_at FROM notification_reads WHERE user_id = $1`, [userId]),
    ]);

    const lastReadAt = readRow.rows[0]?.last_read_at ?? null;

    const items = [
      ...alerts.rows.map(r => ({
        id: `budget_alert:${r.id}`,
        type: 'budget_alert',
        occurred_at: r.sent_at,
        data: {
          provider: r.provider,
          currentValue: parseFloat(r.current_value),
          thresholdUsd: parseFloat(r.threshold_usd),
          success: r.success,
        },
      })),
      ...reconciliations.rows.map(r => ({
        id: `reconciliation:${r.id}`,
        type: 'reconciliation',
        occurred_at: r.created_at,
        data: {
          provider: r.provider,
          deviationPct: parseFloat(r.deviation_pct),
          status: r.status,
        },
      })),
      ...joins.rows.map(r => ({
        id: `team_joined:${r.id}`,
        type: 'team_joined',
        occurred_at: r.accepted_at,
        data: { email: r.email },
      })),
    ];

    items.sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
    const top = items.slice(0, MAX_NOTIFICATIONS).map(n => ({
      ...n,
      read: lastReadAt !== null && new Date(n.occurred_at) <= new Date(lastReadAt),
    }));

    res.json({ notifications: top, unread_count: top.filter(n => !n.read).length });
  } catch (err) {
    console.error('GET /api/notifications error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/read-all', async (req, res) => {
  try {
    const { id: userId } = req.user;
    await pool.query(
      `INSERT INTO notification_reads (user_id, last_read_at) VALUES ($1, NOW())
       ON CONFLICT (user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at`,
      [userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/notifications/read-all error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
