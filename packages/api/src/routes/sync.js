const express = require('express');
const pool = require('../db/pool');
const { decrypt } = require('../db/crypto');
const { requireAdmin } = require('../middleware/auth');
const { calcCost, fetchAnthropicUsage, fetchOpenAIUsage } = require('../services/providerUsage');

const router = express.Router();

async function syncAnthropic(adminKey, days) {
  const endDate   = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const buckets = await fetchAnthropicUsage(adminKey, startDate, endDate);
  return {
    buckets,
    startStr: startDate.toISOString().split('.')[0] + 'Z',
    endStr:   endDate.toISOString().split('.')[0] + 'Z',
  };
}

async function syncOpenAI(apiKey, days) {
  const endDate   = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const buckets = await fetchOpenAIUsage(apiKey, startDate, endDate);
  return {
    buckets,
    startTs: Math.floor(startDate.getTime() / 1000),
    endTs:   Math.floor(endDate.getTime() / 1000),
  };
}

async function importBuckets(buckets, provider, orgId) {
  let imported = 0;
  const tag    = `sync:${provider}`;

  for (const bucket of buckets) {
    const timestamp = bucket.starting_at || new Date(bucket.start_time * 1000).toISOString();

    for (const result of (bucket.results || [])) {
      const model = result.model || 'unknown';
      let inputTokens, outputTokens;

      if (provider === 'anthropic') {
        inputTokens  = parseInt(result.uncached_input_tokens || 0) + parseInt(result.cache_read_input_tokens || 0);
        outputTokens = parseInt(result.output_tokens || 0);
      } else {
        inputTokens  = parseInt(result.input_tokens  || 0);
        outputTokens = parseInt(result.output_tokens || 0);
      }

      const totalTokens = inputTokens + outputTokens;
      if (totalTokens === 0) continue;

      const costUsd = calcCost(provider, model, inputTokens, outputTokens);

      const existing = await pool.query(
        `SELECT id FROM api_calls
         WHERE org_id = $1 AND timestamp = $2 AND model = $3 AND provider = $4 AND prompt_preview = $5`,
        [orgId, timestamp, model, provider, tag]
      );
      if (existing.rows.length) continue;

      await pool.query(
        `INSERT INTO api_calls
           (org_id, timestamp, provider, model, input_tokens, output_tokens, total_tokens, cost_usd, latency_ms, status_code, prompt_preview)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 200, $9)`,
        [orgId, timestamp, provider, model, inputTokens, outputTokens, totalTokens, costUsd, tag]
      );
      imported++;
    }
  }
  return imported;
}

// POST /api/sync/:provider — start historical sync using org's admin key
router.post('/:provider', requireAdmin, async (req, res, next) => {
  const { provider } = req.params;
  const { orgId }    = req.user;
  const days         = parseInt(req.query.days) || 30;

  if (!['anthropic', 'openai'].includes(provider)) {
    return res.status(400).json({ error: 'Proveedor no soportado. Usa: anthropic, openai' });
  }

  const credRow = await pool.query(
    `SELECT api_key_encrypted FROM provider_credentials
     WHERE org_id = $1 AND provider = $2 AND key_type = 'admin'
     ORDER BY created_at DESC LIMIT 1`,
    [orgId, provider]
  );

  if (!credRow.rows.length) {
    return res.status(400).json({
      error: `Admin key not configured for this provider. Add it in Settings.`,
      detail: provider === 'anthropic'
        ? 'Para Anthropic: genera una Admin Key en console.anthropic.com > Settings > Admin Keys'
        : 'Para OpenAI: usa una key con permisos de organización',
    });
  }

  const apiKey = decrypt(credRow.rows[0].api_key_encrypted);

  const logRow = await pool.query(
    `INSERT INTO sync_logs (org_id, provider, status) VALUES ($1, $2, 'running') RETURNING id`,
    [orgId, provider]
  );
  const syncId = logRow.rows[0].id;

  res.json({ success: true, sync_id: syncId, message: 'Sync iniciado en background' });

  ;(async () => {
    try {
      let buckets, startStr, endStr;
      if (provider === 'anthropic') {
        ({ buckets, startStr, endStr } = await syncAnthropic(apiKey, days));
      } else {
        const result = await syncOpenAI(apiKey, days);
        buckets  = result.buckets;
        startStr = new Date(result.startTs * 1000).toISOString();
        endStr   = new Date(result.endTs   * 1000).toISOString();
      }

      const imported = await importBuckets(buckets, provider, orgId);

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

// DELETE /api/sync/:provider/data — delete all api_calls for provider in this org
router.delete('/:provider/data', requireAdmin, async (req, res, next) => {
  const { provider } = req.params;
  const { orgId }    = req.user;
  if (!['anthropic', 'openai'].includes(provider)) {
    return res.status(400).json({ error: 'Proveedor no soportado' });
  }
  try {
    const result = await pool.query(
      `DELETE FROM api_calls WHERE org_id = $1 AND provider = $2`,
      [orgId, provider]
    );
    res.json({ success: true, deleted: result.rowCount });
  } catch (err) { next(err); }
});

// GET /api/sync/logs — recent sync operations for this org
router.get('/logs', async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const result = await pool.query(
      'SELECT * FROM sync_logs WHERE org_id = $1 ORDER BY started_at DESC LIMIT 20',
      [orgId]
    );
    res.json({ logs: result.rows });
  } catch (err) { next(err); }
});

// GET /api/sync/status — latest sync status per provider for this org
router.get('/status', async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const result = await pool.query(
      `SELECT DISTINCT ON (provider) * FROM sync_logs WHERE org_id = $1 ORDER BY provider, started_at DESC`,
      [orgId]
    );
    res.json({ status: result.rows });
  } catch (err) { next(err); }
});

module.exports = router;
