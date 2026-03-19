const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('✅ Migration complete');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

migrate();
