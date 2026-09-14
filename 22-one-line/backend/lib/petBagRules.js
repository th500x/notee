/**
 * Pet bag blob checks (no DB, no catalog rolls). Product: sibling notee-go docs/00-4 §10.2
 *
 * This is a private backup of the App DataStore. Reject oversize / non-JSON / a pets
 * array that is not an array. Do not re-run intake, fusion, or HP recovery — a leftover
 * individual must not 400 the whole bag.
 *
 * Wallet fields live in the same JSON: `pp` (P-Points) and `fav` (default-deploy uid).
 * The claimed-gift ledger is not here. It lives on the stamp document.
 */

const { httpError } = require('./httpError');
const { PET_ID_RE } = require('./giftRules');

const BAG_BLOB_MAX = 32000;
const PETS_MAX = 80;
const UID_MAX = 32;
const MARKS_MAX = 999_999;
const SIZE_RE = /^[sml]$/;
const CHAR_RE = /^[a-z]{2,16}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function asString(raw, max, code) {
  if (raw == null) return null;
  const text = String(raw);
  if (text.length > max) {
    throw httpError(400, '袋字段过长', code);
  }
  return text;
}

function assertBagBlob(raw) {
  if (raw == null || raw === '') return '';
  const blob = asString(raw, BAG_BLOB_MAX, 'PET_BAG_BAD_BLOB');
  let parsed;
  try {
    parsed = JSON.parse(blob);
  } catch (_) {
    throw httpError(400, '宠物袋无效', 'PET_BAG_BAD_BLOB');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw httpError(400, '宠物袋无效', 'PET_BAG_BAD_BLOB');
  }
  const version = Number(parsed.v);
  if (!Number.isInteger(version) || version < 1) {
    throw httpError(400, '宠物袋版本无效', 'PET_BAG_BAD_BLOB');
  }
  const pets = parsed.pets == null ? [] : parsed.pets;
  if (!Array.isArray(pets)) {
    throw httpError(400, '宠物袋无效', 'PET_BAG_BAD_BLOB');
  }
  if (pets.length > PETS_MAX) {
    throw httpError(400, '宠物袋人数过多', 'PET_BAG_BAD_BLOB');
  }
  pets.forEach(assertPet);
  assertMarks(parsed.pp);
  assertFavorite(parsed.fav);
  return blob;
}

function assertMarks(raw) {
  if (raw == null || raw === '') return;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > MARKS_MAX) {
    throw httpError(400, 'P-Points 无效', 'PET_BAG_BAD_BLOB');
  }
}

function assertFavorite(raw) {
  if (raw == null || raw === '') return;
  const uid = String(raw).trim();
  if (!uid || uid.length > UID_MAX) {
    throw httpError(400, '默认出战无效', 'PET_BAG_BAD_BLOB');
  }
  // A leftover fav (filtered species, fusion consumed the uid) must not 400 the bag.
  // The App drops it on decode.
}

function assertPet(pet) {
  if (!pet || typeof pet !== 'object' || Array.isArray(pet)) {
    throw httpError(400, '宠物个体无效', 'PET_BAG_BAD_BLOB');
  }
  const uid = String(pet.uid || '').trim();
  if (!uid || uid.length > UID_MAX) {
    throw httpError(400, '宠物 uid 无效', 'PET_BAG_BAD_BLOB');
  }
  const species = String(pet.species || '').trim();
  if (!PET_ID_RE.test(species)) {
    throw httpError(400, '物种 id 无效', 'PET_BAG_BAD_BLOB');
  }
  if (pet.size != null && !SIZE_RE.test(String(pet.size))) {
    throw httpError(400, '体型无效', 'PET_BAG_BAD_BLOB');
  }
  if (pet.char != null && !CHAR_RE.test(String(pet.char))) {
    throw httpError(400, '性格无效', 'PET_BAG_BAD_BLOB');
  }
  if (pet.star != null) {
    const star = Number(pet.star);
    if (!Number.isInteger(star) || star < 0 || star > 3) {
      throw httpError(400, '星级无效', 'PET_BAG_BAD_BLOB');
    }
  }
}

function assertTonightDayKey(raw) {
  if (raw == null || raw === '') return null;
  const key = String(raw).trim();
  if (!DAY_RE.test(key)) {
    throw httpError(400, 'Tonight 日无效', 'PET_BAG_BAD_DAY');
  }
  return key;
}

function assertRevision(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 2_000_000_000) {
    throw httpError(400, '袋版本无效', 'PET_BAG_BAD_REVISION');
  }
  return n;
}

function parseBody(body) {
  const src = body && typeof body === 'object' ? body : {};
  return {
    bagBlob: assertBagBlob(src.bagBlob),
    welcomeClaimed: Boolean(src.welcomeClaimed),
    tonightDayKey: assertTonightDayKey(src.tonightDayKey),
    revision: assertRevision(src.revision),
  };
}

function bagBlobText(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function publicBag(row) {
  if (!row) {
    return {
      bagBlob: null,
      welcomeClaimed: false,
      tonightDayKey: null,
      revision: 0,
    };
  }
  return {
    bagBlob: bagBlobText(row.bag_blob) || '',
    welcomeClaimed: Boolean(Number(row.welcome_claimed)),
    tonightDayKey: row.tonight_day_key || null,
    revision: Number(row.revision) || 0,
  };
}

module.exports = {
  parseBody,
  publicBag,
  assertBagBlob,
  assertTonightDayKey,
  assertRevision,
  PETS_MAX,
};
