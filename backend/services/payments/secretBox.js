/**
 * Encryption for secrets kept in the database (payment keys). AES-256-GCM with a key derived from
 * SETTINGS_ENCRYPTION_KEY (or JWT_SECRET when it is not set). Stored as "v1.<iv>.<tag>.<data>" (base64 parts).
 * If the server secret changes, old values can no longer be read and are treated as missing: paste the keys again.
 */
const crypto = require('crypto');

function cipherKey() {
  const secret = process.env.SETTINGS_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) throw new Error('Set SETTINGS_ENCRYPTION_KEY (or JWT_SECRET) before saving payment keys');
  return crypto.createHash('sha256').update(`faysha-settings:${secret}`).digest();
}

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', cipherKey(), iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), data].map((p) => (typeof p === 'string' ? p : p.toString('base64'))).join('.');
}

/** The plain value, or null when it cannot be read (missing, damaged, or the server secret changed). */
function decrypt(stored) {
  if (!stored || typeof stored !== 'string') return null;
  const [version, iv, tag, data] = stored.split('.');
  if (version !== 'v1' || !iv || !tag || !data) return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', cipherKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** "…abcd" for long secrets, "saved" for short ones: enough to recognise a key without revealing it. */
const hint = (value) => (!value ? null : value.length >= 12 ? `…${value.slice(-4)}` : 'saved');

module.exports = { encrypt, decrypt, hint };
