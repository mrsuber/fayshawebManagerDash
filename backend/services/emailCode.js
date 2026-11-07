const crypto = require('crypto');
const db = require('../config/database');

/**
 * Sign-up verification codes. A 6-digit code is emailed; only its hash is stored (users.email_verification_token,
 * prefixed "code:" so it never collides with link tokens). 15 minutes to use it, 5 wrong tries, one new code a minute.
 */
const TTL_MIN = 15;
const MAX_TRIES = 5;
const RESEND_SECONDS = 60;
const hash = (code) => `code:${crypto.createHash('sha256').update(String(code)).digest('hex')}`;

async function send(user, { force = false } = {}) {
  const row = (await db.query('SELECT email_code_sent_at FROM users WHERE id = $1', [user.id])).rows[0];
  const since = row?.email_code_sent_at ? (Date.now() - new Date(row.email_code_sent_at).getTime()) / 1000 : Infinity;
  if (!force && since < RESEND_SECONDS) return { sent: false, waitSeconds: Math.ceil(RESEND_SECONDS - since) };
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await db.query(
    `UPDATE users SET email_verification_token = $1, email_verification_expires = NOW() + INTERVAL '${TTL_MIN} minutes',
       email_code_attempts = 0, email_code_sent_at = NOW() WHERE id = $2`,
    [hash(code), user.id],
  );
  const name = String(user.full_name || 'there').replace(/[<>&]/g, '');
  require('./email.service')
    .sendEmail({
      to: user.email,
      subject: `${code} is your Faysha code`,
      text: `Hello ${name},\n\nYour Faysha verification code is ${code}. It works for ${TTL_MIN} minutes.\n\nIf you did not create a Faysha account, you can ignore this email.`,
      html: `<p>Hello ${name},</p><p>Your Faysha verification code is</p><p style="font-size:30px;letter-spacing:8px;font-weight:bold">${code}</p><p>It works for ${TTL_MIN} minutes. If you did not create a Faysha account, you can ignore this email.</p>`,
    })
    .catch((e) => console.error('Verification email failed:', e.message));
  if (process.env.NODE_ENV !== 'production') console.log(`[dev] verification code for ${user.email}: ${code}`);
  return { sent: true, waitSeconds: RESEND_SECONDS };
}

/** → 'ok' | 'wrong' | 'expired' | 'locked' */
async function check(userId, code) {
  const u = (await db.query('SELECT email_verification_token AS t, email_verification_expires AS exp, email_code_attempts AS n FROM users WHERE id = $1', [userId])).rows[0];
  if (!u?.t || !u.t.startsWith('code:')) return 'expired';
  if (u.n >= MAX_TRIES) return 'locked';
  if (new Date(u.exp) < new Date()) return 'expired';
  const a = Buffer.from(u.t);
  const b = Buffer.from(hash(String(code).replace(/\D/g, '')));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    await db.query('UPDATE users SET email_code_attempts = email_code_attempts + 1 WHERE id = $1', [userId]);
    return u.n + 1 >= MAX_TRIES ? 'locked' : 'wrong';
  }
  await db.query(
    `UPDATE users SET email_verified = true, status = 'active', email_verification_token = NULL, email_verification_expires = NULL, email_code_attempts = 0
     WHERE id = $1`,
    [userId],
  );
  return 'ok';
}

module.exports = { send, check, MAX_TRIES, RESEND_SECONDS };
