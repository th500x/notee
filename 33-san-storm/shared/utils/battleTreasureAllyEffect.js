/**
 * 宝物 `special_effect` · 战斗助阵（battle_ally）解析
 * 须与 battleTreasureAllyEffect.cjs 同步
 *
 * CSV 示例：
 * - `battle_ally:epic_char_random;epic_troop:2`
 * - `battle_ally:legendary_char_random;legendary_troop:2`
 */

import { unwrapConfigSpecialEffectRaw } from './configSpecialEffectRaw.js';

/** @type {Record<string, { charRarity: string, troopRarity: string, troopKey: string }>} */
const BATTLE_ALLY_MODES = {
  epic_char_random: { charRarity: 'epic', troopRarity: 'epic', troopKey: 'epic_troop' },
  legendary_char_random: {
    charRarity: 'legendary',
    troopRarity: 'legendary',
    troopKey: 'legendary_troop',
  },
};

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
  const mode = BATTLE_ALLY_MODES[entries.battle_ally];
  if (!mode) return null;
  const troopCount = parseInt(entries[mode.troopKey], 10);
  return {
    charRarity: mode.charRarity,
    troopRarity: mode.troopRarity,
    troopCount: Number.isFinite(troopCount) && troopCount > 0 ? troopCount : 2,
  };
}
