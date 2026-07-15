/**
 * 与驻地编组 `GarrisonLineup` / 编组 `LineupTab` 军营区一致的部队池；
 * 排除主城驻军所仓库（`main_city_barracks_storage`）内卡片。
 */

export const RARITY_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3, core: 4 };

export const RARITY_LABEL = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };

export function isMainCityBarracksStored(card) {
  const v = card?.mainCityBarracksStorage;
  return v === 1 || v === true || String(v) === '1';
}

/**
 * @param {object[]} cards
 * @param {Set<string>|Iterable<string>} occupiedIds
 * @returns {object[]}
 */
export function filterBarracksTroopCards(cards, occupiedIds) {
  const occ = occupiedIds instanceof Set ? occupiedIds : new Set(occupiedIds || []);
  return (cards || []).filter((c) => {
    if (!c || c.cardType === 'equipmentSet') return false;
    if (c.isEquipped || occ.has(c.instanceId)) return false;
    if (isMainCityBarracksStored(c)) return false;
    if (c.cardType === 'equipment' && c.boundEquipmentSetInstanceId) return false;
    if (c.cardType !== 'troop') return false;
    const maxBattle = c.maxBattleCount ?? 10;
    const count = Math.max(0, c.battleCount ?? 0);
    return count < maxBattle || c.rarity === 'legendary';
  });
}

/**
 * 主城驻军所仓库内的部队卡（仍须未上阵、未在驻地槽）
 * @param {object[]} cards
 * @param {Set<string>|Iterable<string>} occupiedIds
 */
export function filterWarehouseTroopCards(cards, occupiedIds) {
  const occ = occupiedIds instanceof Set ? occupiedIds : new Set(occupiedIds || []);
  return (cards || []).filter((c) => {
    if (!c || c.cardType !== 'troop') return false;
    if (!isMainCityBarracksStored(c)) return false;
    if (c.isEquipped || occ.has(c.instanceId)) return false;
    return true;
  });
}

/**
 * @param {object[]} troopCards
 * @returns {object[]}
 */
/** 与 profile 中将领卡一致：同稀有度分组内按获得时间 */
export function sortBarracksTroopsForDisplay(troopCards) {
  const sorted = [...(troopCards || [])];
  sorted.sort((a, b) => {
    const ra = RARITY_ORDER[a.config?.rarity || a.rarity || 'common'] ?? 99;
    const rb = RARITY_ORDER[b.config?.rarity || b.rarity || 'common'] ?? 99;
    if (ra !== rb) return ra - rb;
    const ta = a.obtainedAt ? new Date(a.obtainedAt).getTime() : 0;
    const tb = b.obtainedAt ? new Date(b.obtainedAt).getTime() : 0;
    return ta - tb;
  });
  return sorted;
}

export function groupTroopCardsByRarity(troopCards) {
  const grouped = {};
  (troopCards || []).forEach((card) => {
    const r = card.config?.rarity || card.rarity || 'common';
    if (!grouped[r]) grouped[r] = [];
    grouped[r].push(card);
  });
  return Object.keys(grouped)
    .sort((a, b) => (RARITY_ORDER[a] ?? 99) - (RARITY_ORDER[b] ?? 99))
    .map((r) => ({ rarity: r, cards: grouped[r] }));
}

/**
 * @param {object[]} cards
 * @param {Set<string>} occupiedIds
 * @returns {object[]}
 */
export function getBarracksTroopCardsSorted(cards, occupiedIds) {
  return sortBarracksTroopsForDisplay(filterBarracksTroopCards(cards, occupiedIds));
}

export function filterBarracksCharacterCards(cards, occupiedIds) {
  const occ = occupiedIds instanceof Set ? occupiedIds : new Set(occupiedIds || []);
  return (cards || []).filter((c) => {
    if (!c || c.cardType !== 'character') return false;
    if (c.isEquipped || occ.has(c.instanceId)) return false;
    if (isMainCityBarracksStored(c)) return false;
    return true;
  });
}

export function getBarracksCharacterCardsSorted(cards, occupiedIds) {
  return sortBarracksTroopsForDisplay(filterBarracksCharacterCards(cards, occupiedIds));
}

export function getWarehouseTroopCardsSorted(cards, occupiedIds) {
  return sortBarracksTroopsForDisplay(filterWarehouseTroopCards(cards, occupiedIds));
}
