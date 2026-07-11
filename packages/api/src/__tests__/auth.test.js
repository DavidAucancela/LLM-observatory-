const request = require('supertest');
const { app }  = require('../index');
const { resetDb, createOrg, pool } = require('./helpers');

// Prevent real emails during tests
jest.mock('../services/email', () => ({
  sendActivationEmail:    jest.fn().mockResolvedValue({}),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({}),
  sendInvitationEmail:    jest.fn().mockResolvedValue({}),
}));

beforeEach(resetDb);

const REGISTER_PAYLOAD = {
  email:    'test@example.com',
  password: 'password123',
  org_name: 'Acme Corp',
};

describe('POST /api/auth/register', () => {
  it('creates user + org + member and returns 201', async () => {
    const res = await request(app).post('/api/auth/register').send(REGISTER_PAYLOAD);
    expect(res.status).toBe(201);
    expect(res.body.message).toBeDefined();
  });

  it('returns 409 on duplicate email when user is already active', async () => {
    // createOrg creates an active user — registering with the same email should 409
    const { email } = await createOrg('Duplicate Test');
    const res = await request(app).post('/api/auth/register').send({ email, password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('returns 400 for invalid email', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'not-an-email', password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for short password', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'x@x.com', password: 'short' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('returns JWT with orgId and role on valid credentials', async () => {
    const { email, password } = await createOrg('Login Test');
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.orgId).toBeDefined();
    expect(res.body.role).toBe('admin');
  });

  it('returns 401 for wrong password', async () => {
    const { email } = await createOrg('Bad Pass Test');
    const res = await request(app).post('/api/auth/login').send({ email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('logs in immediately after registering (accounts auto-activate)', async () => {
    await request(app).post('/api/auth/register').send({ email: 'fresh@x.com', password: 'password123' });
    const res = await request(app).post('/api/auth/login').send({ email: 'fresh@x.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});

describe('GET /api/auth/me', () => {
  it('returns user data for valid JWT', async () => {
    const { jwt: token, email, orgId } = await createOrg('Me Test');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
    expect(res.body.orgId).toBe(orgId);
    expect(res.body.role).toBe('admin');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with an expired/invalid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('returns 200 and subsequent requests with the same token return 401', async () => {
    const { email, password } = await createOrg('Logout Test');
    // Login to get a fresh JWT with jti claim
    const loginRes = await request(app).post('/api/auth/login').send({ email, password });
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.token;

    // Token works before logout
    const before = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);

    // Logout — server adds jti to blacklist
    const logoutRes = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    // Same token is now rejected
    const after = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(401);
  });

  it('returns 401 when called without a token', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });
});
