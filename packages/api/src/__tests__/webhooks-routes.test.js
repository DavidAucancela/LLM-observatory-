const request = require('supertest');
const { app }  = require('../index');
const { resetDb, createOrg } = require('./helpers');

beforeEach(resetDb);
// Prevent real webhook delivery in route tests
beforeEach(() => jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200 }));
afterEach(() => jest.restoreAllMocks());

const WEBHOOK_PAYLOAD = { name: 'My Hook', url: 'https://example.com/hook' };

describe('POST /api/webhooks', () => {
  it('creates webhook and returns secret once in full', async () => {
    const { jwt } = await createOrg('Webhook Create Org');
    const res = await request(app)
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${jwt}`)
      .send(WEBHOOK_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body.secret).toBeDefined();
    expect(res.body.secret.length).toBeGreaterThan(10);
    expect(res.body.name).toBe('My Hook');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/webhooks').send(WEBHOOK_PAYLOAD);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/webhooks', () => {
  it('returns webhook list with secret as hint (not in full)', async () => {
    const { jwt } = await createOrg('Webhook List Org');
    await request(app).post('/api/webhooks').set('Authorization', `Bearer ${jwt}`).send(WEBHOOK_PAYLOAD);

    const res = await request(app).get('/api/webhooks').set('Authorization', `Bearer ${jwt}`);
    expect(res.status).toBe(200);
    expect(res.body.webhooks).toHaveLength(1);
    // Secret should be shown as hint (e.g. "…xxxx"), never full 64-char hex
    const hint = res.body.webhooks[0].secret_hint;
    expect(hint).toMatch(/^…/);
  });
});

describe('DELETE /api/webhooks/:id', () => {
  it('deletes webhook scoped to org', async () => {
    const { jwt } = await createOrg('Webhook Delete Org');
    const created = await request(app)
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${jwt}`)
      .send(WEBHOOK_PAYLOAD);

    const del = await request(app)
      .delete(`/api/webhooks/${created.body.id}`)
      .set('Authorization', `Bearer ${jwt}`);
    expect(del.status).toBe(200);

    const list = await request(app).get('/api/webhooks').set('Authorization', `Bearer ${jwt}`);
    expect(list.body.webhooks).toHaveLength(0);
  });

  it('org A cannot delete webhook belonging to org B', async () => {
    const orgA = await createOrg('Org A Webhooks');
    const orgB = await createOrg('Org B Webhooks');

    const created = await request(app)
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${orgB.jwt}`)
      .send(WEBHOOK_PAYLOAD);

    const del = await request(app)
      .delete(`/api/webhooks/${created.body.id}`)
      .set('Authorization', `Bearer ${orgA.jwt}`);
    expect(del.status).toBe(404);
  });
});

describe('POST /api/webhooks/:id/test', () => {
  it('sends test payload and returns success status', async () => {
    const { jwt } = await createOrg('Webhook Test Org');
    const created = await request(app)
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${jwt}`)
      .send(WEBHOOK_PAYLOAD);

    const res = await request(app)
      .post(`/api/webhooks/${created.body.id}/test`)
      .set('Authorization', `Bearer ${jwt}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBeDefined();
  });
});
