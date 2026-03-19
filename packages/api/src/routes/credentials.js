const express = require('express');
const { z } = require('zod');
const pool = require('../db/pool');
const { encrypt, decrypt, maskKey } = require('../db/crypto');

const router = express.Router();

const CredentialSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'anthropic_admin']),
  api_key: z.string().min(10)
});

// GET /api/credentials — list configured providers (keys masked)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, provider, key_hint, is_valid, last_tested_at, created_at, updated_at FROM provider_credentials ORDER BY provider'
    );
    res.json({ credentials: result.rows });
  } catch (err) {
    console.error('GET /api/credentials error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/credentials — save or update an API key
router.post('/', async (req, res) => {
  try {
    const { provider, api_key } = CredentialSchema.parse(req.body);
    const encrypted = encrypt(api_key);
    const hint = maskKey(api_key);

    const result = await pool.query(
      `INSERT INTO provider_credentials (provider, api_key_encrypted, key_hint, is_valid, updated_at)
       VALUES ($1, $2, $3, NULL, NOW())
       ON CONFLICT (provider) DO UPDATE
         SET api_key_encrypted = $2, key_hint = $3, is_valid = NULL, updated_at = NOW()
       RETURNING id, provider, key_hint, is_valid, last_tested_at, created_at, updated_at`,
      [provider, encrypted, hint]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error('POST /api/credentials error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/credentials/:provider/test — validate key against the real API
router.post('/:provider/test', async (req, res) => {
  try {
    const { provider } = req.params;
    const row = await pool.query(
      'SELECT api_key_encrypted FROM provider_credentials WHERE provider = $1',
      [provider]
    );
    if (!row.rows.length) return res.status(404).json({ error: 'No credential found for this provider' });

    const apiKey = decrypt(row.rows[0].api_key_encrypted);
    let valid = false;
    let errorMsg = null;

    if (provider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      });
      valid = response.status === 200;
      if (!valid) errorMsg = `Anthropic responded with ${response.status}`;
    } else if (provider === 'openai') {
      const isAdmin = apiKey.startsWith('sk-admin-');
      const testUrl = isAdmin
        ? 'https://api.openai.com/v1/organization/usage/completions?start_time=1&limit=1'
        : 'https://api.openai.com/v1/models';
      const response = await fetch(testUrl, {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      valid = response.status === 200;
      if (!valid) errorMsg = `OpenAI responded with ${response.status}`;
    }

    await pool.query(
      'UPDATE provider_credentials SET is_valid = $1, last_tested_at = NOW() WHERE provider = $2',
      [valid, provider]
    );

    res.json({ success: true, valid, error: errorMsg });
  } catch (err) {
    console.error('POST /api/credentials/:provider/test error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/credentials/:provider — remove credentials
router.delete('/:provider', async (req, res) => {
  try {
    await pool.query('DELETE FROM provider_credentials WHERE provider = $1', [req.params.provider]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/credentials/openai/balance — fetch credit balance from OpenAI
router.get('/openai/balance', async (req, res) => {
  try {
    const row = await pool.query('SELECT api_key_encrypted FROM provider_credentials WHERE provider = $1', ['openai']);
    if (!row.rows.length) return res.status(404).json({ error: 'No OpenAI key configured' });
    const apiKey = decrypt(row.rows[0].api_key_encrypted);
    // OpenAI no expone saldo directamente; consultamos uso del mes en curso
    const now = new Date();
    const startOfMonth = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
    const url = `https://api.openai.com/v1/organization/usage/completions?start_time=${startOfMonth}&bucket_width=1d&limit=31`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!response.ok) return res.status(response.status).json({ error: `OpenAI ${response.status}: ${await response.text()}` });
    const data = await response.json();
    // Sumar tokens y calcular costo aproximado
    let inputTokens = 0, outputTokens = 0;
    for (const bucket of (data.data || [])) {
      for (const r of (bucket.results || [])) {
        inputTokens += parseInt(r.input_tokens || 0);
        outputTokens += parseInt(r.output_tokens || 0);
      }
    }
    const costUsd = (inputTokens / 1_000_000) * 2.5 + (outputTokens / 1_000_000) * 10.0;
    res.json({ input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: costUsd, month: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}` });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/credentials/:provider/key — internal use only: return decrypted key
router.get('/:provider/key', async (req, res) => {
  try {
    const row = await pool.query(
      'SELECT api_key_encrypted FROM provider_credentials WHERE provider = $1',
      [req.params.provider]
    );
    if (!row.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ api_key: decrypt(row.rows[0].api_key_encrypted) });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
