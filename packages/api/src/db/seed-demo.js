// Idempotent demo seed — safe to run multiple times.
// Creates a public demo account with 30 days of realistic data.
// Run: node src/db/seed-demo.js
//      (or from Railway Console: node src/db/seed-demo.js)
// Also exported as seedDemo() — index.js re-runs it weekly to keep the showcase fresh.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool   = require('./pool');

// Encryption is optional — credentials seeding is skipped gracefully if key missing
let encrypt, maskKey;
try {
  ({ encrypt, maskKey } = require('./crypto'));
} catch { /* no ENCRYPTION_KEY set — credentials won't be seeded */ }

// Fake demo keys (clearly non-functional, used only for UI display)
const DEMO_ANT_KEY = 'sk-ant-api03-demo-observatory-showcase-anthropic-key-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA01';
const DEMO_OAI_KEY = 'sk-proj-demo-observatory-showcase-openai-key-OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO01';

const DEMO_EMAIL    = 'demo@llm-observatory.com';
const DEMO_PASSWORD = 'Demo1234!';
const DEMO_ORG      = 'LLM Observatory Demo';
const DEMO_SLUG     = 'demo';

const ANTHROPIC_MODELS = [
  'claude-opus-4-8',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
  'claude-3-5-sonnet-20241022',
  'claude-3-haiku-20240307',
];
const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];

const MODEL_PRICING = {
  'claude-opus-4-8':           { input: 15.0, output: 75.0 },
  'claude-sonnet-4-6':         { input:  3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input:  0.8, output:  4.0 },
  'claude-3-5-sonnet-20241022':{ input:  3.0, output: 15.0 },
  'claude-3-haiku-20240307':   { input:  0.25,output:  1.25 },
  'gpt-4o':       { input: 2.5, output: 10.0 },
  'gpt-4o-mini':  { input: 0.15,output:  0.60 },
  'gpt-4-turbo':  { input: 10.0,output: 30.0 },
  'gpt-3.5-turbo':{ input: 0.5, output:  1.5 },
};

const SAMPLE_PROMPTS = [
  'Analyze the quarterly sales data and provide insights',
  'Write a Python function to parse JSON files',
  'Explain the concept of machine learning to a junior dev',
  'Summarize this research paper about climate change',
  'Generate unit tests for the authentication module',
  'Debug this TypeScript error in my React component',
  'Create a SQL query for monthly revenue report',
  'Help me refactor this legacy code to use async/await',
  'Translate this document from Spanish to English',
  'Write a product description for this new feature',
  'Review this pull request and suggest improvements',
  'Explain why my Docker container keeps crashing',
  'Generate a REST API spec for a user management system',
  'Write a regex to validate email addresses',
  'Optimize this PostgreSQL query for performance',
];

const TAGS_POOL = [
  { env: 'production', service: 'api' },
  { env: 'production', service: 'web' },
  { env: 'staging',    service: 'api' },
  { env: 'production', service: 'worker' },
  { env: 'production', service: 'api', team: 'backend' },
];

const ERROR_TYPES = ['rate_limit', 'server_error', 'invalid_request'];
const ERROR_MSGS  = {
  rate_limit:      'Rate limit exceeded. Please retry after 60 seconds.',
  server_error:    'Internal server error. Please try again.',
  invalid_request: 'Invalid request parameters.',
};

function normalRandom(mean, std) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0, Math.round(mean + z * std));
}

async function seedDemo() {
  console.log('🌱 Running demo seed...');

  // ── 1. Org (upsert) ───────────────────────────────────────────────────────
  const orgRes = await pool.query(`
    INSERT INTO organizations (name, slug)
    VALUES ($1, $2)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `, [DEMO_ORG, DEMO_SLUG]);
  const orgId = orgRes.rows[0].id;
  console.log(`  Org id=${orgId}`);

  // ── 2. User (upsert — resets password if someone changed it) ─────────────
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userRes = await pool.query(`
    INSERT INTO users (email, password_hash, is_active)
    VALUES ($1, $2, true)
    ON CONFLICT (email) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          is_active     = true
    RETURNING id
  `, [DEMO_EMAIL, hash]);
  const userId = userRes.rows[0].id;
  console.log(`  User id=${userId}`);

  // ── 3. Membership (member role — read-only) ───────────────────────────────
  await pool.query(`
    INSERT INTO org_members (org_id, user_id, role)
    VALUES ($1, $2, 'member')
    ON CONFLICT (org_id, user_id) DO NOTHING
  `, [orgId, userId]);

  // ── 4. Provider credentials (fake keys — only for UI display) ────────────
  await pool.query('DELETE FROM provider_credentials WHERE org_id = $1', [orgId]);
  if (encrypt && maskKey) {
    const antHint = maskKey(DEMO_ANT_KEY);
    const oaiHint = maskKey(DEMO_OAI_KEY);
    await pool.query(`
      INSERT INTO provider_credentials (org_id, provider, key_type, label, api_key_encrypted, key_hint, is_valid)
      VALUES
        ($1, 'anthropic', 'sdk', 'Demo Anthropic Key', $2, $3, true),
        ($1, 'openai',    'sdk', 'Demo OpenAI Key',    $4, $5, true)
    `, [orgId, encrypt(DEMO_ANT_KEY), antHint, encrypt(DEMO_OAI_KEY), oaiHint]);
    console.log('  Credentials seeded');
  } else {
    console.log('  ⚠ ENCRYPTION_KEY not set — skipping credentials');
  }

  // ── 5. Observatory token (one sample token, visible in Settings) ──────────
  // Random hash each run — insert only if none exists yet, or re-runs would pile up tokens
  const hasToken = await pool.query(
    `SELECT 1 FROM observatory_tokens WHERE org_id = $1 AND name = 'Demo SDK Token' AND revoked_at IS NULL LIMIT 1`,
    [orgId]
  );
  if (hasToken.rowCount === 0) {
    const rawToken   = 'obs_sk_demo_' + crypto.randomBytes(20).toString('hex');
    const tokenHash  = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenPrefix= rawToken.slice(0, 20);
    await pool.query(`
      INSERT INTO observatory_tokens (org_id, name, token_hash, token_prefix, created_by)
      VALUES ($1, 'Demo SDK Token', $2, $3, $4)
      ON CONFLICT (token_hash) DO NOTHING
    `, [orgId, tokenHash, tokenPrefix, userId]);
  }

  // ── 6. api_calls — delete old demo data and re-insert fresh ──────────────
  await pool.query('DELETE FROM api_calls WHERE org_id = $1', [orgId]);
  const antHint = maskKey ? maskKey(DEMO_ANT_KEY) : null;
  const oaiHint = maskKey ? maskKey(DEMO_OAI_KEY) : null;

  const now     = new Date();
  const records = [];

  for (let i = 0; i < 600; i++) {
    const daysAgo   = Math.pow(Math.random(), 1.5) * 30;
    const timestamp = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
    const hour      = timestamp.getHours();
    const isPeak    = hour >= 9 && hour <= 18;

    const provider = Math.random() < 0.65 ? 'anthropic' : 'openai';
    const models   = provider === 'anthropic' ? ANTHROPIC_MODELS : OPENAI_MODELS;
    const model    = models[Math.floor(Math.random() * (isPeak ? Math.ceil(models.length * 0.6) : models.length))];
    const pricing  = MODEL_PRICING[model];

    const isLarge  = model.includes('opus') || model.includes('gpt-4-turbo') || (model.includes('gpt-4o') && !model.includes('mini'));
    const isSmall  = model.includes('haiku') || model.includes('mini') || model.includes('3.5-turbo');
    const baseIn   = isLarge ? 800 : isSmall ? 200 : 400;
    const baseOut  = isLarge ? 1200 : isSmall ? 300 : 600;

    const inputTokens  = normalRandom(baseIn,  baseIn  * 0.3);
    const outputTokens = normalRandom(baseOut, baseOut * 0.3);
    const totalTokens  = inputTokens + outputTokens;
    const costUsd      = (inputTokens / 1e6) * pricing.input + (outputTokens / 1e6) * pricing.output;

    const baseLatency = isLarge ? 3000 : isSmall ? 500 : 1500;
    const isSlow      = Math.random() < 0.05;
    const latencyMs   = isSlow ? normalRandom(baseLatency * 3, 1000) : normalRandom(baseLatency, baseLatency * 0.2);

    const statusCode = Math.random() < 0.97 ? 200 : [429, 500, 503][Math.floor(Math.random() * 3)];
    const isError    = statusCode >= 400;
    const errorType  = isError ? ERROR_TYPES[Math.floor(Math.random() * ERROR_TYPES.length)] : null;
    const errorMsg   = isError ? ERROR_MSGS[errorType] : null;

    const tools      = Math.random() < 0.3
      ? [['search', 'calculator', 'code_executor', 'file_reader'][Math.floor(Math.random() * 4)]]
      : [];

    // Cache tokens — realistic for Anthropic prompt caching
    const hasCacheRead  = provider === 'anthropic' && Math.random() < 0.2;
    const cacheRead     = hasCacheRead ? normalRandom(inputTokens * 0.4, 50) : 0;
    const cacheWrite    = hasCacheRead && Math.random() < 0.5 ? normalRandom(200, 50) : 0;

    const tags = Math.random() < 0.6 ? TAGS_POOL[Math.floor(Math.random() * TAGS_POOL.length)] : {};
    const prompt = SAMPLE_PROMPTS[Math.floor(Math.random() * SAMPLE_PROMPTS.length)];

    const keyHint = provider === 'anthropic' ? antHint : oaiHint;

    records.push([
      orgId, timestamp.toISOString(), provider, model,
      inputTokens, outputTokens, totalTokens,
      costUsd.toFixed(6), Math.max(100, latencyMs), statusCode,
      JSON.stringify(tools), prompt, JSON.stringify(tags),
      cacheRead, cacheWrite, errorType, errorMsg, keyHint,
    ]);
  }

  const batchSize = 50;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch  = records.slice(i, i + batchSize);
    const values = batch.map((_, idx) => {
      const b = idx * 18;
      return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12},$${b+13},$${b+14},$${b+15},$${b+16},$${b+17},$${b+18})`;
    }).join(',');
    await pool.query(
      `INSERT INTO api_calls
         (org_id,timestamp,provider,model,input_tokens,output_tokens,total_tokens,
          cost_usd,latency_ms,status_code,tools_used,prompt_preview,tags,
          cache_read_tokens,cache_write_tokens,error_type,error_message,api_key_hint)
       VALUES ${values}`,
      batch.flat()
    );
    process.stdout.write(`\r  api_calls ${Math.min(i + batchSize, records.length)}/600`);
  }
  console.log();

  // ── 7. Budgets ────────────────────────────────────────────────────────────
  await pool.query('DELETE FROM budgets WHERE org_id = $1', [orgId]);
  for (const [name, limit, period] of [
    ['Daily API Budget',          5,   'daily'],
    ['Monthly Anthropic Budget', 150,  'monthly'],
    ['Monthly OpenAI Budget',     80,  'monthly'],
  ]) {
    await pool.query(
      `INSERT INTO budgets (org_id, name, limit_usd, period) VALUES ($1,$2,$3,$4)`,
      [orgId, name, limit, period]
    );
  }
  console.log('  Budgets seeded');

  // ── 8. Provider balances ──────────────────────────────────────────────────
  await pool.query('DELETE FROM provider_balances WHERE org_id = $1', [orgId]);
  for (const [provider, amount, note, interval] of [
    ['anthropic',  50.00, 'Initial credit',  '30 days'],
    ['anthropic', 100.00, 'Monthly top-up',  '12 days'],
    ['openai',     25.00, 'Initial credit',  '28 days'],
    ['openai',     50.00, 'Monthly top-up',   '8 days'],
  ]) {
    await pool.query(
      `INSERT INTO provider_balances (org_id, provider, amount_usd, note, recharged_at)
       VALUES ($1,$2,$3,$4, NOW() - INTERVAL '${interval}')`,
      [orgId, provider, amount, note]
    );
  }
  console.log('  Provider balances seeded');

  console.log(`\n✅ Demo seed complete`);
  console.log(`   Email:    ${DEMO_EMAIL}`);
  console.log(`   Password: ${DEMO_PASSWORD}`);
}

if (require.main === module) {
  seedDemo()
    .then(() => pool.end())
    .catch(err => { console.error(err); process.exit(1); });
}

module.exports = { seedDemo };
