/**
 * 从 PlayerContext 的 player + cards 数据构建战斗用的我方部队单位列表
 *
 * 提取自 EventBattle.buildPlayerUnits，供攻城战等场景复用。
 * 将领/君主 **阶段1 被动数值**、**阶段2 被动（首击免疫 / 坚韧条件减伤）**、**阶段3 主动纯治疗**、**阶段4 主动纯伤害**、**阶段5 主动复合伤害装配**（与 `shared/utils/skillPhase1Passive`、`skillPhase2Passive`、`skillPhase3ActiveHeal`、`skillPhase4ActiveDamage`、`skillPhase5CompositeDamage`、`combatSystem`、编组同源）在传入 `skillsMap` 时合并。
 */

import {
  attachPhase1CombatToCharacter,
  buildPhase1BundleFromSkillIds,
  collectCharacterSkillIdsFromConfig,
  phase1RangeBonusForTroopType,
  phase1TroopTypeDamageMult,
} from '@shared/utils/skillPhase1Passive';
import {
  attachPhase2CombatToCharacter,
  buildPhase2DefensiveConfigFromSkillIds,
} from '@shared/utils/skillPhase2Passive';
import {
  attachPhase3HealToCharacter,
  buildPhase3HealSlotsFromSkillIds,
} from '@shared/utils/skillPhase3ActiveHeal';
import {
  attachPhase4DamageToCharacter,
  buildPhase4DamageSlotsFromSkillIds,
} from '@shared/utils/skillPhase4ActiveDamage';
import {
  attachPhase5CompositeToCharacter,
  buildPhase5CompositeSlotsFromSkillIds,
} from '@shared/utils/skillPhase5CompositeDamage';
import { applyInflightTroopSnapshotToBuiltUnits } from '@/utils/inflightBattleTroopSnapshot';

function buildTroopUnit(troopCard, charData, morale, phase1Bundle) {
  const cfg = troopCard.config || {};
  const vetMult = 1 + (Number(troopCard.veteran_bonus_pct) || 0) / 100;
  const baseRange = cfg.range || 1;
  const rangeBonus = phase1Bundle ? phase1RangeBonusForTroopType(phase1Bundle, cfg.troopType) : 0;
  const dmgMult = phase1Bundle ? phase1TroopTypeDamageMult(phase1Bundle, cfg.troopType) : 1;
  return {
    troop: {
      id: cfg.id || troopCard.card_id,
      instanceId: troopCard.instance_id,
      name: cfg.name || troopCard.card_id,
      rarity: cfg.rarity || troopCard.rarity || 'common',
      troopType: cfg.troopType,
      weaponType: cfg.weaponType,
      attack: (cfg.attack || 0) * vetMult,
      defense: (cfg.defense || 0) * vetMult,
      speed: Math.round((cfg.speed || 0) * vetMult),
      movement: Math.round((cfg.movement || 0) * vetMult),
      range: Math.max(1, baseRange + rangeBonus),
      maxTroops: (cfg.maxTroops || 0) + (troopCard.bonus_max_troops || 0),
      troopWeight: cfg.troopWeight || 1,
      battleCount: troopCard.battle_count ?? 0,
      maxBattleCount: troopCard.max_battle_count ?? 25,
      skills: cfg.skills || [],
      phase1OutgoingDamageMult: dmgMult,
    },
    character: charData,
    currentTroops: troopCard.current_troops ?? ((cfg.maxTroops || 0) + (troopCard.bonus_max_troops || 0)),
    maxTroops: (cfg.maxTroops || 0) + (troopCard.bonus_max_troops || 0),
    morale: morale ?? 70,
  };
}

/**
 * @param {object} [skillsMap] skills.json 字典 id→行；缺省 `{}` 时不叠被动（兼容旧调用）
 */
export function buildPlayerUnitsFromContext(player, cards, attributeBonusBySlot = {}, skillsMap = {}) {
  if (!cards || cards.length === 0 || !player) return [];
  const units = [];
  const playerBonus = attributeBonusBySlot?.player || {};
  const char1Bonus = attributeBonusBySlot?.character1 || {};
  const char2Bonus = attributeBonusBySlot?.character2 || {};
  const withBonus = (base, bonus10) => Number(base || 0) + (Number(bonus10 || 0) / 10);

  const playerSkillIds = [player?.skill_1, player?.skill_2].filter(Boolean);
  const playerPhase1 = buildPhase1BundleFromSkillIds(playerSkillIds, skillsMap);
  const playerPhase3Slots = buildPhase3HealSlotsFromSkillIds(playerSkillIds, skillsMap);
  const playerPhase4Slots = buildPhase4DamageSlotsFromSkillIds(playerSkillIds, skillsMap);
  const playerPhase5Slots = buildPhase5CompositeSlotsFromSkillIds(playerSkillIds, skillsMap);

  // 玩家角色 + 玩家部队
  const playerTroop = cards.find(c => c.card_type === 'troop' && c.is_equipped && c.equipped_by === 'player' && c.equipped_slot === 'troop');
  if (playerTroop) {
    const charData = attachPhase5CompositeToCharacter(
      attachPhase4DamageToCharacter(
        attachPhase3HealToCharacter(
          attachPhase2CombatToCharacter(
            attachPhase1CombatToCharacter({
              name: player.character_name,
              courtesyName: player.character_name,
              combat: withBonus(player.combat / 10, playerBonus.combat),
              command: withBonus(player.command / 10, playerBonus.command),
              intelligence: withBonus(player.intelligence / 10, playerBonus.intelligence),
              luck: withBonus(player.luck / 10, playerBonus.luck),
              courage: withBonus(player.courage / 10, playerBonus.courage),
              politics: withBonus((player.politics ?? 0) / 10, playerBonus.politics),
              charm: withBonus((player.charm ?? 0) / 10, playerBonus.charm),
              traitModifier: 0,
            }, playerPhase1),
            buildPhase2DefensiveConfigFromSkillIds(playerSkillIds, skillsMap),
          ),
          playerPhase3Slots,
        ),
        playerPhase4Slots,
      ),
      playerPhase5Slots,
    );
    units.push({ ...buildTroopUnit(playerTroop, charData, player.morale ?? 70, playerPhase1), lineupSlot: 'player' });
  }

  // 将领1 + 将领1部队
  const char1Card = cards.find(c => c.card_type === 'character' && c.is_equipped && c.equipped_by === 'character1' && c.equipped_slot === 'character');
  const char1Troops = cards.filter(c => c.card_type === 'troop' && c.is_equipped && c.equipped_by === 'character1');
  if (char1Card && char1Troops.length > 0) {
    const cfg = char1Card.config || {};
    const ids1 = collectCharacterSkillIdsFromConfig(cfg);
    const p1 = buildPhase1BundleFromSkillIds(ids1, skillsMap);
    const p3slots1 = buildPhase3HealSlotsFromSkillIds(ids1, skillsMap);
    const p4slots1 = buildPhase4DamageSlotsFromSkillIds(ids1, skillsMap);
    const p5slots1 = buildPhase5CompositeSlotsFromSkillIds(ids1, skillsMap);
    const charData = attachPhase5CompositeToCharacter(
      attachPhase4DamageToCharacter(
        attachPhase3HealToCharacter(
          attachPhase2CombatToCharacter(
            attachPhase1CombatToCharacter({
              name: cfg.name || char1Card.card_id, courtesyName: cfg.name || char1Card.card_id,
              combat: withBonus(cfg.combat || 5, char1Bonus.combat),
              command: withBonus(cfg.command || 5, char1Bonus.command),
              intelligence: withBonus(cfg.intelligence || 5, char1Bonus.intelligence),
              luck: withBonus(cfg.luck || 5, char1Bonus.luck),
              courage: withBonus(cfg.courage || 5, char1Bonus.courage),
              politics: withBonus(cfg.politics || 5, char1Bonus.politics),
              charm: withBonus(cfg.charm || 5, char1Bonus.charm),
              traitModifier: cfg.traitModifier || 0,
            }, p1),
            buildPhase2DefensiveConfigFromSkillIds(ids1, skillsMap),
          ),
          p3slots1,
        ),
        p4slots1,
      ),
      p5slots1,
    );
    for (const t of char1Troops) {
      units.push({ ...buildTroopUnit(t, charData, char1Card.morale ?? 70, p1), lineupSlot: 'character1' });
    }
  }

  // 将领2 + 将领2部队
  const char2Card = cards.find(c => c.card_type === 'character' && c.is_equipped && c.equipped_by === 'character2' && c.equipped_slot === 'character');
  const char2Troops = cards.filter(c => c.card_type === 'troop' && c.is_equipped && c.equipped_by === 'character2');
  if (char2Card && char2Troops.length > 0) {
    const cfg = char2Card.config || {};
    const ids2 = collectCharacterSkillIdsFromConfig(cfg);
    const p1 = buildPhase1BundleFromSkillIds(ids2, skillsMap);
    const p3slots2 = buildPhase3HealSlotsFromSkillIds(ids2, skillsMap);
    const p4slots2 = buildPhase4DamageSlotsFromSkillIds(ids2, skillsMap);
    const p5slots2 = buildPhase5CompositeSlotsFromSkillIds(ids2, skillsMap);
    const charData = attachPhase5CompositeToCharacter(
      attachPhase4DamageToCharacter(
        attachPhase3HealToCharacter(
          attachPhase2CombatToCharacter(
            attachPhase1CombatToCharacter({
              name: cfg.name || char2Card.card_id, courtesyName: cfg.name || char2Card.card_id,
              combat: withBonus(cfg.combat || 5, char2Bonus.combat),
              command: withBonus(cfg.command || 5, char2Bonus.command),
              intelligence: withBonus(cfg.intelligence || 5, char2Bonus.intelligence),
              luck: withBonus(cfg.luck || 5, char2Bonus.luck),
              courage: withBonus(cfg.courage || 5, char2Bonus.courage),
              politics: withBonus(cfg.politics || 5, char2Bonus.politics),
              charm: withBonus(cfg.charm || 5, char2Bonus.charm),
              traitModifier: cfg.traitModifier || 0,
            }, p1),
            buildPhase2DefensiveConfigFromSkillIds(ids2, skillsMap),
          ),
          p3slots2,
        ),
        p4slots2,
      ),
      p5slots2,
    );
    for (const t of char2Troops) {
      units.push({ ...buildTroopUnit(t, charData, char2Card.morale ?? 70, p1), lineupSlot: 'character2' });
    }
  }

  // 与 `sumEquippedTroopTroopsFromCards` / 开战门闸一致：凡 `is_equipped` 的部队卡均须能进战，避免门闸算满兵力但此处为空导致战术图永不初始化
  const usedTroopIds = new Set(
    units
      .map((u) => (u.troop?.instanceId != null ? String(u.troop.instanceId) : ''))
      .filter(Boolean),
  );
  const playerCommander = attachPhase5CompositeToCharacter(
    attachPhase4DamageToCharacter(
      attachPhase3HealToCharacter(
        attachPhase2CombatToCharacter(
          attachPhase1CombatToCharacter({
            name: player.character_name,
            courtesyName: player.character_name,
            combat: withBonus(player.combat / 10, playerBonus.combat),
            command: withBonus(player.command / 10, playerBonus.command),
            intelligence: withBonus(player.intelligence / 10, playerBonus.intelligence),
            luck: withBonus(player.luck / 10, playerBonus.luck),
            courage: withBonus(player.courage / 10, playerBonus.courage),
            politics: withBonus((player.politics ?? 0) / 10, playerBonus.politics),
            charm: withBonus((player.charm ?? 0) / 10, playerBonus.charm),
            traitModifier: 0,
          }, playerPhase1),
          buildPhase2DefensiveConfigFromSkillIds(playerSkillIds, skillsMap),
        ),
        playerPhase3Slots,
      ),
      playerPhase4Slots,
    ),
    playerPhase5Slots,
  );
  for (const c of cards) {
    if (c.card_type !== 'troop' || !c.is_equipped) continue;
    const tid = c.instance_id != null ? String(c.instance_id) : '';
    if (tid && usedTroopIds.has(tid)) continue;
    if (tid) usedTroopIds.add(tid);
    units.push({
      ...buildTroopUnit(c, playerCommander, player.morale ?? 70, playerPhase1),
      lineupSlot: 'player',
    });
  }

  return applyInflightTroopSnapshotToBuiltUnits(player?.player_id ?? player?.playerId, units);
}
