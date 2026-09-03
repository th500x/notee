/**
 * 将领兵种适性 · 出站伤害加成 — 游戏前端 ESM 入口。
 * 算法须与 `shared/utils/troopAffinityCombat.cjs` 一致；改逻辑时请同步两处。
 */

/**
 * @param {string|null|undefined} affinityStr
 * @returns {Record<string, number>}
 */
export function parseTroopAffinityString(affinityStr) {
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
 * @returns {number}
 */
export function getTroopAffinityOutgoingDamageMult(character, troopType) {
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
export function attachTroopAffinityToCharacter(charData, affinityRaw) {
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
