/**
 * 大地图成就 display_effect 白名单（与 25-2 §5 一致）
 */

const KNOWN_MAP_DISPLAY_EFFECTS = new Set(['金色', '红色', '绿色', '黑色']);

/**
 * @param {unknown} raw
 * @returns {string|null}
 */
function normalizeMapDisplayEffect(raw) {
  const v = typeof raw === 'string' ? raw.trim() : '';
  return KNOWN_MAP_DISPLAY_EFFECTS.has(v) ? v : null;
}

module.exports = {
  KNOWN_MAP_DISPLAY_EFFECTS,
  normalizeMapDisplayEffect,
};
