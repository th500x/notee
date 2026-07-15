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

/**
 * 战略格 2×2 锚点右下角势力六芒星个数：小城 / 关隘 / 据点等 **1**；**中城 / 大城均为 2**（与中城立绘角标一致；大城另叠前层径向 tint 见 `WorldStrategicMapTile`）。
 * 优先 `cityRow.city_type`（与库/API），否则回退锚点格 `object`（`city_*`）。
 *
 * @param {object|null|undefined} cityRow
 * @param {string|null|undefined} effectiveObject - 锚点格 object 键
 * @returns {number} 1 | 2
 */
export function getStrategicFactionMarkerCount(cityRow, effectiveObject) {
  const ct = cityRow?.city_type ?? cityRow?.cityType;
  const resolved =
    ct ||
    (effectiveObject === 'city_major'
      ? 'city_major'
      : effectiveObject === 'city_medium'
        ? 'city_medium'
        : effectiveObject === 'city_small'
          ? 'city_small'
          : null);
  if (resolved === 'city_major' || resolved === 'city_medium') return 2;
  return 1;
}
