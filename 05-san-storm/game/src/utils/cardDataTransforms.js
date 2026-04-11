/**
 * 卡牌原始实例 → 共享卡牌组件入参格式的转换工具
 *
 * 供 LineupTab、GarrisonLineup 等需要把后端卡牌实例传给
 * CharacterCard / TroopCard / EquipmentCard / TitleAchievementCard 的场合使用。
 *
 * 命名规范：toXxxCardData(card, ...) → 转换后的 props 对象
 */

/**
 * 将将领卡原始实例转为 CharacterCard props
 * @param {object} card - 后端卡牌实例（含 config、card_id、morale 等）
 * @param {object} [attributeBonus={}] - 后端 attributeBonusBySlot 中对应的加成
 */
export function toCharCardData(card, attributeBonus) {
  const cfg = card.config || {};
  return {
    id: cfg.id || card.card_id,
    name: cfg.name || card.card_id,
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
    attributeBonus: attributeBonus || {},
  };
}

/**
 * 将部队卡原始实例转为 TroopCard props
 * @param {object} card - 后端卡牌实例
 */
export function toTroopCardData(card) {
  const cfg = card.config || {};
  return {
    id: cfg.id || card.card_id,
    name: cfg.name || card.card_id,
    rarity: cfg.rarity || card.rarity,
    troopType: cfg.troopType,
    weaponType: cfg.weaponType,
    faction: cfg.faction,
    attack: cfg.attack || 0,
    defense: cfg.defense || 0,
    speed: cfg.speed,
    movement: cfg.movement,
    range: cfg.range,
    maxTroops: (cfg.maxTroops || 0) + (card.bonus_max_troops || 0),
    currentTroops: card.current_troops,
    skills: cfg.skills || [],
    description: cfg.description,
    battleCount: card.battle_count ?? 0,
    maxBattleCount: card.max_battle_count ?? 10,
    infantryCounter: cfg.infantryCounter,
    cavalryCounter: cfg.cavalryCounter,
    archerCounter: cfg.archerCounter,
    siegeCounter: cfg.siegeCounter,
    plainAdapt: cfg.plainAdapt,
    hillAdapt: cfg.hillAdapt,
    forestAdapt: cfg.forestAdapt,
    siegeAdapt: cfg.siegeAdapt,
    veteranTier: card.veteran_tier ?? 0,
    veteranBonusPct: Number(card.veteran_bonus_pct) || 0,
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
    id: cfg.equipmentId || card.card_id,
    name: cfg.equipmentName || card.card_id,
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
    id: cfg.id || card.card_id,
    name: cfg.name || card.card_id,
    rarity: cfg.rarity || card.rarity || 'common',
    description: cfg.description,
    attributeBonus: cfg.attributeBonus || {},
    specialEffect: cfg.specialEffect,
    specialEffectDesc: cfg.specialEffectDesc,
  };
}
