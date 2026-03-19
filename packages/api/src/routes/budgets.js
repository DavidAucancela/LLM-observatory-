const express = require('express');
const { z } = require('zod');
const pool = require('../db/pool');

const router = express.Router();

const BudgetSchema = z.object({
  name: z.string().min(1).max(100),
  limit_usd: z.number().positive(),
  period: z.enum(['daily', 'weekly', 'monthly']).default('monthly')
});

router.get('/', async (req, res) => {
  try {
    const budgets = await pool.query('SELECT * FROM budgets ORDER BY created_at DESC');

    // Calculate current spend for each budget
    const budgetsWithSpend = await Promise.all(budgets.rows.map(async (budget) => {
      const periodMap = { daily: '1 day', weekly: '7 days', monthly: '30 days' };
      const interval = periodMap[budget.period] || '30 days';
      const spend = await pool.query(
        `SELECT COALESCE(SUM(cost_usd), 0) as current_spend FROM api_calls WHERE timestamp > NOW() - INTERVAL '${interval}'`
      );
      return { ...budget, current_spend: parseFloat(spend.rows[0].current_spend) };
    }));

    res.json({ data: budgetsWithSpend });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = BudgetSchema.parse(req.body);
    const result = await pool.query(
      'INSERT INTO budgets (name, limit_usd, period) VALUES ($1, $2, $3) RETURNING *',
      [data.name, data.limit_usd, data.period]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM budgets WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
