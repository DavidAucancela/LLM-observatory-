const express = require('express');
const { z } = require('zod');
const pool = require('../db/pool');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const BalanceSchema = z.object({
  provider: z.enum(['anthropic', 'openai']),
  amount_usd: z.number().positive(),
  note: z.string().max(200).optional()
});

router.get('/', async (req, res) => {
  try {
    const range = req.query.range || '30d';
    const rangeMap = { '24h': '24 hours', '7d': '7 days', '30d': '30 days', 'all': '3650 days' };
    const interval = rangeMap[range] || '30 days';

    const [balances, spending] = await Promise.all([
      pool.query('SELECT * FROM provider_balances ORDER BY recharged_at DESC'),
      pool.query(`
        SELECT provider, COALESCE(SUM(cost_usd), 0) as spent
        FROM api_calls
        WHERE timestamp > NOW() - INTERVAL '${interval}'
        GROUP BY provider
      `)
    ]);

    const totalLoaded = { anthropic: 0, openai: 0 };
    for (const b of balances.rows) {
      totalLoaded[b.provider] = (totalLoaded[b.provider] || 0) + parseFloat(b.amount_usd);
    }

    const totalSpent = { anthropic: 0, openai: 0 };
    for (const s of spending.rows) {
      totalSpent[s.provider] = parseFloat(s.spent);
    }

    const providers = ['anthropic', 'openai'].map(p => ({
      provider: p,
      total_loaded: totalLoaded[p] || 0,
      total_spent: totalSpent[p] || 0,
      remaining: Math.max(0, (totalLoaded[p] || 0) - (totalSpent[p] || 0)),
      pct_used: totalLoaded[p] > 0 ? Math.min(100, ((totalSpent[p] || 0) / totalLoaded[p]) * 100) : 0
    }));

    res.json({ providers, history: balances.rows });
  } catch (err) {
    console.error('GET /api/balances error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const data = BalanceSchema.parse(req.body);
    const result = await pool.query(
      'INSERT INTO provider_balances (provider, amount_usd, note) VALUES ($1, $2, $3) RETURNING *',
      [data.provider, data.amount_usd, data.note || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM provider_balances WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
