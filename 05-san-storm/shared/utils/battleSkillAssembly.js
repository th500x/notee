/**
 * 战术战斗 · 将领技能阶段 1～5 统一装配（玩家 / PVE 敌 / 关卡 NPC / 攻城守军同源）。
 *
 * 与 `battlePlayerBuilder`、`useBattleMap.assignRealBattleTroops`、`buildLargeMapBattleTroopsFromSim`、
 * `buildSiegeUnits` 共用；禁止在各入口复制 attachPhase* 链。
 *
 * @see docs/00/20-data-layer/23-1-SKILL_SYSTEM.md §6
 */

import {
  attachPhase1CombatToCharacter,
  buildPhase1BundleFromSkillIds,
  collectCharacterSkillIdsFromConfig,
  phase1RangeBonusForTroopType,
  phase1TroopTypeDamageMult,
} from './skillPhase1Passive.js';
import {
  attachPhase2CombatToCharacter,
  buildPhase2DefensiveConfigFromSkillIds,
} from './skillPhase2Passive.js';
import {
  attachPhase3HealToCharacter,
  buildPhase3HealSlotsFromSkillIds,
} from './skillPhase3ActiveHeal.js';
import {
  attachPhase4DamageToCharacter,
  buildPhase4DamageSlotsFromSkillIds,
} from './skillPhase4ActiveDamage.js';
import {
  attachPhase5CompositeToCharacter,
  buildPhase5CompositeSlotsFromSkillIds,
} from './skillPhase5CompositeDamage.js';

/**
 * @param {object|string[]|null|undefined} source 配置行（含 skill_1/skill_2/skills）或技能 id 数组
 * @returns {string[]}
 */
export function resolveBattleSkillIds(source) {
  if (Array.isArray(source)) {
    return source.filter((id) => typeof id === 'string' && id);
  }
  return collectCharacterSkillIdsFromConfig(source);
}

/**
 * @param {object|null|undefined} charData 战斗用将领对象（0–10 量纲）
 * @param {object|string[]|null|undefined} skillIdSource
 * @param {Record<string, object>|null|undefined} skillsMap skills.json 字典
 * @returns {{ character: object|null|undefined, phase1Bundle: object|null, skillIds: string[] }}
 */
export function enrichCharacterWithSkillPhases(charData, skillIdSource, skillsMap) {
  if (!charData) {
    return { character: charData, phase1Bundle: null, skillIds: [] };
  }
  const skillIds = resolveBattleSkillIds(skillIdSource);
  if (!skillsMap || !Object.keys(skillsMap).length || !skillIds.length) {
    return { character: charData, phase1Bundle: null, skillIds };
  }

  const phase1Bundle = buildPhase1BundleFromSkillIds(skillIds, skillsMap);
  const character = attachPhase5CompositeToCharacter(
    attachPhase4DamageToCharacter(
      attachPhase3HealToCharacter(
        attachPhase2CombatToCharacter(
          attachPhase1CombatToCharacter(charData, phase1Bundle),
          buildPhase2DefensiveConfigFromSkillIds(skillIds, skillsMap),
        ),
        buildPhase3HealSlotsFromSkillIds(skillIds, skillsMap),
      ),
      buildPhase4DamageSlotsFromSkillIds(skillIds, skillsMap),
    ),
    buildPhase5CompositeSlotsFromSkillIds(skillIds, skillsMap),
  );

  return { character, phase1Bundle, skillIds };
}

/**
 * 阶段1 被动：部队射程与出站伤害乘子（与 `battlePlayerBuilder.buildTroopUnit` 一致）。
 *
 * @param {object|null|undefined} troop
 * @param {object|null|undefined} phase1Bundle
 * @returns {object|null|undefined}
 */
export function applyPhase1BundleToTroopObject(troop, phase1Bundle) {
  if (!troop || !phase1Bundle) return troop;
  const troopType = troop.troopType;
  const baseRange = troop.range ?? 1;
  const rangeBonus = phase1RangeBonusForTroopType(phase1Bundle, troopType);
  const dmgMult = phase1TroopTypeDamageMult(phase1Bundle, troopType);
  return {
    ...troop,
    range: Math.max(1, baseRange + rangeBonus),
    phase1OutgoingDamageMult: dmgMult,
  };
}

/**
 * @param {object} opts
 * @param {object} opts.troop 部队战斗字段（含 troopType、range 等）
 * @param {object|null|undefined} opts.character 将领战斗字段
 * @param {object|string[]|null|undefined} opts.skillIdSource
 * @param {Record<string, object>|null|undefined} opts.skillsMap
 * @returns {{ troop: object, character: object|null|undefined, phase1Bundle: object|null }}
 */
export function enrichBattleUnitWithSkillPhases({
  troop,
  character,
  skillIdSource,
  skillsMap,
}) {
  if (!character) {
    return { troop, character, phase1Bundle: null };
  }
  const { character: enrichedChar, phase1Bundle } = enrichCharacterWithSkillPhases(
    character,
    skillIdSource,
    skillsMap,
  );
  const enrichedTroop = applyPhase1BundleToTroopObject(troop, phase1Bundle);
  return {
    troop: enrichedTroop,
    character: enrichedChar,
    phase1Bundle,
  };
}
