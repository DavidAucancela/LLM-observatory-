const express = require('express');
const { z } = require('zod');
const pool = require('../db/pool');
const { computeInsights } = require('../services/insights');

const router = express.Router();

const RANGES = ['24h', '7d', '30d', '90d'];

const DismissSchema = z.object({
  insight_key: z.string().min(1).max(200),
  hours:       z.number().int().min(1).max(168).default(24),
});

router.get('/summary', async (req, res) => {
  try {
    const { orgId } = req.user;
    const range = RANGES.includes(req.query.range) ? req.query.range : '7d';

    const [insights, dismissed] = await Promise.all([
      computeInsights(orgId, range),
      pool.query(
        `SELECT insight_key FROM insight_dismissals WHERE org_id = $1 AND dismissed_until > NOW()`,
        [orgId]
      ),
    ]);

    const dismissedKeys = new Set(dismissed.rows.map(r => r.insight_key));
    res.json({ insights: insights.filter(i => !dismissedKeys.has(i.insight_key)) });
  } catch (err) {
    console.error('GET /api/insights/summary error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/dismiss', async (req, res) => {
  try {
    const { orgId, id } = req.user;
    const { insight_key, hours } = DismissSchema.parse(req.body);
    await pool.query(
      `INSERT INTO insight_dismissals (org_id, insight_key, dismissed_until, dismissed_by)
       VALUES ($1, $2, NOW() + ($3 || ' hours')::interval, $4)
       ON CONFLICT (org_id, insight_key)
       DO UPDATE SET dismissed_until = EXCLUDED.dismissed_until, dismissed_by = EXCLUDED.dismissed_by`,
      [orgId, insight_key, hours, id ?? null]
    );
    res.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error('POST /api/insights/dismiss error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
