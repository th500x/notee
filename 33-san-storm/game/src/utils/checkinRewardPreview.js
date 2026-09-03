/**
 * 真三日报 · 28 日签到 rewards 字符串中的卡牌预览（与 rewardService.parseRewardString 子集对齐）
 */

import { fetchWithTimeout } from '@/services/httpClient';
import { API_CONFIG } from '@/constants';
import { getTreasureMaxUsesFromCardId, getInitialUsesRemaining } from '@shared/utils/treasureUses';

/** @param {string} cardId */
export function resolveCheckinCardTypeFromId(cardId) {
  const id = String(cardId || '');
  if (id.includes('_troop_')) return 'troop';
  if (id.includes('_char_')) return 'character';
  if (id.includes('_title_')) return 'title';
  if (id.includes('_achi_')) return 'achievement';
  if (id.includes('_treasure_')) return 'treasure';
  if (id.includes('_equip_')) return 'equipment';
  return null;
}

/**
 * 签到格是否含可预览的写死卡牌（不含道具/资源）
 * @param {string|null|undefined} rewardsStr
 * @returns {{ cardId: string, cardType: string }|null}
 */
export function extractCheckinCardReward(rewardsStr) {
  if (!rewardsStr || typeof rewardsStr !== 'string') return null;
  for (const part of rewardsStr.split(';')) {
    const t = part.trim();
    if (!t) continue;
    if (/^(silver|food):/i.test(t)) continue;
    if (t.includes('_item_') || t.startsWith('item_')) continue;
    if (
      t.includes('_troop_')
      || t.includes('_char_')
      || t.includes('_equip_')
      || t.includes('_title_')
      || t.includes('_achi_')
      || t.includes('_treasure_')
    ) {
      const cardId = t.split(':')[0].trim();
      const cardType = resolveCheckinCardTypeFromId(cardId);
      if (cardId && cardType) return { cardId, cardType };
    }
  }
  return null;
}

/** @param {object} treasure configService.formatTreasureData */
export function treasureConfigToEquipmentCard(treasure) {
  if (!treasure) return null;
  const maxUses = getTreasureMaxUsesFromCardId(treasure.id);
  return {
    id: treasure.id,
    name: treasure.name,
    rarity: treasure.rarity || 'common',
    equipmentType: 'treasure',
    series: treasure.series || null,
    bonus: Array.isArray(treasure.bonus) ? treasure.bonus : [],
    specialEffect: treasure.specialEffect,
    specialEffectDesc: treasure.specialEffectDesc,
    description: treasure.description,
    usesRemaining: getInitialUsesRemaining(treasure.id),
    maxUses,
  };
}

/**
 * @param {string} cardId
 * @param {string} cardType
 * @returns {Promise<{ type: string, data: object }|null>}
 */
export async function fetchCheckinCardPreview(cardId, cardType) {
  const base = API_CONFIG.BASE_URL;
  if (cardType === 'treasure') {
    const res = await fetchWithTimeout(`${base}/config/treasures/${encodeURIComponent(cardId)}`);
    const json = await res.json();
    if (!json.success || !json.treasure) return null;
    const data = treasureConfigToEquipmentCard(json.treasure);
    return data ? { type: 'treasure', data } : null;
  }
  const endpointMap = {
    troop: { path: 'troops', key: 'troop' },
    character: { path: 'characters', key: 'character' },
    equipment: { path: 'equipment', key: 'equipment' },
    title: { path: 'titles', key: 'title' },
  };
  const ep = endpointMap[cardType];
  if (!ep) return null;
  const res = await fetchWithTimeout(`${base}/config/${ep.path}/${encodeURIComponent(cardId)}`);
  const json = await res.json();
  if (!json.success) return null;
  const data = json[ep.key] || json.troop || json.character || json.equipment || json.title;
  return data ? { type: cardType, data } : null;
}
