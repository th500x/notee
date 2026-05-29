/**
 * 将领兵种适性 · 出站伤害加成（`config_characters.troop_affinity`，如 `cavalry:6`）。
 * 与 `calcDamage` / `siegeCombatCore` 中 character 字段契约一致。
 *
 * 使用 .cjs：shared 为 ESM 包，后端 require 须 CommonJS。
 * 游戏前端须用 `game/src/utils/troopAffinityCombat.js`（ESM），勿直接 import 本文件。
 */

'use strict';

/**
 * @param {string|null|undefined} affinityStr 如 `cavalry:6` 或 `infantry:8;archer:2`
 * @returns {Record<string, number>} 兵种 → 小数加成（6 → 0.06）
 */
function parseTroopAffinityString(affinityStr) {
  const affinities = {};
  if (!affinityStr || typeof affinityStr !== 'string') return affinities;
  affinityStr.split(';').forEach((pair) => {
    const [troopType, bonus] = pair.split(':');
    const key = troopType && troopType.trim();
    if (!key) return;
    const n = parseInt(String(bonus).trim(), 10);
    if (Number.isFinite(n) && n !== 0) affinities[key] = n / 100;
  });
  return affinities;
}

/**
 * @param {object|null|undefined} character
 * @param {string|null|undefined} troopType
 * @returns {number} 出站伤害乘子（无匹配适性时为 1）
 */
function getTroopAffinityOutgoingDamageMult(character, troopType) {
  if (!character || !troopType) return 1;
  let affinities = character.troopAffinities;
  if (!affinities || typeof affinities !== 'object') {
    const raw = character.troopAffinity ?? character.troop_affinity;
    affinities = parseTroopAffinityString(typeof raw === 'string' ? raw : '');
  }
  const pct = Number(affinities[troopType] ?? 0);
  return pct ? 1 + pct : 1;
}

/**
 * @param {object|null|undefined} charData
 * @param {string|null|undefined} affinityRaw
 * @returns {object|null|undefined}
 */
function attachTroopAffinityToCharacter(charData, affinityRaw) {
  if (!charData) return charData;
  const str =
    typeof affinityRaw === 'string'
      ? affinityRaw
      : charData.troopAffinity ?? charData.troop_affinity ?? null;
  if (!str) return charData;
  const parsed = parseTroopAffinityString(str);
  if (!Object.keys(parsed).length) return charData;
  return { ...charData, troopAffinity: str, troopAffinities: parsed };
}

module.exports = {
  parseTroopAffinityString,
  getTroopAffinityOutgoingDamageMult,
  attachTroopAffinityToCharacter,
};
