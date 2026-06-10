/**
 * 战术图友军落位与 DOM 战斗单位映射（御驾 / 宝物助阵共用）
 */
import { getBattleFieldTroopPortraitUrlAttempts } from '@shared/utils/troopIconUrls';
import { enrichBattleUnitWithSkillPhases } from '@shared/utils/battleSkillAssembly';

/** 玩家阵线左侧；最多 3 支友军 */
export const BATTLE_ALLY_POSITIONS = [
  { y: 8, x: 0 },
  { y: 9, x: 0 },
  { y: 7, x: 0 },
];

export const MAX_BATTLE_ALLY_UNITS = 3;

/**
 * @param {Array} allyUnits
 * @param {string} baseUrl
 * @param {number} [maxAllies]
 * @returns {Array}
 */
/**
 * @param {Array} allyUnits
 * @param {string} baseUrl
 * @param {number} [maxAllies]
 * @param {Record<string, object>|null} [skillsMap]
 * @returns {Array}
 */
export function mapAllyUnitsToBattleTroops(allyUnits, baseUrl, maxAllies = MAX_BATTLE_ALLY_UNITS, skillsMap = null) {
  return (allyUnits || []).slice(0, maxAllies).map((unit, i) => {
    const pos = BATTLE_ALLY_POSITIONS[i] || BATTLE_ALLY_POSITIONS[BATTLE_ALLY_POSITIONS.length - 1];
    const charRaw = unit.character || null;
    const charBase = charRaw
      ? {
          name: charRaw.courtesyName || charRaw.name,
          courtesyName: charRaw.courtesyName || charRaw.name,
          luck: charRaw.luck,
          courage: charRaw.courage,
          combat: charRaw.combat,
          command: charRaw.command,
          intelligence: charRaw.intelligence,
          politics: charRaw.politics,
          charm: charRaw.charm,
          trait: charRaw.trait,
          traitModifier: charRaw.traitModifier ?? charRaw.trait_modifier ?? 0,
          skill_1: charRaw.skill_1 ?? charRaw.skill1 ?? null,
          skill_2: charRaw.skill_2 ?? charRaw.skill2 ?? null,
        }
      : null;
    const { troop: enrichedTroop, character: battleChar } = enrichBattleUnitWithSkillPhases({
      troop: unit.troop,
      character: charBase,
      skillIdSource: charRaw,
      skillsMap,
    });
    const attempts = getBattleFieldTroopPortraitUrlAttempts(
      { ...enrichedTroop, faction: 'ally1' },
      baseUrl,
    );
    return {
      ...enrichedTroop,
      id: `${unit.troop.id}_a${i}`,
      faction: 'ally',
      campaignNpcForce: 'ally1',
      y: pos.y,
      x: pos.x,
      currentTroops: unit.currentTroops ?? unit.troop.maxTroops,
      initialTroops: unit.currentTroops ?? unit.troop.maxTroops,
      maxTroops: unit.maxTroops ?? unit.troop.maxTroops,
      character: battleChar,
      displayName: charRaw
        ? (charRaw.courtesyName || charRaw.name)
        : unit.troop.name,
      morale: unit.morale ?? 85,
      imgSrc: attempts[0],
      imgPortraitAttempts: attempts,
      imgFallback: attempts[attempts.length - 1],
      _npcIndex: unit._npcIndex,
      imperialMarch: !!unit.imperialMarch,
      treasureBattleAlly: !!unit.treasureBattleAlly,
    };
  });
}
