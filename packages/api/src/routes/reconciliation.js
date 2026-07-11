const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// GET /api/reconciliation — recent reconciliation runs for this org (newest first)
router.get('/', async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
    const result = await pool.query(
      `SELECT provider, period_start, period_end, provider_computed_usd, client_reported_usd,
              deviation_pct, status, error_message, created_at
       FROM reconciliation_runs WHERE org_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [orgId, limit]
    );
    res.json({ runs: result.rows });
  } catch (err) { next(err); }
});

// GET /api/reconciliation/latest — most recent run per provider, for a dashboard
// "data confidence" indicator (no run yet = no admin key configured / job hasn't run).
router.get('/latest', async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const result = await pool.query(
      `SELECT DISTINCT ON (provider) provider, period_start, period_end, provider_computed_usd,
              client_reported_usd, deviation_pct, status, error_message, created_at
       FROM reconciliation_runs WHERE org_id = $1 ORDER BY provider, created_at DESC`,
      [orgId]
    );
    res.json({ latest: result.rows });
  } catch (err) { next(err); }
});

module.exports = router;
