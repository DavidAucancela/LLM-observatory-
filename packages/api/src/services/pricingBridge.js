// Single source of truth for "given provider token counts, what did this cost?"
// inside packages/api. Pricing tables + cost fns come from @llm-observatory/sdk
// (the same tables the client SDKs use) so the API never carries its own
// drifting copy again. This module only adds:
//   1. a provider -> cost-fn dispatch map, and
//   2. the Anthropic prompt-cache-creation (cache write) surcharge.
//
// Used by services/providerUsage.js (historical sync + reconciliation fallback)
// and routes/metrics.js (model-recognition warning on ingest).

const sdk = require('@llm-observatory/sdk');

// provider -> SDK cost fn. All are (model, inputTokens, outputTokens) => number
// (USD); each normalizes the model id (snapshot-suffix stripping) internally and
// returns 0 + console.warn on an unknown model.
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

const KNOWN_PROVIDERS = new Set(['anthropic', 'openai', 'gemini', 'grok', 'kimi']);

function canonicalModelId(provider, model) {
  return sdk.normalizeModelId(model, PROVIDER_PRICING_TABLES[provider]);
}

function isKnownModel(provider, model) {
  const table = PROVIDER_PRICING_TABLES[provider];
  // Guard against a deployed SDK build that hasn't shipped a provider's table
  // yet: don't flag those as "unrecognized", only genuinely unknown providers.
  if (!table) return KNOWN_PROVIDERS.has(provider);
  return Boolean(table[sdk.normalizeModelId(model, table)]);
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

  return fn(model, effectiveInput, output); // fn normalizes the model id itself
}

module.exports = {
  costForProviderUsage,
  isKnownModel,
  canonicalModelId,
  normalizeModelId: sdk.normalizeModelId,
  CACHE_CREATION_INPUT_MULTIPLIER,
  PROVIDER_COST_FNS,
  PROVIDER_PRICING_TABLES,
};
