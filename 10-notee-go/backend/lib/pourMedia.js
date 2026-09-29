/**
 * Private square-crop backups for Pour / Meal history (not originals, not Feed).
 * Keys are deterministic: pour/{userId}/{sittingId}/{start|end}.jpg
 */

const { httpError } = require('./httpError');

const SLOTS = new Set(['start', 'end']);
const MAX_BYTES = 300 * 1024;
const SITTING_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const USER_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function assertSittingId(raw) {
  const id = String(raw || '');
  if (!SITTING_RE.test(id)) {
    throw httpError(400, '局 id 无效', 'POUR_CROP_BAD_ID');
  }
  return id;
}

function assertSlot(raw) {
  const slot = String(raw || '');
  if (!SLOTS.has(slot)) {
    throw httpError(400, '裁切槽位无效', 'POUR_CROP_BAD_SLOT');
  }
  return slot;
}

function assertUserId(raw) {
  const id = String(raw || '');
  if (!USER_RE.test(id)) {
    throw httpError(400, '用户无效', 'POUR_CROP_BAD_USER');
  }
  return id;
}

function assertJpeg(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 3) {
    throw httpError(400, '裁切须为 JPEG', 'POUR_CROP_BAD_TYPE');
  }
  if (buffer.length > MAX_BYTES) {
    throw httpError(413, '裁切过大', 'POUR_CROP_TOO_LARGE');
  }
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
    throw httpError(400, '裁切须为 JPEG', 'POUR_CROP_BAD_TYPE');
  }
  return buffer;
}

function historySittingIds(blob) {
  if (!blob) return [];
  try {
    const parsed = JSON.parse(blob);
    const records = parsed && parsed.records;
    if (!Array.isArray(records)) return [];
    const ids = [];
    const seen = new Set();
    for (const row of records) {
      if (!row || typeof row.id !== 'string') continue;
      if (!SITTING_RE.test(row.id) || seen.has(row.id)) continue;
      seen.add(row.id);
      ids.push(row.id);
    }
    return ids;
  } catch (_) {
    return [];
  }
}

module.exports = {
  SLOTS,
  MAX_BYTES,
  SITTING_RE,
  assertSittingId,
  assertSlot,
  assertUserId,
  assertJpeg,
  historySittingIds,
};
