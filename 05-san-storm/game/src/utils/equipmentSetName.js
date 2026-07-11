/**
 * 装备卡（套装）命名：分数档位、随机「形容词+的+名词」、显示名校验
 * @see docs/00/20-data-layer/24-2-EQUIPMENT_SET_NAMING.md
 */

import nameParts from '@/data/texts/equipmentSetNameParts.json';

const RARITY_SCORE = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  core: 5,
};

/** 单件装备件稀有度 → 分（与文档一致） */
export function scoreFromEquipmentRarity(rarity) {
  const r = rarity || 'common';
  return RARITY_SCORE[r] ?? 1;
}

/** 四件之和，理论 4～20 */
export function sumEquipmentSetScoreFromCards(cards) {
  if (!cards?.length) return 4;
  return cards.reduce((acc, c) => acc + scoreFromEquipmentRarity(c?.config?.rarity ?? c?.rarity), 0);
}

/** 总分 → 词库档位 key */
export function setRarityTierFromScore(total) {
  const t = Number(total);
  if (t <= 4) return 'common';
  if (t <= 8) return 'rare';
  if (t <= 12) return 'epic';
  if (t <= 16) return 'legendary';
  return 'core';
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * 按档位随机装备卡名（最多尝试 24 次保证 ≤12 码点；仍过长则截断）
 * @param {string} tier common|rare|epic|legendary|core
 * @param {() => number} [rng] 0～1
 */
export function rollRandomEquipmentSetName(tier, rng = Math.random) {
  const bank = nameParts[tier] || nameParts.common;
  const { adjectives, nouns } = bank;
  for (let i = 0; i < 24; i++) {
    const name = `${pick(adjectives, rng)}的${pick(nouns, rng)}`;
    if ([...name].length <= 12) return name;
  }
  const fallback = `${pick(adjectives, rng)}的${pick(nouns, rng)}`;
  return [...fallback].slice(0, 12).join('');
}

/** 完成封装：trim 后 1～12 个 Unicode 码点 */
export function validateEquipmentSetDisplayName(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return { ok: false, error: '名称不能为空' };
  const cp = [...s];
  if (cp.length > 12) return { ok: false, error: '名称须在 1～12 字以内' };
  return { ok: true, value: s };
}
