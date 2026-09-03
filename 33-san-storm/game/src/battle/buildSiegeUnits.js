/**
 * 攻城/驻守战：将 playerUnits + enemyUnits（来自驻守 NPC）组装为战术部队数组。
 * 适用于 pve_siege / pvp_siege 等预置敌方阵容的场景（非随机 eventRarity 模式）。
 *
 * 角色属性原始值为 0–100 尺度（来自 DB），÷10 转为游戏内 0–10 尺度，与 characters.json 一致。
 */
import { getBattleFieldTroopPortraitUrlAttempts } from '@shared/utils/troopIconUrls';
import { initialMoraleFromCharacter } from '@/utils/npcMorale';
import { initBattlePhase2Runtime } from '@shared/utils/skillPhase2Passive';
import { initBattlePhase3HealRuntime } from '@shared/utils/skillPhase3ActiveHeal';
import { initBattlePhase4DamageRuntime } from '@shared/utils/skillPhase4ActiveDamage';
import { initBattlePhase5CompositeRuntime } from '@shared/utils/skillPhase5CompositeDamage';
import { normalizePositionCombatBonuses } from '@/utils/positionCombatBonuses';
import { attachTroopAffinityToCharacter } from '@/utils/troopAffinityCombat';
import { enrichBattleUnitWithSkillPhases } from '@shared/utils/battleSkillAssembly';
import {
  buildTroopCatalogById,
  flattenPlayerUnitToBattleTroop,
} from '@shared/utils/resolveTroopBattleCaps';
import { mapAllyUnitsToBattleTroops } from '@/battle/mapAllyUnitsToBattleTroops';
import {
  snapDeployPositions,
  assertTroopsNotOnUndeployableTerrain,
} from '@shared/utils/tacticalDeploySnap.js';

const PLAYER_PREFERRED = [
  { y: 9, x: 1 }, { y: 9, x: 4 }, { y: 9, x: 7 },
  { y: 8, x: 2 }, { y: 8, x: 5 },
];

const ENEMY_PREFERRED = [
  { y: 0, x: 1 }, { y: 0, x: 5 },
  { y: 1, x: 3 }, { y: 1, x: 7 },
];

/**
 * @param {Array} playerUnits  - 我方编组单位（最多 5 个）
 * @param {Array} enemyUnits   - 驻守 NPC 单位（最多 4 个）
 * @param {Array} [allyUnits]  - 御驾 / 宝物等友军（最多 3 支）
 * @param {Record<string, object>} [skillsMap] skills.json 字典；有则守军叠阶段1～5（与玩家同源）
 * @param {string} baseUrl     - import.meta.env.BASE_URL
 * @param {'player'|'enemy'} [siegeCityDefenderFaction='enemy'] 攻城守城方阵营（玩家守城时为 `player`）
 * @param {object} [mapResult] - 刚 generate 的地图（避河吸附；缺则无法保证不站河）
 * @returns {Array} battleTroops
 */
export function buildSiegeUnits({
  playerUnits,
  enemyUnits,
  allyUnits = [],
  skillsMap = null,
  baseUrl,
  catalogById = null,
  siegeCityDefenderFaction = 'enemy',
  mapResult = null,
}) {
  const catalog = catalogById || buildTroopCatalogById();
  const tagSiegeCityDefender = (troop) => {
    if (siegeCityDefenderFaction && troop.faction === siegeCityDefenderFaction) {
      return { ...troop, _siegeCityDefender: true };
    }
    return troop;
  };

  if (!mapResult?.terrain?.length) {
    throw new Error('[buildSiegeUnits] 缺少 mapResult：攻城落子必须避河，请传入 generate() 返回值');
  }
  const playerPositions = snapDeployPositions(
    PLAYER_PREFERRED.slice(0, Math.min(5, playerUnits.length)),
    mapResult,
    { label: 'siege-player' },
  );
  const enemyPositions = snapDeployPositions(
    ENEMY_PREFERRED.slice(0, Math.min(4, enemyUnits.length)),
    mapResult,
    { label: 'siege-enemy' },
  );

  const playerTroops = playerUnits.slice(0, 5).map((unit, i) =>
    tagSiegeCityDefender(
      flattenPlayerUnitToBattleTroop(unit, i, {
        pos: playerPositions[i],
        catalogById: catalog,
        baseUrl,
        getPortraitAttempts: (trMeta, bUrl) =>
          getBattleFieldTroopPortraitUrlAttempts(trMeta, bUrl),
      }),
    ),
  );

  const enemyTroops = enemyUnits.slice(0, 4).map((npc, i) => {
    const raw = npc.character;
    const charName = raw
      ? (raw.courtesyName || raw.courtesy_name || raw.name || raw.character_name || raw.characterName)
      : null;
    const morale = initialMoraleFromCharacter(raw);
    const npcTroopMeta = {
      id: npc.troopId,
      rarity: npc.rarity,
      troopType: npc.troopType,
      weaponType: npc.weaponType,
    };
    const attempts = getBattleFieldTroopPortraitUrlAttempts({ ...npcTroopMeta, faction: 'enemy' }, baseUrl);
    // DB 原始属性为 0–100 尺度，÷10 转为 0–10
    const attr = (v, fallback = 5) => (v != null ? Number(v) / 10 : fallback);
    const enemyPosBonuses = normalizePositionCombatBonuses(raw?.positionBonuses);
    const baseRange = (() => {
      const r = Number(npc.range ?? npc.attackRange);
      return Number.isFinite(r) && r > 0 ? r : 1;
    })();
    const charBase = raw && charName
      ? attachTroopAffinityToCharacter({
          name: charName,
          courtesyName: charName,
          luck: attr(raw.luck),
          courage: attr(raw.courage),
          combat: attr(raw.combat),
          command: attr(raw.command),
          intelligence: attr(raw.intelligence),
          politics: attr(raw.politics),
          charm: attr(raw.charm),
          trait: raw.trait,
          traitModifier: raw.traitModifier ?? raw.trait_modifier ?? 0,
          ...(enemyPosBonuses ? { positionBonuses: enemyPosBonuses } : {}),
        }, raw.troopAffinity ?? raw.troop_affinity)
      : null;
    const troopBase = {
      id: npc.troopId + '_e' + i,
      name: npc.troopName,
      rarity: npc.rarity,
      troopType: npc.troopType,
      weaponType: npc.weaponType,
      attack: npc.attack,
      defense: npc.defense,
      speed: npc.speed,
      movement: npc.movement,
      range: baseRange,
      maxTroops: npc.maxTroops,
      troopWeight: npc.troopWeight ?? 1,
    };
    const { troop: enrichedTroop, character: battleChar } = enrichBattleUnitWithSkillPhases({
      troop: troopBase,
      character: charBase,
      skillIdSource: raw,
      skillsMap,
    });
    return tagSiegeCityDefender({
      ...enrichedTroop,
      currentTroops: npc.currentTroops ?? npc.maxTroops,
      initialTroops: npc.currentTroops ?? npc.maxTroops,
      faction: 'enemy',
      y: enemyPositions[i].y,
      x: enemyPositions[i].x,
      character: battleChar,
      displayName: charName || npc.troopName,
      morale,
      imgSrc: attempts[0],
      imgPortraitAttempts: attempts,
      imgFallback: attempts[attempts.length - 1],
      _npcIndex: npc.index,
      instanceId: npc._troopInstanceId || null,
    });
  });

  const occupiedForAllies = new Set([
    ...playerPositions.map((p) => `${p.y},${p.x}`),
    ...enemyPositions.map((p) => `${p.y},${p.x}`),
  ]);
  const allyTroops = mapAllyUnitsToBattleTroops(allyUnits, baseUrl, undefined, skillsMap, {
    mapResult,
    occupied: occupiedForAllies,
  });

  const out = [...playerTroops, ...allyTroops, ...enemyTroops];
  assertTroopsNotOnUndeployableTerrain(out, mapResult);
  initBattlePhase2Runtime(out);
  initBattlePhase3HealRuntime(out, 10, 8);
  initBattlePhase4DamageRuntime(out, 10, 8);
  initBattlePhase5CompositeRuntime(out, 10, 8);
  return out;
}
