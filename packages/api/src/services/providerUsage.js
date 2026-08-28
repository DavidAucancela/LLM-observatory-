// Shared provider usage/cost fetching, used by both the historical sync route
// (routes/sync.js) and the reconciliation job (jobs/reconciliation.js).
//
// Two kinds of provider integration live here:
//  - fetch{Anthropic,OpenAI}Usage + summarizeBuckets: TOKEN usage, recomputed
//    to a dollar estimate locally via PRICING below. Used by sync.js (bulk
//    historical import) and as reconciliation's fallback when a real Costs
//    API call fails.
//  - fetch{Anthropic,OpenAI}RealCost: the actual provider-billed dollar total
//    (OpenAI's /v1/organization/costs, Anthropic's
//    /v1/organizations/cost_report) — genuine ground truth, not a local
//    recomputation. This is reconciliation's primary source.

function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
}

const PRICING = {
  anthropic: {
    'claude-opus-4-6':            { input:  5.0, output: 25.0 },
    'claude-sonnet-4-6':          { input:  3.0, output: 15.0 },
    'claude-haiku-4-5-20251001':  { input:  0.8, output:  4.0 },
    'claude-3-5-sonnet-20241022': { input:  3.0, output: 15.0 },
    'claude-3-5-haiku-20241022':  { input:  0.8, output:  4.0 },
    'claude-3-opus-20240229':     { input: 15.0, output: 75.0 },
    'claude-3-haiku-20240307':    { input:  0.25, output: 1.25 },
  },
  openai: {
    'gpt-4o':        { input:  2.5, output: 10.0 },
    'gpt-4o-mini':   { input:  0.15, output: 0.6 },
    'gpt-4-turbo':   { input: 10.0, output: 30.0 },
    'gpt-4':         { input: 30.0, output: 60.0 },
    'gpt-3.5-turbo': { input:  0.5, output:  1.5 },
    'o1':            { input: 15.0, output: 60.0 },
    'o1-mini':       { input:  3.0, output: 12.0 },
    'o3-mini':       { input:  1.1, output:  4.4 },
    'o3':            { input: 10.0, output: 40.0 },
  },
};

function calcCost(provider, model, inputTokens, outputTokens) {
  const pricing = (PRICING[provider] || {})[model];
  if (!pricing) {
    console.warn(`[providerUsage] Unknown model pricing: ${provider}/${model} — cost set to $0`);
    return 0;
  }
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

async function fetchAnthropicUsage(adminKey, startDate, endDate) {
  const startStr = startDate.toISOString().split('.')[0] + 'Z';
  const endStr   = endDate.toISOString().split('.')[0] + 'Z';

  let allData = [], nextPage = null, hasMore = true;

  while (hasMore) {
    const url = new URL('https://api.anthropic.com/v1/organizations/usage_report/messages');
    url.searchParams.set('starting_at', startStr);
    url.searchParams.set('ending_at', endStr);
    url.searchParams.set('bucket_width', '1d');
    url.searchParams.append('group_by[]', 'model');
    url.searchParams.set('limit', '31');
    if (nextPage) url.searchParams.set('page', nextPage);

    const res = await fetchWithTimeout(url.toString(), {
      headers: { 'x-api-key': adminKey, 'anthropic-version': '2023-06-01' }
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);

    const data = await res.json();
    allData  = allData.concat(data.data || []);
    hasMore  = data.has_more || false;
    nextPage = data.next_page || null;
  }
  return allData;
}

async function fetchOpenAIUsage(apiKey, startDate, endDate) {
  const startTs = Math.floor(startDate.getTime() / 1000);
  const endTs   = Math.floor(endDate.getTime() / 1000);

  let allBuckets = [], page = null, hasMore = true;

  while (hasMore) {
    const url = new URL('https://api.openai.com/v1/organization/usage/completions');
    url.searchParams.set('start_time', startTs);
    url.searchParams.set('end_time', endTs);
    url.searchParams.set('bucket_width', '1d');
    url.searchParams.append('group_by[]', 'model');
    url.searchParams.set('limit', 31);
    if (page) url.searchParams.set('page', page);

    const res = await fetchWithTimeout(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);

    const data  = await res.json();
    allBuckets  = allBuckets.concat(data.data || []);
    hasMore     = data.has_more || false;
    page        = data.next_page || null;
  }
  return allBuckets;
}

// Sums token-usage buckets into a single { inputTokens, outputTokens, costUsd }
// via PRICING, per-model, for the given provider.
function summarizeBuckets(buckets, provider) {
  let inputTokens = 0, outputTokens = 0, costUsd = 0;

  for (const bucket of buckets) {
    for (const result of (bucket.results || [])) {
      const model = result.model || 'unknown';
      let inTok, outTok;
      if (provider === 'anthropic') {
        inTok  = parseInt(result.uncached_input_tokens || 0) + parseInt(result.cache_read_input_tokens || 0);
        outTok = parseInt(result.output_tokens || 0);
      } else {
        inTok  = parseInt(result.input_tokens  || 0);
        outTok = parseInt(result.output_tokens || 0);
      }
      inputTokens  += inTok;
      outputTokens += outTok;
      costUsd      += calcCost(provider, model, inTok, outTok);
    }
  }
  return { inputTokens, outputTokens, costUsd };
}

// Real provider-billed cost (USD) for the window — NOT a local recomputation.
// Anthropic's cost_report `amount` is a decimal string in the "lowest currency
// unit" (cents for USD) per their docs' own example ("123.45" -> $1.23), so it
// must be divided by 100. OpenAI's costs `amount.value` is already a plain
// USD float (confirmed via their cookbook example output) — no conversion.
async function fetchAnthropicRealCost(adminKey, startDate, endDate) {
  const startStr = startDate.toISOString().split('.')[0] + 'Z';
  const endStr   = endDate.toISOString().split('.')[0] + 'Z';

  let total = 0, nextPage = null, hasMore = true;

  while (hasMore) {
    const url = new URL('https://api.anthropic.com/v1/organizations/cost_report');
    url.searchParams.set('starting_at', startStr);
    url.searchParams.set('ending_at', endStr);
    url.searchParams.set('bucket_width', '1d');
    url.searchParams.set('limit', '31');
    if (nextPage) url.searchParams.set('page', nextPage);

    const res = await fetchWithTimeout(url.toString(), {
      headers: { 'x-api-key': adminKey, 'anthropic-version': '2023-06-01' }
    });
    if (!res.ok) throw new Error(`Anthropic cost_report API ${res.status}: ${await res.text()}`);

    const data = await res.json();
    for (const bucket of (data.data || [])) {
      for (const result of (bucket.results || [])) {
        total += parseFloat(result.amount || '0') / 100;
      }
    }
    hasMore  = data.has_more || false;
    nextPage = data.next_page || null;
  }
  return total;
}

async function fetchOpenAIRealCost(apiKey, startDate, endDate) {
  const startTs = Math.floor(startDate.getTime() / 1000);
  const endTs   = Math.floor(endDate.getTime() / 1000);

  let total = 0, page = null, hasMore = true;

  while (hasMore) {
    const url = new URL('https://api.openai.com/v1/organization/costs');
    url.searchParams.set('start_time', String(startTs));
    url.searchParams.set('end_time', String(endTs));
    url.searchParams.set('bucket_width', '1d');
    url.searchParams.set('limit', '180');
    if (page) url.searchParams.set('page', page);

    const res = await fetchWithTimeout(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`OpenAI costs API ${res.status}: ${await res.text()}`);

    const data = await res.json();
    for (const bucket of (data.data || [])) {
      for (const result of (bucket.results || [])) {
        total += parseFloat(result.amount?.value || 0);
      }
    }
    hasMore = data.has_more || false;
    page    = data.next_page || null;
  }
  return total;
}

module.exports = {
  fetchWithTimeout, PRICING, calcCost,
  fetchAnthropicUsage, fetchOpenAIUsage, summarizeBuckets,
  fetchAnthropicRealCost, fetchOpenAIRealCost,
};
