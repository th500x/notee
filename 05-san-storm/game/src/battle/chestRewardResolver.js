/**
 * 宝箱奖励解析（手动战斗 / 自动战斗共用）
 *
 * 从 equipment.json 按赛季 + 稀有度抽取装备件，
 * 与 backend/routes/battles.js insertChestEquipmentFromReward 的入库逻辑一致。
 */
import { loadSharedData } from '@/services/dataService';

const CHEST_EQUIPMENT_SEASON = 'san_1';
const RARITY_LABEL_CN = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };

/**
 * 检查部队脚下是否有未开启宝箱，若有则抽取装备奖励并标记 isOpen。
 * @returns {Promise<object|null>} reward 对象，null 表示无宝箱或无匹配装备
 */
export async function resolveChestReward(troop, mapResult, battleTroops) {
  if (!troop || troop.currentTroops <= 0 || !mapResult) return null;
  const obj = mapResult.objects.find(
    (o) => o.type === 'chest' && !o.isOpen && o.y === troop.y && o.x === troop.x,
  );
  if (!obj) return null;

  const enemyRarities = battleTroops.filter((t) => t.faction === 'enemy' && t.rarity).map((t) => t.rarity);
  const rarityPriority = ['core', 'legendary', 'epic', 'rare', 'common'];
  const bestRarity = rarityPriority.find((r) => enemyRarities.includes(r)) || 'common';

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

  const typesWithPool = equipTypes.filter((type) =>
    list.some(
      (e) => e.id && e.name && (e.season || season) === season && e.equipmentType === type && e.rarity === bestRarity,
    ),
  );
  if (typesWithPool.length === 0) return null;

  const randomType = typesWithPool[Math.floor(Math.random() * typesWithPool.length)];
  const pool = list.filter(
    (e) => e.id && e.name && (e.season || season) === season && e.equipmentType === randomType && e.rarity === bestRarity,
  );
  if (pool.length === 0) return null;

  const picked = pool[Math.floor(Math.random() * pool.length)];
  const bonus = {};
  for (const b of picked.bonus || []) {
    if (b && b.key != null && b.value != null) bonus[b.key] = b.value;
  }

  obj.isOpen = true;

  return {
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
