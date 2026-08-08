/**
 * Post body rules (server half of client+server dual gate).
 * ≤100 Unicode code points; block links / phones / @ handles / empty spam.
 */

const { httpError } = require('./httpError');

const MAX_CODE_POINTS = 100;

/** Loose TLD / host sniffs — not a full URL parser. */
const LINK_RE =
  /https?:\/\/|www\.|\b[a-z0-9][a-z0-9-]{0,61}[a-z0-9]\.(?:com|net|org|cn|vip|io|me|co|app|xyz|ly|link|click|cc|tv|info|biz)\b/i;

const AT_HANDLE_RE = /@[A-Za-z0-9_]{2,}/;
const LONG_DIGIT_RE = /\d{8,}/;
const PHONEISH_RE = /\d[\d\s\-()]{6,}\d/;

/**
 * @returns {string} NFC-trimmed body
 */
function assertPostBody(raw) {
  if (typeof raw !== 'string') {
    throw httpError(400, '正文无效', 'BAD_BODY');
  }
  const body = raw.normalize('NFC').trim();
  if (!body) {
    throw httpError(400, '正文不能为空', 'BAD_BODY');
  }

  const codePoints = Array.from(body);
  if (codePoints.length > MAX_CODE_POINTS) {
    throw httpError(400, `正文最多 ${MAX_CODE_POINTS} 字`, 'BODY_TOO_LONG');
  }

  // Must contain at least one letter or number (any script)
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
  MAX_CODE_POINTS,
  assertPostBody,
  assertStampId,
};
