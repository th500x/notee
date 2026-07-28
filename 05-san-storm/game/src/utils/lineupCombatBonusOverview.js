/**
 * 上阵编组「加成一览」数据汇总（纯展示，不改玩法）。
 * 兵力/平加口径对齐 `cardTroopSpecialEffect`；兵种%对齐 `positionCombatBonuses`。
 */

import {
  parseCardTroopSpecialEffectFromConfigValue,
} from '@shared/utils/cardTroopSpecialEffect.js';
import { normalizePositionCombatBonuses } from '@/utils/positionCombatBonuses';
import { parseBattleTreasureAllySpec } from '@shared/utils/battleTreasureAllyEffect.js';
import { parseTroopAffinityString } from '@/utils/troopAffinityCombat';

const ATTR_LABELS = {
  courage: '勇',
  combat: '武',
  command: '统',
  intelligence: '智',
  politics: '政',
  charm: '魅',
  luck: '运',
};

const TROOP_FLAT_LABELS = {
  bonus_max_troops: '兵力上限',
  bonus_attack: '攻击',
  bonus_defense: '防御',
  bonus_speed: '速度',
  bonus_movement: '移动',
};

const SOURCE_LABELS = {
  title: '称号',
  achievement: '成就',
  treasure: '宝物',
  faction: '势力',
  position: '官职',
};

/**
 * @param {object|null|undefined} card
 * @returns {string}
 */
function cardDisplayName(card) {
  const cfg = card?.config || {};
  return cfg.name || cfg.displayName || card?.cardId || '未命名';
}

/**
 * @param {object|null|undefined} card
 * @returns {string|null}
 */
function cardSpecialEffectRaw(card) {
  const cfg = card?.config || {};
  return cfg.specialEffect ?? cfg.special_effect ?? null;
}

/**
 * @param {{ title?: object|null, achievement?: object|null, treasure?: object|null }} effectCards
 */
function collectHangerTroopFlatSources(effectCards = {}) {
  /** @type {Array<{ sourceType: string, sourceName: string, field: string, label: string, value: number }>} */
  const rows = [];
  for (const sourceType of ['title', 'achievement', 'treasure']) {
    const card = effectCards[sourceType];
    if (!card) continue;
    const parsed = parseCardTroopSpecialEffectFromConfigValue(cardSpecialEffectRaw(card));
    for (const [field, value] of Object.entries(parsed)) {
      const n = Number(value) || 0;
      if (n === 0) continue;
      rows.push({
        sourceType,
        sourceName: cardDisplayName(card),
        field,
        label: TROOP_FLAT_LABELS[field] || field,
        value: n,
      });
    }
  }
  return rows;
}

/**
 * @param {object|null|undefined} attributeBonus
 */
function collectAttributeRows(attributeBonus) {
  if (!attributeBonus || typeof attributeBonus !== 'object') return [];
  const rows = [];
  for (const [key, label] of Object.entries(ATTR_LABELS)) {
    const raw = Number(attributeBonus[key] || 0);
    if (!raw) continue;
    rows.push({ key, label, value: raw / 10 });
  }
  return rows;
}

/**
 * @param {object|null|undefined} effectCards
 */
function collectSpecialEffectNotes(effectCards = {}) {
  /** @type {Array<{ sourceType: string, sourceName: string, text: string }>} */
  const notes = [];
  for (const sourceType of ['title', 'achievement', 'treasure']) {
    const card = effectCards[sourceType];
    if (!card) continue;
    const cfg = card.config || {};
    const desc = cfg.specialEffectDesc || cfg.special_effect_desc || null;
    const raw = cardSpecialEffectRaw(card);
    const ally = parseBattleTreasureAllySpec(raw);
    if (ally) {
      const rarityLabel = ally.charRarity === 'epic' ? '史诗' : '传奇';
      notes.push({
        sourceType,
        sourceName: cardDisplayName(card),
        text: `战斗助阵：随机 ${rarityLabel} 将 + ${ally.troopCount} 支${rarityLabel}部队`,
      });
      continue;
    }
    // 已进「兵力/平加」分解的不再重复贴特效文案
    const troopFlat = parseCardTroopSpecialEffectFromConfigValue(raw);
    if (Object.keys(troopFlat).length > 0) continue;
    if (desc) {
      notes.push({
        sourceType,
        sourceName: cardDisplayName(card),
        text: String(desc),
      });
    }
  }
  return notes;
}

const TROOP_TYPE_ROWS = [
  { key: 'infantry', label: '步兵', posKey: 'infantryBonus', affKey: 'infantry' },
  { key: 'cavalry', label: '骑兵', posKey: 'cavalryBonus', affKey: 'cavalry' },
  { key: 'archer', label: '弓兵', posKey: 'archerBonus', affKey: 'archer' },
];

/**
 * 官职兵种% + 将领适性% 相加展示（UI 汇总；战斗内仍各自乘算）。
 * @param {object|null} positionBonuses
 * @param {string|null|undefined} troopAffinityRaw
 * @param {string|null|undefined} positionName
 */
function buildMergedTroopTypeBonuses(positionBonuses, troopAffinityRaw, positionName) {
  const affinities = parseTroopAffinityString(
    typeof troopAffinityRaw === 'string' ? troopAffinityRaw : '',
  );
  const hasAffinity = TROOP_TYPE_ROWS.some((r) => (Number(affinities[r.affKey]) || 0) > 0);
  const hasPosition = !!(
    positionBonuses &&
    TROOP_TYPE_ROWS.some((r) => (Number(positionBonuses[r.posKey]) || 0) > 0)
  );

  const rows = TROOP_TYPE_ROWS.map((r) => {
    const pos = Number(positionBonuses?.[r.posKey]) || 0;
    const aff = Number(affinities[r.affKey]) || 0;
    const value = pos + aff;
    if (value <= 0) return null;
    return { key: r.key, label: r.label, value };
  }).filter(Boolean);

  /** @type {string[]} */
  const titleParts = [];
  if (hasAffinity) titleParts.push('将领特性');
  if (hasPosition) titleParts.push(positionName || '官职');

  return {
    titleParts,
    rows,
    hasAnySource: hasAffinity || hasPosition,
  };
}

/**
 * @param {object} opts
 * @param {object[]} [opts.troops]
 * @param {{ title?: object|null, achievement?: object|null, treasure?: object|null }} [opts.effectCards]
 * @param {object|null} [opts.positionConfig]
 * @param {boolean} [opts.includePositionBonuses]
 * @param {string|null} [opts.troopAffinity]
 * @param {object|null} [opts.attributeBonus]
 */
export function buildLineupCombatBonusOverview({
  troops = [],
  effectCards = {},
  positionConfig = null,
  includePositionBonuses = false,
  troopAffinity = null,
  attributeBonus = null,
} = {}) {
  const hangerRows = collectHangerTroopFlatSources(effectCards);
  const cardMaxSum = hangerRows
    .filter((r) => r.field === 'bonus_max_troops')
    .reduce((s, r) => s + r.value, 0);

  const appliedMaxBonus = Math.max(
    0,
    ...troops.map((t) => Number(t?.bonusMaxTroops || t?.bonus_max_troops || 0) || 0),
  );
  const factionMax = Math.max(0, appliedMaxBonus - cardMaxSum);

  /** @type {Array<{ sourceType: string, sourceName: string, value: number }>} */
  const maxTroopsBreakdown = hangerRows
    .filter((r) => r.field === 'bonus_max_troops')
    .map((r) => ({
      sourceType: r.sourceType,
      sourceName: r.sourceName,
      value: r.value,
    }));
  if (factionMax > 0) {
    maxTroopsBreakdown.push({
      sourceType: 'faction',
      sourceName: '势力加成',
      value: factionMax,
    });
  }

  const troopFlatOther = ['bonus_attack', 'bonus_defense', 'bonus_speed', 'bonus_movement']
    .map((field) => {
      const parts = hangerRows.filter((r) => r.field === field);
      const total = parts.reduce((s, r) => s + r.value, 0);
      if (total === 0) return null;
      return {
        field,
        label: TROOP_FLAT_LABELS[field],
        total,
        parts: parts.map((r) => ({
          sourceType: r.sourceType,
          sourceName: r.sourceName,
          value: r.value,
        })),
      };
    })
    .filter(Boolean);

  const positionBonuses = includePositionBonuses
    ? normalizePositionCombatBonuses(
        positionConfig?.positionBonuses || positionConfig?.position_bonuses || null,
      )
    : null;
  const positionName = includePositionBonuses
    ? (positionConfig?.name || positionConfig?.positionName || null)
    : null;

  const troopTypeBonuses = buildMergedTroopTypeBonuses(
    positionBonuses,
    troopAffinity,
    positionName,
  );

  const troopCaps = troops.map((card) => {
    const cfg = card.config || {};
    const base = Number(cfg.maxTroops || cfg.max_troops || 0) || 0;
    const bonus = Number(card.bonusMaxTroops || card.bonus_max_troops || 0) || 0;
    return {
      name: cfg.name || cfg.displayName || card.cardId || '部队',
      base,
      bonus,
      total: base + bonus,
    };
  });

  return {
    sourceLabels: SOURCE_LABELS,
    maxTroops: {
      breakdown: maxTroopsBreakdown,
      totalBonus: maxTroopsBreakdown.reduce((s, r) => s + r.value, 0),
      troopCaps,
    },
    troopFlat: troopFlatOther,
    troopTypeBonuses,
    attributes: collectAttributeRows(attributeBonus),
    specialNotes: collectSpecialEffectNotes(effectCards),
  };
}

export { ATTR_LABELS, SOURCE_LABELS, TROOP_FLAT_LABELS };
