const request = require('supertest');
const { app }  = require('../index');
const { resetDb, createOrg, pool } = require('./helpers');

beforeEach(resetDb);

const VALID_METRIC = {
  provider:     'anthropic',
  model:        'claude-sonnet-4-6',
  input_tokens:  100,
  output_tokens: 50,
  total_tokens:  150,
  cost_usd:      0.00045,
  latency_ms:    320,
  status_code:   200,
};

describe('POST /api/metrics', () => {
  it('inserts metric and returns 201 with correct org_id', async () => {
    const { orgId, obsToken } = await createOrg('Metrics Org');
    const res = await request(app)
      .post('/api/metrics')
      .set('Authorization', `Bearer ${obsToken}`)
      .send(VALID_METRIC);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.org_id).toBe(orgId);
    expect(res.body.data.model).toBe('claude-sonnet-4-6');
  });

  it('returns 401 without any token', async () => {
    const res = await request(app).post('/api/metrics').send(VALID_METRIC);
    expect(res.status).toBe(401);
  });

  it('returns 401 for a revoked observatory token', async () => {
    const { obsToken } = await createOrg('Revoked Org');
    // Revoke the token
    await pool.query(`UPDATE observatory_tokens SET revoked_at = NOW()`);
    const res = await request(app)
      .post('/api/metrics')
      .set('Authorization', `Bearer ${obsToken}`)
      .send(VALID_METRIC);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid body (missing model)', async () => {
    const { obsToken } = await createOrg('Validation Org');
    const { model: _unused, ...noModel } = VALID_METRIC;
    const res = await request(app)
      .post('/api/metrics')
      .set('Authorization', `Bearer ${obsToken}`)
      .send(noModel);
    expect(res.status).toBe(400);
  });

  it('updates last_used_at on the observatory token', async () => {
    const { obsToken } = await createOrg('LastUsed Org');
    await request(app)
      .post('/api/metrics')
      .set('Authorization', `Bearer ${obsToken}`)
      .send(VALID_METRIC);

    // Give the async update a tick to run
    await new Promise(r => setTimeout(r, 50));
    const res = await pool.query(`SELECT last_used_at FROM observatory_tokens LIMIT 1`);
    expect(res.rows[0].last_used_at).not.toBeNull();
  });
});

describe('GET /api/metrics — org scoping', () => {
  it('org A cannot see metrics inserted by org B', async () => {
    const orgA = await createOrg('Org A');
    const orgB = await createOrg('Org B');

    // Org B inserts a metric
    await request(app)
      .post('/api/metrics')
      .set('Authorization', `Bearer ${orgB.obsToken}`)
      .send(VALID_METRIC);

    // Org A lists metrics — should see none
    const res = await request(app)
      .get('/api/metrics')
      .set('Authorization', `Bearer ${orgA.jwt}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('org can see its own metrics', async () => {
    const { obsToken, jwt: token } = await createOrg('Own Metrics Org');
    await request(app)
      .post('/api/metrics')
      .set('Authorization', `Bearer ${obsToken}`)
      .send(VALID_METRIC);

    const res = await request(app)
      .get('/api/metrics')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

describe('GET /api/metrics/summary — org scoping', () => {
  it('summary only aggregates data for the requesting org', async () => {
    const orgA = await createOrg('Summary A');
    const orgB = await createOrg('Summary B');

    // Org B inserts a metric with known cost
    await request(app)
      .post('/api/metrics')
      .set('Authorization', `Bearer ${orgB.obsToken}`)
      .send({ ...VALID_METRIC, cost_usd: 9.99 });

    // Org A summary should show zero cost
    const res = await request(app)
      .get('/api/metrics/summary')
      .set('Authorization', `Bearer ${orgA.jwt}`);
    expect(res.status).toBe(200);
    expect(parseFloat(res.body.summary.total_cost_usd)).toBe(0);
  });
});
