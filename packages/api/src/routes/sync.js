const express = require('express');
const pool = require('../db/pool');
const { decrypt } = require('../db/crypto');

const router = express.Router();

const PRICING = {
  anthropic: {
    'claude-opus-4-6': { input: 15.0, output: 75.0 },
    'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
    'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
    'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
    'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },
    'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 }
  },
  openai: {
    'gpt-4o': { input: 2.5, output: 10.0 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gpt-4-turbo': { input: 10.0, output: 30.0 },
    'gpt-4': { input: 30.0, output: 60.0 },
    'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
    'o1': { input: 15.0, output: 60.0 },
    'o1-mini': { input: 3.0, output: 12.0 },
    'o3-mini': { input: 1.1, output: 4.4 },
    'o3': { input: 10.0, output: 40.0 }
  }
};

function calcCost(provider, model, inputTokens, outputTokens) {
  const table = PRICING[provider] || {};
  const pricing = table[model];
  if (!pricing) {
    console.warn(`[sync] Unknown model pricing: ${provider}/${model} — cost set to $0`);
    return 0;
  }
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

async function syncAnthropic(adminKey, days) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().split('.')[0] + 'Z';
  const endStr = endDate.toISOString().split('.')[0] + 'Z';

  let allData = [];
  let nextPage = null;
  let hasMore = true;

  while (hasMore) {
    const url = new URL('https://api.anthropic.com/v1/organizations/usage_report/messages');
    url.searchParams.set('starting_at', startStr);
    url.searchParams.set('ending_at', endStr);
    url.searchParams.set('bucket_width', '1d');
    url.searchParams.append('group_by[]', 'model');
    url.searchParams.set('limit', '31');
    if (nextPage) url.searchParams.set('page', nextPage);

    const res = await fetch(url.toString(), {
      headers: { 'x-api-key': adminKey, 'anthropic-version': '2023-06-01' }
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);

    const data = await res.json();
    allData = allData.concat(data.data || []);
    hasMore = data.has_more || false;
    nextPage = data.next_page || null;
  }

  return { buckets: allData, startStr, endStr };
}

async function syncOpenAI(apiKey, days) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startTs = Math.floor(startDate.getTime() / 1000);
  const endTs = Math.floor(endDate.getTime() / 1000);

  let allBuckets = [];
  let page = null;
  let hasMore = true;

  while (hasMore) {
    const url = new URL('https://api.openai.com/v1/organization/usage/completions');
    url.searchParams.set('start_time', startTs);
    url.searchParams.set('end_time', endTs);
    url.searchParams.set('bucket_width', '1d');
    url.searchParams.append('group_by[]', 'model');
    url.searchParams.set('limit', 31);
    if (page) url.searchParams.set('page', page);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);

    const data = await res.json();
    allBuckets = allBuckets.concat(data.data || []);
    hasMore = data.has_more || false;
    page = data.next_page || null;
  }

  return { buckets: allBuckets, startTs, endTs };
}

async function importBuckets(buckets, provider) {
  let imported = 0;
  const tag = `sync:${provider}`;

  for (const bucket of buckets) {
    const timestamp = bucket.starting_at || new Date(bucket.start_time * 1000).toISOString();

    for (const result of (bucket.results || [])) {
      const model = result.model || 'unknown';
      let inputTokens, outputTokens;

      if (provider === 'anthropic') {
        inputTokens = parseInt(result.uncached_input_tokens || 0) + parseInt(result.cache_read_input_tokens || 0);
        outputTokens = parseInt(result.output_tokens || 0);
      } else {
        inputTokens = parseInt(result.input_tokens || 0);
        outputTokens = parseInt(result.output_tokens || 0);
      }

      const totalTokens = inputTokens + outputTokens;
      if (totalTokens === 0) continue;

      const costUsd = calcCost(provider, model, inputTokens, outputTokens);

      // Deduplication: same timestamp + model + provider + tag
      const existing = await pool.query(
        `SELECT id FROM api_calls WHERE timestamp = $1 AND model = $2 AND provider = $3 AND prompt_preview = $4`,
        [timestamp, model, provider, tag]
      );
      if (existing.rows.length) continue;

      await pool.query(
        `INSERT INTO api_calls (timestamp, provider, model, input_tokens, output_tokens, total_tokens, cost_usd, latency_ms, status_code, prompt_preview)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 200, $8)`,
        [timestamp, provider, model, inputTokens, outputTokens, totalTokens, costUsd, tag]
      );
      imported++;
    }
  }
  return imported;
}

// POST /api/sync/:provider — start historical sync using admin key
router.post('/:provider', async (req, res, next) => {
  const { provider } = req.params;
  const days = parseInt(req.query.days) || 30;

  if (!['anthropic', 'openai'].includes(provider)) {
    return res.status(400).json({ error: 'Proveedor no soportado. Usa: anthropic, openai' });
  }

  // Require an admin key for sync — never use SDK keys
  const credRow = await pool.query(
    `SELECT api_key_encrypted FROM provider_credentials
     WHERE provider = $1 AND key_type = 'admin'
     ORDER BY created_at DESC LIMIT 1`,
    [provider]
  );

  if (!credRow.rows.length) {
    return res.status(400).json({
      error: `Admin key not configured for this provider. Add it in Settings.`,
      detail: provider === 'anthropic'
        ? 'Para Anthropic: genera una Admin Key en console.anthropic.com > Settings > Admin Keys'
        : 'Para OpenAI: usa una key con permisos de organización'
    });
  }

  const apiKey = decrypt(credRow.rows[0].api_key_encrypted);

  const logRow = await pool.query(
    `INSERT INTO sync_logs (provider, status) VALUES ($1, 'running') RETURNING id`,
    [provider]
  );
  const syncId = logRow.rows[0].id;

  // Respond immediately, run sync in background
  res.json({ success: true, sync_id: syncId, message: 'Sync iniciado en background' });

  ;(async () => {
    try {
      let buckets, startStr, endStr;
      if (provider === 'anthropic') {
        ({ buckets, startStr, endStr } = await syncAnthropic(apiKey, days));
      } else {
        const result = await syncOpenAI(apiKey, days);
        buckets = result.buckets;
        startStr = new Date(result.startTs * 1000).toISOString();
        endStr = new Date(result.endTs * 1000).toISOString();
      }

      const imported = await importBuckets(buckets, provider);

      await pool.query(
        `UPDATE sync_logs
         SET status = 'success', completed_at = NOW(), records_synced = $1,
             date_range_start = $2, date_range_end = $3
         WHERE id = $4`,
        [imported, startStr, endStr, syncId]
      );
      console.log(`[sync] ${provider} complete: ${imported} records imported`);
    } catch (err) {
      await pool.query(
        `UPDATE sync_logs SET status = 'error', completed_at = NOW(), error_message = $1 WHERE id = $2`,
        [err.message, syncId]
      );
      console.error('[sync] Error:', err.message);
    }
  })();
});

// DELETE /api/sync/:provider/data — delete all api_calls for a provider
router.delete('/:provider/data', async (req, res, next) => {
  const { provider } = req.params;
  if (!['anthropic', 'openai'].includes(provider)) {
    return res.status(400).json({ error: 'Proveedor no soportado' });
  }
  try {
    const result = await pool.query(
      `DELETE FROM api_calls WHERE provider = $1`,
      [provider]
    );
    res.json({ success: true, deleted: result.rowCount });
  } catch (err) {
    next(err);
  }
});

// GET /api/sync/logs — list recent sync operations
router.get('/logs', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM sync_logs ORDER BY started_at DESC LIMIT 20');
    res.json({ logs: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/sync/status — latest sync status per provider
router.get('/status', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (provider) * FROM sync_logs ORDER BY provider, started_at DESC`
    );
    res.json({ status: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
