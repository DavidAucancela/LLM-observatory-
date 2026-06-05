const { describe, it } = require('node:test');
const assert = require('node:assert');
const { calculateCost, calculateOpenAICost, ANTHROPIC_PRICING, OPENAI_PRICING } = require('../index.js');

describe('calculateCost (Anthropic)', () => {
  it('calculates cost for claude-sonnet correctly', () => {
    const cost = calculateCost('claude-sonnet-4-6', 1_000_000, 1_000_000);
    assert.strictEqual(cost, 18.0); // 3.0 + 15.0
  });

  it('calculates cost for claude-opus correctly', () => {
    const cost = calculateCost('claude-opus-4-6', 1_000_000, 1_000_000);
    assert.strictEqual(cost, 90.0); // 15.0 + 75.0
  });

  it('returns zero for unknown models', () => {
    const cost = calculateCost('unknown-model', 1_000_000, 0);
    assert.strictEqual(cost, 0);
  });

  it('calculates zero cost for zero tokens', () => {
    const cost = calculateCost('claude-sonnet-4-6', 0, 0);
    assert.strictEqual(cost, 0);
  });

  it('all known Anthropic models have valid pricing', () => {
    for (const [model, pricing] of Object.entries(ANTHROPIC_PRICING)) {
      assert.ok(pricing.input >= 0, `${model} input price should be >= 0`);
      assert.ok(pricing.output >= 0, `${model} output price should be >= 0`);
    }
  });
});

describe('calculateOpenAICost', () => {
  it('calculates cost for gpt-4o correctly', () => {
    const cost = calculateOpenAICost('gpt-4o', 1_000_000, 1_000_000);
    assert.strictEqual(cost, 12.5); // 2.50 + 10.00
  });

  it('returns zero for unknown models', () => {
    const cost = calculateOpenAICost('unknown-model', 1_000_000, 0);
    assert.strictEqual(cost, 0);
  });

  it('all known OpenAI models have valid pricing', () => {
    for (const [model, pricing] of Object.entries(OPENAI_PRICING)) {
      assert.ok(pricing.input >= 0, `${model} input price should be >= 0`);
      assert.ok(pricing.output >= 0, `${model} output price should be >= 0`);
    }
  });
});
