/**
 * 宝物 `special_effect` · 战斗助阵（battle_ally）解析
 * 须与 battleTreasureAllyEffect.js 同步
 *
 * CSV 示例：`battle_ally:legendary_char_random;legendary_troop:2`
 */

const { unwrapConfigSpecialEffectRaw } = require('./configSpecialEffectRaw.cjs');

/**
 * @param {unknown} rawValue
 * @returns {{ charRarity: string, troopRarity: string, troopCount: number }|null}
 */
function parseBattleTreasureAllySpec(rawValue) {
  const str = unwrapConfigSpecialEffectRaw(rawValue);
  if (!str) return null;
  const entries = {};
  for (const part of str.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(':');
    if (colon < 0) continue;
    const key = trimmed.slice(0, colon).trim();
    const val = trimmed.slice(colon + 1).trim();
    if (key) entries[key] = val;
  }
  if (entries.battle_ally !== 'legendary_char_random') return null;
  const troopCount = parseInt(entries.legendary_troop, 10);
  return {
    charRarity: 'legendary',
    troopRarity: 'legendary',
    troopCount: Number.isFinite(troopCount) && troopCount > 0 ? troopCount : 2,
  };
}

module.exports = { parseBattleTreasureAllySpec };
