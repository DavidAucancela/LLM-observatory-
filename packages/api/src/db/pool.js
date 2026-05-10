const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/llm_observatory',
  connectionTimeoutMillis: 5000,   // fail fast if pool can't acquire a connection
  idleTimeoutMillis: 30000,        // release idle connections (avoids stale sockets)
  query_timeout: 15000,            // cancel any query that takes > 15 s
  max: 10,
});

pool.on('error', (err) => {
  console.error('Unexpected DB error', err);
});

module.exports = pool;
