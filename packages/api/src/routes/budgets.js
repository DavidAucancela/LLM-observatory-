const express = require('express');
const { z } = require('zod');
const pool = require('../db/pool');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const BudgetSchema = z.object({
  name:      z.string().min(1).max(100),
  limit_usd: z.number().positive(),
  period:    z.enum(['daily', 'weekly', 'monthly']).default('monthly'),
});

router.get('/', async (req, res) => {
  try {
    const { orgId } = req.user;
    const budgets = await pool.query(
      'SELECT * FROM budgets WHERE org_id = $1 ORDER BY created_at DESC',
      [orgId]
    );

    const periodMap = { daily: '1 day', weekly: '7 days' };
    const budgetsWithSpend = await Promise.all(budgets.rows.map(async (budget) => {
      const interval = periodMap[budget.period];
      const sinceClause = interval
        ? `NOW() - INTERVAL '${interval}'`
        : `DATE_TRUNC('month', NOW())`;
      const spend = await pool.query(
        `SELECT COALESCE(SUM(cost_usd), 0) as current_spend
         FROM api_calls WHERE org_id = $1 AND timestamp > ${sinceClause}`,
        [orgId]
      );
      return { ...budget, current_spend: parseFloat(spend.rows[0].current_spend) };
    }));

    res.json({ data: budgetsWithSpend });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { orgId } = req.user;
    const data = BudgetSchema.parse(req.body);
    const result = await pool.query(
      'INSERT INTO budgets (org_id, name, limit_usd, period) VALUES ($1, $2, $3, $4) RETURNING *',
      [orgId, data.name, data.limit_usd, data.period]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { orgId } = req.user;
    await pool.query('DELETE FROM budgets WHERE id = $1 AND org_id = $2', [req.params.id, orgId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
