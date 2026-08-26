/**
 * Pour Check cloud bag (ledger + last 30 photo-less history records).
 * Product: sibling notee-go docs/03 §3.7. Originals never appear in these blobs.
 */

const { httpError } = require('./httpError');
const { rejectBannedKeys } = require('./pourPayload');
const { assertWeightedText } = require('./postBody');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STAMP_ID_RE = /^[a-z]{2}_[a-z0-9_]{1,48}$/;
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TABLE_RE = /^[A-Z]{1,10}$/;
const NAME_RE = /^[A-Z0-9]{1,10}$/;

const KIND_IDS = new Set([
  'beer',
  'whisky',
  'brandy',
  'soju',
  'baijiu',
  'wine',
  'cocktail',
  'soft',
  'other',
]);
const OUTCOMES = new Set(['Publishable', 'EarlyEnd', 'Expired']);

const LEDGER_BLOB_MAX = 65536;
const HISTORY_BLOB_MAX = 200000;
const HISTORY_MAX = 30;
const CREDITED_MAX = 20000;
const CELLS_MAX = 8000;
const HALVES_MAX = 99999;
const PEOPLE_MIN = 1;
const PEOPLE_MAX = 12;
const BOTTLE_MIN = 1;
const BOTTLE_MAX = 36;
const ML_MIN = 50;
const ML_MAX = 2000;
const PLACE_BUDGET = 40;
const MOOD_BUDGET = 100;
const KINDS_MAX = 9;

const LEDGER_KEYS = new Set(['credited', 'cells']);
const CELL_KEYS = new Set(['y', 'm', 'k', 'h']);
const HISTORY_ROOT_KEYS = new Set(['v', 'records']);
const RECORD_KEYS = new Set([
  'id',
  'outcome',
  'startedTapMs',
  'startTakenMs',
  'endTakenMs',
  'endedTapMs',
  'tableName',
  'people',
  'names',
  'place',
  'mood',
  'stampId',
  'syncedDayKey',
  'syncedPostId',
  'kinds',
  'bottles',
  'qaStatsEdited',
  'qaBottleCount',
  'qaConsumedMl',
  'qaStampEdited',
]);
const BOTTLE_KEYS = new Set(['startMl', 'remainMl', 'kindId']);

function asString(raw, max, code) {
  if (raw == null) return null;
  const text = String(raw);
  if (text.length > max) {
    throw httpError(400, '袋字段过长', code);
  }
  return text;
}

function assertKnownKeys(obj, allowed, code) {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      throw httpError(400, '袋含未知字段', code);
    }
  }
}

function assertMs(raw, code) {
  if (typeof raw === 'boolean' || raw == null || raw === '') {
    throw httpError(400, '时间无效', code);
  }
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 4_000_000_000_000) {
    throw httpError(400, '时间无效', code);
  }
  return n;
}

function assertOptMs(raw, code) {
  if (raw == null) return null;
  return assertMs(raw, code);
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

function assertOptInt(raw, min, max, code, message) {
  if (raw == null) return null;
  return assertInt(raw, min, max, code, message);
}

function assertUuid(raw, code) {
  if (typeof raw !== 'string' || !UUID_RE.test(raw)) {
    throw httpError(400, 'id 无效', code);
  }
  return raw;
}

function assertKindId(id, code) {
  if (typeof id !== 'string' || !KIND_IDS.has(id)) {
    throw httpError(400, '品类无效', code);
  }
  return id;
}

function assertLedgerBlob(raw) {
  if (raw == null || raw === '') return '';
  const blob = asString(raw, LEDGER_BLOB_MAX, 'POUR_BAG_BAD_BLOB');
  let parsed;
  try {
    parsed = JSON.parse(blob);
  } catch (_) {
    throw httpError(400, '开瓶账无效', 'POUR_BAG_BAD_BLOB');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw httpError(400, '开瓶账无效', 'POUR_BAG_BAD_BLOB');
  }
  rejectBannedKeys(parsed);
  assertKnownKeys(parsed, LEDGER_KEYS, 'POUR_BAG_BAD_BLOB');

  const creditedRaw = parsed.credited == null ? [] : parsed.credited;
  if (!Array.isArray(creditedRaw) || creditedRaw.length > CREDITED_MAX) {
    throw httpError(400, '开瓶账无效', 'POUR_BAG_BAD_BLOB');
  }
  const credited = [];
  const seen = new Set();
  for (const id of creditedRaw) {
    if (typeof id !== 'string' || !id) {
      throw httpError(400, '开瓶账无效', 'POUR_BAG_BAD_BLOB');
    }
    if (seen.has(id)) continue;
    seen.add(id);
    credited.push(id);
  }

  const cellsRaw = parsed.cells == null ? [] : parsed.cells;
  if (!Array.isArray(cellsRaw) || cellsRaw.length > CELLS_MAX) {
    throw httpError(400, '开瓶账无效', 'POUR_BAG_BAD_BLOB');
  }
  for (const cell of cellsRaw) {
    if (!cell || typeof cell !== 'object' || Array.isArray(cell)) {
      throw httpError(400, '开瓶账无效', 'POUR_BAG_BAD_BLOB');
    }
    assertKnownKeys(cell, CELL_KEYS, 'POUR_BAG_BAD_BLOB');
    assertInt(cell.y, 2000, 2100, 'POUR_BAG_BAD_BLOB', '开瓶账无效');
    assertInt(cell.m, 1, 12, 'POUR_BAG_BAD_BLOB', '开瓶账无效');
    assertKindId(cell.k, 'POUR_BAG_BAD_BLOB');
    assertInt(cell.h, 1, HALVES_MAX, 'POUR_BAG_BAD_BLOB', '开瓶账无效');
  }
  return blob;
}

function assertBottle(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw httpError(400, '酒瓶无效', 'POUR_BAG_BAD_BLOB');
  }
  assertKnownKeys(raw, BOTTLE_KEYS, 'POUR_BAG_BAD_BLOB');
  const startMl = assertInt(raw.startMl, ML_MIN, ML_MAX, 'POUR_BAG_BAD_BLOB', '酒瓶无效');
  const remainMl = assertOptInt(raw.remainMl, 0, startMl, 'POUR_BAG_BAD_BLOB', '酒瓶无效');
  let kindId = null;
  if (raw.kindId != null && raw.kindId !== '') {
    kindId = assertKindId(raw.kindId, 'POUR_BAG_BAD_BLOB');
  }
  return { startMl, remainMl, kindId };
}

function assertRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw httpError(400, '历史条目无效', 'POUR_BAG_BAD_BLOB');
  }
  rejectBannedKeys(raw);
  assertKnownKeys(raw, RECORD_KEYS, 'POUR_BAG_BAD_BLOB');
  assertUuid(raw.id, 'POUR_BAG_BAD_BLOB');
  if (typeof raw.outcome !== 'string' || !OUTCOMES.has(raw.outcome)) {
    throw httpError(400, '历史条目无效', 'POUR_BAG_BAD_BLOB');
  }
  assertMs(raw.startedTapMs, 'POUR_BAG_BAD_BLOB');
  assertMs(raw.startTakenMs, 'POUR_BAG_BAD_BLOB');
  assertOptMs(raw.endTakenMs, 'POUR_BAG_BAD_BLOB');
  assertMs(raw.endedTapMs, 'POUR_BAG_BAD_BLOB');
  if (typeof raw.tableName !== 'string' || !TABLE_RE.test(raw.tableName)) {
    throw httpError(400, '桌名无效', 'POUR_BAG_BAD_BLOB');
  }
  const people = assertInt(raw.people, PEOPLE_MIN, PEOPLE_MAX, 'POUR_BAG_BAD_BLOB', '人数无效');
  if (!Array.isArray(raw.names) || raw.names.length !== people) {
    throw httpError(400, '同行昵称无效', 'POUR_BAG_BAD_BLOB');
  }
  raw.names.forEach((n, i) => {
    if (typeof n !== 'string' || !NAME_RE.test(n)) {
      throw httpError(400, '同行昵称无效', 'POUR_BAG_BAD_BLOB');
    }
    if (i > 0 && n === 'SOLO') {
      throw httpError(400, '同行昵称无效', 'POUR_BAG_BAD_BLOB');
    }
  });
  assertWeightedText(raw.place == null ? '' : raw.place, PLACE_BUDGET, { allowEmpty: false });
  assertWeightedText(raw.mood == null ? '' : raw.mood, MOOD_BUDGET, { allowEmpty: true });
  if (raw.stampId != null && raw.stampId !== '') {
    if (typeof raw.stampId !== 'string' || !STAMP_ID_RE.test(raw.stampId)) {
      throw httpError(400, '邮票 id 无效', 'POUR_BAG_BAD_BLOB');
    }
  }
  if (raw.syncedDayKey != null && raw.syncedDayKey !== '') {
    if (typeof raw.syncedDayKey !== 'string' || !DAY_KEY_RE.test(raw.syncedDayKey)) {
      throw httpError(400, '同步日无效', 'POUR_BAG_BAD_BLOB');
    }
  }
  if (raw.syncedPostId != null && raw.syncedPostId !== '') {
    assertUuid(raw.syncedPostId, 'POUR_BAG_BAD_BLOB');
  }
  if (!Array.isArray(raw.kinds) || raw.kinds.length === 0 || raw.kinds.length > KINDS_MAX) {
    throw httpError(400, '品类无效', 'POUR_BAG_BAD_BLOB');
  }
  const seenKinds = new Set();
  for (const id of raw.kinds) {
    assertKindId(id, 'POUR_BAG_BAD_BLOB');
    if (seenKinds.has(id)) {
      throw httpError(400, '品类无效', 'POUR_BAG_BAD_BLOB');
    }
    seenKinds.add(id);
  }
  if (!Array.isArray(raw.bottles) || raw.bottles.length < BOTTLE_MIN || raw.bottles.length > BOTTLE_MAX) {
    throw httpError(400, '酒瓶无效', 'POUR_BAG_BAD_BLOB');
  }
  raw.bottles.forEach(assertBottle);
  if (raw.qaStatsEdited != null && typeof raw.qaStatsEdited !== 'boolean') {
    throw httpError(400, '历史条目无效', 'POUR_BAG_BAD_BLOB');
  }
  assertOptInt(raw.qaBottleCount, 0, BOTTLE_MAX, 'POUR_BAG_BAD_BLOB', '历史条目无效');
  assertOptInt(raw.qaConsumedMl, 0, BOTTLE_MAX * ML_MAX, 'POUR_BAG_BAD_BLOB', '历史条目无效');
  if (raw.qaStampEdited != null && typeof raw.qaStampEdited !== 'boolean') {
    throw httpError(400, '历史条目无效', 'POUR_BAG_BAD_BLOB');
  }
}

function assertHistoryBlob(raw) {
  if (raw == null || raw === '') return '';
  const blob = asString(raw, HISTORY_BLOB_MAX, 'POUR_BAG_BAD_BLOB');
  let parsed;
  try {
    parsed = JSON.parse(blob);
  } catch (_) {
    throw httpError(400, '历史袋无效', 'POUR_BAG_BAD_BLOB');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw httpError(400, '历史袋无效', 'POUR_BAG_BAD_BLOB');
  }
  rejectBannedKeys(parsed);
  assertKnownKeys(parsed, HISTORY_ROOT_KEYS, 'POUR_BAG_BAD_BLOB');
  if (parsed.v != null && parsed.v !== 1) {
    throw httpError(400, '历史袋无效', 'POUR_BAG_BAD_BLOB');
  }
  const records = parsed.records == null ? [] : parsed.records;
  if (!Array.isArray(records) || records.length > HISTORY_MAX) {
    throw httpError(400, '历史最多 30 条', 'POUR_BAG_BAD_BLOB');
  }
  const seen = new Set();
  for (const rec of records) {
    assertRecord(rec);
    if (seen.has(rec.id)) {
      throw httpError(400, '历史条目重复', 'POUR_BAG_BAD_BLOB');
    }
    seen.add(rec.id);
  }
  return blob;
}

function assertRevision(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 2_000_000_000) {
    throw httpError(400, '袋版本无效', 'POUR_BAG_BAD_REVISION');
  }
  return n;
}

function parseBody(body) {
  const src = body && typeof body === 'object' ? body : {};
  return {
    ledgerBlob: assertLedgerBlob(src.ledgerBlob),
    historyBlob: assertHistoryBlob(src.historyBlob),
    keepLast30: src.keepLast30 !== false,
    revision: assertRevision(src.revision),
  };
}

function publicBag(row) {
  if (!row) {
    return {
      ledgerBlob: null,
      historyBlob: null,
      keepLast30: true,
      revision: 0,
    };
  }
  return {
    ledgerBlob: row.ledger_blob || '',
    historyBlob: row.history_blob || '',
    keepLast30: row.keep_last_30 == null ? true : Boolean(Number(row.keep_last_30)),
    revision: Number(row.revision) || 0,
  };
}

module.exports = {
  parseBody,
  publicBag,
  assertLedgerBlob,
  assertHistoryBlob,
  assertRevision,
  HISTORY_MAX,
};
