/**
 * Pure helpers for Cloud Translation responses (docs/04 §2.5). No network.
 */

const TARGETS = {
  en: 'en',
  zh: 'zh-CN',
};

const MAX_TEXTS = 20;
/** Per string, not per batch. Headlines stay under 150; a longer string comes back as sent. */
const MAX_CHARS = 200;

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

module.exports = {
  TARGETS,
  MAX_TEXTS,
  MAX_CHARS,
  googleTarget,
  sameLanguage,
};
