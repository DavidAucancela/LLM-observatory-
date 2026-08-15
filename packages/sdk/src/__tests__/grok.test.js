const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const sinon  = require('sinon');

const { MonitoredGrok } = require('../index.js');

function makeResponse({ prompt = 100, completion = 50, cached = 0 } = {}) {
  return {
    usage: {
      prompt_tokens:     prompt,
      completion_tokens: completion,
      prompt_tokens_details: { cached_tokens: cached },
    },
  };
}

let client;
let completionsStub;
let fetchStub;

beforeEach(() => {
  fetchStub = sinon.stub(globalThis, 'fetch').resolves({ ok: true, status: 200 });
  client = new MonitoredGrok({
    apiKey: 'xai-TESTKEY0000000000000000',
    observatoryUrl: 'http://obs:3001',
    observatoryToken: 'obs_sk_test',
  });
  completionsStub = sinon.stub(client.client.chat.completions, 'create');
});

afterEach(() => sinon.restore());

describe('MonitoredGrok — client setup', () => {
  it('points the underlying OpenAI client at api.x.ai', () => {
    assert.strictEqual(client.client.baseURL, 'https://api.x.ai/v1');
  });
});

// ── Non-streaming ─────────────────────────────────────────────────────────────
describe('MonitoredGrok — non-streaming', () => {
  it('returns response from underlying client unchanged', async () => {
    const resp = makeResponse();
    completionsStub.resolves(resp);
    const result = await client.chat.completions.create({
      model: 'grok-4.6',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    assert.strictEqual(result, resp);
  });

  it('sends metric with correct tokens, provider grok, and status 200', async () => {
    completionsStub.resolves(makeResponse({ prompt: 100, completion: 50 }));
    await client.chat.completions.create({
      model: 'grok-4.6',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    await new Promise(r => setImmediate(r));

    assert.strictEqual(fetchStub.callCount, 1);
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.strictEqual(metric.input_tokens,  100);
    assert.strictEqual(metric.output_tokens, 50);
    assert.strictEqual(metric.total_tokens,  150);
    assert.strictEqual(metric.status_code,   200);
    assert.strictEqual(metric.provider,      'grok');
  });

  it('calculates cost correctly: 1M+1M grok-4.6 → $8.00', async () => {
    completionsStub.resolves(makeResponse({ prompt: 1_000_000, completion: 1_000_000 }));
    await client.chat.completions.create({
      model: 'grok-4.6',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    await new Promise(r => setImmediate(r));
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.strictEqual(metric.cost_usd, 8.0);
  });

  it('captures cache_read_tokens from prompt_tokens_details.cached_tokens', async () => {
    completionsStub.resolves(makeResponse({ prompt: 100, completion: 50, cached: 40 }));
    await client.chat.completions.create({
      model: 'grok-4.6',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    await new Promise(r => setImmediate(r));
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.strictEqual(metric.cache_read_tokens, 40);
  });

  it('sends metric on error with status and zero cost', async () => {
    const err = Object.assign(new Error('rate limited'), { status: 429 });
    completionsStub.rejects(err);

    await assert.rejects(
      () => client.chat.completions.create({
        model: 'grok-4.6',
        messages: [{ role: 'user', content: 'Hi' }],
      }),
      { message: 'rate limited' }
    );
    await new Promise(r => setImmediate(r));

    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.strictEqual(metric.status_code, 429);
    assert.strictEqual(metric.cost_usd,    0);
  });

  it('forwards tags to metric payload', async () => {
    const taggedClient = new MonitoredGrok({
      apiKey: 'xai-TESTKEY0000000000000000',
      observatoryUrl: 'http://obs:3001',
      tags: { env: 'staging', team: 'ml' },
    });
    sinon.stub(taggedClient.client.chat.completions, 'create').resolves(makeResponse());

    await taggedClient.chat.completions.create({
      model: 'grok-4.6',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    await new Promise(r => setImmediate(r));
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.deepStrictEqual(metric.tags, { env: 'staging', team: 'ml' });
  });
});

// ── Streaming ─────────────────────────────────────────────────────────────────
describe('MonitoredGrok — streaming', () => {
  it('yields all chunks from the underlying stream', async () => {
    async function* fakeStream() {
      yield { choices: [{ delta: { content: 'Hello' } }], usage: null };
      yield { choices: [{ delta: { content: ' world' } }], usage: null };
    }
    completionsStub.resolves(fakeStream());

    const result = client.chat.completions.create({
      model: 'grok-4.6',
      messages: [{ role: 'user', content: 'Hi' }],
      stream: true,
    });
    const chunks = [];
    for await (const chunk of await result) { chunks.push(chunk); }
    assert.strictEqual(chunks.length, 2);
  });

  it('captures usage from final chunk and sends metric with provider grok after stream completes', async () => {
    async function* fakeStream() {
      yield { usage: null, choices: [] };
      yield { usage: { prompt_tokens: 120, completion_tokens: 60, prompt_tokens_details: { cached_tokens: 0 } }, choices: [] };
    }
    completionsStub.resolves(fakeStream());

    const stream = await client.chat.completions.create({
      model: 'grok-4.6',
      messages: [{ role: 'user', content: 'Hi' }],
      stream: true,
    });
    for await (const _ of stream) { /* consume */ }
    await new Promise(r => setImmediate(r));

    assert.strictEqual(fetchStub.callCount, 1);
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.strictEqual(metric.input_tokens,  120);
    assert.strictEqual(metric.output_tokens, 60);
    assert.strictEqual(metric.provider,      'grok');
  });
});
