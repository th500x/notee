/**
 * 从 PlayerContext 的 player + cards 数据构建战斗用的我方部队单位列表
 *
 * 将领/君主技能阶段 1～5 经 `@shared/utils/battleSkillAssembly` 与 PVE 敌/NPC/守军同源。
 */

import {
  enrichCharacterWithSkillPhases,
  resolveBattleSkillIds,
} from '@shared/utils/battleSkillAssembly';
import {
  phase1RangeBonusForTroopType,
  phase1TroopTypeDamageMult,
  buildPhase1BundleFromSkillIds,
} from '@shared/utils/skillPhase1Passive';
import { applyInflightTroopSnapshotToBuiltUnits } from '@/utils/inflightBattleTroopSnapshot';
import {
  attachPositionCombatBonuses,
  getPositionCombatBonusesFromPlayer,
} from '@/utils/positionCombatBonuses';
import { attachTroopAffinityToCharacter } from '@/utils/troopAffinityCombat';

function buildTroopUnit(troopCard, charData, morale, phase1Bundle) {
  const cfg = troopCard.config || {};
  const vetMult = 1 + (Number(troopCard.veteranBonusPct) || 0) / 100;
  const baseRange = cfg.range || 1;
  const rangeBonus = phase1Bundle ? phase1RangeBonusForTroopType(phase1Bundle, cfg.troopType) : 0;
  const dmgMult = phase1Bundle ? phase1TroopTypeDamageMult(phase1Bundle, cfg.troopType) : 1;
  const bonusMax = Math.max(0, Math.round(Number(troopCard.bonusMaxTroops) || 0));
  const baseMax = Math.max(0, Math.round(Number(cfg.maxTroops ?? cfg.max_troops) || 0));
  const maxTroops = baseMax + bonusMax;
  return {
    troop: {
      id: cfg.id || troopCard.cardId,
      instanceId: troopCard.instanceId,
      name: cfg.name || troopCard.cardId,
      rarity: cfg.rarity || troopCard.rarity || 'common',
      troopType: cfg.troopType,
      weaponType: cfg.weaponType,
      attack: (cfg.attack || 0) * vetMult,
      defense: (cfg.defense || 0) * vetMult,
      speed: Math.round((cfg.speed || 0) * vetMult),
      movement: Math.round((cfg.movement || 0) * vetMult),
      range: Math.max(1, baseRange + rangeBonus),
      maxTroops,
      troopWeight: cfg.troopWeight || 1,
      battleCount: troopCard.battleCount ?? 0,
      maxBattleCount: troopCard.maxBattleCount ?? 25,
      skills: cfg.skills || [],
      phase1OutgoingDamageMult: dmgMult,
      infantryCounter: cfg.infantryCounter ?? 1,
      cavalryCounter: cfg.cavalryCounter ?? 1,
      archerCounter: cfg.archerCounter ?? 1,
      siegeCounter: cfg.siegeCounter ?? 1,
      plainAdapt: cfg.plainAdapt ?? 1,
      hillAdapt: cfg.hillAdapt ?? 1,
      forestAdapt: cfg.forestAdapt ?? 1,
      siegeAdapt: cfg.siegeAdapt ?? 1,
    },
    character: charData,
    bonus_max_troops: bonusMax,
    currentTroops: troopCard.currentTroops ?? maxTroops,
    maxTroops,
    morale: morale ?? 70,
  };
}

function buildCommanderCharData(base, skillsMap, skillIdSource) {
  const { character, phase1Bundle } = enrichCharacterWithSkillPhases(base, skillIdSource, skillsMap);
  return { character, phase1Bundle };
}

/**
 * @param {object} [skillsMap] skills.json 字典 id→行；缺省 `{}` 时不叠被动（兼容旧调用）
 */
export function buildPlayerUnitsFromContext(player, cards, attributeBonusBySlot = {}, skillsMap = {}) {
  if (!cards || cards.length === 0 || !player) return [];
  const units = [];
  const posCombatBonuses = getPositionCombatBonusesFromPlayer(player);
  const withCombatCharacter = (charData, troopAffinity) => {
    let c = charData;
    if (posCombatBonuses) c = attachPositionCombatBonuses(c, posCombatBonuses);
    if (troopAffinity) c = attachTroopAffinityToCharacter(c, troopAffinity);
    return c;
  };
  const playerBonus = attributeBonusBySlot?.player || {};
  const char1Bonus = attributeBonusBySlot?.character1 || {};
  const char2Bonus = attributeBonusBySlot?.character2 || {};
  const withBonus = (base, bonus10) => Number(base || 0) + (Number(bonus10 || 0) / 10);

  const playerSkillIds = resolveBattleSkillIds([player?.skill1, player?.skill2].filter(Boolean));
  const playerPhase1 = buildPhase1BundleFromSkillIds(playerSkillIds, skillsMap);

  const playerTroop = cards.find(c => c.cardType === 'troop' && c.isEquipped && c.equippedBy === 'player' && c.equippedSlot === 'troop');
  if (playerTroop) {
    const { character: charData, phase1Bundle } = buildCommanderCharData({
      name: player.characterName,
      courtesyName: player.characterName,
      combat: withBonus(player.combat / 10, playerBonus.combat),
      command: withBonus(player.command / 10, playerBonus.command),
      intelligence: withBonus(player.intelligence / 10, playerBonus.intelligence),
      luck: withBonus(player.luck / 10, playerBonus.luck),
      courage: withBonus(player.courage / 10, playerBonus.courage),
      politics: withBonus((player.politics ?? 0) / 10, playerBonus.politics),
      charm: withBonus((player.charm ?? 0) / 10, playerBonus.charm),
      traitModifier: 0,
    }, skillsMap, playerSkillIds);
    units.push({
      ...buildTroopUnit(playerTroop, withCombatCharacter(charData, player.troopAffinity), player.morale ?? 70, phase1Bundle ?? playerPhase1),
      lineupSlot: 'player',
    });
  }

  const char1Card = cards.find(c => c.cardType === 'character' && c.isEquipped && c.equippedBy === 'character1' && c.equippedSlot === 'character');
  const char1Troops = cards.filter(c => c.cardType === 'troop' && c.isEquipped && c.equippedBy === 'character1');
  if (char1Card && char1Troops.length > 0) {
    const cfg = char1Card.config || {};
    const { character: charData, phase1Bundle } = buildCommanderCharData({
      name: cfg.name || char1Card.cardId, courtesyName: cfg.name || char1Card.cardId,
      combat: withBonus(cfg.combat || 5, char1Bonus.combat),
      command: withBonus(cfg.command || 5, char1Bonus.command),
      intelligence: withBonus(cfg.intelligence || 5, char1Bonus.intelligence),
      luck: withBonus(cfg.luck || 5, char1Bonus.luck),
      courage: withBonus(cfg.courage || 5, char1Bonus.courage),
      politics: withBonus(cfg.politics || 5, char1Bonus.politics),
      charm: withBonus(cfg.charm || 5, char1Bonus.charm),
      traitModifier: cfg.traitModifier || 0,
    }, skillsMap, cfg);
    for (const t of char1Troops) {
      units.push({
        ...buildTroopUnit(t, withCombatCharacter(charData, cfg.troopAffinity), char1Card.morale ?? 70, phase1Bundle),
        lineupSlot: 'character1',
      });
    }
  }

  const char2Card = cards.find(c => c.cardType === 'character' && c.isEquipped && c.equippedBy === 'character2' && c.equippedSlot === 'character');
  const char2Troops = cards.filter(c => c.cardType === 'troop' && c.isEquipped && c.equippedBy === 'character2');
  if (char2Card && char2Troops.length > 0) {
    const cfg = char2Card.config || {};
    const { character: charData, phase1Bundle } = buildCommanderCharData({
      name: cfg.name || char2Card.cardId, courtesyName: cfg.name || char2Card.cardId,
      combat: withBonus(cfg.combat || 5, char2Bonus.combat),
      command: withBonus(cfg.command || 5, char2Bonus.command),
      intelligence: withBonus(cfg.intelligence || 5, char2Bonus.intelligence),
      luck: withBonus(cfg.luck || 5, char2Bonus.luck),
      courage: withBonus(cfg.courage || 5, char2Bonus.courage),
      politics: withBonus(cfg.politics || 5, char2Bonus.politics),
      charm: withBonus(cfg.charm || 5, char2Bonus.charm),
      traitModifier: cfg.traitModifier || 0,
    }, skillsMap, cfg);
    for (const t of char2Troops) {
      units.push({
        ...buildTroopUnit(t, withCombatCharacter(charData, cfg.troopAffinity), char2Card.morale ?? 70, phase1Bundle),
        lineupSlot: 'character2',
      });
    }
  }

  const usedTroopIds = new Set(
    units
      .map((u) => (u.troop?.instanceId != null ? String(u.troop.instanceId) : ''))
      .filter(Boolean),
  );
  const { character: playerCommander, phase1Bundle: commanderPhase1 } = buildCommanderCharData({
    name: player.characterName,
    courtesyName: player.characterName,
    combat: withBonus(player.combat / 10, playerBonus.combat),
    command: withBonus(player.command / 10, playerBonus.command),
    intelligence: withBonus(player.intelligence / 10, playerBonus.intelligence),
    luck: withBonus(player.luck / 10, playerBonus.luck),
    courage: withBonus(player.courage / 10, playerBonus.courage),
    politics: withBonus((player.politics ?? 0) / 10, playerBonus.politics),
    charm: withBonus((player.charm ?? 0) / 10, playerBonus.charm),
    traitModifier: 0,
  }, skillsMap, playerSkillIds);
  for (const c of cards) {
    if (c.cardType !== 'troop' || !c.isEquipped) continue;
    const tid = c.instanceId != null ? String(c.instanceId) : '';
    if (tid && usedTroopIds.has(tid)) continue;
    if (tid) usedTroopIds.add(tid);
    units.push({
      ...buildTroopUnit(c, withCombatCharacter(playerCommander, player.troopAffinity), player.morale ?? 70, commanderPhase1 ?? playerPhase1),
      lineupSlot: 'player',
    });
  }

  return applyInflightTroopSnapshotToBuiltUnits(player?.playerId, units);
}
