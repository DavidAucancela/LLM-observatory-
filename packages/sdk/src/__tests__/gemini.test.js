const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const sinon  = require('sinon');

const { MonitoredGemini } = require('../index.js');

function makeResponse({ prompt = 100, candidates = 50, cached = 0, text = 'hi there' } = {}) {
  return {
    text,
    usageMetadata: {
      promptTokenCount:        prompt,
      candidatesTokenCount:    candidates,
      cachedContentTokenCount: cached,
    },
    candidates: [{ finishReason: 'STOP' }],
    functionCalls: [],
  };
}

let client;
let generateContentStub;
let fetchStub;

beforeEach(() => {
  fetchStub = sinon.stub(globalThis, 'fetch').resolves({ ok: true, status: 200 });
  client = new MonitoredGemini({
    apiKey: 'AIza-TESTKEY0000000000000000',
    observatoryUrl: 'http://obs:3001',
    observatoryToken: 'obs_sk_test',
  });
  generateContentStub = sinon.stub(client.client.models, 'generateContent');
});

afterEach(() => sinon.restore());

// ── Non-streaming ─────────────────────────────────────────────────────────────
describe('MonitoredGemini — non-streaming', () => {
  it('returns response from underlying client unchanged', async () => {
    const resp = makeResponse();
    generateContentStub.resolves(resp);
    const result = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Hi',
    });
    assert.strictEqual(result, resp);
  });

  it('sends metric with correct tokens, provider, and status 200', async () => {
    generateContentStub.resolves(makeResponse({ prompt: 100, candidates: 50 }));
    await client.models.generateContent({ model: 'gemini-2.5-flash', contents: 'Hi' });
    await new Promise(r => setImmediate(r));

    assert.strictEqual(fetchStub.callCount, 1);
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.strictEqual(metric.input_tokens,  100);
    assert.strictEqual(metric.output_tokens, 50);
    assert.strictEqual(metric.total_tokens,  150);
    assert.strictEqual(metric.status_code,   200);
    assert.strictEqual(metric.provider,      'gemini');
  });

  it('calculates cost correctly: 1M+1M gemini-2.5-flash → $2.80', async () => {
    generateContentStub.resolves(makeResponse({ prompt: 1_000_000, candidates: 1_000_000 }));
    await client.models.generateContent({ model: 'gemini-2.5-flash', contents: 'Hi' });
    await new Promise(r => setImmediate(r));
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.strictEqual(metric.cost_usd, 2.8);
  });

  it('truncates prompt_preview to 200 chars for string contents', async () => {
    generateContentStub.resolves(makeResponse());
    await client.models.generateContent({ model: 'gemini-2.5-flash', contents: 'X'.repeat(500) });
    await new Promise(r => setImmediate(r));
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.ok(metric.prompt_preview.length <= 200);
  });

  it('extracts prompt_preview from array-of-Content contents', async () => {
    generateContentStub.resolves(makeResponse());
    await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: 'What is the weather?' }] }],
    });
    await new Promise(r => setImmediate(r));
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.strictEqual(metric.prompt_preview, 'What is the weather?');
  });

  it('extracts tool names from functionDeclarations', async () => {
    generateContentStub.resolves(makeResponse());
    await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Dim the lights',
      config: { tools: [{ functionDeclarations: [{ name: 'controlLight' }] }] },
    });
    await new Promise(r => setImmediate(r));
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.deepStrictEqual(metric.tools_used, ['controlLight']);
  });

  it('sends metric on error with status and zero cost', async () => {
    const err = Object.assign(new Error('rate limited'), { status: 429 });
    generateContentStub.rejects(err);

    await assert.rejects(
      () => client.models.generateContent({ model: 'gemini-2.5-flash', contents: 'Hi' }),
      { message: 'rate limited' }
    );
    await new Promise(r => setImmediate(r));

    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.strictEqual(metric.status_code, 429);
    assert.strictEqual(metric.cost_usd,    0);
  });

  it('forwards tags to metric payload', async () => {
    const taggedClient = new MonitoredGemini({
      apiKey: 'AIza-TESTKEY0000000000000000',
      observatoryUrl: 'http://obs:3001',
      tags: { env: 'staging', team: 'ml' },
    });
    sinon.stub(taggedClient.client.models, 'generateContent').resolves(makeResponse());

    await taggedClient.models.generateContent({ model: 'gemini-2.5-flash', contents: 'Hi' });
    await new Promise(r => setImmediate(r));
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.deepStrictEqual(metric.tags, { env: 'staging', team: 'ml' });
  });
});

// ── Streaming ─────────────────────────────────────────────────────────────────
describe('MonitoredGemini — streaming', () => {
  it('yields all chunks from the underlying stream', async () => {
    async function* fakeStream() {
      yield { text: 'Hello', usageMetadata: null, candidates: [] };
      yield { text: ' world', usageMetadata: null, candidates: [] };
    }
    const generateContentStreamStub = sinon.stub(client.client.models, 'generateContentStream').resolves(fakeStream());

    const stream = client.models.generateContentStream({ model: 'gemini-2.5-flash', contents: 'Hi' });
    const chunks = [];
    for await (const chunk of stream) { chunks.push(chunk); }
    assert.strictEqual(chunks.length, 2);
  });

  it('captures cumulative usage from the last chunk and sends metric after stream completes', async () => {
    async function* fakeStream() {
      yield { text: 'Hel', usageMetadata: null, candidates: [] };
      yield {
        text: 'lo',
        usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 60, cachedContentTokenCount: 0 },
        candidates: [{ finishReason: 'STOP' }],
      };
    }
    sinon.stub(client.client.models, 'generateContentStream').resolves(fakeStream());

    const stream = client.models.generateContentStream({ model: 'gemini-2.5-flash', contents: 'Hi' });
    for await (const _ of stream) { /* consume */ }
    await new Promise(r => setImmediate(r));

    assert.strictEqual(fetchStub.callCount, 1);
    const metric = JSON.parse(fetchStub.firstCall.args[1].body);
    assert.strictEqual(metric.input_tokens,  120);
    assert.strictEqual(metric.output_tokens, 60);
    assert.strictEqual(metric.provider,      'gemini');
    assert.strictEqual(metric.response_full, 'Hello');
  });

  it('sends metric even when stream is closed early', async () => {
    async function* fakeStream() {
      yield { text: 'a', usageMetadata: null, candidates: [] };
      yield { text: 'b', usageMetadata: null, candidates: [] };
    }
    sinon.stub(client.client.models, 'generateContentStream').resolves(fakeStream());

    const stream = client.models.generateContentStream({ model: 'gemini-2.5-flash', contents: 'Hi' });
    for await (const _ of stream) { break; }
    await new Promise(r => setImmediate(r));

    assert.strictEqual(fetchStub.callCount, 1);
  });
});
