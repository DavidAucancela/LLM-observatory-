#!/usr/bin/env node
// Repara datos históricos de api_calls afectados por los bugs de tracking de
// costo corregidos en fix/cost-tracking-*:
//
//   Pass 1 — Re-tarifa filas en $0 que sí tenían tokens y modelo conocido
//            (IDs de OpenAI con fecha, claude-fable-5, etc.). Superset del
//            viejo scripts/reprice-zero-cost-calls.js.
//   Pass 2 — Pone cost_usd = 0 en filas 4xx/5xx (un request rechazado no se
//            factura).
//   Pass 3 — Colapsa las filas `sync:<provider>` duplicadas al "gap" real
//            (bucket recomputado − lo que ya reportaron las filas en vivo de
//            ese org+provider+modelo+día). Elimina la fila si el gap es 0.
//
// Dry-run por defecto. --apply escribe. --org=<id> acota a un org.
// Lee la DB de process.env.DATABASE_URL (igual que el resto de la API).
//
// En el contenedor de Railway (DATABASE_URL ya seteada), desde /app:
//   node scripts/repair-cost-history.js
//   node scripts/repair-cost-history.js --apply --org=3
// En local contra otra DB:
//   DATABASE_URL='postgresql://…' node packages/api/scripts/repair-cost-history.js

const pool = require('../src/db/pool');
const { costForProviderUsage } = require('../src/services/pricingBridge');

const args   = process.argv.slice(2);
const APPLY  = args.includes('--apply');
const orgArg = args.find(a => a.startsWith('--org='));
const ORG_ID = orgArg ? parseInt(orgArg.split('=')[1], 10) : null;

const SYNC_PROVIDERS = ['anthropic', 'openai'];
const fmt = (n) => `$${Number(n).toFixed(6)}`;
const orgFilter = (startIdx) => (ORG_ID ? ` AND org_id = $${startIdx}` : '');

// Rebuild the { uncachedInput, cacheReadInput, cacheCreationInput, output } the
// pricing bridge expects from a stored row's columns.
function rowTokens(row) {
  const cacheRead  = parseInt(row.cache_read_tokens, 10) || 0;
  const cacheWrite = parseInt(row.cache_write_tokens, 10) || 0;
  const input      = parseInt(row.input_tokens, 10) || 0;
  const output     = parseInt(row.output_tokens, 10) || 0;
  // input_tokens historically already includes cache-read for Anthropic sync
  // rows; subtract it back out so we don't double-count in the bridge.
  const uncached = Math.max(0, input - cacheRead);
  return { uncachedInput: uncached, cacheReadInput: cacheRead, cacheCreationInput: cacheWrite, output };
}

async function pass1Reprice() {
  const params = ORG_ID ? [SYNC_PROVIDERS.concat(['gemini', 'grok', 'kimi']), ORG_ID]
                        : [SYNC_PROVIDERS.concat(['gemini', 'grok', 'kimi'])];
  const { rows } = await pool.query(
    `SELECT id, provider, model, input_tokens, output_tokens,
            cache_read_tokens, cache_write_tokens
     FROM api_calls
     WHERE cost_usd = 0
       AND status_code < 400
       AND cost_confidence = 'known'
       AND total_tokens > 0
       AND provider = ANY($1)${orgFilter(2)}`,
    params
  );

  const updates = [];
  let recovered = 0;
  for (const row of rows) {
    const cost = costForProviderUsage(row.provider, row.model, rowTokens(row));
    if (cost > 0) { updates.push({ id: row.id, cost }); recovered += cost; }
  }
  console.log(`Pass 1 (reprice $0): ${rows.length} candidatas, ${updates.length} re-tarifadas, recupera ${fmt(recovered)}`);
  return updates.map((u) => ['UPDATE api_calls SET cost_usd = $1 WHERE id = $2', [u.cost, u.id]]);
}

async function pass2ZeroFailed() {
  const params = ORG_ID ? [ORG_ID] : [];
  const { rows } = await pool.query(
    `SELECT id, cost_usd FROM api_calls
     WHERE status_code >= 400 AND cost_usd > 0${orgFilter(1)}`,
    params
  );
  const removed = rows.reduce((s, r) => s + Number(r.cost_usd), 0);
  console.log(`Pass 2 (zero 4xx/5xx): ${rows.length} filas, quita ${fmt(removed)}`);
  return rows.map((r) => [
    `UPDATE api_calls SET cost_usd = 0, cost_confidence = 'known' WHERE id = $1`, [r.id],
  ]);
}

async function pass3CollapseSync() {
  const params = ORG_ID ? [SYNC_PROVIDERS, ORG_ID] : [SYNC_PROVIDERS];
  // Every sync:<provider> row, grouped by (org, provider, model, UTC day).
  const { rows } = await pool.query(
    `SELECT id, org_id, provider, model,
            date_trunc('day', timestamp) AS day,
            timestamp, input_tokens, output_tokens,
            cache_read_tokens, cache_write_tokens, cost_usd
     FROM api_calls
     WHERE provider = ANY($1)
       AND prompt_preview LIKE 'sync:%'${orgFilter(2)}
     ORDER BY org_id, provider, model, day`,
    params
  );

  const groups = new Map();
  for (const r of rows) {
    const key = `${r.org_id}::${r.provider}::${r.model}::${r.day.toISOString()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const ops = [];
  let before = 0, after = 0, deleted = 0;
  for (const [, groupRows] of groups) {
    const { org_id, provider, model, day } = groupRows[0];
    const dayStart = day.toISOString();
    const dayEnd   = new Date(day.getTime() + 86400_000).toISOString();

    // Recompute the bucket cost from the sync rows' own stored tokens (best we
    // can do offline — historical rows never stored cache-creation).
    let bucketCost = 0;
    for (const r of groupRows) bucketCost += costForProviderUsage(provider, model, rowTokens(r));

    const liveRes = await pool.query(
      `SELECT COALESCE(SUM(cost_usd), 0) AS cost FROM api_calls
       WHERE org_id = $1 AND provider = $2 AND model = $3
         AND timestamp >= $4 AND timestamp < $5
         AND (prompt_preview IS NULL OR (
               prompt_preview NOT LIKE 'sync:%'
           AND prompt_preview NOT LIKE 'test:%'
           AND prompt_preview <> 'eval:judge'))`,
      [org_id, provider, model, dayStart, dayEnd]
    );
    const liveCost = parseFloat(liveRes.rows[0].cost) || 0;
    const gap = Math.max(0, bucketCost - liveCost);

    before += groupRows.reduce((s, r) => s + Number(r.cost_usd), 0);
    after  += gap;

    const [keep, ...drop] = groupRows;
    for (const r of drop) { ops.push(['DELETE FROM api_calls WHERE id = $1', [r.id]]); deleted++; }
    if (gap <= 0) {
      ops.push(['DELETE FROM api_calls WHERE id = $1', [keep.id]]); deleted++;
    } else {
      ops.push(['UPDATE api_calls SET cost_usd = $1 WHERE id = $2', [gap, keep.id]]);
    }
  }
  console.log(`Pass 3 (collapse sync): ${groups.size} grupos (día×modelo), ${deleted} filas eliminadas, ` +
              `costo sync ${fmt(before)} → ${fmt(after)}`);
  return ops;
}

async function main() {
  const ops = [
    ...(await pass1Reprice()),
    ...(await pass2ZeroFailed()),
    ...(await pass3CollapseSync()),
  ];

  console.log(`\nTotal: ${ops.length} operaciones de escritura.`);
  if (!APPLY) {
    console.log('Dry-run — no se escribió nada. Corre con --apply para aplicar.');
    await pool.end();
    return;
  }
  if (ops.length === 0) { await pool.end(); return; }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [sql, p] of ops) await client.query(sql, p);
    await client.query('COMMIT');
    console.log(`Aplicado: ${ops.length} operaciones.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error, rollback:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exitCode = 1;
});
