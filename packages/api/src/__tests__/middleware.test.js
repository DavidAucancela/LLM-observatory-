const request = require('supertest');
const jwt     = require('jsonwebtoken');
const { app } = require('../index');
const { resetDb, createOrg, createMember, pool } = require('./helpers');

beforeEach(resetDb);

describe('Auth middleware', () => {
  it('allows public route GET /health without any token', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('sets req.user.orgId correctly from a valid observatory token', async () => {
    // Validate via a protected route that echoes orgId (POST /api/metrics)
    const { orgId, obsToken } = await createOrg('OrgId Test');
    const res = await request(app)
      .post('/api/metrics')
      .set('Authorization', `Bearer ${obsToken}`)
      .send({
        provider: 'anthropic', model: 'claude-sonnet-4-6',
        input_tokens: 1, output_tokens: 1, total_tokens: 2,
        cost_usd: 0, latency_ms: 10, status_code: 200,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.org_id).toBe(orgId);
  });

  it('sets isObservatoryToken=true — observatory tokens cannot use admin routes', async () => {
    const { obsToken } = await createOrg('OBS Admin Test');
    // Observatory tokens must fail requireAdmin (e.g. DELETE /api/team/members/:id)
    const res = await request(app)
      .post('/api/tokens')  // requireAdmin route
      .set('Authorization', `Bearer ${obsToken}`)
      .send({ name: 'New Token' });
    expect(res.status).toBe(403);
  });

  it('returns 401 for a revoked observatory token', async () => {
    const { obsToken } = await createOrg('Revoke Test');
    await pool.query(`UPDATE observatory_tokens SET revoked_at = NOW()`);
    const res = await request(app)
      .post('/api/metrics')
      .set('Authorization', `Bearer ${obsToken}`)
      .send({ provider: 'anthropic', model: 'test', input_tokens: 0, output_tokens: 0, total_tokens: 0, cost_usd: 0, latency_ms: 0, status_code: 200 });
    expect(res.status).toBe(401);
  });

  it('resolves JWT and sets req.user.role + orgId correctly', async () => {
    const { jwt: token, orgId, email } = await createOrg('JWT Test');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.orgId).toBe(orgId);
    expect(res.body.role).toBe('admin');
  });

  it('returns 401 for an expired JWT', async () => {
    const { orgId } = await createOrg('Expired JWT');
    const expired = jwt.sign(
      { id: 999, email: 'x@x.com', orgId, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }
    );
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 with no token at all on protected route', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('requireAdmin middleware', () => {
  it('blocks member role from admin-only routes', async () => {
    const { orgId } = await createOrg('Admin Guard Org');
    const { jwt: memberToken } = await createMember(orgId);

    const res = await request(app)
      .post('/api/tokens')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'My Token' });
    expect(res.status).toBe(403);
  });

  it('allows admin role on admin-only routes', async () => {
    const { jwt: adminToken } = await createOrg('Admin Allow Org');
    const res = await request(app)
      .post('/api/tokens')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'My Token' });
    // 201 = created, not 403
    expect(res.status).not.toBe(403);
  });
});
