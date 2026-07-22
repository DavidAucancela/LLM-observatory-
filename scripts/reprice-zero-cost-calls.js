#!/usr/bin/env node
// Recalcula cost_usd para llamadas históricas que quedaron en $0 porque su
// modelo no estaba en la tabla de precios del SDK al momento de ingerirse
// (ej. claude-fable-5, gpt-5.6-* antes de este fix). Usa las mismas tablas
// de precios que el SDK — packages/sdk/src/index.js — así que una vez que
// un modelo se agrega ahí, este script sabe recalcularlo.
//
// Por defecto corre en modo dry-run (solo muestra qué cambiaría). Pasa
// --apply para escribir los cambios en la base de datos.
//
// Uso:
//   node scripts/reprice-zero-cost-calls.js                # dry-run
//   node scripts/reprice-zero-cost-calls.js --apply         # aplica cambios
//   node scripts/reprice-zero-cost-calls.js --apply --org=3 # limita a un org

const pool = require('../packages/api/src/db/pool');
const {
  calculateCost,
  calculateOpenAICost,
  calculateGeminiCost,
  ANTHROPIC_PRICING,
  OPENAI_PRICING,
  GEMINI_PRICING,
} = require('../packages/sdk/src/index.js');

const CALCULATORS = {
  anthropic: calculateCost,
  openai: calculateOpenAICost,
  gemini: calculateGeminiCost,
};

const PRICING_TABLES = {
  anthropic: ANTHROPIC_PRICING,
  openai: OPENAI_PRICING,
  gemini: GEMINI_PRICING,
};

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const orgArg = args.find(a => a.startsWith('--org='));
const ORG_ID = orgArg ? parseInt(orgArg.split('=')[1], 10) : null;

function fmt(n) {
  return `$${n.toFixed(6)}`;
}

async function main() {
  // Only touch calls that are provably wrong: succeeded (status < 400),
  // recorded $0, and the client never flagged the $0 as a genuine unknown
  // cost (cost_confidence would already be 'unknown' for those — see
  // packages/api/CLAUDE.md). Recomputing those would just be re-guessing.
  const { rows } = await pool.query(
    `SELECT id, org_id, provider, model, input_tokens, output_tokens, cost_usd
     FROM api_calls
     WHERE cost_usd = 0
       AND status_code < 400
       AND cost_confidence = 'known'
       AND provider = ANY($1)
       ${ORG_ID ? 'AND org_id = $2' : ''}
     ORDER BY provider, model`,
    ORG_ID ? [Object.keys(CALCULATORS), ORG_ID] : [Object.keys(CALCULATORS)]
  );

  if (rows.length === 0) {
    console.log('No hay llamadas con cost_usd = 0 sospechoso. Nada que corregir.');
    await pool.end();
    return;
  }

  // Group by (provider, model) so we can report clearly and skip whole
  // groups the pricing table still doesn't know about.
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.provider}::${row.model}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const toUpdate = []; // { id, newCost }
  const stillUnknown = []; // { provider, model, count }
  let totalRecovered = 0;

  for (const [key, calls] of groups) {
    const [provider, model] = key.split('::');
    const known = Object.prototype.hasOwnProperty.call(PRICING_TABLES[provider], model);

    if (!known) {
      stillUnknown.push({ provider, model, count: calls.length });
      continue;
    }

    const calc = CALCULATORS[provider];
    let groupRecovered = 0;
    for (const call of calls) {
      const newCost = calc(model, call.input_tokens, call.output_tokens);
      if (newCost > 0) {
        toUpdate.push({ id: call.id, newCost });
        groupRecovered += newCost;
      }
    }
    totalRecovered += groupRecovered;
    console.log(
      `${APPLY ? '✓' : '→'} ${provider}/${model}: ${calls.length} llamadas, ` +
      `recupera ${fmt(groupRecovered)}`
    );
  }

  if (stillUnknown.length > 0) {
    console.log('\nModelos que siguen sin precio conocido (no se tocaron):');
    for (const { provider, model, count } of stillUnknown) {
      console.log(`  - ${provider}/${model}: ${count} llamadas en $0`);
    }
    console.log('Agrega estos modelos a ANTHROPIC_PRICING/OPENAI_PRICING/GEMINI_PRICING\n' +
      'en packages/sdk/src/index.js (y su espejo en packages/sdk-python) y vuelve a correr este script.');
  }

  console.log(`\nTotal a recuperar: ${fmt(totalRecovered)} en ${toUpdate.length} llamadas.`);

  if (!APPLY) {
    console.log('\nDry-run — no se escribió nada. Corre con --apply para aplicar los cambios.');
    await pool.end();
    return;
  }

  if (toUpdate.length === 0) {
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const { id, newCost } of toUpdate) {
      await client.query('UPDATE api_calls SET cost_usd = $1 WHERE id = $2', [newCost, id]);
    }
    await client.query('COMMIT');
    console.log(`\nAplicado: ${toUpdate.length} llamadas actualizadas.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error aplicando cambios, se hizo rollback:', err.message);
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
