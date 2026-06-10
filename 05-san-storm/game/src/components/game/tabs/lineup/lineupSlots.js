/**
 * 上阵编组（`LineupTab`）槽位定义与稀有度展示常量
 *
 * 与驻地编组（`GarrisonLineup` + `GarrisonGeneralPanel`）的槽位形状**不同**：
 *   - 上阵编组玩家行额外有「官职」「装备卡」槽；将领行用第二个部队卡替代官职。
 *   - 驻地编组没有玩家行；其槽位由 `GarrisonGeneralPanel` 自行声明（不复用本文件）。
 * "相同的部分共享、相异的不混用"原则下，本文件**仅**服务上阵编组。
 *
 * 稀有度顺序与文案与 `utils/garrisonBarracksTroopPool.js` 保持一致；色彩字典两端可能略有差异
 * （上阵卡片摘要里 core 用 `text-yellow-400`，driver 抽屉里用 `text-yellow-300`），按"相异不混用"
 * 各自维护。
 */

/** 通用稀有度排序（小→大：白 < 蓝 < 紫 < 橙 < 金） */
export const RARITY_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3, core: 4 };

export const RARITY_LABEL = {
  common: '普通',
  rare: '稀有',
  epic: '史诗',
  legendary: '传奇',
  core: '核心',
};

/** 槽位摘要（EquipSlot）内的色彩 */
export const RARITY_COLOR_MINI = {
  common: 'text-gray-300',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-orange-400',
  core: 'text-yellow-400',
};

/** 装备卡 4-piece 占位（CardDrawer / CardDetailOverlay）内的色彩；core 用 yellow-300 与原代码一致 */
export const RARITY_COLOR_DETAIL = {
  common: 'text-gray-300',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-orange-400',
  core: 'text-yellow-300',
};

/** 装备卡侧栏文字色彩 */
export const RARITY_TEXT_CLASS = {
  common: 'text-white',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-orange-400',
  core: 'text-yellow-300',
};

/** 玩家槽位（左：部队 / 官职 / 装备卡 ；右：称号 / 成就 / 宝物） */
export const PLAYER_SLOTS = [
  { id: 'troop',        label: '部队',   icon: '⚔️', side: 'left',  implemented: true },
  { id: 'position',     label: '官职',   icon: '👑', side: 'left',  implemented: true },
  { id: 'equipmentSet', label: '装备卡', icon: '🛡️', side: 'left',  implemented: true },
  { id: 'title',        label: '称号',   icon: '🎖️', side: 'right', implemented: true },
  { id: 'achievement',  label: '成就',   icon: '🏆', side: 'right', implemented: true },
  { id: 'treasure',     label: '宝物',   icon: '💎', side: 'right', implemented: true },
];

/** 将领槽位（左：部队1 / 部队2 / 装备卡；右与玩家相同） */
export const GENERAL_SLOTS = [
  { id: 'troop1',       label: '部队1',  icon: '⚔️', side: 'left',  implemented: true },
  { id: 'troop2',       label: '部队2',  icon: '⚔️', side: 'left',  implemented: true },
  { id: 'equipmentSet', label: '装备卡', icon: '🛡️', side: 'left',  implemented: true },
  { id: 'title',        label: '称号',   icon: '🎖️', side: 'right', implemented: true },
  { id: 'achievement',  label: '成就',   icon: '🏆', side: 'right', implemented: true },
  { id: 'treasure',     label: '宝物',   icon: '💎', side: 'right', implemented: true },
];

import { getRerollRarityForPlayer } from '@/utils/positionRerollRarity.js';

/**
 * 玩家官职等级 → CharacterCard 渲染用稀有度。
 * 官职级别越低（1=最高）稀有度越高；大司空任职期间固定 legendary（见 positionRerollRarity.cjs）。
 */
export function getPositionRarity(level, currentPositionId = null) {
  return getRerollRarityForPlayer({ positionLevel: level, currentPositionId });
}

/** 同稀有度内保持原序，跨稀有度按 RARITY_ORDER 升序 */
export function sortCardsByRarity(cards) {
  if (!cards?.length) return [];
  return [...cards].sort(
    (a, b) =>
      (RARITY_ORDER[a.config?.rarity || a.rarity || 'common'] ?? 99) -
      (RARITY_ORDER[b.config?.rarity || b.rarity || 'common'] ?? 99)
  );
}

/**
 * 把 cards 按稀有度分组并按 RARITY_ORDER 排序，输出 `[{ rarity, cards }]`。
 * 与 `utils/garrisonBarracksTroopPool.js#groupTroopCardsByRarity` 行为一致；
 * 这里独立一份是因为上阵抽屉接受任意 card_type，不强求 troop。
 */
export function groupCardsByRarity(cards) {
  const grouped = {};
  (cards || []).forEach((card) => {
    const r = card.config?.rarity || card.rarity || 'common';
    if (!grouped[r]) grouped[r] = [];
    grouped[r].push(card);
  });
  return Object.keys(grouped)
    .sort((a, b) => (RARITY_ORDER[a] ?? 99) - (RARITY_ORDER[b] ?? 99))
    .map((r) => ({ rarity: r, cards: grouped[r] }));
}
