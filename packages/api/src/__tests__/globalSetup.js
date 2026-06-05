// Runs once before all test suites. Creates the test database and applies schema.
const { Client } = require('pg');
const fs   = require('fs');
const path = require('path');

module.exports = async function globalSetup() {
  const dbUrl   = process.env.DATABASE_URL || 'postgresql://postgres:changeme@localhost:5432/llm_observatory_test';
  const url     = new URL(dbUrl);
  const dbName  = url.pathname.slice(1);

  // Connect to the default 'postgres' database to create the test DB if needed
  const adminClient = new Client({
    host:     url.hostname,
    port:     parseInt(url.port || '5432'),
    user:     url.username,
    password: url.password,
    database: 'postgres',
  });

  await adminClient.connect();
  const exists = await adminClient.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
  if (!exists.rows.length) {
    await adminClient.query(`CREATE DATABASE "${dbName}"`);
  }
  await adminClient.end();

  // Apply schema to the test database
  const testClient = new Client({
    host:     url.hostname,
    port:     parseInt(url.port || '5432'),
    user:     url.username,
    password: url.password,
    database: dbName,
  });

  await testClient.connect();
  const schema = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
  await testClient.query(schema);
  await testClient.end();
};
