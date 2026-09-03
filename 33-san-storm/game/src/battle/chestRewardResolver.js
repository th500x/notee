/**
 * 宝箱奖励解析（手动战斗 / 自动战斗共用）
 *
 * chest_01 → 普通/稀有装备；chest_02 → 史诗/传奇装备；不含核心。
 * 仅玩家部队可开启。
 */
import { loadSharedData } from '@/services/dataService';

const CHEST_EQUIPMENT_SEASON = 'san_1';
const RARITY_LABEL_CN = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };

function lootRaritiesForChest(obj) {
  if (Array.isArray(obj?.lootRarities) && obj.lootRarities.length) {
    return obj.lootRarities.filter((r) => r && r !== 'core');
  }
  if (obj?.chestVariant === '02') return ['epic', 'legendary'];
  return ['common', 'rare'];
}

/**
 * @returns {Promise<object|null>}
 */
export async function resolveChestReward(troop, mapResult, battleTroops) {
  if (!troop || troop.currentTroops <= 0 || !mapResult) return null;
  if (troop.faction !== 'player') return null;

  const obj = mapResult.objects.find(
    (o) => o.type === 'chest' && !o.isOpen && o.y === troop.y && o.x === troop.x,
  );
  if (!obj) return null;

  const lootRarities = lootRaritiesForChest(obj);
  const equipTypes = ['weapon', 'armor', 'accessory'];
  let data;
  try {
    data = await loadSharedData('equipment');
  } catch (e) {
    console.error('[resolveChestReward] load equipment.json failed', e);
    return null;
  }

  const list = data?.equipment || [];
  const season = CHEST_EQUIPMENT_SEASON;

  const pool = list.filter(
    (e) =>
      e.id &&
      e.name &&
      (e.season || season) === season &&
      equipTypes.includes(e.equipmentType) &&
      lootRarities.includes(e.rarity),
  );
  if (pool.length === 0) return null;

  const picked = pool[Math.floor(Math.random() * pool.length)];
  const bonus = {};
  for (const b of picked.bonus || []) {
    if (b && b.key != null && b.value != null) bonus[b.key] = b.value;
  }

  obj.isOpen = true;

  return {
    kind: 'chest',
    equipmentId: picked.id,
    name: picked.name,
    rarity: picked.rarity,
    equipmentType: picked.equipmentType,
    bonus,
    specialEffect: picked.specialEffect || null,
    troopName: troop.character?.courtesyName || troop.name,
    rarityLabel: RARITY_LABEL_CN[picked.rarity] || picked.rarity,
  };
}
