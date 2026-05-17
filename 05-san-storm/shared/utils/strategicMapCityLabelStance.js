/**
 * 战略大地图 2×2 城名标签：按与当前势力关系着色（与 game 同源，供 shared 内距离/高亮算法复用）。
 *
 * 盟友 / 非敌对势力 ID 列表由上层传入；未传入时除「己方 / 中立」外一律按敌对处理。
 */

/** @param {Set<string>|string[]|null|undefined} list */
function factionInOptionalList(list, factionId) {
  if (!factionId || !list) return false;
  if (list instanceof Set) return list.has(factionId);
  if (Array.isArray(list)) return list.includes(factionId);
  return false;
}

/** 非敌对名单内：绿 / 黄两档，按 `faction_id` 稳定分摊 */
function nonHostileStanceVariant(factionId) {
  let s = 0;
  for (let i = 0; i < factionId.length; i++) s += factionId.charCodeAt(i);
  return s % 2 === 0 ? 'nonHostile' : 'nonHostileAlt';
}

export const STRATEGIC_CITY_LABEL_HEX = {
  own: '#3b82f6',
  neutral: '#ffffff',
  hostile: '#ef4444',
  nonHostile: '#10b981',
  nonHostileAlt: '#f59e0b',
  ally: '#9333ea',
};

/**
 * @param {object} opts
 * @param {string|null|undefined} opts.cityFactionId
 * @param {string|null|undefined} opts.playerFactionId
 * @param {Set<string>|string[]|null|undefined} [opts.allyFactionIds]
 * @param {Set<string>|string[]|null|undefined} [opts.nonHostileFactionIds]
 * @returns {'own'|'neutral'|'hostile'|'nonHostile'|'nonHostileAlt'|'ally'|null}
 */
export function getStrategicCityLabelStance({
  cityFactionId,
  playerFactionId,
  allyFactionIds = null,
  nonHostileFactionIds = null,
}) {
  const pf = playerFactionId != null && playerFactionId !== '' ? String(playerFactionId) : null;
  if (!pf) return null;

  const fidRaw = cityFactionId != null && cityFactionId !== '' ? String(cityFactionId) : null;
  if (!fidRaw) return 'neutral';

  if (fidRaw === pf) return 'own';
  if (factionInOptionalList(allyFactionIds, fidRaw)) return 'ally';
  if (factionInOptionalList(nonHostileFactionIds, fidRaw)) return nonHostileStanceVariant(fidRaw);

  return 'hostile';
}

/**
 * @param {'own'|'neutral'|'hostile'|'nonHostile'|'nonHostileAlt'|'ally'|null|undefined} stance
 * @returns {{ color: string }|undefined}
 */
export function strategicCityLabelInlineColorStyle(stance) {
  if (!stance) return undefined;
  const hex = STRATEGIC_CITY_LABEL_HEX[stance];
  if (!hex) return undefined;
  return { color: hex };
}
