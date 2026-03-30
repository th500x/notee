/**
 * 披挂攻城 PVP · 服务端单场推演（无地图走位，随机对射式交锋，与 combatSystem 伤害一致）
 */

const crypto = require('crypto');
const {
  createSeededRng,
  calcDamageSeeded,
  rollCritDodgeSeeded,
  troopDamageToCasualties,
} = require('../lib/siegeCombatCore.cjs');

const PLAYER_POS = [
  { y: 9, x: 1 },
  { y: 9, x: 4 },
  { y: 9, x: 7 },
  { y: 8, x: 2 },
  { y: 8, x: 5 },
];
const ENEMY_POS = [
  { y: 0, x: 1 },
  { y: 0, x: 5 },
  { y: 1, x: 3 },
  { y: 1, x: 7 },
];

function hashSeed(parts) {
  const h = crypto.createHash('sha256').update(parts.join('|')).digest();
  return h.readUInt32BE(0) ^ h.readUInt32BE(4);
}

/**
 * siege npc 格式 → BattleArena/calcDamage 用 troop（与前端 BattleArena 一致：将领属性 /10）
 */
function siegeNpcToTroop(npc, faction, posIndex, side, rng) {
  const pos = side === 'player' ? PLAYER_POS[posIndex % PLAYER_POS.length] : ENEMY_POS[posIndex % ENEMY_POS.length];
  const morale =
    side === 'player'
      ? 72
      : Math.min(100, Math.max(40, 50 + Math.floor(rng() * 30)));
  const base = {
    id: `${npc.troopId}_${side}_${posIndex}`,
    name: npc.troopName,
    rarity: npc.rarity,
    troopType: npc.troopType || 'infantry',
    weaponType: npc.weaponType,
    attack: npc.attack,
    defense: npc.defense,
    speed: npc.speed,
    movement: npc.movement,
    range: npc.attackRange,
    maxTroops: npc.maxTroops,
    currentTroops: npc.currentTroops ?? npc.maxTroops,
    faction,
    y: pos.y,
    x: pos.x,
    morale,
    troopWeight: npc.troopWeight || 1,
    battleCount: npc.battleCount,
    maxBattleCount: npc.maxBattleCount,
    infantryCounter: npc.infantryCounter ?? 1,
    cavalryCounter: npc.cavalryCounter ?? 1,
    archerCounter: npc.archerCounter ?? 1,
    siegeCounter: npc.siegeCounter ?? 1,
    plainAdapt: npc.plainAdapt ?? 1,
    forestAdapt: npc.forestAdapt ?? 1,
    hillAdapt: npc.hillAdapt ?? 1,
    waterAdapt: npc.waterAdapt ?? 1,
  };
  if (npc.character) {
    const c = npc.character;
    base.character = {
      name: c.name,
      courtesyName: c.courtesyName || c.name,
      luck: (c.luck != null ? c.luck : 50) / 10,
      courage: (c.courage != null ? c.courage : 50) / 10,
      combat: (c.combat != null ? c.combat : 50) / 10,
      command: (c.command != null ? c.command : 50) / 10,
      intelligence: (c.intelligence != null ? c.intelligence : 50) / 10,
      politics: (c.politics != null ? c.politics : 50) / 10,
      charm: (c.charm != null ? c.charm : 50) / 10,
    };
  } else {
    base.character = null;
  }
  base._npcIndex = npc.index;
  return base;
}

/**
 * @returns {{ attackerWon: boolean, killedIndices: number[], battleLog: string[], rounds: number, battleSeed: number, attackerTroopsEnd: object[], defenderTroopsEnd: object[] }}
 */
function runSiegePvpSkirmish(attackerSiegeNpcs, defenderSiegeNpcs, seedInput) {
  const battleSeed =
    typeof seedInput === 'number' && !Number.isNaN(seedInput)
      ? seedInput >>> 0
      : hashSeed([String(seedInput || ''), Date.now().toString()]);
  const rng = createSeededRng(battleSeed);

  const playerTroops = attackerSiegeNpcs.map((npc, i) => siegeNpcToTroop(npc, 'player', i, 'player', rng));
  const enemyTroops = defenderSiegeNpcs.map((npc, i) => siegeNpcToTroop(npc, 'enemy', i, 'enemy', rng));

  const logs = [];
  let round = 0;
  const maxRounds = 250;

  while (round < maxRounds) {
    round++;
    const aliveP = playerTroops.filter((t) => t.currentTroops > 0);
    const aliveE = enemyTroops.filter((t) => t.currentTroops > 0);
    if (aliveP.length === 0) {
      logs.push(`第${round}回合：攻城方全军覆没。`);
      return finish(false);
    }
    if (aliveE.length === 0) {
      logs.push(`第${round}回合：守军全灭。`);
      return finish(true);
    }

    const attackerIsPlayer = rng() < 0.5;
    const atkPool = attackerIsPlayer ? aliveP : aliveE;
    const defPool = attackerIsPlayer ? aliveE : aliveP;
    const atk = atkPool[Math.floor(rng() * atkPool.length)];
    const def = defPool[Math.floor(rng() * defPool.length)];

    const roll = rollCritDodgeSeeded(atk, def, rng);
    if (roll === 'dodge') {
      logs.push(`第${round}回合：${atk.character?.courtesyName || atk.name} 攻击被闪避。`);
      continue;
    }
    let dmg = calcDamageSeeded(atk, def, null, rng);
    if (roll === 'crit') dmg = Math.max(1, Math.round(dmg * 1.5));
    const cas = troopDamageToCasualties(def, dmg);
    def.currentTroops = Math.max(0, def.currentTroops - cas);
    const dn = def.character?.courtesyName || def.name;
    logs.push(`第${round}回合：${atk.character?.courtesyName || atk.name} 对 ${dn} 造成 ${cas} 损失（${roll === 'crit' ? '暴击' : '命中'}）。`);
  }

  logs.push(`达到回合上限，判定攻城方失利。`);
  return finish(false);

  function finish(attackerWon) {
    const killedIndices = [];
    enemyTroops.forEach((t, idx) => {
      const orig = defenderSiegeNpcs[idx];
      if (orig && t.currentTroops <= 0) killedIndices.push(orig.index !== undefined ? orig.index : idx);
    });
    return {
      attackerWon,
      killedIndices,
      battleLog: logs,
      rounds: round,
      battleSeed,
      attackerTroopsEnd: playerTroops.map((t) => ({ ...t })),
      defenderTroopsEnd: enemyTroops.map((t) => ({ ...t })),
    };
  }
}

module.exports = {
  runSiegePvpSkirmish,
  hashSeed,
};
