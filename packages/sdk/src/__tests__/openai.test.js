const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const sinon  = require('sinon');

const { MonitoredOpenAI } = require('../index.js');

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
  client = new MonitoredOpenAI({
    apiKey: 'sk-proj-TESTKEY0000000000000000',
    observatoryUrl: 'http://obs:3001',
    observatoryToken: 'obs_sk_test',
  });
  completionsStub = sinon.stub(client.client.chat.completions, 'create');
});

afterEach(() => sinon.restore());

// ── Non-streaming ─────────────────────────────────────────────────────────────
describe('MonitoredOpenAI — non-streaming', () => {
  it('returns response from underlying client unchanged', async () => {
    const resp = makeResponse();
    completionsStub.resolves(resp);
    const result = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    assert.strictEqual(result, resp);
  });

  it('sends metric with correct tokens and status 200', async () => {
    completionsStub.resolves(makeResponse({ prompt: 100, completion: 50 }));
    await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    await new Promise(r => setImmediate(r));

    assert.strictEqual(fetchStub.callCount, 1);
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.strictEqual(metric.input_tokens,  100);
    assert.strictEqual(metric.output_tokens, 50);
    assert.strictEqual(metric.total_tokens,  150);
    assert.strictEqual(metric.status_code,   200);
    assert.strictEqual(metric.provider,      'openai');
  });

  it('calculates cost correctly: 1M+1M gpt-4o → $12.50', async () => {
    completionsStub.resolves(makeResponse({ prompt: 1_000_000, completion: 1_000_000 }));
    await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    await new Promise(r => setImmediate(r));
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.strictEqual(metric.cost_usd, 12.5);
  });

  it('truncates prompt_preview to 200 chars', async () => {
    completionsStub.resolves(makeResponse());
    await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'X'.repeat(500) }],
    });
    await new Promise(r => setImmediate(r));
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.ok(metric.prompt_preview.length <= 200);
  });

  it('extracts tool names from function schema', async () => {
    completionsStub.resolves(makeResponse());
    await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
      tools: [
        { function: { name: 'get_weather' } },
        { function: { name: 'search_web' } },
      ],
    });
    await new Promise(r => setImmediate(r));
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.deepStrictEqual(metric.tools_used, ['get_weather', 'search_web']);
  });

  it('sends metric on error with status and zero cost', async () => {
    const err = Object.assign(new Error('rate limited'), { status: 429 });
    completionsStub.rejects(err);

    await assert.rejects(
      () => client.chat.completions.create({
        model: 'gpt-4o',
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
    completionsStub.resolves(makeResponse());
    const taggedClient = new MonitoredOpenAI({
      apiKey: 'sk-proj-TESTKEY0000000000000000',
      observatoryUrl: 'http://obs:3001',
      tags: { env: 'staging', team: 'ml' },
    });
    sinon.stub(taggedClient.client.chat.completions, 'create').resolves(makeResponse());

    await taggedClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    await new Promise(r => setImmediate(r));
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.deepStrictEqual(metric.tags, { env: 'staging', team: 'ml' });
  });
});

// ── Streaming ─────────────────────────────────────────────────────────────────
describe('MonitoredOpenAI — streaming', () => {
  it('injects include_usage into stream_options', async () => {
    completionsStub.resolves((async function*() {})());
    await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
      stream: true,
    });
    const callKwargs = completionsStub.firstCall.args[0];
    assert.strictEqual(callKwargs.stream_options.include_usage, true);
  });

  it('yields all chunks from the underlying stream', async () => {
    async function* fakeStream() {
      yield { choices: [{ delta: { content: 'Hello' } }], usage: null };
      yield { choices: [{ delta: { content: ' world' } }], usage: null };
    }
    completionsStub.resolves(fakeStream());

    const result = client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
      stream: true,
    });
    const chunks = [];
    for await (const chunk of await result) { chunks.push(chunk); }
    assert.strictEqual(chunks.length, 2);
  });

  it('captures usage from final chunk and sends metric after stream completes', async () => {
    async function* fakeStream() {
      yield { usage: null, choices: [] };
      yield { usage: { prompt_tokens: 120, completion_tokens: 60, prompt_tokens_details: { cached_tokens: 0 } }, choices: [] };
    }
    completionsStub.resolves(fakeStream());

    const stream = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
      stream: true,
    });
    for await (const _ of stream) { /* consume */ }
    await new Promise(r => setImmediate(r));

    assert.strictEqual(fetchStub.callCount, 1);
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.strictEqual(metric.input_tokens,  120);
    assert.strictEqual(metric.output_tokens, 60);
  });

  it('sends metric even when stream is closed early', async () => {
    async function* fakeStream() {
      yield { usage: null, choices: [] };
      yield { usage: null, choices: [] };
    }
    completionsStub.resolves(fakeStream());

    const stream = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
      stream: true,
    });
    // Break early
    for await (const _ of stream) { break; }
    await new Promise(r => setImmediate(r));

    assert.strictEqual(fetchStub.callCount, 1);
  });
});
