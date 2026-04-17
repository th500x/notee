/**
 * 与驻地编组 `GarrisonLineup` / 编组 `LineupTab` 军营区一致的部队池；
 * 排除主城驻军所仓库（`main_city_barracks_storage`）内卡片。
 */

export const RARITY_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3, core: 4 };

export const RARITY_LABEL = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };

export function isMainCityBarracksStored(card) {
  const v = card?.main_city_barracks_storage;
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
    if (!c || c.card_type === 'equipmentSet') return false;
    if (c.is_equipped || occ.has(c.instance_id)) return false;
    if (isMainCityBarracksStored(c)) return false;
    if (c.card_type === 'equipment' && c.bound_equipment_set_instance_id) return false;
    if (c.card_type !== 'troop') return false;
    const maxBattle = c.max_battle_count ?? 10;
    const count = Math.max(0, c.battle_count ?? 0);
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
    if (!c || c.card_type !== 'troop') return false;
    if (!isMainCityBarracksStored(c)) return false;
    if (c.is_equipped || occ.has(c.instance_id)) return false;
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
    const ta = a.obtained_at ? new Date(a.obtained_at).getTime() : 0;
    const tb = b.obtained_at ? new Date(b.obtained_at).getTime() : 0;
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

export function getWarehouseTroopCardsSorted(cards, occupiedIds) {
  return sortBarracksTroopsForDisplay(filterWarehouseTroopCards(cards, occupiedIds));
}
