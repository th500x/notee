/**
 * Pour Check cloud bag (ledger + last 30 photo-less history records).
 * Product: sibling notee-go docs/03 §3.7.
 *
 * This is a private backup of the App DataStore, not a public post.
 * Reject media / path keys and oversize blobs only. Do not re-run the
 * start-form dual gate (names length, stamp regex, place spam, UUID
 * version) — one leftover row must not 400 the whole bag.
 */

const { httpError } = require('./httpError');
const { rejectBannedKeys } = require('./pourPayload');

const LEDGER_BLOB_MAX = 65536;
const HISTORY_BLOB_MAX = 200000;
const HISTORY_MAX = 30;

function asString(raw, max, code) {
  if (raw == null) return null;
  const text = String(raw);
  if (text.length > max) {
    throw httpError(400, '袋字段过长', code);
  }
  return text;
}

function parseJsonObject(blob, emptyMessage, code) {
  let parsed;
  try {
    parsed = JSON.parse(blob);
  } catch (_) {
    throw httpError(400, emptyMessage, code);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw httpError(400, emptyMessage, code);
  }
  rejectBannedKeys(parsed);
  return parsed;
}

function assertLedgerBlob(raw) {
  if (raw == null || raw === '') return '';
  const blob = asString(raw, LEDGER_BLOB_MAX, 'POUR_BAG_BAD_BLOB');
  parseJsonObject(blob, '开瓶账无效', 'POUR_BAG_BAD_BLOB');
  return blob;
}

function assertHistoryBlob(raw) {
  if (raw == null || raw === '') return '';
  const blob = asString(raw, HISTORY_BLOB_MAX, 'POUR_BAG_BAD_BLOB');
  const parsed = parseJsonObject(blob, '历史袋无效', 'POUR_BAG_BAD_BLOB');
  const records = parsed.records == null ? [] : parsed.records;
  if (!Array.isArray(records)) {
    throw httpError(400, '历史袋无效', 'POUR_BAG_BAD_BLOB');
  }
  if (records.length > HISTORY_MAX) {
    parsed.records = records.slice(0, HISTORY_MAX);
    return JSON.stringify(parsed);
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
