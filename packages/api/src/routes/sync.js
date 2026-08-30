const express = require('express');
const pool = require('../db/pool');
const { decrypt } = require('../db/crypto');
const { requireAdmin } = require('../middleware/auth');
const { fetchAnthropicUsage, fetchOpenAIUsage, anthropicCacheCreationTokens } = require('../services/providerUsage');
const { costForProviderUsage } = require('../services/pricingBridge');

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

// Splits one provider usage result-row into the token categories the pricing
// bridge understands. OpenAI's usage API has no separate cache-write concept and
// folds cached input into input_tokens.
function extractBucketTokens(provider, result) {
  if (provider === 'anthropic') {
    return {
      uncachedInput:      parseInt(result.uncached_input_tokens || 0, 10),
      cacheReadInput:     parseInt(result.cache_read_input_tokens || 0, 10),
      cacheCreationInput: anthropicCacheCreationTokens(result),
      output:             parseInt(result.output_tokens || 0, 10),
    };
  }
  return {
    uncachedInput:      parseInt(result.input_tokens || 0, 10),
    cacheReadInput:     0,
    cacheCreationInput: 0,
    output:             parseInt(result.output_tokens || 0, 10),
  };
}

// Imports provider daily-aggregate usage as reconciling `sync:<provider>` rows,
// but only for the SHORTFALL not already covered by the org's own live SDK rows
// for that provider+model+day. Without this, an org that runs the SDK *and*
// syncs double-counts every overlapping day.
//
// Idempotent: the whole window's prior `sync:<provider>` rows are dropped and
// recomputed inside one transaction, so re-running never stacks rows and the
// recorded total converges toward (never exceeds) the provider's own figure as
// live rows accumulate.
async function importBuckets(buckets, provider, orgId, windowStartISO, windowEndISO) {
  const tag    = `sync:${provider}`;
  const client = await pool.connect();
  let imported = 0;

  try {
    await client.query('BEGIN');

    await client.query(
      `DELETE FROM api_calls
       WHERE org_id = $1 AND provider = $2 AND prompt_preview = $3
         AND timestamp >= $4 AND timestamp <= $5`,
      [orgId, provider, tag, windowStartISO, windowEndISO]
    );

    for (const bucket of buckets) {
      const dayStartISO = bucket.starting_at
        || new Date(bucket.start_time * 1000).toISOString();
      const dayEndISO = new Date(Date.parse(dayStartISO) + 86400_000).toISOString();

      for (const result of (bucket.results || [])) {
        const model = result.model || 'unknown';
        const tok   = extractBucketTokens(provider, result);
        const bucketInput = tok.uncachedInput + tok.cacheReadInput + tok.cacheCreationInput;
        if (bucketInput + tok.output === 0) continue;

        const bucketCost = costForProviderUsage(provider, model, tok);
        if (bucketCost <= 0) continue;

        // What the org's own LIVE rows (not sync, not ping, not judge) already
        // booked for this provider+model+day.
        const live = await client.query(
          `SELECT COALESCE(SUM(cost_usd), 0)           AS cost,
                  COALESCE(SUM(input_tokens), 0)       AS input_tokens,
                  COALESCE(SUM(output_tokens), 0)      AS output_tokens,
                  COALESCE(SUM(cache_read_tokens), 0)  AS cache_read_tokens,
                  COALESCE(SUM(cache_write_tokens), 0) AS cache_write_tokens
           FROM api_calls
           WHERE org_id = $1 AND provider = $2 AND model = $3
             AND timestamp >= $4 AND timestamp < $5
             AND (prompt_preview IS NULL OR (
                   prompt_preview NOT LIKE 'sync:%'
               AND prompt_preview NOT LIKE 'test:%'
               AND prompt_preview <> 'eval:judge'))`,
          [orgId, provider, model, dayStartISO, dayEndISO]
        );
        const liveCost       = parseFloat(live.rows[0].cost) || 0;
        const liveInput      = parseInt(live.rows[0].input_tokens, 10) || 0;
        const liveOutput     = parseInt(live.rows[0].output_tokens, 10) || 0;
        const liveCacheRead  = parseInt(live.rows[0].cache_read_tokens, 10) || 0;
        const liveCacheWrite = parseInt(live.rows[0].cache_write_tokens, 10) || 0;

        const gap = bucketCost - liveCost;
        if (gap <= 0) continue; // live rows already cover this bucket

        // Residual token counts on the reconciling row are an approximation
        // (bucket minus what live rows reported, floored at 0). The `gap` dollar
        // figure is the authoritative number.
        const resInput      = Math.max(0, bucketInput - liveInput);
        const resOutput     = Math.max(0, tok.output - liveOutput);
        const resCacheRead  = Math.max(0, tok.cacheReadInput - liveCacheRead);
        const resCacheWrite = Math.max(0, tok.cacheCreationInput - liveCacheWrite);

        await client.query(
          `INSERT INTO api_calls
             (org_id, timestamp, provider, model,
              input_tokens, output_tokens, total_tokens, cost_usd,
              cache_read_tokens, cache_write_tokens,
              latency_ms, status_code, prompt_preview, api_key_hint, cost_confidence)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,200,$11,$11,'known')`,
          [orgId, dayStartISO, provider, model,
           resInput, resOutput, resInput + resOutput, gap,
           resCacheRead, resCacheWrite, tag]
        );
        imported++;
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
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

      const imported = await importBuckets(buckets, provider, orgId, startStr, endStr);

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
module.exports.importBuckets = importBuckets;      // exported for unit tests
module.exports.extractBucketTokens = extractBucketTokens;
