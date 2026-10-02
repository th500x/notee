/**
 * Cloud Translation proxy (notee-go docs/04 §2.5).
 * The API key stays in GOOGLE_TRANSLATE_API_KEY. Callers send { target, texts }.
 * Results sit in this process only. Posts and headlines in MySQL stay the original.
 */

const { httpError } = require('../lib/httpError');
const {
  MAX_TEXTS,
  MAX_CHARS,
  googleTarget,
  sameLanguage,
  decodeEntities,
} = require('../lib/translateText');

const CACHE_MAX = 2000;
const cache = new Map();

function remember(key, value) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

async function callGoogle(texts, target) {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!key) throw httpError(503, 'Translation is not configured', 'TRANSLATE_OFF');
  const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: texts, target, format: 'text' }),
    });
  } catch (err) {
    throw httpError(502, 'Translation upstream failed', 'TRANSLATE_UPSTREAM');
  }
  if (!res.ok) {
    throw httpError(502, `Translation upstream ${res.status}`, 'TRANSLATE_UPSTREAM');
  }
  const body = await res.json();
  const rows = body && body.data && body.data.translations;
  if (!Array.isArray(rows) || rows.length !== texts.length) {
    throw httpError(502, 'Translation upstream shape', 'TRANSLATE_UPSTREAM');
  }
  return rows;
}

/**
 * @param {string[]} texts
 * @param {string} target `en` or `zh`
 * @returns {Promise<string[]>}
 */
async function translateTexts(texts, target) {
  if (!Array.isArray(texts) || texts.length === 0 || texts.length > MAX_TEXTS) {
    throw httpError(400, 'texts must be 1–20 strings', 'TRANSLATE_BAD_BATCH');
  }
  const google = googleTarget(target);
  if (!google) throw httpError(400, 'target must be en or zh', 'TRANSLATE_BAD_TARGET');

  const out = new Array(texts.length);
  const pending = [];
  texts.forEach((raw, i) => {
    const text = typeof raw === 'string' ? raw : '';
    if (!text.trim() || text.length > MAX_CHARS) {
      out[i] = typeof raw === 'string' ? raw : '';
      return;
    }
    const hit = cache.get(`${target}\u0000${text}`);
    if (hit !== undefined) {
      out[i] = hit;
      return;
    }
    pending.push({ i, text });
  });

  if (pending.length > 0) {
    const rows = await callGoogle(pending.map((item) => item.text), google);
    pending.forEach((item, n) => {
      const row = rows[n];
      const translated = sameLanguage(row.detectedSourceLanguage, google)
        ? item.text
        : decodeEntities(row.translatedText);
      const value = translated && translated.trim() ? translated : item.text;
      remember(`${target}\u0000${item.text}`, value);
      out[item.i] = value;
    });
  }
  return out;
}

module.exports = { translateTexts };
