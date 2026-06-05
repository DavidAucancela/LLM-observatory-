const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const pool   = require('../db/pool');

const JWT_SECRET = process.env.JWT_SECRET || '00'.repeat(64);

// Truncate all tenant tables between tests (call in beforeEach)
async function resetDb() {
  await pool.query(`
    TRUNCATE TABLE
      webhook_endpoints,
      observatory_tokens,
      alert_history, alert_rules,
      sync_logs,
      provider_credentials,
      provider_balances,
      budgets,
      api_calls,
      invitations,
      org_members,
      organizations,
      users
    RESTART IDENTITY CASCADE
  `);
}

// Creates a fully active org with one admin user and one observatory token.
// Returns { orgId, userId, email, password, jwt, obsToken }
async function createOrg(name = 'Test Org') {
  const slug      = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
  const email     = `admin-${Date.now()}@test.com`;
  const password  = 'password123';
  const hash      = await bcrypt.hash(password, 1); // fast rounds for tests

  const orgRes  = await pool.query(
    `INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id`,
    [name, slug]
  );
  const orgId = orgRes.rows[0].id;

  const userRes = await pool.query(
    `INSERT INTO users (email, password_hash, is_active) VALUES ($1, $2, true) RETURNING id`,
    [email, hash]
  );
  const userId = userRes.rows[0].id;

  await pool.query(
    `INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'admin')`,
    [orgId, userId]
  );

  const token = jwt.sign(
    { id: userId, email, orgId, role: 'admin' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Create an observatory token
  const raw    = 'obs_sk_test_' + crypto.randomBytes(16).toString('hex');
  const hash64 = crypto.createHash('sha256').update(raw).digest('hex');
  await pool.query(
    `INSERT INTO observatory_tokens (org_id, name, token_hash, token_prefix, created_by)
     VALUES ($1, $2, $3, $4, $5)`,
    [orgId, 'Test Token', hash64, raw.slice(0, 20), userId]
  );

  return { orgId, userId, email, password, jwt: token, obsToken: raw };
}

// Creates a member (non-admin) JWT for an existing org
async function createMember(orgId) {
  const email = `member-${Date.now()}@test.com`;
  const hash  = await bcrypt.hash('password123', 1);
  const userRes = await pool.query(
    `INSERT INTO users (email, password_hash, is_active) VALUES ($1, $2, true) RETURNING id`,
    [email, hash]
  );
  const userId = userRes.rows[0].id;
  await pool.query(
    `INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'member')`,
    [orgId, userId]
  );
  const token = jwt.sign({ id: userId, email, orgId, role: 'member' }, JWT_SECRET, { expiresIn: '1h' });
  return { userId, email, jwt: token };
}

module.exports = { resetDb, createOrg, createMember, pool };
