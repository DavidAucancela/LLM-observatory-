const crypto = require('crypto');

const ALGORITHM_GCM = 'aes-256-gcm';
const ALGORITHM_CBC = 'aes-256-cbc'; // retained for decrypting legacy-stored values

if (!process.env.ENCRYPTION_KEY) {
  console.error('❌ ENCRYPTION_KEY environment variable is required (32-byte hex string)');
  process.exit(1);
}
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

// New format (v2): "v2:<12-byte iv hex>:<ciphertext hex>:<16-byte auth tag hex>"
// Legacy format:   "<16-byte iv hex>:<ciphertext hex>"  (AES-256-CBC, no auth tag)
function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM_GCM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v2:${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

function decrypt(encoded) {
  if (encoded.startsWith('v2:')) {
    // AES-256-GCM — authenticated decryption
    const parts = encoded.split(':');
    const iv  = Buffer.from(parts[1], 'hex');
    const data = Buffer.from(parts[2], 'hex');
    const tag  = Buffer.from(parts[3], 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM_GCM, KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
  // Legacy AES-256-CBC path — for credentials encrypted before the GCM migration
  const [ivHex, encHex] = encoded.split(':');
  const iv  = Buffer.from(ivHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM_CBC, KEY, iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

function maskKey(key) {
  if (!key || key.length < 12) return '****';
  return key.slice(0, 10) + '...' + key.slice(-4);
}

module.exports = { encrypt, decrypt, maskKey };
