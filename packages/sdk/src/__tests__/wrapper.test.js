const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const { calculateCost, MODEL_PRICING } = require('../index.js');

describe('calculateCost', () => {
  it('calculates cost for claude-sonnet correctly', () => {
    const cost = calculateCost('claude-sonnet-4-6', 1_000_000, 1_000_000);
    assert.strictEqual(cost, 18.0); // 3.0 + 15.0
  });

  it('calculates cost for claude-opus correctly', () => {
    const cost = calculateCost('claude-opus-4-6', 1_000_000, 1_000_000);
    assert.strictEqual(cost, 90.0); // 15.0 + 75.0
  });

  it('uses default pricing for unknown models', () => {
    const cost = calculateCost('unknown-model', 1_000_000, 0);
    assert.strictEqual(cost, 3.0);
  });

  it('calculates zero cost for zero tokens', () => {
    const cost = calculateCost('claude-sonnet-4-6', 0, 0);
    assert.strictEqual(cost, 0);
  });

  it('all known models have valid pricing', () => {
    for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
      assert.ok(pricing.input >= 0, `${model} input price should be >= 0`);
      assert.ok(pricing.output >= 0, `${model} output price should be >= 0`);
    }
  });
});
