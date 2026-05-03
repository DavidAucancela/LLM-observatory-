const express = require('express');
const { z } = require('zod');
const pool = require('../db/pool');
const { sendDiscordAlert } = require('../jobs/alertChecker');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const RuleSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'all']).default('all'),
  metric: z.enum(['daily_spend']).default('daily_spend'),
  threshold_usd: z.number().positive(),
  discord_webhook_url: z.string().url(),
  debounce_hours: z.number().int().min(1).max(168).default(6),
});

router.get('/rules', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM alert_rules ORDER BY created_at DESC');
    res.json({ rules: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/rules', requireAdmin, async (req, res) => {
  try {
    const data = RuleSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO alert_rules (provider, metric, threshold_usd, discord_webhook_url, debounce_hours) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.provider, data.metric, data.threshold_usd, data.discord_webhook_url, data.debounce_hours]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/rules/:id', requireAdmin, async (req, res) => {
  try {
    const { enabled, threshold_usd, discord_webhook_url, debounce_hours } = req.body;
    const sets = [];
    const vals = [];
    if (enabled !== undefined) { vals.push(enabled); sets.push(`enabled = $${vals.length}`); }
    if (threshold_usd !== undefined) { vals.push(threshold_usd); sets.push(`threshold_usd = $${vals.length}`); }
    if (discord_webhook_url !== undefined) { vals.push(discord_webhook_url); sets.push(`discord_webhook_url = $${vals.length}`); }
    if (debounce_hours !== undefined) { vals.push(parseInt(debounce_hours, 10) || 6); sets.push(`debounce_hours = $${vals.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(req.params.id);
    const result = await pool.query(`UPDATE alert_rules SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/rules/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM alert_rules WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ah.*, ar.provider as rule_provider, ar.threshold_usd as rule_threshold, ar.discord_webhook_url
       FROM alert_history ah
       LEFT JOIN alert_rules ar ON ah.rule_id = ar.id
       ORDER BY ah.sent_at DESC LIMIT 50`
    );
    res.json({ history: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/rules/:id/test', requireAdmin, async (req, res) => {
  try {
    const rule = await pool.query('SELECT * FROM alert_rules WHERE id = $1', [req.params.id]);
    if (!rule.rows.length) return res.status(404).json({ error: 'Rule not found' });
    const r = rule.rows[0];
    const success = await sendDiscordAlert(r.discord_webhook_url, r.provider, 99.99, parseFloat(r.threshold_usd), true);
    res.json({ success, message: success ? 'Alerta de prueba enviada a Discord' : 'Error al enviar la alerta' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
