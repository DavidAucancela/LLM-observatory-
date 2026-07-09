const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const sinon  = require('sinon');

const { MonitoredAnthropic } = require('../index.js');

function makeResponse({ input = 100, output = 50, cacheRead = 0, cacheWrite = 0, content, stop_reason } = {}) {
  return {
    usage: {
      input_tokens:                input,
      output_tokens:               output,
      cache_read_input_tokens:     cacheRead,
      cache_creation_input_tokens: cacheWrite,
    },
    content: content ?? [{ type: 'text', text: 'Hello there' }],
    stop_reason: stop_reason ?? 'end_turn',
  };
}

let client;
let messagesStub;
let fetchStub;

beforeEach(() => {
  fetchStub = sinon.stub(globalThis, 'fetch').resolves({ ok: true, status: 200 });
  client = new MonitoredAnthropic({
    apiKey: 'sk-ant-api03-ABCDEF1234',
    observatoryUrl: 'http://obs:3001',
    observatoryToken: 'obs_sk_test',
  });
  messagesStub = sinon.stub(client.client.messages, 'create');
});

afterEach(() => sinon.restore());

// ── Non-streaming ─────────────────────────────────────────────────────────────
describe('MonitoredAnthropic — non-streaming', () => {
  it('returns the response from the underlying client', async () => {
    const resp = makeResponse();
    messagesStub.resolves(resp);
    const result = await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    });
    assert.strictEqual(result, resp);
  });

  it('sends metric with correct token counts and status 200', async () => {
    messagesStub.resolves(makeResponse({ input: 100, output: 50 }));
    await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    });
    await new Promise(r => setImmediate(r));

    assert.strictEqual(fetchStub.callCount, 1);
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.strictEqual(metric.input_tokens,  100);
    assert.strictEqual(metric.output_tokens, 50);
    assert.strictEqual(metric.total_tokens,  150);
    assert.strictEqual(metric.status_code,   200);
    // provider is defaulted to 'anthropic' by the API — not sent by the SDK wrapper
  });

  it('calculates cost correctly: 1M+1M sonnet → $18', async () => {
    messagesStub.resolves(makeResponse({ input: 1_000_000, output: 1_000_000 }));
    await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    });
    await new Promise(r => setImmediate(r));
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.strictEqual(metric.cost_usd, 18.0);
  });

  it('masks api_key_hint correctly', async () => {
    messagesStub.resolves(makeResponse());
    await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    });
    await new Promise(r => setImmediate(r));
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.strictEqual(metric.api_key_hint, 'sk-ant-a…1234');
  });

  it('truncates prompt_preview to 200 chars', async () => {
    messagesStub.resolves(makeResponse());
    await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 10,
      messages: [{ role: 'user', content: 'A'.repeat(500) }],
    });
    await new Promise(r => setImmediate(r));
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.ok(metric.prompt_preview.length <= 200);
  });

  it('forwards tags to the metric payload', async () => {
    messagesStub.resolves(makeResponse());
    const taggedClient = new MonitoredAnthropic({
      apiKey: 'sk-ant-api03-ABCDEF1234',
      observatoryUrl: 'http://obs:3001',
      tags: { env: 'production', feature: 'summarizer' },
    });
    sinon.stub(taggedClient.client.messages, 'create').resolves(makeResponse());

    await taggedClient.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    });
    await new Promise(r => setImmediate(r));
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.deepStrictEqual(metric.tags, { env: 'production', feature: 'summarizer' });
  });

  it('extracts tool names into tools_used', async () => {
    messagesStub.resolves(makeResponse());
    await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 10,
      messages: [{ role: 'user', content: 'Use tools' }],
      tools: [{ name: 'get_weather' }, { name: 'search_web' }],
    });
    await new Promise(r => setImmediate(r));
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.deepStrictEqual(metric.tools_used, ['get_weather', 'search_web']);
  });

  it('sends prompt_full with the full messages array, not just the first message', async () => {
    messagesStub.resolves(makeResponse());
    const messages = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'second' },
      { role: 'user', content: 'third' },
    ];
    await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 10, messages });
    await new Promise(r => setImmediate(r));
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.deepStrictEqual(JSON.parse(metric.prompt_full), messages);
  });

  it('extracts system_prompt and request_params from params', async () => {
    messagesStub.resolves(makeResponse());
    await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 10, temperature: 0.7, top_p: 0.9,
      system: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    await new Promise(r => setImmediate(r));
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.strictEqual(metric.system_prompt, 'You are a helpful assistant.');
    assert.deepStrictEqual(metric.request_params, { temperature: 0.7, max_tokens: 10, top_p: 0.9, stream: false });
  });

  it('extracts tool_calls (name + arguments) from tool_use content blocks', async () => {
    messagesStub.resolves(makeResponse({
      content: [
        { type: 'text', text: 'Let me check.' },
        { type: 'tool_use', name: 'get_weather', input: { city: 'Paris' } },
      ],
    }));
    await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 10,
      messages: [{ role: 'user', content: 'Weather in Paris?' }],
    });
    await new Promise(r => setImmediate(r));
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.deepStrictEqual(metric.tool_calls, [{ name: 'get_weather', arguments: { city: 'Paris' } }]);
    assert.strictEqual(metric.response_full, 'Let me check.');
  });

  it('extracts stop_reason from the response', async () => {
    messagesStub.resolves(makeResponse({ stop_reason: 'max_tokens' }));
    await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    });
    await new Promise(r => setImmediate(r));
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.strictEqual(metric.stop_reason, 'max_tokens');
  });

  it('captures cache_read_tokens and cache_write_tokens', async () => {
    messagesStub.resolves(makeResponse({ input: 100, output: 50, cacheRead: 300, cacheWrite: 150 }));
    await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    });
    await new Promise(r => setImmediate(r));
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.strictEqual(metric.cache_read_tokens,  300);
    assert.strictEqual(metric.cache_write_tokens, 150);
  });

  it('sends metric with status 429 and zero cost on rate limit error', async () => {
    const err = Object.assign(new Error('rate limited'), { status: 429 });
    messagesStub.rejects(err);

    await assert.rejects(
      () => client.messages.create({
        model: 'claude-sonnet-4-6', max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
      { message: 'rate limited' }
    );
    await new Promise(r => setImmediate(r));

    assert.strictEqual(fetchStub.callCount, 1);
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.strictEqual(metric.status_code, 429);
    assert.strictEqual(metric.cost_usd,    0);
  });

  it('classifies error_type as rate_limit for 429', async () => {
    const err = Object.assign(new Error('too many requests'), { status: 429 });
    messagesStub.rejects(err);
    await assert.rejects(() => client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    }));
    await new Promise(r => setImmediate(r));
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.strictEqual(metric.error_type, 'rate_limit');
    assert.ok(metric.error_message.length > 0);
  });
});

// ── Streaming ─────────────────────────────────────────────────────────────────
describe('MonitoredAnthropic — streaming', () => {
  function makeFakeStream({ input = 80, output = 40, content, stop_reason } = {}) {
    return {
      finalMessage: () => Promise.resolve({
        usage: {
          input_tokens: input,
          output_tokens: output,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
        content: content ?? [{ type: 'text', text: 'streamed reply' }],
        stop_reason: stop_reason ?? 'end_turn',
      }),
      [Symbol.asyncIterator]: async function*() {
        yield { type: 'content_block_delta' };
        yield { type: 'content_block_delta' };
      },
    };
  }

  it('returns the stream to the caller immediately', async () => {
    const fakeStream = makeFakeStream();
    messagesStub.resolves(fakeStream);
    const result = await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 100,
      messages: [{ role: 'user', content: 'Hi' }],
      stream: true,
    });
    assert.strictEqual(result, fakeStream);
  });

  it('sends metric with correct tokens after finalMessage resolves', async () => {
    messagesStub.resolves(makeFakeStream({ input: 80, output: 40 }));
    await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 100,
      messages: [{ role: 'user', content: 'Hi' }],
      stream: true,
    });

    // Wait for the .then() on finalMessage to run
    await new Promise(r => setImmediate(r));
    await new Promise(r => setImmediate(r));

    assert.strictEqual(fetchStub.callCount, 1);
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.strictEqual(metric.input_tokens,  80);
    assert.strictEqual(metric.output_tokens, 40);
    assert.strictEqual(metric.total_tokens,  120);
    assert.strictEqual(metric.status_code,   200);
    assert.strictEqual(metric.response_full, 'streamed reply');
    assert.strictEqual(metric.stop_reason,   'end_turn');
  });

  it('sends metric even when the stream errors before completing', async () => {
    const err = Object.assign(new Error('stream error'), { status: 500 });
    messagesStub.rejects(err);

    await assert.rejects(() => client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 100,
      messages: [{ role: 'user', content: 'Hi' }],
      stream: true,
    }));
    await new Promise(r => setImmediate(r));

    assert.strictEqual(fetchStub.callCount, 1);
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.strictEqual(metric.status_code, 500);
    assert.strictEqual(metric.cost_usd,    0);
  });
});
