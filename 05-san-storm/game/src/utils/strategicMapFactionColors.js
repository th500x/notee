/**
 * 战略大地图底板：势力代表色（与 docs/10-core-system/11-1-FACTION_SYSTEM.md §势力总览 一致；
 * `0001`～`7001` 与正式六芒星图标主色对齐）。
 */
export const FACTION_REPRESENTATIVE_HEX = {
  san_1_faction_0001: '#B58E61',
  san_1_faction_1001: '#E91E63',
  san_1_faction_2001: '#FF7043',
  san_1_faction_3001: '#00ACC1',
  san_1_faction_4001: '#8E24AA',
  san_1_faction_5001: '#43A047',
  san_1_faction_6001: '#FDD835',
  san_1_faction_7001: '#D2B48C',
  san_1_faction_8001: '#87CEEB',
  san_1_faction_9001: '#E53935',
};

/**
 * @param {string|null|undefined} factionId
 * @returns {string|null} CSS `#rrggbb` 或 null
 */
export function getFactionRepresentativeColor(factionId) {
  if (!factionId) return null;
  return FACTION_REPRESENTATIVE_HEX[factionId] || null;
}

/** @param {string} hex - `#rrggbb` */
export function hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return null;
  const h = hex.slice(1);
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * 战略大地图城点 2×2 区域右下角：六芒星势力图标
 * `public/assets/san_1_battle/faction/{factionId}.png`
 * 通用/中立占位 `san_1_faction_0001` 不显示。
 *
 * @param {string|null|undefined} factionId
 * @returns {string|null}
 */
export function getStrategicFactionLogoUrl(factionId) {
  if (!factionId || typeof factionId !== 'string') return null;
  if (factionId === 'san_1_faction_0001') return null;
  return `${import.meta.env.BASE_URL}assets/san_1_battle/faction/${encodeURIComponent(factionId)}.png`;
}
