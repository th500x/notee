/**
 * Password rules + hashing. Plaintext never leaves this module.
 * There is no email recovery (see notee-go/docs/00-1-Account.md) — the login id plus this
 * password is the only way back in, so keep the rules predictable rather than strict.
 */

const bcrypt = require('bcryptjs');
const { httpError } = require('./httpError');

const PASSWORD_MIN = 6;
/** bcrypt silently ignores bytes past 72; reject instead of hashing a truncated secret. */
const PASSWORD_MAX_BYTES = 72;
const BCRYPT_ROUNDS = 10;

function assertPassword(raw) {
  if (typeof raw !== 'string' || raw.length < PASSWORD_MIN) {
    throw httpError(400, `密码至少 ${PASSWORD_MIN} 位`, 'BAD_PASSWORD');
  }
  if (Buffer.byteLength(raw, 'utf8') > PASSWORD_MAX_BYTES) {
    throw httpError(400, '密码过长', 'BAD_PASSWORD');
  }
  return raw;
}

function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

function verifyPassword(password, hash) {
  if (typeof password !== 'string' || typeof hash !== 'string' || !hash) {
    return Promise.resolve(false);
  }
  return bcrypt.compare(password, hash);
}

module.exports = {
  PASSWORD_MIN,
  PASSWORD_MAX_BYTES,
  BCRYPT_ROUNDS,
  assertPassword,
  hashPassword,
  verifyPassword,
};
