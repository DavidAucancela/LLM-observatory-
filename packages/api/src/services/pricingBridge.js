// Single source of truth for "given provider token counts, what did this cost?"
// inside packages/api. Pricing tables + cost fns come from @llm-observatory/sdk
// (the same tables the client SDKs use) so the API never carries its own
// drifting copy again. This module adds:
//   1. a provider -> cost-fn dispatch map,
//   2. the Anthropic prompt-cache-creation (cache write) surcharge, and
//   3. model-id normalization (snapshot-suffix stripping) done HERE rather than
//      relying on sdk.normalizeModelId — the deployed npm build of the SDK can
//      lag the monorepo source, and older published versions don't export it.
//
// Used by services/providerUsage.js (historical sync + reconciliation fallback)
// and routes/metrics.js (model-recognition warning on ingest).

const sdk = require('@llm-observatory/sdk');

// provider -> SDK cost fn. All are (model, inputTokens, outputTokens) => number
// (USD) with a plain exact-key table lookup, returning 0 + console.warn on an
// unknown model. We normalize the model id before calling them (see below).
const PROVIDER_COST_FNS = {
  anthropic: sdk.calculateCost, // there is no calculateAnthropicCost alias — calculateCost IS Anthropic
  openai:    sdk.calculateOpenAICost,
  gemini:    sdk.calculateGeminiCost,
  grok:      sdk.calculateGrokCost,
  kimi:      sdk.calculateKimiCost,
};

// provider -> SDK pricing table, used for model-recognition and normalization.
const PROVIDER_PRICING_TABLES = {
  anthropic: sdk.ANTHROPIC_PRICING,
  openai:    sdk.OPENAI_PRICING,
  gemini:    sdk.GEMINI_PRICING,
  grok:      sdk.GROK_PRICING,
  kimi:      sdk.KIMI_PRICING,
};

// Anthropic bills cache-WRITE (cache_creation) input at ~1.25x the base input
// rate. The SDK cost fns take a single flat input number, so we fold the
// surcharge into an "effective input" before calling them. Approximation:
// applies the model's base input rate x1.25 uniformly and ignores the 5m vs 1h
// TTL tiers. Cache READS stay at the plain input rate — the same simplification
// the SDK already documents for Grok/Kimi/Anthropic.
const CACHE_CREATION_INPUT_MULTIPLIER = 1.25;

// Trailing -YYYYMMDD or -YYYY-MM-DD snapshot suffix. Mirrors the SDK's own
// MODEL_SNAPSHOT_SUFFIX_RE (kept local — see header note 3).
const MODEL_SNAPSHOT_SUFFIX_RE = /-(\d{8}|\d{4}-\d{2}-\d{2})$/;

// Canonicalize a raw model id before a pricing lookup: strip a `models/` prefix
// and a trailing snapshot suffix, but only when the stripped id is actually a
// key in `pricingTable` (unknown/future ids pass through untouched).
function normalizeModelId(model, pricingTable) {
  if (!model || typeof model !== 'string') return model;
  const m = model.startsWith('models/') ? model.slice(7) : model;
  if (pricingTable && pricingTable[m]) return m;
  const stripped = m.replace(MODEL_SNAPSHOT_SUFFIX_RE, '');
  if (pricingTable && pricingTable[stripped]) return stripped;
  return m;
}

const KNOWN_PROVIDERS = new Set(['anthropic', 'openai', 'gemini', 'grok', 'kimi']);

function canonicalModelId(provider, model) {
  return normalizeModelId(model, PROVIDER_PRICING_TABLES[provider]);
}

function isKnownModel(provider, model) {
  const table = PROVIDER_PRICING_TABLES[provider];
  // A deployed SDK build may not ship every provider's table yet (e.g. npm
  // 1.1.0 has no Grok/Kimi). Don't flag those as "unrecognized" — only flag a
  // model when we actually have a table to check it against, or an unknown
  // provider entirely.
  if (!table) return KNOWN_PROVIDERS.has(provider);
  return Boolean(table[normalizeModelId(model, table)]);
}

// tokens: { uncachedInput, cacheReadInput, cacheCreationInput, output } — all
// optional, default 0. Returns the USD estimate for this slice of usage.
function costForProviderUsage(provider, model, tokens = {}) {
  const fn = PROVIDER_COST_FNS[provider];
  if (!fn) {
    console.warn(`[pricingBridge] No cost fn for provider "${provider}" — cost set to $0`);
    return 0;
  }
  const uncached   = Number(tokens.uncachedInput)      || 0;
  const cacheRead   = Number(tokens.cacheReadInput)     || 0;
  const cacheWrite  = Number(tokens.cacheCreationInput) || 0;
  const output      = Number(tokens.output)             || 0;

  const effectiveInput =
    uncached + cacheRead + Math.round(cacheWrite * CACHE_CREATION_INPUT_MULTIPLIER);

  // Normalize here so a dated snapshot id (gpt-4o-mini-2024-07-18) prices even
  // against an SDK build whose calculate* helpers don't normalize themselves.
  return fn(canonicalModelId(provider, model), effectiveInput, output);
}

module.exports = {
  costForProviderUsage,
  isKnownModel,
  canonicalModelId,
  normalizeModelId,
  CACHE_CREATION_INPUT_MULTIPLIER,
  PROVIDER_COST_FNS,
  PROVIDER_PRICING_TABLES,
};
