/**
 * 战略大地图 2×2 城名标签：按与玩家的关系着色。
 * 色值与战役图部队 HP 条（`BattleMap.css` → `.troop-hp-block.full-*`）对齐，便于全项目统一识别。
 *
 * 盟友 / 非敌对势力 ID 列表由上层（战役、外交 API）传入；未传入时除「己方 / 中立」外一律按敌对（红）处理，
 * 见 `getStrategicCityLabelStance` 文末注释。
 */

/** @param {Set<string>|string[]|null|undefined} list */
function factionInOptionalList(list, factionId) {
  if (!factionId || !list) return false;
  if (list instanceof Set) return list.has(factionId);
  if (Array.isArray(list)) return list.includes(factionId);
  return false;
}

/** 非敌对名单内：绿 / 黄两档，按 `faction_id` 稳定分摊（与战役 ally1 / ally2 同色） */
function nonHostileStanceVariant(factionId) {
  let s = 0;
  for (let i = 0; i < factionId.length; i++) s += factionId.charCodeAt(i);
  return s % 2 === 0 ? 'nonHostile' : 'nonHostileAlt';
}

/**
 * 与 `BattleMap.css` 部队条一致：`player` / `enemy` / `ally1` / `ally2`。
 * 盟友紫单独取可读色（战役条无「盟友紫」，与势力卡位紫系 `#8E24AA` 同族）。
 */
export const STRATEGIC_CITY_LABEL_HEX = {
  own: '#3b82f6',
  neutral: '#ffffff',
  hostile: '#ef4444',
  /** 与 `.troop-hp-block.full-ally1` 一致 */
  nonHostile: '#10b981',
  /** 与 `.troop-hp-block.full-ally2` 一致；可用于多档非敌对或后续分派 */
  nonHostileAlt: '#f59e0b',
  ally: '#9333ea',
};

/**
 * @param {object} opts
 * @param {string|null|undefined} opts.cityFactionId - `cities.faction_id`
 * @param {string|null|undefined} opts.playerFactionId - 当前玩家所选势力
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

  // 结盟与完整外交态未接入前：非己方、非中立、且不在显式盟友/非敌对名单中的势力，一律按敌对（红）展示。
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
