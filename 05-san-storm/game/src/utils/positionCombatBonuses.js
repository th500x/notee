/**
 * 官职 · 战斗兵种加成（步/骑/弓 %）— 游戏前端 ESM 入口。
 * 算法须与 `shared/utils/positionCombatBonuses.cjs` 一致；改逻辑时请同步两处。
 * （Vite 不宜 `import` 共享 `.cjs` 的命名导出，见 `siegeKillEconomyTributeDisplay.js` 同模式。）
 */

/**
 * @param {object|null|undefined} raw
 * @returns {{ infantryBonus: number, cavalryBonus: number, archerBonus: number }|null}
 */
export function normalizePositionCombatBonuses(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const infantry = Number(raw.infantryBonus ?? raw.infantry ?? 0) || 0;
  const cavalry = Number(raw.cavalryBonus ?? raw.cavalry ?? 0) || 0;
  const archer = Number(raw.archerBonus ?? raw.archer ?? 0) || 0;
  if (infantry === 0 && cavalry === 0 && archer === 0) return null;
  return { infantryBonus: infantry, cavalryBonus: cavalry, archerBonus: archer };
}

/**
 * @param {object|null|undefined} charData
 * @param {object|null|undefined} bonuses
 * @returns {object|null|undefined}
 */
export function attachPositionCombatBonuses(charData, bonuses) {
  const norm = normalizePositionCombatBonuses(bonuses);
  if (!norm || !charData) return charData;
  return { ...charData, positionBonuses: norm };
}

/**
 * @param {object|null|undefined} player
 * @returns {object|null}
 */
export function getPositionCombatBonusesFromPlayer(player) {
  const pb = player?.positionConfig?.positionBonuses;
  return normalizePositionCombatBonuses(pb);
}
