/**
 * Login id format + candidate generation (no DB access — see userService for the pool query).
 *
 * 4 chars, uppercase. The first char decides the pool:
 *   regular = A–Z (everything sign-up hands out)
 *   vip     = 0–9 (reserved for the paid one-time rename; never offered on sign-up)
 * Trailing 3 chars are A–Z / 0–9 in both pools.
 */

const crypto = require('crypto');
const { httpError } = require('./httpError');
const { isReservedLoginId } = require('./reservedLoginIds');

const LOGIN_ID_LENGTH = 4;
const REGULAR_FIRST_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const VIP_FIRST_CHARSET = '0123456789';
const TAIL_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const REGULAR_PATTERN = /^[A-Z][A-Z0-9]{3}$/;

/** Only the first char differs; the VIP entry is what §5 of 00-2-Account.md will draw from. */
const FIRST_CHARSET_BY_POOL = {
  regular: REGULAR_FIRST_CHARSET,
  vip: VIP_FIRST_CHARSET,
};

/** Trim + uppercase. Returns '' for anything that is not a string. */
function normalizeLoginId(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toUpperCase();
}

/**
 * Normalize + validate for sign-up. Digit-leading ids are rejected here so the VIP pool
 * cannot be claimed through the regular flow.
 * @returns {string} normalized login id
 */
function assertRegularLoginId(raw) {
  const loginId = normalizeLoginId(raw);
  if (!REGULAR_PATTERN.test(loginId)) {
    throw httpError(400, '短号须为 4 位：首位字母，其余字母或数字', 'BAD_LOGIN_ID');
  }
  if (isReservedLoginId(loginId)) {
    throw httpError(400, '该短号不可注册，请另选一个', 'RESERVED_LOGIN_ID');
  }
  return loginId;
}

function randomLoginId(firstCharset) {
  let id = firstCharset[crypto.randomInt(firstCharset.length)];
  for (let i = 1; i < LOGIN_ID_LENGTH; i += 1) {
    id += TAIL_CHARSET[crypto.randomInt(TAIL_CHARSET.length)];
  }
  return id;
}

/**
 * One batch of distinct, well-formed, non-reserved candidates to probe against the DB.
 * @param {{ size: number, pool?: string, skip?: Set<string> }} opts
 * @returns {string[]}
 */
function randomLoginIdBatch({ size, pool = 'regular', skip = new Set() }) {
  const firstCharset = FIRST_CHARSET_BY_POOL[pool];
  if (!firstCharset) throw httpError(500, '未知短号池', 'BAD_LOGIN_ID_POOL');

  const batch = [];
  const maxAttempts = size * 20;
  for (let attempt = 0; attempt < maxAttempts && batch.length < size; attempt += 1) {
    const id = randomLoginId(firstCharset);
    if (skip.has(id) || isReservedLoginId(id)) continue;
    skip.add(id);
    batch.push(id);
  }
  return batch;
}

module.exports = {
  LOGIN_ID_LENGTH,
  REGULAR_FIRST_CHARSET,
  VIP_FIRST_CHARSET,
  TAIL_CHARSET,
  normalizeLoginId,
  assertRegularLoginId,
  randomLoginIdBatch,
};
