const pool = require('./pool');

const ANTHROPIC_MODELS = [
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
  'claude-3-5-sonnet-20241022',
  'claude-3-haiku-20240307'
];

const OPENAI_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-3.5-turbo'
];

const MODEL_PRICING = {
  'claude-opus-4-6': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 }
};

const SAMPLE_PROMPTS = [
  'Analyze the quarterly sales data and provide insights',
  'Write a Python function to parse JSON files',
  'Explain the concept of machine learning',
  'Summarize this research paper about climate change',
  'Generate unit tests for the authentication module',
  'Debug this TypeScript error in my React component',
  'Create a SQL query for monthly revenue report',
  'Help me refactor this legacy code to use async/await',
  'Translate this document from Spanish to English',
  'Write a product description for this new feature'
];

function normalRandom(mean, std) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0, Math.round(mean + z * std));
}

async function seed() {
  console.log('🌱 Seeding 600 records...');

  // Get or create a seed org
  let orgRes = await pool.query('SELECT id FROM organizations LIMIT 1');
  if (!orgRes.rows.length) {
    orgRes = await pool.query(
      "INSERT INTO organizations (name, slug) VALUES ('Seed Organization', 'seed') RETURNING id"
    );
  }
  const orgId = orgRes.rows[0].id;

  const now = new Date();
  const records = [];

  for (let i = 0; i < 600; i++) {
    const daysAgo = Math.pow(Math.random(), 1.5) * 30;
    const timestamp = new Date(now - daysAgo * 24 * 60 * 60 * 1000);

    const hour = timestamp.getHours();
    const isPeakHour = hour >= 9 && hour <= 18;

    // 65% anthropic, 35% openai
    const provider = Math.random() < 0.65 ? 'anthropic' : 'openai';
    const models = provider === 'anthropic' ? ANTHROPIC_MODELS : OPENAI_MODELS;
    const model = models[Math.floor(Math.random() * (isPeakHour ? Math.ceil(models.length * 0.6) : models.length))];
    const pricing = MODEL_PRICING[model];

    const isLargeModel = model.includes('opus') || model.includes('gpt-4-turbo') || model.includes('gpt-4o') && !model.includes('mini');
    const baseInput = isLargeModel ? 800 : model.includes('haiku') || model.includes('mini') || model.includes('3.5-turbo') ? 200 : 400;
    const baseOutput = isLargeModel ? 1200 : model.includes('haiku') || model.includes('mini') || model.includes('3.5-turbo') ? 300 : 600;

    const inputTokens = normalRandom(baseInput, baseInput * 0.3);
    const outputTokens = normalRandom(baseOutput, baseOutput * 0.3);
    const totalTokens = inputTokens + outputTokens;
    const costUsd = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;

    const isSlowRequest = Math.random() < 0.05;
    const baseLatency = isLargeModel ? 3000 : model.includes('haiku') || model.includes('mini') ? 500 : 1500;
    const latencyMs = isSlowRequest ? normalRandom(baseLatency * 3, 1000) : normalRandom(baseLatency, baseLatency * 0.2);

    const statusCode = Math.random() < 0.97 ? 200 : [429, 500, 503][Math.floor(Math.random() * 3)];
    const tools = Math.random() < 0.3
      ? [['search', 'calculator', 'code_executor', 'file_reader'][Math.floor(Math.random() * 4)]]
      : [];

    records.push([
      orgId,
      timestamp.toISOString(),
      provider,
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      costUsd.toFixed(6),
      Math.max(100, latencyMs),
      statusCode,
      JSON.stringify(tools),
      SAMPLE_PROMPTS[Math.floor(Math.random() * SAMPLE_PROMPTS.length)],
    ]);
  }

  const batchSize = 50;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const values = batch.map((_, idx) => {
      const base = idx * 12;
      return `($${base+1}, $${base+2}, $${base+3}, $${base+4}, $${base+5}, $${base+6}, $${base+7}, $${base+8}, $${base+9}, $${base+10}, $${base+11}, $${base+12})`;
    }).join(', ');

    await pool.query(
      `INSERT INTO api_calls (org_id, timestamp, provider, model, input_tokens, output_tokens, total_tokens, cost_usd, latency_ms, status_code, tools_used, prompt_preview) VALUES ${values}`,
      batch.flat()
    );
    console.log(`  Inserted ${Math.min(i + batchSize, records.length)}/600`);
  }

  // Seed provider balances
  for (const [provider, amount, note, interval] of [
    ['anthropic', 50.00,  'Recarga inicial', '30 days'],
    ['anthropic', 100.00, 'Recarga mensual', '15 days'],
    ['openai',    25.00,  'Recarga inicial', '28 days'],
    ['openai',    50.00,  'Recarga mensual', '10 days'],
  ]) {
    await pool.query(
      `INSERT INTO provider_balances (org_id, provider, amount_usd, note, recharged_at)
       VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${interval}')`,
      [orgId, provider, amount, note]
    );
  }
  console.log('  Provider balances seeded');

  console.log('✅ Seed complete');
  await pool.end();
}

seed().catch(err => { console.error(err); process.exit(1); });
