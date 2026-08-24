/**
 * Login id format + candidate generation (no DB access — occupancy lives in userService).
 *
 * 4 chars, uppercase. The first char is the **prefix batch**, walked in order — not random:
 *   regular = A→Z (sign-up). A is exhausted before B is offered.
 *   honor   = 0→9 (paid rename). 0 is exhausted before 1 is offered.
 * Trailing 3 chars are random A–Z / 0–9 inside the current prefix.
 *
 * Auto-pick skips reservedLoginIds.js: blocked (brand/slurs) and lion (0000–9999 / AAAA–ZZZZ).
 * Design matches 05's original batch-id rule. Do not copy 05's later random first-char.
 * See notee-go/docs/00-1-Account.md.
 */

const crypto = require('crypto');
const { httpError } = require('./httpError');
const { isReservedLoginId, isLionLoginId, RESERVED_LOGIN_IDS } = require('./reservedLoginIds');

const LOGIN_ID_LENGTH = 4;
const REGULAR_FIRST_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const VIP_FIRST_CHARSET = '0123456789';
const TAIL_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const PREFIX_CAPACITY = TAIL_CHARSET.length ** 3; // 36³ = 46656

const REGULAR_PATTERN = /^[A-Z][A-Z0-9]{3}$/;

const FIRST_CHARSET_BY_POOL = {
  regular: REGULAR_FIRST_CHARSET,
  vip: VIP_FIRST_CHARSET,
  honor: VIP_FIRST_CHARSET,
};

const RESERVED_PER_PREFIX = (() => {
  const map = Object.create(null);
  for (const id of RESERVED_LOGIN_IDS) {
    const p = id[0];
    map[p] = (map[p] || 0) + 1;
  }
  return map;
})();

function charsetForPool(pool) {
  const charset = FIRST_CHARSET_BY_POOL[pool];
  if (!charset) throw httpError(500, '未知短号池', 'BAD_LOGIN_ID_POOL');
  return charset;
}

/** Trim + uppercase. Returns '' for anything that is not a string. */
function normalizeLoginId(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toUpperCase();
}

/**
 * Normalize + validate for sign-up. Digit-leading ids are rejected here so the honor pool
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

/**
 * Operator grant only. Lions are out of auto-pick / self-register.
 * @returns {string} normalized lion id
 */
function assertLionLoginId(raw) {
  const loginId = normalizeLoginId(raw);
  if (!isLionLoginId(loginId)) {
    throw httpError(400, '只能发放狮子号（0000–9999 / AAAA–ZZZZ）', 'NOT_LION_LOGIN_ID');
  }
  return loginId;
}

function capacityOfPrefix(prefix) {
  return PREFIX_CAPACITY - (RESERVED_PER_PREFIX[prefix] || 0);
}

/** Earliest prefix in `charset` that still has free ids. Null if the pool is exhausted. */
function currentPrefixFromOccupancy(charset, occupancy = {}) {
  for (const ch of charset) {
    if ((occupancy[ch] || 0) < capacityOfPrefix(ch)) return ch;
  }
  return null;
}

function randomLoginId(prefix) {
  let id = prefix;
  for (let i = 1; i < LOGIN_ID_LENGTH; i += 1) {
    id += TAIL_CHARSET[crypto.randomInt(TAIL_CHARSET.length)];
  }
  return id;
}

/**
 * Distinct, well-formed, non-reserved candidates **inside one prefix** to probe against the DB.
 * @param {{ size: number, prefix: string, skip?: Set<string> }} opts
 * @returns {string[]}
 */
function randomLoginIdBatch({ size, prefix, skip = new Set() }) {
  if (typeof prefix !== 'string' || prefix.length !== 1) {
    throw httpError(500, '短号首位批次无效', 'BAD_LOGIN_ID_POOL');
  }

  const batch = [];
  const maxAttempts = size * 20;
  for (let attempt = 0; attempt < maxAttempts && batch.length < size; attempt += 1) {
    const id = randomLoginId(prefix);
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
  PREFIX_CAPACITY,
  FIRST_CHARSET_BY_POOL,
  charsetForPool,
  normalizeLoginId,
  assertRegularLoginId,
  assertLionLoginId,
  capacityOfPrefix,
  currentPrefixFromOccupancy,
  randomLoginIdBatch,
};
