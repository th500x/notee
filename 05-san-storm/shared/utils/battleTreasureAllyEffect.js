/**
 * 宝物 `special_effect` · 战斗助阵（battle_ally）解析
 * 须与 battleTreasureAllyEffect.cjs 同步
 */

import { unwrapConfigSpecialEffectRaw } from './configSpecialEffectRaw.js';

/** @param {unknown} rawValue */
export function parseBattleTreasureAllySpec(rawValue) {
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
