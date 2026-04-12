/**
 * One-time migration: reads AUTH_EMAIL + AUTH_PASSWORD_HASH from .env
 * and inserts the admin user into the `users` table.
 * Safe to run multiple times — skips if the user already exists.
 *
 * Usage: npm run migrate-admin
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });
const pool = require('./pool');

async function migrateAdmin() {
  const email = process.env.AUTH_EMAIL;
  const hash  = process.env.AUTH_PASSWORD_HASH;

  if (!email || !hash) {
    console.error('❌  AUTH_EMAIL y AUTH_PASSWORD_HASH deben estar definidos en .env');
    process.exit(1);
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      console.log(`✓  El usuario ${email} ya existe en la tabla users — nada que hacer`);
      process.exit(0);
    }

    await pool.query(
      `INSERT INTO users (email, password_hash, role, is_active)
       VALUES ($1, $2, 'admin', true)`,
      [email, hash]
    );
    console.log(`✅  Admin migrado correctamente: ${email}`);
  } catch (err) {
    console.error('❌  Error en migración:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateAdmin();
