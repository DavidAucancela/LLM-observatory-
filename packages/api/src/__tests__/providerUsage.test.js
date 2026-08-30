const { summarizeBuckets } = require('../services/providerUsage');

const M = 1_000_000;

// Minimal shape of what fetch{Anthropic,OpenAI}Usage return: an array of
// buckets, each with a `results` array of per-model rows.
function bucket(results) {
  return { starting_at: '2026-07-16T00:00:00Z', results };
}

describe('summarizeBuckets — Anthropic cache-creation handling (bug 3)', () => {
  it('counts cache-creation tokens and prices them with the 1.25x surcharge (flat field)', () => {
    const out = summarizeBuckets([bucket([{
      model: 'claude-sonnet-4-6',
      uncached_input_tokens: M,
      cache_read_input_tokens: M,
      cache_creation_input_tokens: M,
      output_tokens: 0,
    }])], 'anthropic');

    expect(out.inputTokens).toBe(3 * M);          // uncached + read + creation
    expect(out.cacheReadTokens).toBe(M);
    expect(out.cacheWriteTokens).toBe(M);
    // (1M + 1M) * $3 + round(1M * 1.25) * $3  ==  6.0 + 3.75
    expect(out.costUsd).toBeCloseTo(9.75, 6);
  });

  it('reads the nested cache_creation shape identically (defensive parsing)', () => {
    const flat = summarizeBuckets([bucket([{
      model: 'claude-sonnet-4-6',
      uncached_input_tokens: 0, cache_read_input_tokens: 0,
      cache_creation_input_tokens: M, output_tokens: 0,
    }])], 'anthropic');

    const nested = summarizeBuckets([bucket([{
      model: 'claude-sonnet-4-6',
      uncached_input_tokens: 0, cache_read_input_tokens: 0,
      cache_creation: { ephemeral_5m_input_tokens: 600_000, ephemeral_1h_input_tokens: 400_000 },
      output_tokens: 0,
    }])], 'anthropic');

    expect(nested.cacheWriteTokens).toBe(M);
    expect(nested.costUsd).toBeCloseTo(flat.costUsd, 6);
  });
});

describe('summarizeBuckets — OpenAI dated model id (bug 2)', () => {
  it('prices a snapshot model id instead of dropping it to $0', () => {
    const out = summarizeBuckets([bucket([{
      model: 'gpt-4o-mini-2024-07-18',
      input_tokens: M,
      output_tokens: 0,
    }])], 'openai');

    expect(out.inputTokens).toBe(M);
    expect(out.costUsd).toBeCloseTo(0.15, 6);
  });
});
