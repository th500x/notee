/**
 * 攻城/驻守战：将 playerUnits + enemyUnits（来自驻守 NPC）组装为战术部队数组。
 * 适用于 pve_siege / pvp_siege 等预置敌方阵容的场景（非随机 eventRarity 模式）。
 *
 * 角色属性原始值为 0–100 尺度（来自 DB），÷10 转为游戏内 0–10 尺度，与 characters.json 一致。
 */
import { getBattleFieldTroopPortraitUrlAttempts } from '@shared/utils/troopIconUrls';
import { initialMoraleFromCharacter } from '@/utils/npcMorale';

const PLAYER_POSITIONS = [
  { y: 9, x: 1 }, { y: 9, x: 4 }, { y: 9, x: 7 },
  { y: 8, x: 2 }, { y: 8, x: 5 },
];

const ENEMY_POSITIONS = [
  { y: 0, x: 1 }, { y: 0, x: 5 },
  { y: 1, x: 3 }, { y: 1, x: 7 },
];

/**
 * @param {Array} playerUnits  - 我方编组单位（最多 5 个）
 * @param {Array} enemyUnits   - 驻守 NPC 单位（最多 4 个）
 * @param {string} baseUrl     - import.meta.env.BASE_URL
 * @returns {Array} battleTroops
 */
export function buildSiegeUnits({ playerUnits, enemyUnits, baseUrl }) {
  const playerTroops = playerUnits.slice(0, 5).map((unit, i) => {
    const attempts = getBattleFieldTroopPortraitUrlAttempts({ ...unit.troop, faction: 'player' }, baseUrl);
    return {
      ...unit.troop,
      id: unit.troop.id + '_p' + i,
      faction: 'player',
      y: PLAYER_POSITIONS[i].y,
      x: PLAYER_POSITIONS[i].x,
      currentTroops: unit.currentTroops ?? unit.troop.maxTroops,
      initialTroops: unit.currentTroops ?? unit.troop.maxTroops,
      maxTroops: unit.maxTroops ?? unit.troop.maxTroops,
      character: unit.character || null,
      displayName: unit.character
        ? (unit.character.courtesyName || unit.character.name)
        : unit.troop.name,
      morale: unit.morale ?? 70,
      instanceId: unit.troop.instanceId,
      ...(unit.lineupSlot ? { lineupSlot: unit.lineupSlot } : {}),
      imgSrc: attempts[0],
      imgPortraitAttempts: attempts,
      imgFallback: attempts[attempts.length - 1],
    };
  });

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
    return {
      id: npc.troopId + '_e' + i,
      name: npc.troopName,
      rarity: npc.rarity,
      troopType: npc.troopType,
      weaponType: npc.weaponType,
      attack: npc.attack,
      defense: npc.defense,
      speed: npc.speed,
      movement: npc.movement,
      range: (() => {
        const raw = npc.range ?? npc.attackRange;
        const r = Number(raw);
        return Number.isFinite(r) && r > 0 ? r : null;
      })(),
      maxTroops: npc.maxTroops,
      currentTroops: npc.currentTroops ?? npc.maxTroops,
      initialTroops: npc.currentTroops ?? npc.maxTroops,
      faction: 'enemy',
      y: ENEMY_POSITIONS[i].y,
      x: ENEMY_POSITIONS[i].x,
      character: raw && charName ? {
        name: charName,
        courtesyName: charName,
        luck: attr(raw.luck),
        courage: attr(raw.courage),
        combat: attr(raw.combat),
        command: attr(raw.command),
        intelligence: attr(raw.intelligence),
        politics: attr(raw.politics),
        charm: attr(raw.charm),
      } : null,
      displayName: charName || npc.troopName,
      morale,
      imgSrc: attempts[0],
      imgPortraitAttempts: attempts,
      imgFallback: attempts[attempts.length - 1],
      _npcIndex: npc.index,
      instanceId: npc._troopInstanceId || null,
    };
  });

  return [...playerTroops, ...enemyTroops];
}
