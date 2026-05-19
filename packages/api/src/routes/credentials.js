const express = require('express');
const { z } = require('zod');
const pool = require('../db/pool');
const { encrypt, decrypt, maskKey } = require('../db/crypto');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
}

const CredentialSchema = z.object({
  provider: z.enum(['anthropic', 'openai']),
  key_type: z.enum(['sdk', 'admin']),
  label:    z.string().min(1).max(100),
  value:    z.string().min(10),
});

// GET /api/credentials — list credentials for current org (keys masked)
router.get('/', async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const result = await pool.query(
      `SELECT id, provider, key_type, label, key_hint, is_valid, last_tested_at, created_at
       FROM provider_credentials WHERE org_id = $1
       ORDER BY provider, key_type, created_at DESC`,
      [orgId]
    );
    res.json({ credentials: result.rows });
  } catch (err) { next(err); }
});

// POST /api/credentials — add a new credential
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const { provider, key_type, label, value } = CredentialSchema.parse(req.body);
    const encrypted = encrypt(value);
    const hint      = maskKey(value);

    const result = await pool.query(
      `INSERT INTO provider_credentials (org_id, provider, key_type, label, api_key_encrypted, key_hint, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, provider, key_type, label, key_hint, is_valid, last_tested_at, created_at`,
      [orgId, provider, key_type, label, encrypted, hint]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// POST /api/credentials/:id/ping — idempotent test metric (replaces previous one)
router.post('/:id/ping', requireAdmin, async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const row = await pool.query(
      'SELECT provider, key_hint FROM provider_credentials WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );
    if (!row.rows.length) return res.status(404).json({ error: 'Credencial no encontrada' });

    const { provider, key_hint } = row.rows[0];
    const model = provider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini';

    await pool.query(
      `DELETE FROM api_calls WHERE org_id = $1 AND provider = $2 AND prompt_preview = 'test:sdk_integration' AND api_key_hint = $3`,
      [orgId, provider, key_hint]
    );

    const result = await pool.query(
      `INSERT INTO api_calls (org_id, provider, model, input_tokens, output_tokens, total_tokens, cost_usd, latency_ms, status_code, prompt_preview, api_key_hint)
       VALUES ($1, $2, $3, 12, 24, 36, 0.0001, 123, 200, 'test:sdk_integration', $4) RETURNING *`,
      [orgId, provider, model, key_hint]
    );

    if (req.app.get('io')) req.app.get('io').emit('new-metric', result.rows[0]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// POST /api/credentials/:id/test — validate a key against provider API
router.post('/:id/test', requireAdmin, async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const row = await pool.query(
      'SELECT provider, key_type, api_key_encrypted FROM provider_credentials WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );
    if (!row.rows.length) return res.status(404).json({ error: 'Credencial no encontrada' });

    const { provider, key_type, api_key_encrypted } = row.rows[0];
    const apiKey = decrypt(api_key_encrypted);
    let valid    = false;
    let errorMsg = null;

    if (provider === 'anthropic') {
      if (key_type === 'admin') {
        const response = await fetchWithTimeout(
          'https://api.anthropic.com/v1/organizations/usage_report/messages?limit=1',
          { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } }
        );
        valid = response.status === 200 || response.status === 400;
        if (response.status === 401 || response.status === 403) {
          valid    = false;
          errorMsg = `Anthropic Admin API respondió con ${response.status}`;
        }
      } else {
        const response = await fetchWithTimeout('https://api.anthropic.com/v1/models', {
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
        });
        valid = response.status === 200;
        if (!valid) errorMsg = `Anthropic API respondió con ${response.status}`;
      }
    } else if (provider === 'openai') {
      if (key_type === 'admin') {
        const startOfMonth = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);
        const response = await fetchWithTimeout(
          `https://api.openai.com/v1/organization/usage/completions?start_time=${startOfMonth}&limit=1`,
          { headers: { Authorization: `Bearer ${apiKey}` } }
        );
        valid = response.status === 200;
        if (!valid) errorMsg = `OpenAI Organization API respondió con ${response.status}`;
      } else {
        const response = await fetchWithTimeout('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` }
        });
        valid = response.status === 200;
        if (!valid) errorMsg = `OpenAI API respondió con ${response.status}`;
      }
    }

    await pool.query(
      'UPDATE provider_credentials SET is_valid = $1, last_tested_at = NOW() WHERE id = $2',
      [valid, id]
    );

    res.json({ success: true, valid, error: errorMsg });
  } catch (err) { next(err); }
});

// DELETE /api/credentials/:id — delete credential + cascade its api_calls
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const credResult = await pool.query(
      'SELECT provider, key_type, key_hint FROM provider_credentials WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );
    if (!credResult.rows.length) return res.status(404).json({ error: 'Credencial no encontrada' });

    const { provider, key_type, key_hint } = credResult.rows[0];

    if (key_hint) {
      await pool.query('DELETE FROM api_calls WHERE org_id = $1 AND api_key_hint = $2', [orgId, key_hint]);
    }
    if (key_type === 'admin') {
      await pool.query(
        `DELETE FROM api_calls WHERE org_id = $1 AND provider = $2 AND prompt_preview = $3`,
        [orgId, provider, `sync:${provider}`]
      );
    }

    await pool.query('DELETE FROM provider_credentials WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/credentials/openai/balance — fetch monthly usage from OpenAI org API
router.get('/openai/balance', async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const row = await pool.query(
      `SELECT api_key_encrypted FROM provider_credentials
       WHERE org_id = $1 AND provider = 'openai' AND key_type = 'admin'
       ORDER BY created_at DESC LIMIT 1`,
      [orgId]
    );
    if (!row.rows.length) return res.status(404).json({ error: 'No hay Admin Key de OpenAI configurada' });

    const apiKey = decrypt(row.rows[0].api_key_encrypted);
    const now    = new Date();
    const startOfMonth = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
    const url = `https://api.openai.com/v1/organization/usage/completions?start_time=${startOfMonth}&bucket_width=1d&limit=31`;

    const response = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: `OpenAI ${response.status}: ${text}` });
    }

    const data = await response.json();
    let inputTokens = 0, outputTokens = 0;
    for (const bucket of (data.data || [])) {
      for (const r of (bucket.results || [])) {
        inputTokens  += parseInt(r.input_tokens  || 0);
        outputTokens += parseInt(r.output_tokens || 0);
      }
    }
    const costUsd = (inputTokens / 1_000_000) * 2.5 + (outputTokens / 1_000_000) * 10.0;
    res.json({
      input_tokens:  inputTokens,
      output_tokens: outputTokens,
      cost_usd:      costUsd,
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    });
  } catch (err) { next(err); }
});

module.exports = router;
