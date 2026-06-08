/**
 * 卡牌原始实例 → 共享卡牌组件入参格式的转换工具
 *
 * 供 LineupTab、GarrisonLineup 等需要把后端卡牌实例传给
 * CharacterCard / TroopCard / EquipmentCard / TitleAchievementCard 的场合使用。
 *
 * 命名规范：toXxxCardData(card, ...) → 转换后的 props 对象
 */

import {
  applyPhase1CoreDeltasToCharacterProps,
  buildPhase1BundleFromSkillIds,
  collectCharacterSkillIdsFromConfig,
} from '@shared/utils/skillPhase1Passive';
import { parseEchoSlots } from '@shared/utils/characterEchoCombat';
import { applyVeteranBonusToTroopCombatStats } from '@shared/utils/troopVeteranDisplay';

/**
 * 将将领卡原始实例转为 CharacterCard props
 * @param {object} card - 后端卡牌实例（含 config、card_id、morale 等）
 * @param {object} [attributeBonus={}] - 后端 attributeBonusBySlot 中对应的加成
 * @param {Record<string, object>|null} [skillsMap] - 若传入则叠阶段1被动数值（与 `battlePlayerBuilder` / `combatSystem` 同源）
 */
export function toCharCardData(card, attributeBonus = {}, skillsMap = null) {
  const cfg = card.config || {};
  let out = {
    id: cfg.id || card.cardId,
    name: cfg.name || card.cardId,
    rarity: cfg.rarity || card.rarity || 'common',
    stage: cfg.stage,
    luck: cfg.luck,
    courage: cfg.courage,
    combat: cfg.combat,
    command: cfg.command,
    intelligence: cfg.intelligence,
    politics: cfg.politics,
    charm: cfg.charm,
    troopAffinity: cfg.troopAffinity,
    trait: cfg.trait,
    traitModifier: cfg.traitModifier,
    skills: cfg.skills || [],
    bond: cfg.bond,
    biography: cfg.biography,
    description: cfg.description,
    avatar: cfg.avatar,
    morale: card.morale ?? null,
    characterEchoSlots: parseEchoSlots(card.characterEchoSlots ?? card.character_echo_slots),
    attributeBonus: attributeBonus || {},
  };
  if (skillsMap && typeof skillsMap === 'object') {
    const bundle = buildPhase1BundleFromSkillIds(collectCharacterSkillIdsFromConfig(cfg), skillsMap);
    out = applyPhase1CoreDeltasToCharacterProps(out, bundle);
  }
  return out;
}

/**
 * 将部队卡原始实例转为 TroopCard props
 * @param {object} card - 后端卡牌实例
 */
export function toTroopCardData(card) {
  const cfg = card.config || {};
  const veteranBonusPct = Number(card.veteranBonusPct) || 0;
  const combatStats = applyVeteranBonusToTroopCombatStats(
    {
      attack: cfg.attack || 0,
      defense: cfg.defense || 0,
      speed: cfg.speed,
      movement: cfg.movement,
    },
    veteranBonusPct,
  );
  return {
    id: cfg.id || card.cardId,
    name: cfg.name || card.cardId,
    rarity: cfg.rarity || card.rarity,
    troopType: cfg.troopType,
    weaponType: cfg.weaponType,
    faction: cfg.faction,
    attack: combatStats.attack,
    defense: combatStats.defense,
    speed: combatStats.speed,
    movement: combatStats.movement,
    range: cfg.range,
    maxTroops: (cfg.maxTroops || 0) + (card.bonusMaxTroops || 0),
    currentTroops: card.currentTroops,
    skills: cfg.skills || [],
    description: cfg.description,
    battleCount: card.battleCount ?? 0,
    maxBattleCount: card.maxBattleCount ?? 10,
    infantryCounter: cfg.infantryCounter,
    cavalryCounter: cfg.cavalryCounter,
    archerCounter: cfg.archerCounter,
    siegeCounter: cfg.siegeCounter,
    plainAdapt: cfg.plainAdapt,
    hillAdapt: cfg.hillAdapt,
    forestAdapt: cfg.forestAdapt,
    siegeAdapt: cfg.siegeAdapt,
    veteranTier: card.veteranTier ?? 0,
    veteranBonusPct,
    lifetimeBattleCount: card.lifetimeBattleCount ?? 0,
  };
}

/**
 * 将装备件卡原始实例转为 EquipmentCard props
 * @param {object} card - 后端卡牌实例
 */
export function toEquipCardData(card) {
  const cfg = card.config || {};
  const bonusKeys = ['luck', 'courage', 'combat', 'command', 'intelligence', 'politics', 'charm'];
  const bonus = bonusKeys
    .filter(k => cfg[`${k}Bonus`])
    .map(k => ({ key: k, value: cfg[`${k}Bonus`] }));
  return {
    id: cfg.equipmentId || card.cardId,
    name: cfg.equipmentName || card.cardId,
    rarity: cfg.rarity || card.rarity || 'common',
    equipmentType: cfg.equipmentType || 'weapon',
    bonus,
    specialEffect: cfg.specialEffect,
    specialEffectDesc: cfg.specialEffectDesc,
    description: cfg.description,
  };
}

/**
 * 将称号卡原始实例转为 TitleAchievementCard props
 * @param {object} card - 后端卡牌实例
 */
export function toTitleCardData(card) {
  const cfg = card.config || {};
  return {
    id: cfg.id || card.cardId,
    name: cfg.name || card.cardId,
    rarity: cfg.rarity || card.rarity || 'common',
    description: cfg.description,
    attributeBonus: cfg.attributeBonus || {},
    specialEffect: cfg.specialEffect,
    specialEffectDesc: cfg.specialEffectDesc,
  };
}

const CONFIG_CARD_RARITY_MAP = {
  1: 'common',
  2: 'rare',
  3: 'epic',
  4: 'legendary',
  5: 'core',
};

/** 从 config_* ID 序号首位解析稀有度（与后端 profile enrich 一致） */
export function rarityFromConfigCardId(cardId) {
  const parts = String(cardId || '').split('_');
  const seqStr = parts[parts.length - 1] || '';
  return CONFIG_CARD_RARITY_MAP[Number(seqStr.charAt(0))] || 'common';
}

/**
 * 里程碑/领取 API 返回的 grant → TitleAchievementCard 展示数据
 * @param {object} grant
 * @param {'title'|'achievement'} cardType
 */
export function buildTitleAchievementRevealFromGrant(grant, cardType) {
  const id = cardType === 'achievement' ? grant.achievementId : grant.titleId;
  const name =
    (cardType === 'achievement' ? grant.achievementName : grant.titleName) || id;
  return {
    id,
    name,
    rarity: rarityFromConfigCardId(id),
    attributeBonus: {},
    description: null,
    specialEffectDesc: null,
  };
}

/**
 * @param {object|null|undefined} grant
 * @param {object[]} cards - profile cards
 * @param {'title'|'achievement'} cardType
 */
export function resolveTitleAchievementReveal(grant, cards, cardType) {
  if (!grant) return null;
  const typeKey = cardType === 'achievement' ? 'achievement' : 'title';
  const cardId = cardType === 'achievement' ? grant.achievementId : grant.titleId;
  const instanceId = grant.instanceId;
  const matched =
    (instanceId && (cards || []).find((c) => c.instanceId === instanceId)) ||
    (cards || []).find((c) => c.cardId === cardId && c.cardType === typeKey);
  if (matched) {
    return { cardType: typeKey, item: toTitleCardData(matched) };
  }
  return { cardType: typeKey, item: buildTitleAchievementRevealFromGrant(grant, cardType) };
}
