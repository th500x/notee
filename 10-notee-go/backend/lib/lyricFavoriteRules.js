/**
 * Party Catalog favorite ids (no DB). Product: sibling notee-go docs/05 §3.3.2a.
 * Ids are catalog keys such as "album:2000:小镇姑娘:陶喆". Do not require the id
 * to still be in the shipped catalog — a retired id must not 400 the whole bag.
 */

const { httpError } = require('./httpError');

const IDS_MAX = 800;
const ID_MAX = 160;
const REVISION_MAX = 2_000_000_000;

function assertId(raw) {
  const id = String(raw == null ? '' : raw).trim();
  if (!id || id.length > ID_MAX || /[\u0000-\u001F\u007F]/.test(id)) {
    throw httpError(400, '收藏曲目无效', 'LYRIC_FAVORITES_BAD');
  }
  return id;
}

function assertIds(raw) {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw httpError(400, '收藏列表无效', 'LYRIC_FAVORITES_BAD');
  }
  if (raw.length > IDS_MAX) {
    throw httpError(400, '收藏过多', 'LYRIC_FAVORITES_BAD');
  }
  const out = [];
  raw.forEach((item) => {
    const id = assertId(item);
    if (!out.includes(id)) out.push(id);
  });
  return out;
}

function assertRevision(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > REVISION_MAX) {
    throw httpError(400, '袋版本无效', 'LYRIC_FAVORITES_BAD_REVISION');
  }
  return n;
}

function parseBody(body) {
  const src = body && typeof body === 'object' ? body : {};
  return {
    ids: assertIds(src.ids),
    revision: assertRevision(src.revision),
  };
}

function blobToIds(value) {
  if (value == null || value === '') return [];
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    return [];
  }
  const ids = parsed && Array.isArray(parsed.ids) ? parsed.ids : [];
  return ids
    .map((id) => String(id == null ? '' : id).trim())
    .filter((id) => id && id.length <= ID_MAX && !/[\u0000-\u001F\u007F]/.test(id))
    .filter((id, index, all) => all.indexOf(id) === index);
}

function encodeBlob(ids) {
  return JSON.stringify({ v: 1, ids });
}

function publicBag(row) {
  if (!row) {
    return { ids: [], revision: 0 };
  }
  return {
    ids: blobToIds(row.bag_blob),
    revision: Number(row.revision) || 0,
  };
}

module.exports = {
  parseBody,
  publicBag,
  encodeBlob,
  assertIds,
  assertRevision,
  IDS_MAX,
};
