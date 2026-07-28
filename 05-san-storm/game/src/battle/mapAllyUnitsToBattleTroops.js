/**
 * 战术图友军落位与 DOM 战斗单位映射（御驾 / 宝物助阵共用）
 */
import { getBattleFieldTroopPortraitUrlAttempts } from '@shared/utils/troopIconUrls';
import { enrichBattleUnitWithSkillPhases } from '@shared/utils/battleSkillAssembly';
import { resolveBattleUnitKey } from '@shared/utils/battleUnitKeyResolve.js';
import { snapDeployPositions } from '@shared/utils/tacticalDeploySnap.js';

/** 玩家阵线左侧；最多 3 支友军（首选；有地图时再吸附避河） */
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
 * @param {Record<string, object>|null} [skillsMap]
 * @param {{ mapResult?: object, occupied?: Set<string> }} [placeOpts] 有 mapResult 时避河吸附
 * @returns {Array}
 */
export function mapAllyUnitsToBattleTroops(
  allyUnits,
  baseUrl,
  maxAllies = MAX_BATTLE_ALLY_UNITS,
  skillsMap = null,
  placeOpts = {},
) {
  const list = (allyUnits || []).slice(0, maxAllies);
  if (!list.length) return [];

  const preferred = list.map(
    (_, i) => BATTLE_ALLY_POSITIONS[i] || BATTLE_ALLY_POSITIONS[BATTLE_ALLY_POSITIONS.length - 1],
  );
  const positions = placeOpts.mapResult?.terrain
    ? snapDeployPositions(preferred, placeOpts.mapResult, {
        label: 'ally',
        occupied: placeOpts.occupied,
      })
    : preferred;

  return list.map((unit, i) => {
    const pos = positions[i] || preferred[i];
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
    const battleUnitKey = resolveBattleUnitKey(enrichedTroop);
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
      ...(battleUnitKey ? { battleUnitKey } : {}),
      _npcIndex: unit._npcIndex,
      imperialMarch: !!unit.imperialMarch,
      treasureBattleAlly: !!unit.treasureBattleAlly,
    };
  });
}
