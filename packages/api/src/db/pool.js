const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/llm_observatory'
});

pool.on('error', (err) => {
  console.error('Unexpected DB error', err);
});

module.exports = pool;
