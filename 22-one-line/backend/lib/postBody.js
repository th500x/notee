/**
 * Post body rules (server half of client+server dual gate).
 * One budget of 100: each Han (Chinese) code point costs 2; everything else costs 1.
 * Block links / phones / @ / spam.
 */

const { httpError } = require('./httpError');

const BUDGET = 100;
const HAN_COST = 2;
const HAN_RE = /\p{Script=Han}/u;

/** Loose TLD / host sniffs — not a full URL parser. */
const LINK_RE =
  /https?:\/\/|www\.|\b[a-z0-9][a-z0-9-]{0,61}[a-z0-9]\.(?:com|net|org|cn|vip|io|me|co|app|xyz|ly|link|click|cc|tv|info|biz)\b/i;

const AT_HANDLE_RE = /@[A-Za-z0-9_]{2,}/;
const LONG_DIGIT_RE = /\d{8,}/;
const PHONEISH_RE = /\d[\d\s\-()]{6,}\d/;

function weightedLength(body) {
  let n = 0;
  for (const ch of Array.from(body)) {
    n += HAN_RE.test(ch) ? HAN_COST : 1;
  }
  return n;
}

/**
 * Same spam / link / phone rules as a One Line body, with a caller-chosen budget.
 * @returns {string} NFC-trimmed text
 */
function assertWeightedText(raw, budget, { allowEmpty = false } = {}) {
  if (typeof raw !== 'string') {
    if (allowEmpty && (raw == null || raw === undefined)) return '';
    throw httpError(400, '正文无效', 'BAD_BODY');
  }
  const body = raw.normalize('NFC').trim();
  if (!body) {
    if (allowEmpty) return '';
    throw httpError(400, '正文不能为空', 'BAD_BODY');
  }

  if (weightedLength(body) > budget) {
    throw httpError(400, `正文最多 ${budget}（汉字算 ${HAN_COST}）`, 'BODY_TOO_LONG');
  }

  if (!/[\p{L}\p{N}]/u.test(body)) {
    throw httpError(400, '正文不能为纯空白或标点', 'BODY_SPAM');
  }

  if (LINK_RE.test(body)) {
    throw httpError(400, '正文不可含链接', 'BODY_LINK');
  }
  if (AT_HANDLE_RE.test(body)) {
    throw httpError(400, '正文不可含 @ 引流', 'BODY_AT');
  }

  const digitsOnly = body.replace(/[^\d]/g, '');
  if (LONG_DIGIT_RE.test(digitsOnly) || PHONEISH_RE.test(body)) {
    throw httpError(400, '正文不可含电话或长串数字', 'BODY_PHONE');
  }

  return body;
}

/**
 * @returns {string} NFC-trimmed body
 */
function assertPostBody(raw, opts = {}) {
  return assertWeightedText(raw, BUDGET, opts);
}

/**
 * Optional stamp id (client-declared ownership until inventory verify exists).
 * @returns {string|null}
 */
function assertStampId(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(raw)) {
    throw httpError(400, 'stampId 无效', 'BAD_STAMP');
  }
  return raw;
}

module.exports = {
  BUDGET,
  HAN_COST,
  weightedLength,
  assertWeightedText,
  assertPostBody,
  assertStampId,
};
