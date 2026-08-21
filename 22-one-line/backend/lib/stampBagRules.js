/**
 * Stamp bag blob checks (no DB, no catalog). Product: sibling notee-go docs/00-3 §6.2
 */

const { httpError } = require('./httpError');

const STAMP_ID_RE = /^[a-z]{2}_[a-z0-9_]{1,48}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INVENTORY_MAX = 16000;
const CHECK_IN_MAX = 512;
const GIFT_IDS_MAX = 8000;
const COUNT_MAX = 999999;

function asString(raw, max, code) {
  if (raw == null) return null;
  const text = String(raw);
  if (text.length > max) {
    throw httpError(400, '袋字段过长', code);
  }
  return text;
}

function assertStampId(id) {
  if (!STAMP_ID_RE.test(id)) {
    throw httpError(400, '邮票 id 无效', 'STAMP_BAG_BAD_BLOB');
  }
  return id;
}

function parseFrags(raw) {
  if (!raw) return;
  raw.split(',').forEach((pair) => {
    if (!pair) return;
    const kv = pair.split(':');
    if (kv.length !== 2) throw httpError(400, '碎片格式无效', 'STAMP_BAG_BAD_BLOB');
    assertStampId(kv[0]);
    const n = Number(kv[1]);
    if (!Number.isInteger(n) || n < 1 || n > COUNT_MAX) {
      throw httpError(400, '碎片数量无效', 'STAMP_BAG_BAD_BLOB');
    }
  });
}

function parseOwned(raw) {
  if (!raw) return;
  raw.split(',').forEach((id) => {
    if (id) assertStampId(id);
  });
}

function assertInventoryBlob(raw) {
  if (raw == null || raw === '') return '';
  const blob = asString(raw, INVENTORY_MAX, 'STAMP_BAG_BAD_BLOB');
  const parts = blob.split('|');
  if (parts[0] === 'v2') {
    if (parts.length < 5) throw httpError(400, '库存格式无效', 'STAMP_BAG_BAD_BLOB');
    parseFrags(parts[1]);
    parseOwned(parts[2]);
    const craft = Number(parts[3]);
    const uni = Number(parts[4]);
    if (!Number.isInteger(craft) || craft < 0 || craft > COUNT_MAX) {
      throw httpError(400, '合成库无效', 'STAMP_BAG_BAD_BLOB');
    }
    if (!Number.isInteger(uni) || uni < 0 || uni > COUNT_MAX) {
      throw httpError(400, '通用邮票无效', 'STAMP_BAG_BAD_BLOB');
    }
    return blob;
  }
  if (parts[0] === 'v1') {
    if (parts.length < 3) throw httpError(400, '库存格式无效', 'STAMP_BAG_BAD_BLOB');
    parseFrags(parts[1]);
    parseOwned(parts[2]);
    return blob;
  }
  throw httpError(400, '库存格式无效', 'STAMP_BAG_BAD_BLOB');
}

function assertCheckInBlob(raw) {
  if (raw == null || raw === '') return null;
  const blob = asString(raw, CHECK_IN_MAX, 'STAMP_BAG_BAD_BLOB');
  const parts = blob.split('|');
  if (parts[0] !== 'v1' && parts[0] !== 'v2') {
    throw httpError(400, '签到格式无效', 'STAMP_BAG_BAD_BLOB');
  }
  if (parts.length < 5) throw httpError(400, '签到格式无效', 'STAMP_BAG_BAD_BLOB');
  assertStampId(parts[1]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parts[2])) {
    throw httpError(400, '签到日期无效', 'STAMP_BAG_BAD_BLOB');
  }
  if (parts[3] && !/^\d{4}-\d{2}-\d{2}$/.test(parts[3])) {
    throw httpError(400, '签到日期无效', 'STAMP_BAG_BAD_BLOB');
  }
  return blob;
}

function assertGiftClaimedIds(raw) {
  if (raw == null || raw === '') return '';
  const blob = asString(raw, GIFT_IDS_MAX, 'STAMP_BAG_BAD_BLOB');
  const ids = blob.split(',').map((s) => s.trim()).filter(Boolean);
  ids.forEach((id) => {
    if (!UUID_RE.test(id)) throw httpError(400, '赠品领取 id 无效', 'STAMP_BAG_BAD_BLOB');
  });
  return [...new Set(ids)].sort().join(',');
}

function assertRevision(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 2_000_000_000) {
    throw httpError(400, '袋版本无效', 'STAMP_BAG_BAD_REVISION');
  }
  return n;
}

function parseBody(body) {
  const src = body && typeof body === 'object' ? body : {};
  return {
    inventoryBlob: assertInventoryBlob(src.inventoryBlob),
    checkInBlob: assertCheckInBlob(src.checkInBlob),
    welcomePicked: Boolean(src.welcomePicked),
    giftClaimedIds: assertGiftClaimedIds(src.giftClaimedIds),
    revision: assertRevision(src.revision),
  };
}

function publicBag(row) {
  if (!row) {
    return {
      inventoryBlob: null,
      checkInBlob: null,
      welcomePicked: false,
      giftClaimedIds: '',
      revision: 0,
    };
  }
  return {
    inventoryBlob: row.inventory_blob || '',
    checkInBlob: row.check_in_blob || null,
    welcomePicked: Boolean(Number(row.welcome_picked)),
    giftClaimedIds: row.gift_claimed_ids || '',
    revision: Number(row.revision) || 0,
  };
}

module.exports = {
  parseBody,
  publicBag,
  assertInventoryBlob,
  assertCheckInBlob,
  assertGiftClaimedIds,
  assertRevision,
};
