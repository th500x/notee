/**
 * 披挂攻城 PVP · 服务端单场推演
 *
 * - 无格子移动 / 射程判定：不模拟走位，但每一击仍走与正式战斗相同的伤害链
 *   （`siegeCombatCore`：`calcDamageSeeded`、`rollCritDodgeSeeded`、`troopDamageToCasualties`，
 *   与前端棋盘战 `combatSystem` / BattleArena 所用公式一致，不是独立乱写的「对射」数值）。
 * - 战术流程：与 BattleArena 相同语义的一回合一圈——每战术回合输出「═══ 第 T 回合 ═══」，
 *   当场存活双方将帅部队按速度排序后各行动至多一次；**每次主动攻击后若目标未灭且双方仍在反击射程内，再结算一击反击**
 *  （`calcDamageSeeded` 的 `strike: 'normal' | 'counter'` 与棋盘战一致）。
 */

const crypto = require('crypto');
const {
  createSeededRng,
  calcDamageSeeded,
  rollCritDodgeSeeded,
  troopDamageToCasualties,
} = require('../lib/siegeCombatCore.cjs');
const { normalizePositionCombatBonuses } = require('../../shared/utils/positionCombatBonuses.cjs');
const { resolveSiegeCityDefenseMultFromOpts } = require('../../shared/utils/siegeCityDefenseMult.cjs');

/**
 * 推演占位坐标：双方排在同一行、**相邻两格**（曼哈顿距=1），任意攻方↔守方随机对位时都在近战/弓程内，
 * 便于与棋盘战一致走完 **主动一击 + 反击**（`gridDist(def,atk) <= troopAttackRange(def)`）。
 * 多单位同阵营共用同一格（抽象接战线，不模拟走位）。
 */
const SIEGE_LINE_Y = 5;
const PLAYER_SIEGE_TILE = { y: SIEGE_LINE_Y, x: 4 };
const ENEMY_SIEGE_TILE = { y: SIEGE_LINE_Y, x: 5 };

function hashSeed(parts) {
  const h = crypto.createHash('sha256').update(parts.join('|')).digest();
  return h.readUInt32BE(0) ^ h.readUInt32BE(4);
}

/** 与 `battleFlowManager.dist` 一致：曼哈顿距离 */
function gridDist(a, b) {
  return Math.abs(a.y - b.y) + Math.abs(a.x - b.x);
}

/** 与 `battleFlowManager.troopAttackRange` 一致 */
function troopAttackRange(troop) {
  const r = Number(troop?.range);
  return Number.isFinite(r) && r > 0 ? r : 1;
}

/**
 * siege npc 格式 → BattleArena/calcDamage 用 troop（与前端 BattleArena 一致：将领属性 /10）
 */
function siegeNpcToTroop(npc, faction, posIndex, side, rng) {
  const pos = side === 'player' ? PLAYER_SIEGE_TILE : ENEMY_SIEGE_TILE;
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
    initialTroops: npc.currentTroops ?? npc.maxTroops,
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
    const posBonuses = normalizePositionCombatBonuses(c.positionBonuses);
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
      ...(posBonuses ? { positionBonuses: posBonuses } : {}),
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
function runSiegePvpSkirmish(attackerSiegeNpcs, defenderSiegeNpcs, seedInput, opts = {}) {
  const siegeCityDefenseMult = resolveSiegeCityDefenseMultFromOpts(opts);
  const battleSeed =
    typeof seedInput === 'number' && !Number.isNaN(seedInput)
      ? seedInput >>> 0
      : hashSeed([String(seedInput || ''), Date.now().toString()]);
  const rng = createSeededRng(battleSeed);

  const playerTroops = attackerSiegeNpcs.map((npc, i) => siegeNpcToTroop(npc, 'player', i, 'player', rng));
  const enemyTroops = defenderSiegeNpcs.map((npc, i) => siegeNpcToTroop(npc, 'enemy', i, 'enemy', rng));

  const logs = [];
  /** 推演侧 player=faction 攻城方，enemy=守军；写入战报前缀与玩家主观「我军」一致，避免同名将领无法区分 */
  const sideLabel = (faction) => (faction === 'player' ? '攻方' : '守军');
  let tacticalRound = 0;
  /** 与棋盘战一致：战术回合上限（非单次交锋次数） */
  const maxTacticalRounds = 100;

  const roundHeader = (n) => `═══ 第 ${n} 回合 ═══`;

  while (tacticalRound < maxTacticalRounds) {
    tacticalRound += 1;
    logs.push(roundHeader(tacticalRound));

    let aliveP = playerTroops.filter((t) => t.currentTroops > 0);
    let aliveE = enemyTroops.filter((t) => t.currentTroops > 0);
    if (aliveP.length === 0) {
      logs.push('交战前攻城方已无兵，战斗结束。');
      return finish(false, tacticalRound);
    }
    if (aliveE.length === 0) {
      logs.push('交战前守军已无兵，战斗结束。');
      return finish(true, tacticalRound);
    }

    const actorEntries = [...aliveP, ...aliveE].map((t) => ({ t, tie: rng() }));
    actorEntries.sort((a, b) => {
      const ds = (b.t.speed || 0) - (a.t.speed || 0);
      if (ds !== 0) return ds;
      return a.tie - b.tie;
    });

    let attackInRound = 0;
    for (const { t: atk } of actorEntries) {
      if (atk.currentTroops <= 0) continue;

      aliveP = playerTroops.filter((t) => t.currentTroops > 0);
      aliveE = enemyTroops.filter((t) => t.currentTroops > 0);
      if (aliveP.length === 0) return finish(false, tacticalRound);
      if (aliveE.length === 0) return finish(true, tacticalRound);

      const oppPool = atk.faction === 'player' ? aliveE : aliveP;
      if (oppPool.length === 0) continue;

      const def = oppPool[Math.floor(rng() * oppPool.length)];
      attackInRound += 1;
      const an = atk.character?.courtesyName || atk.name;
      const dn = def.character?.courtesyName || def.name;

      const roll = rollCritDodgeSeeded(atk, def, rng);
      const atkLab = sideLabel(atk.faction);
      const defLab = sideLabel(def.faction);
      if (roll === 'dodge') {
        logs.push(`第 ${attackInRound} 次攻击：[${atkLab}]${an} 攻击被闪避。`);
        continue;
      }
      let dmg = calcDamageSeeded(atk, def, null, rng, {
        strike: 'normal',
        ...(def.faction === 'enemy' ? { siegeCityDefenseMult } : {}),
      });
      if (roll === 'crit') dmg = Math.max(1, Math.round(dmg * 1.5));
      const cas = troopDamageToCasualties(def, dmg);
      def.currentTroops = Math.max(0, def.currentTroops - cas);
      logs.push(
        `第 ${attackInRound} 次攻击：[${atkLab}]${an} 对 [${defLab}]${dn} 造成 ${cas} 损失（${roll === 'crit' ? '暴击' : '命中'}）。`,
      );

      if (def.currentTroops > 0 && atk.currentTroops > 0 && gridDist(def, atk) <= troopAttackRange(def)) {
        const rollC = rollCritDodgeSeeded(def, atk, rng);
        if (rollC === 'dodge') {
          logs.push(`　└ 反击：[${defLab}]${dn} 对 [${atkLab}]${an} 被闪避。`);
        } else {
          let dmgC = calcDamageSeeded(def, atk, null, rng, { strike: 'counter' });
          if (rollC === 'crit') dmgC = Math.max(1, Math.round(dmgC * 1.5));
          const casC = troopDamageToCasualties(atk, dmgC);
          atk.currentTroops = Math.max(0, atk.currentTroops - casC);
          logs.push(
            `　└ 反击：[${defLab}]${dn} 对 [${atkLab}]${an} 造成 ${casC} 损失（${rollC === 'crit' ? '暴击' : '命中'}）。`,
          );
        }
      }
    }
  }

  logs.push(`达到战术回合上限（第 ${maxTacticalRounds} 回合），判定攻城方失利。`);
  return finish(false, maxTacticalRounds);

  function finish(attackerWon, completedTacticalRounds) {
    const killedIndices = [];
    enemyTroops.forEach((t, idx) => {
      const orig = defenderSiegeNpcs[idx];
      if (orig && t.currentTroops <= 0) killedIndices.push(orig.index !== undefined ? orig.index : idx);
    });
    return {
      attackerWon,
      killedIndices,
      battleLog: logs,
      rounds: completedTacticalRounds,
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
