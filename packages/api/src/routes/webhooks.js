const express = require('express');
const crypto  = require('crypto');
const { z }   = require('zod');
const pool    = require('../db/pool');

const router = express.Router();

const WebhookSchema = z.object({
  name:   z.string().min(1).max(100),
  url:    z.string().url(),
  events: z.array(z.string()).min(1).default(['metric.created']),
});

// List webhooks (secret shown as hint only)
router.get('/', async (req, res) => {
  try {
    const { orgId } = req.user;
    const { rows } = await pool.query(
      `SELECT id, name, url, events, is_active, created_at,
              '…' || RIGHT(secret, 4) AS secret_hint
       FROM webhook_endpoints
       WHERE org_id = $1
       ORDER BY created_at DESC`,
      [orgId]
    );
    res.json({ webhooks: rows });
  } catch (err) {
    console.error('GET /api/webhooks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create webhook (returns secret once)
router.post('/', async (req, res) => {
  try {
    const { orgId } = req.user;
    const data = WebhookSchema.parse(req.body);
    const secret = crypto.randomBytes(32).toString('hex');
    const { rows } = await pool.query(
      `INSERT INTO webhook_endpoints (org_id, name, url, secret, events)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, url, events, is_active, created_at`,
      [orgId, data.name, data.url, secret, data.events]
    );
    res.status(201).json({ ...rows[0], secret });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: err.errors });
    console.error('POST /api/webhooks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete webhook
router.delete('/:id', async (req, res) => {
  try {
    const { orgId } = req.user;
    const { rowCount } = await pool.query(
      `DELETE FROM webhook_endpoints WHERE id = $1 AND org_id = $2`,
      [req.params.id, orgId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Webhook not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/webhooks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test webhook — send a sample payload
router.post('/:id/test', async (req, res) => {
  try {
    const { orgId } = req.user;
    const { rows } = await pool.query(
      `SELECT url, secret FROM webhook_endpoints WHERE id = $1 AND org_id = $2`,
      [req.params.id, orgId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Webhook not found' });

    const { url, secret } = rows[0];
    const payload = JSON.stringify({
      event:     'webhook.test',
      timestamp: new Date().toISOString(),
      data:      { message: 'Test from LLM Observatory' },
    });
    const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const response = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':            'application/json',
        'X-Observatory-Signature': sig,
        'X-Observatory-Event':     'webhook.test',
      },
      body:   payload,
      signal: AbortSignal.timeout(5000),
    });

    res.json({ success: response.ok, status: response.status });
  } catch (err) {
    console.error('POST /api/webhooks/:id/test error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
