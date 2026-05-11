const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';

if (!process.env.ENCRYPTION_KEY) {
  console.error('❌ ENCRYPTION_KEY environment variable is required (32-byte hex string)');
  process.exit(1);
}
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(encoded) {
  const [ivHex, encHex] = encoded.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

function maskKey(key) {
  if (!key || key.length < 12) return '****';
  return key.slice(0, 10) + '...' + key.slice(-4);
}

module.exports = { encrypt, decrypt, maskKey };
