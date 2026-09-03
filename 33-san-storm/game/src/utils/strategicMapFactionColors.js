/**
 * 战略大地图底板：势力代表色（与 docs/01-jun-exploration/10-core-system/11-1-FACTION_SYSTEM.md §4.1 一致）。
 */
export const FACTION_REPRESENTATIVE_HEX = {
  san_1_faction_0001: '#B58E61',
  san_1_faction_1001: '#FF6B6B',
  san_1_faction_2001: '#FFD93D',
  san_1_faction_3001: '#FCB900',
  san_1_faction_9101: '#87CEEB',
  san_1_faction_8001: '#87CEEB', // 兼容旧北疆 id
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
 * 势力列表等仍用六芒星 PNG：`public/assets/san_1_battle/faction/{factionId}.png`
 * 战略城点叠层已改为右上势力旗（见 `WorldStrategicMapTile`），不再用本 URL。
 * 通用/中立占位 `san_1_faction_0001` 返回 null。
 *
 * @param {string|null|undefined} factionId
 * @returns {string|null}
 */
export function getStrategicFactionLogoUrl(factionId) {
  if (!factionId || typeof factionId !== 'string') return null;
  if (factionId === 'san_1_faction_0001') return null;
  return `${import.meta.env.BASE_URL}assets/san_1_battle/faction/${encodeURIComponent(factionId)}.png`;
}

/**
 * 旗面文字对比色：浅底深字、深底浅字。
 * @param {string|null|undefined} hex - `#rrggbb`
 * @returns {string}
 */
export function contrastTextOnFactionHex(hex) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#') || hex.length < 7) {
    return '#fffbeb';
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return '#fffbeb';
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#1c1917' : '#fffbeb';
}
