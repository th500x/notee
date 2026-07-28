/**
 * 战斗序列帧 unitKey 解析：特写 → 稀有度×兵种默认表 → null（再回退旧静态立绘）
 * 须与 public/data/shared/battle-unit-key-defaults.json 同步；后端可用同名 .cjs。
 * @see docs/00/90-assets/99-2-BATTLE_UNIT_SPRITE_PIPELINE.md §5.3
 */

import battleUnitKeyDefaults from '../../public/data/shared/battle-unit-key-defaults.json';

/**
 * @param {object|null|undefined} troop
 * @param {object} [defaultsDoc] 默认整份 JSON（含 defaults）
 * @returns {string|null}
 */
export function resolveBattleUnitKey(troop, defaultsDoc = battleUnitKeyDefaults) {
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

/**
 * 在部队对象上写入解析后的 battleUnitKey（无解析结果则原样返回）。
 * @param {object|null|undefined} troop
 * @returns {object|null|undefined}
 */
export function applyBattleUnitKey(troop) {
  if (!troop || typeof troop !== 'object') return troop;
  const key = resolveBattleUnitKey(troop);
  if (!key) return troop;
  if (troop.battleUnitKey === key) return troop;
  return { ...troop, battleUnitKey: key };
}
