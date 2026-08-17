/**
 * Pour Check structured payload (server half of client+server dual gate).
 * No photos, GPS, or extra keys. Mood lives on posts.body, not here.
 */

const { httpError } = require('./httpError');
const { assertWeightedText } = require('./postBody');

const KIND_IDS = new Set([
  'beer',
  'whisky',
  'soju',
  'baijiu',
  'wine',
  'sake',
  'cocktail',
  'soft',
  'other',
]);

const POUR_KEYS = new Set([
  'tableName',
  'people',
  'durationSec',
  'place',
  'bottleCount',
  'consumedMl',
  'kinds',
]);

const PLACE_BUDGET = 40;
const PEOPLE_MIN = 1;
const PEOPLE_MAX = 99;
const BOTTLE_MIN = 1;
const BOTTLE_MAX = 36;
const ML_MAX = 2000;
const DURATION_MIN_SEC = 2 * 60 * 60;
const DURATION_MAX_SEC = 6 * 60 * 60;
const CONSUMED_MAX = BOTTLE_MAX * ML_MAX;

const BANNED_KEY_RE = /image|photo|picture|gps|lat|lng|lon|exif|uri|url|file|path/i;

function rejectBannedKeys(value) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach(rejectBannedKeys);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (BANNED_KEY_RE.test(key)) {
      throw httpError(400, '不可提交图片或位置字段', 'POUR_NO_MEDIA');
    }
    rejectBannedKeys(child);
  }
}

function assertInt(raw, min, max, code, message) {
  if (typeof raw === 'boolean' || raw == null || raw === '') {
    throw httpError(400, message, code);
  }
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw httpError(400, message, code);
  }
  return n;
}

function assertTableName(raw) {
  if (typeof raw !== 'string' || !/^[A-Z]{1,10}$/.test(raw)) {
    throw httpError(400, '桌名无效', 'BAD_POUR');
  }
  return raw;
}

function assertKinds(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw httpError(400, '品类无效', 'BAD_POUR');
  }
  const kinds = [];
  const seen = new Set();
  for (const id of raw) {
    if (typeof id !== 'string' || !KIND_IDS.has(id)) {
      throw httpError(400, '品类无效', 'BAD_POUR');
    }
    if (seen.has(id)) continue;
    seen.add(id);
    kinds.push(id);
  }
  return kinds;
}

/**
 * @returns {{
 *   tableName: string,
 *   people: number,
 *   durationSec: number,
 *   place: string,
 *   bottleCount: number,
 *   consumedMl: number,
 *   kinds: string[]
 * }}
 */
function assertPourPayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw httpError(400, 'pour 无效', 'BAD_POUR');
  }
  rejectBannedKeys(raw);
  for (const key of Object.keys(raw)) {
    if (!POUR_KEYS.has(key)) {
      throw httpError(400, 'pour 含未知字段', 'BAD_POUR');
    }
  }

  const tableName = assertTableName(raw.tableName);
  const people = assertInt(raw.people, PEOPLE_MIN, PEOPLE_MAX, 'BAD_POUR', '人数无效');
  const durationSec = assertInt(
    raw.durationSec,
    DURATION_MIN_SEC,
    DURATION_MAX_SEC,
    'BAD_POUR',
    '时长须在 2–6 小时'
  );
  const place = assertWeightedText(raw.place, PLACE_BUDGET, { allowEmpty: false });
  const bottleCount = assertInt(
    raw.bottleCount,
    BOTTLE_MIN,
    BOTTLE_MAX,
    'BAD_POUR',
    '瓶数无效'
  );
  const consumedMl = assertInt(raw.consumedMl, 0, CONSUMED_MAX, 'BAD_POUR', '消耗 ml 无效');
  const kinds = assertKinds(raw.kinds);

  return {
    tableName,
    people,
    durationSec,
    place,
    bottleCount,
    consumedMl,
    kinds,
  };
}

module.exports = {
  KIND_IDS,
  PLACE_BUDGET,
  DURATION_MIN_SEC,
  DURATION_MAX_SEC,
  rejectBannedKeys,
  assertPourPayload,
};
