/**
 * 从 PlayerContext 的 player + cards 数据构建战斗用的我方部队单位列表
 * 
 * 提取自 EventBattle.buildPlayerUnits，供攻城战等场景复用
 */

function buildTroopUnit(troopCard, charData, morale) {
  const cfg = troopCard.config || {};
  return {
    troop: {
      id: cfg.id || troopCard.card_id,
      instanceId: troopCard.instance_id,
      name: cfg.name || troopCard.card_id,
      rarity: cfg.rarity || troopCard.rarity || 'common',
      troopType: cfg.troopType,
      weaponType: cfg.weaponType,
      attack: cfg.attack || 0,
      defense: cfg.defense || 0,
      speed: cfg.speed || 0,
      movement: cfg.movement || 0,
      range: cfg.range || 1,
      maxTroops: (cfg.maxTroops || 0) + (troopCard.bonus_max_troops || 0),
      troopWeight: cfg.troopWeight || 1,
      battleCount: troopCard.battle_count ?? 0,
      maxBattleCount: troopCard.max_battle_count ?? 25,
      skills: cfg.skills || [],
    },
    character: charData,
    currentTroops: troopCard.current_troops ?? ((cfg.maxTroops || 0) + (troopCard.bonus_max_troops || 0)),
    maxTroops: (cfg.maxTroops || 0) + (troopCard.bonus_max_troops || 0),
    morale: morale ?? 70,
  };
}

export function buildPlayerUnitsFromContext(player, cards) {
  if (!cards || cards.length === 0 || !player) return [];
  const units = [];

  // 玩家角色 + 玩家部队
  const playerTroop = cards.find(c => c.card_type === 'troop' && c.is_equipped && c.equipped_by === 'player' && c.equipped_slot === 'troop');
  if (playerTroop) {
    const charData = {
      name: player.character_name,
      courtesyName: player.character_name,
      combat: player.combat / 10, command: player.command / 10,
      intelligence: player.intelligence / 10, luck: player.luck / 10,
      courage: player.courage / 10, traitModifier: 0,
    };
    units.push(buildTroopUnit(playerTroop, charData, player.morale ?? 70));
  }

  // 将领1 + 将领1部队
  const char1Card = cards.find(c => c.card_type === 'character' && c.is_equipped && c.equipped_by === 'character1' && c.equipped_slot === 'character');
  const char1Troops = cards.filter(c => c.card_type === 'troop' && c.is_equipped && c.equipped_by === 'character1');
  if (char1Card && char1Troops.length > 0) {
    const cfg = char1Card.config || {};
    const charData = {
      name: cfg.name || char1Card.card_id, courtesyName: cfg.name || char1Card.card_id,
      combat: cfg.combat || 5, command: cfg.command || 5, intelligence: cfg.intelligence || 5,
      luck: cfg.luck || 5, courage: cfg.courage || 5, traitModifier: cfg.traitModifier || 0,
    };
    for (const t of char1Troops) units.push(buildTroopUnit(t, charData, char1Card.morale ?? 70));
  }

  // 将领2 + 将领2部队
  const char2Card = cards.find(c => c.card_type === 'character' && c.is_equipped && c.equipped_by === 'character2' && c.equipped_slot === 'character');
  const char2Troops = cards.filter(c => c.card_type === 'troop' && c.is_equipped && c.equipped_by === 'character2');
  if (char2Card && char2Troops.length > 0) {
    const cfg = char2Card.config || {};
    const charData = {
      name: cfg.name || char2Card.card_id, courtesyName: cfg.name || char2Card.card_id,
      combat: cfg.combat || 5, command: cfg.command || 5, intelligence: cfg.intelligence || 5,
      luck: cfg.luck || 5, courage: cfg.courage || 5, traitModifier: cfg.traitModifier || 0,
    };
    for (const t of char2Troops) units.push(buildTroopUnit(t, charData, char2Card.morale ?? 70));
  }

  return units;
}
