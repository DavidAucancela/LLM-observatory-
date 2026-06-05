const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const sinon  = require('sinon');

const { maskKey, MonitoredAnthropic } = require('../index.js');

// ── maskKey ───────────────────────────────────────────────────────────────────
describe('maskKey()', () => {
  it('masks a standard Anthropic key', () => {
    assert.strictEqual(maskKey('sk-ant-api03-ABCDEF1234'), 'sk-ant-a…1234');
  });

  it('returns null for keys shorter than 12 chars', () => {
    assert.strictEqual(maskKey('short'), null);
    assert.strictEqual(maskKey('11chars-ok!'), null);
    assert.strictEqual(maskKey(''), null);
    assert.strictEqual(maskKey(null), null);
  });

  it('masks exactly at the 12-char boundary', () => {
    const result = maskKey('abcdefghijkl'); // exactly 12
    assert.strictEqual(result, 'abcdefgh…ijkl');
  });
});

// ── _postMetric — tested via MonitoredAnthropic._sendMetric ───────────────────
describe('_postMetric()', () => {
  let client;
  let fetchStub;

  beforeEach(() => {
    fetchStub = sinon.stub(globalThis, 'fetch').resolves({ ok: true, status: 200 });
    client = new MonitoredAnthropic({
      apiKey: 'sk-ant-api03-TESTKEY00000',
      observatoryUrl: 'http://obs:3001',
      observatoryToken: 'obs_sk_test123',
    });
    sinon.stub(client.client.messages, 'create').resolves({
      usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    });
  });

  afterEach(() => sinon.restore());

  it('sends metric with Authorization Bearer header when token provided', async () => {
    await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    });
    await new Promise(r => setImmediate(r));

    assert.strictEqual(fetchStub.callCount, 1);
    const [url, opts] = fetchStub.firstCall.args;
    assert.ok(url.includes('/api/metrics'));
    assert.strictEqual(opts.headers['Authorization'], 'Bearer obs_sk_test123');
  });

  it('sends metric without Authorization header when no token', async () => {
    sinon.restore();
    fetchStub = sinon.stub(globalThis, 'fetch').resolves({ ok: true, status: 200 });

    const noTokenClient = new MonitoredAnthropic({
      apiKey: 'sk-ant-api03-TESTKEY00000',
      observatoryUrl: 'http://obs:3001',
    });
    sinon.stub(noTokenClient.client.messages, 'create').resolves({
      usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    });

    await noTokenClient.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    });
    await new Promise(r => setImmediate(r));

    const [, opts] = fetchStub.firstCall.args;
    assert.strictEqual(opts.headers['Authorization'], undefined);
  });

  it('retries once after failure and still delivers metric', async () => {
    sinon.restore();
    // First call fails, second succeeds
    fetchStub = sinon.stub(globalThis, 'fetch');
    fetchStub.onFirstCall().rejects(new Error('network error'));
    fetchStub.onSecondCall().resolves({ ok: true, status: 200 });

    const retryClient = new MonitoredAnthropic({
      apiKey: 'sk-ant-api03-TESTKEY00000',
      observatoryUrl: 'http://obs:3001',
    });
    sinon.stub(retryClient.client.messages, 'create').resolves({
      usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    });

    // Use fake timers to skip the 1-second retry delay
    const clock = sinon.useFakeTimers({ toFake: ['setTimeout'] });
    await retryClient.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    });

    // Advance past the 1s retry delay and flush microtasks
    await clock.tickAsync(1100);
    clock.restore();

    assert.strictEqual(fetchStub.callCount, 2, 'should have retried once');
  });

  it('does not throw to caller even when both metric delivery attempts fail', async () => {
    sinon.restore();
    fetchStub = sinon.stub(globalThis, 'fetch').rejects(new Error('server down'));

    const failClient = new MonitoredAnthropic({
      apiKey: 'sk-ant-api03-TESTKEY00000',
      observatoryUrl: 'http://obs:3001',
    });
    sinon.stub(failClient.client.messages, 'create').resolves({
      usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    });

    const clock = sinon.useFakeTimers({ toFake: ['setTimeout'] });
    // Should not throw even though metric delivery fails
    const result = await failClient.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    });
    assert.ok(result, 'response returned despite metric failure');
    await clock.tickAsync(1100);
    clock.restore();
  });
});
