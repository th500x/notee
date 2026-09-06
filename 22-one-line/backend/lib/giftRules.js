/**
 * Gift campaign payload / audience rules (no DB).
 * Product: sibling notee-go docs/00-2-Home-Top-Bar.md §3.5
 */

const { httpError } = require('./httpError');
const { normalizeLoginId } = require('./loginId');
const stampGiftCatalog = require('./stampGiftCatalog');

const KINDS = new Set(['stamp', 'stamp_pick', 'pet']);
const AUDIENCES = new Set(['all', 'pass', 'honor', 'login_ids']);
const READY_AUDIENCES = new Set(['all', 'login_ids']);

/** Catalog ids like th_bangkok, th_chiang_mai, th_lopburi. */
const STAMP_ID_RE = /^[a-z]{2}_[a-z0-9_]{1,48}$/;
const PET_ID_RE = /^[a-z][a-z0-9_]{0,63}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Player-facing headline on the claim row, e.g. "New Year Gift". */
const TITLE_MAX = 80;

function assertKind(kind) {
  if (!KINDS.has(kind)) {
    throw httpError(400, '未知赠品种类', 'GIFT_BAD_KIND');
  }
  return kind;
}

function assertAudience(audience) {
  if (!AUDIENCES.has(audience)) {
    throw httpError(400, '未知赠品受众', 'GIFT_BAD_AUDIENCE');
  }
  if (!READY_AUDIENCES.has(audience)) {
    throw httpError(400, '该受众尚未接线（Pass / 荣耀标记未上）', 'GIFT_AUDIENCE_NOT_READY');
  }
  return audience;
}

function assertStampId(raw) {
  const id = String(raw || '').trim();
  if (!STAMP_ID_RE.test(id)) {
    throw httpError(400, '邮票 id 无效', 'GIFT_BAD_STAMP_ID');
  }
  return id;
}

/** One stamp id, or every stamp in a series+country (region/th, limited/th). */
function resolveGiftStampIds(input) {
  const itemId = input.itemId ? String(input.itemId).trim() : '';
  const series = input.series ? String(input.series).trim().toLowerCase() : '';
  const country = input.country ? String(input.country).trim().toLowerCase() : '';
  if (itemId && (series || country)) {
    throw httpError(400, '不要同时写 --id 和 --series', 'GIFT_ID_OR_SERIES');
  }
  if (itemId) return [assertStampId(itemId)];
  if (!series || !country) {
    throw httpError(400, '需要 --id <stampId>，或 --series region|limited --country th', 'GIFT_STAMP_TARGET_REQUIRED');
  }
  if (series !== 'region' && series !== 'limited') {
    throw httpError(400, '系列只能是 region 或 limited', 'GIFT_BAD_SERIES');
  }
  if (!/^[a-z]{2}$/.test(country)) {
    throw httpError(400, '国家码无效', 'GIFT_BAD_COUNTRY');
  }
  const ids = (stampGiftCatalog[series] && stampGiftCatalog[series][country]) || [];
  if (!ids.length) {
    throw httpError(400, `该系列没有 ${country} 的票`, 'GIFT_SERIES_EMPTY');
  }
  return ids.map(assertStampId);
}

function assertPetId(raw) {
  const id = String(raw || '').trim();
  if (!PET_ID_RE.test(id)) {
    throw httpError(400, 'PET id 无效', 'GIFT_BAD_PET_ID');
  }
  // Operator gifts may only hand out the free 屋 cabinet (docs/00-4 §8).
  if (!id.startsWith('bar_')) {
    throw httpError(400, '运营赠品只许屋系', 'GIFT_PET_NOT_BAR');
  }
  return id;
}

function assertCampaignId(raw) {
  const id = String(raw || '').trim();
  if (!UUID_RE.test(id)) {
    throw httpError(400, '活动 id 无效', 'GIFT_BAD_ID');
  }
  return id;
}

/**
 * @returns {{ kind: string, payload: object }}
 */
function buildPayload(kind, itemId) {
  const k = assertKind(kind);
  if (k === 'stamp') return { kind: k, payload: { stampId: assertStampId(itemId) } };
  if (k === 'pet') return { kind: k, payload: { petId: assertPetId(itemId) } };
  throw httpError(400, 'stamp_pick 仅本机开户自选，不走 22', 'GIFT_KIND_NOT_WIRED');
}

function parsePayload(kind, payload) {
  const k = assertKind(kind);
  const obj = asObject(payload) || {};
  if (k === 'stamp') return { stampId: assertStampId(obj.stampId) };
  if (k === 'pet') return { petId: assertPetId(obj.petId) };
  return obj;
}

function asObject(value) {
  if (value == null) return null;
  if (typeof value === 'object' && !Buffer.isBuffer(value)) return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
}

function sanitizeTitle(raw) {
  if (raw == null) return null;
  const text = String(raw).replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX);
  return text || null;
}

function parseLoginIds(raw) {
  const text = Array.isArray(raw) ? raw.join(',') : String(raw || '');
  const ids = text
    .split(/[\s,]+/)
    .map((s) => normalizeLoginId(s))
    .filter((id) => /^[A-Z0-9]{4}$/.test(id));
  return [...new Set(ids)];
}

function publicCampaign(row) {
  const payload = parsePayload(row.kind, row.payload);
  return {
    id: row.id,
    kind: row.kind,
    stampId: payload.stampId || null,
    petId: payload.petId || null,
    title: sanitizeTitle(row.note),
  };
}

module.exports = {
  KINDS,
  AUDIENCES,
  READY_AUDIENCES,
  STAMP_ID_RE,
  PET_ID_RE,
  assertKind,
  assertAudience,
  assertStampId,
  resolveGiftStampIds,
  assertPetId,
  assertCampaignId,
  buildPayload,
  parsePayload,
  asObject,
  parseLoginIds,
  sanitizeTitle,
  publicCampaign,
  TITLE_MAX,
};
