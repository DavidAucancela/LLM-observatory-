const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  calculateCost, calculateOpenAICost, calculateGrokCost, calculateKimiCost,
  ANTHROPIC_PRICING, OPENAI_PRICING, GROK_PRICING, KIMI_PRICING,
} = require('../index.js');

describe('calculateCost (Anthropic)', () => {
  it('calculates cost for claude-sonnet correctly', () => {
    const cost = calculateCost('claude-sonnet-4-6', 1_000_000, 1_000_000);
    assert.strictEqual(cost, 18.0); // 3.0 + 15.0
  });

  it('calculates cost for claude-opus correctly', () => {
    const cost = calculateCost('claude-opus-4-6', 1_000_000, 1_000_000);
    assert.strictEqual(cost, 30.0); // 5.0 + 25.0
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

describe('calculateGrokCost', () => {
  it('calculates cost for grok-4.6 correctly', () => {
    const cost = calculateGrokCost('grok-4.6', 1_000_000, 1_000_000);
    assert.strictEqual(cost, 8.0); // 2.00 + 6.00
  });

  it('returns zero for unknown models', () => {
    const cost = calculateGrokCost('unknown-model', 1_000_000, 0);
    assert.strictEqual(cost, 0);
  });

  it('all known Grok models have valid pricing', () => {
    for (const [model, pricing] of Object.entries(GROK_PRICING)) {
      assert.ok(pricing.input >= 0, `${model} input price should be >= 0`);
      assert.ok(pricing.output >= 0, `${model} output price should be >= 0`);
    }
  });
});

describe('calculateKimiCost', () => {
  it('calculates cost for kimi-k3 correctly', () => {
    const cost = calculateKimiCost('kimi-k3', 1_000_000, 1_000_000);
    assert.strictEqual(cost, 18.0); // 3.00 + 15.00
  });

  it('returns zero for unknown models', () => {
    const cost = calculateKimiCost('unknown-model', 1_000_000, 0);
    assert.strictEqual(cost, 0);
  });

  it('all known Kimi models have valid pricing', () => {
    for (const [model, pricing] of Object.entries(KIMI_PRICING)) {
      assert.ok(pricing.input >= 0, `${model} input price should be >= 0`);
      assert.ok(pricing.output >= 0, `${model} output price should be >= 0`);
    }
  });
});
