/**
 * 须与 battleUnitKeyResolve.js 同步（Node / 导入脚本用）。
 * @see docs/00/90-assets/99-2-BATTLE_UNIT_SPRITE_PIPELINE.md §5.3
 */

const battleUnitKeyDefaults = require('../../public/data/shared/battle-unit-key-defaults.json');

function resolveBattleUnitKey(troop, defaultsDoc = battleUnitKeyDefaults) {
  if (!troop || typeof troop !== 'object') return null;

  const explicit = troop.battleUnitKey ?? troop.battle_unit_key;
  if (explicit != null && String(explicit).trim()) {
    return String(explicit).trim();
  }

  const rarity = String(troop.rarity || '').trim().toLowerCase();
  const troopType = String(troop.troopType || troop.troop_type || '')
    .trim()
    .toLowerCase();
  if (!rarity || !troopType) return null;

  const cell = defaultsDoc?.defaults?.[rarity]?.[troopType];
  if (!cell) return null;
  const key = typeof cell === 'string' ? cell : cell.unitKey;
  if (key != null && String(key).trim()) return String(key).trim();
  return null;
}

function applyBattleUnitKey(troop) {
  if (!troop || typeof troop !== 'object') return troop;
  const key = resolveBattleUnitKey(troop);
  if (!key) return troop;
  if (troop.battleUnitKey === key) return troop;
  return { ...troop, battleUnitKey: key };
}

module.exports = {
  resolveBattleUnitKey,
  applyBattleUnitKey,
  battleUnitKeyDefaults,
};
