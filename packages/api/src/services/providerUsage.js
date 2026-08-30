// Shared provider usage/cost fetching, used by both the historical sync route
// (routes/sync.js) and the reconciliation job (jobs/reconciliation.js).
//
// Two kinds of provider integration live here:
//  - fetch{Anthropic,OpenAI}Usage + summarizeBuckets: TOKEN usage, recomputed
//    to a dollar estimate via @llm-observatory/sdk pricing (through
//    services/pricingBridge). Used by sync.js (bulk historical import) and as
//    reconciliation's fallback when a real Costs API call fails.
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

const { costForProviderUsage } = require('./pricingBridge');

// The Anthropic org usage_report/messages result-row field for cache-write
// (cache_creation) tokens isn't pinned down in our fixtures, so accept both the
// flat `cache_creation_input_tokens` and a nested
// `cache_creation: { ephemeral_5m_input_tokens, ephemeral_1h_input_tokens }`.
function anthropicCacheCreationTokens(result) {
  if (result.cache_creation_input_tokens != null) {
    return parseInt(result.cache_creation_input_tokens, 10) || 0;
  }
  const cc = result.cache_creation;
  if (cc && typeof cc === 'object') {
    return (parseInt(cc.ephemeral_5m_input_tokens, 10) || 0)
         + (parseInt(cc.ephemeral_1h_input_tokens, 10) || 0);
  }
  return 0;
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

// Sums token-usage buckets into a single
// { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, costUsd },
// per-model, for the given provider. Pricing comes from services/pricingBridge
// (the SDK tables). `inputTokens` includes cache-read and cache-creation tokens;
// cache-creation carries the 1.25x Anthropic surcharge inside the bridge.
function summarizeBuckets(buckets, provider) {
  let inputTokens = 0, outputTokens = 0, cacheReadTokens = 0, cacheWriteTokens = 0, costUsd = 0;

  for (const bucket of buckets) {
    for (const result of (bucket.results || [])) {
      const model = result.model || 'unknown';
      let uncachedInput, cacheReadInput, cacheCreationInput, output;

      if (provider === 'anthropic') {
        uncachedInput      = parseInt(result.uncached_input_tokens || 0, 10);
        cacheReadInput     = parseInt(result.cache_read_input_tokens || 0, 10);
        cacheCreationInput = anthropicCacheCreationTokens(result);
        output             = parseInt(result.output_tokens || 0, 10);
      } else {
        // OpenAI's usage API input_tokens already includes cached input; it has
        // no separate cache-write concept here.
        uncachedInput      = parseInt(result.input_tokens || 0, 10);
        cacheReadInput     = 0;
        cacheCreationInput = 0;
        output             = parseInt(result.output_tokens || 0, 10);
      }

      inputTokens      += uncachedInput + cacheReadInput + cacheCreationInput;
      outputTokens     += output;
      cacheReadTokens  += cacheReadInput;
      cacheWriteTokens += cacheCreationInput;
      costUsd += costForProviderUsage(provider, model, {
        uncachedInput, cacheReadInput, cacheCreationInput, output,
      });
    }
  }
  return { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, costUsd };
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
  fetchWithTimeout, anthropicCacheCreationTokens,
  fetchAnthropicUsage, fetchOpenAIUsage, summarizeBuckets,
  fetchAnthropicRealCost, fetchOpenAIRealCost,
};
