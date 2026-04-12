#!/usr/bin/env node
// Genera un hash bcrypt para usar como AUTH_PASSWORD_HASH en el .env
//
// Uso:
//   node scripts/generate-password-hash.js tupassword
//
// Output:
//   Pega esto en tu .env:
//   AUTH_PASSWORD_HASH=$2b$10$...

const bcrypt = require('bcrypt');

const password = process.argv[2];

if (!password) {
  console.error('Error: debes proporcionar un password como argumento.');
  console.error('Uso: node scripts/generate-password-hash.js <password>');
  process.exit(1);
}

bcrypt.hash(password, 10).then(hash => {
  console.log('\nPega esto en tu .env:\n');
  console.log(`AUTH_PASSWORD_HASH=${hash}\n`);
});
