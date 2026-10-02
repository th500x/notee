/**
 * Pure helpers for Cloud Translation responses (docs/04 §2.5). No network.
 */

const TARGETS = {
  en: 'en',
  zh: 'zh-CN',
};

const MAX_TEXTS = 20;
const MAX_CHARS = 1000;

function googleTarget(target) {
  return TARGETS[target] || null;
}

function primaryTag(tag) {
  return String(tag || '').toLowerCase().split('-')[0];
}

/** Detected source already is the chrome language: keep the original wording. */
function sameLanguage(detected, target) {
  const a = primaryTag(detected);
  const b = primaryTag(target);
  return a.length > 0 && a === b;
}

/** Cloud Translation still emits a few entities when format=text. */
function decodeEntities(text) {
  return String(text || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

module.exports = {
  TARGETS,
  MAX_TEXTS,
  MAX_CHARS,
  googleTarget,
  sameLanguage,
  decodeEntities,
};
