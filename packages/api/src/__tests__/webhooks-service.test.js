// Unit tests for deliverWebhooks — uses a real DB but stubs global fetch.
const crypto = require('crypto');
const { deliverWebhooks } = require('../services/webhooks');
const { resetDb, createOrg, pool } = require('./helpers');

// Stub fetch globally — we never want real HTTP in these tests
let fetchMock;

beforeEach(async () => {
  await resetDb();
  fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200 });
});

afterEach(() => jest.restoreAllMocks());

async function createWebhook(orgId, { url = 'https://example.com/hook', events = ['metric.created'], active = true } = {}) {
  const secret = crypto.randomBytes(32).toString('hex');
  const res = await pool.query(
    `INSERT INTO webhook_endpoints (org_id, name, url, secret, events, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [orgId, 'Test Webhook', url, secret, events, active]
  );
  return { ...res.rows[0], secret };
}

describe('deliverWebhooks()', () => {
  it('generates correct HMAC — receiver can verify X-Observatory-Signature', async () => {
    const { orgId } = await createOrg('HMAC Org');
    const wh = await createWebhook(orgId);

    const data = { id: 1, model: 'claude-sonnet-4-6' };
    await deliverWebhooks(orgId, 'metric.created', data);
    await new Promise(r => setTimeout(r, 10));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, opts] = fetchMock.mock.calls[0];
    const body = opts.body;
    const sigHeader = opts.headers['X-Observatory-Signature'];

    const expected = 'sha256=' + crypto.createHmac('sha256', wh.secret).update(body).digest('hex');
    expect(sigHeader).toBe(expected);
  });

  it('includes X-Observatory-Event header with the event name', async () => {
    const { orgId } = await createOrg('Event Header Org');
    await createWebhook(orgId);

    await deliverWebhooks(orgId, 'metric.created', {});
    await new Promise(r => setTimeout(r, 10));

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers['X-Observatory-Event']).toBe('metric.created');
  });

  it('does not deliver to inactive webhooks', async () => {
    const { orgId } = await createOrg('Inactive Org');
    await createWebhook(orgId, { active: false });

    await deliverWebhooks(orgId, 'metric.created', {});
    await new Promise(r => setTimeout(r, 10));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not deliver when event is not in webhook.events array (bug fix)', async () => {
    const { orgId } = await createOrg('Event Filter Org');
    await createWebhook(orgId, { events: ['alert.triggered'] });

    await deliverWebhooks(orgId, 'metric.created', {});
    await new Promise(r => setTimeout(r, 10));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('delivers when event matches webhook.events', async () => {
    const { orgId } = await createOrg('Event Match Org');
    await createWebhook(orgId, { events: ['metric.created'] });

    await deliverWebhooks(orgId, 'metric.created', {});
    await new Promise(r => setTimeout(r, 10));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries once after first fetch failure', async () => {
    const { orgId } = await createOrg('Retry Org');
    await createWebhook(orgId);

    fetchMock
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue({ ok: true, status: 200 });

    await deliverWebhooks(orgId, 'metric.created', {});
    // Wait for retry (1s delay + processing)
    await new Promise(r => setTimeout(r, 1200));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 3000);

  it('does not throw to caller even when both delivery attempts fail', async () => {
    const { orgId } = await createOrg('Silent Fail Org');
    await createWebhook(orgId);

    fetchMock.mockRejectedValue(new Error('server down'));

    await expect(deliverWebhooks(orgId, 'metric.created', {})).resolves.not.toThrow();
    await new Promise(r => setTimeout(r, 1200));
  }, 3000);
});
