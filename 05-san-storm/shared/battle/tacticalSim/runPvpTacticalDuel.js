/**
 * PvP 战术对决 · 服务端权威推演内核（方案 A · headless）
 *
 * 单一来源（single shared kernel）：本内核为 PvP 战术对决的**唯一权威**，服务端调用产出
 * `events[] + finalState + battleLog`，客户端只回放事件、**不重新推演**（见 17-5 §12.5/§12.6）。
 *
 * 设计约束：
 *   - 无 React / 无 DOM / 无 sleep；所有随机经 `battleSeed` 派生，结果可复现（bit-identical）。
 *   - 伤害链复用 `siegeCombatCore`（与前端 `combatSystem` / 棋盘战同源公式），**禁止** PvP 专用公式分叉。
 *   - 走位/选敌复用 `tacticalAi.findBestMoveTarget`（忠实移植自 `battleFlowManager`，与前端自动战同决策）。
 *   - 阵型复用 `formationModel`（移植 `formationSystem` + `applyFormationBuffs`，泛化双侧朝向）。
 *   - canonical 空间运行：side `a`=邀战方(player)、`b`=应战方(enemy)；视角镜像在客户端完成（§12.4）。
 *
 * 事件 type 对齐 17-5 §12.6：
 *   BATTLE_START / FORMATION_APPLIED / ROUND_START / MOVE / ATTACK / COUNTER / DAMAGE /
 *   UNIT_ELIMINATED / BATTLE_END（PLAYER_ACTION 待第三阶段）。
 *
 * 已实装（步骤 4a/4b/4c/4d）：放兵、首回合阵型加成、速度回合排序、真实走位/选敌 AI（打满射程/弓兵后撤）、
 *   近/远程接战（主动击+反击）、事件流、finalState、人类可读 battleLog、确定性。
 * 已实装（17-5-3 阶段 1）：真实地图地形防御/攻方地形适应（透传 calcDamageSeeded 第 3 参）、
 *   受击侧城防 `defenseBonus.{a,b}=cityDefense`（接入披挂/道路真实链条所需，切磋默认不传）。
 * 后续增量（步骤 4 技能子项 / 4e，见 17-5-2 §4 步骤 4 备注）：
 *   阶段 3/4/5 技能 AI（需快照携带主动技能字段）、士气崩溃、与浏览器自动战的对照测试。
 *
 * @see docs/10-core-system/17-5-DUEL_SYSTEM.md §12.5 §12.6
 * @see docs/10-core-system/17-5-2-TACTICAL_AUTO_DUEL_IMPLEMENTATION.md 步骤 4
 */

import { createRequire } from 'module';
import { ZONE, getMapTerrainDimensions } from '../../utils/tacticalBattleGrid.js';
import { buildDuelMapFromPreset } from '../../utils/pvpDuelMapCatalog.js';
import {
  buildObjectMap,
  isPassableCell,
  gridDist,
  troopAttackRange,
} from './tacticalGridModel.js';
import { findBestMoveTarget } from './tacticalAi.js';
import { selectFormationForTroops, applyFormation } from './formationModel.js';

const require = createRequire(import.meta.url);
const {
  createSeededRng,
  calcDamageSeeded,
  rollCritDodgeSeeded,
  troopDamageToCasualties,
} = require('../../../backend/lib/siegeCombatCore.cjs');

/** 战术回合上限（与 pvpAutoDuelSim / 棋盘战一致） */
export const MAX_TACTICAL_ROUNDS = 100;

const DEFAULT_SIDE_LABELS = { a: '甲方', b: '乙方' };

/**
 * 冻结快照单元 → 推演 unit（补齐 calcDamageSeeded 所需字段，缺省值与 pvpAutoDuelSim 对齐）。
 * 将领六维若为 0~100 量纲则 /10（与 BattleArena / siegeNpcToTroop 同处理）。
 */
function snapshotToUnit(snap, side, index) {
  const character = snap.character
    ? {
        name: snap.character.name,
        courtesyName: snap.character.courtesyName || snap.character.name,
        luck: (snap.character.luck ?? 50) / 10,
        courage: (snap.character.courage ?? 50) / 10,
        combat: (snap.character.combat ?? 50) / 10,
        command: (snap.character.command ?? 50) / 10,
        intelligence: (snap.character.intelligence ?? 50) / 10,
        politics: (snap.character.politics ?? 50) / 10,
        charm: (snap.character.charm ?? 50) / 10,
      }
    : null;
  const maxTroops = snap.maxTroops ?? snap.currentTroops ?? 0;
  return {
    id: `${side}_${index}_${snap.id ?? snap.troopId ?? 'u'}`,
    instanceId: `${side}_${index}`,
    side,
    faction: side === 'a' ? 'player' : 'enemy',
    name: snap.name ?? snap.troopName ?? `${side}#${index}`,
    rarity: snap.rarity ?? 'common',
    troopType: snap.troopType ?? 'infantry',
    weaponType: snap.weaponType ?? 'melee',
    attack: snap.attack ?? 50,
    defense: snap.defense ?? 50,
    speed: snap.speed ?? 50,
    movement: snap.movement ?? 3,
    range: snap.range ?? snap.attackRange ?? 1,
    maxTroops,
    currentTroops: snap.currentTroops ?? maxTroops,
    initialTroops: snap.currentTroops ?? maxTroops,
    troopWeight: snap.troopWeight ?? 1,
    infantryCounter: snap.infantryCounter ?? 1,
    cavalryCounter: snap.cavalryCounter ?? 1,
    archerCounter: snap.archerCounter ?? 1,
    siegeCounter: snap.siegeCounter ?? 1,
    plainAdapt: snap.plainAdapt ?? 1,
    forestAdapt: snap.forestAdapt ?? 1,
    hillAdapt: snap.hillAdapt ?? 1,
    waterAdapt: snap.waterAdapt ?? 1,
    morale: snap.morale ?? 70,
    character,
    y: -1,
    x: -1,
  };
}

/** 在 zone 行内挑可通行、未占用的格按列均匀铺开（确定性放兵） */
function deployUnits(units, zoneRows, mapResult, objMap, occupied) {
  const { w } = getMapTerrainDimensions(mapResult);
  const cells = [];
  for (const y of zoneRows) {
    for (let x = 0; x < w; x++) {
      const key = `${y},${x}`;
      if (occupied.has(key)) continue;
      if (!isPassableCell(y, x, mapResult, objMap)) continue;
      cells.push([y, x]);
    }
  }
  for (let i = 0; i < units.length; i++) {
    if (cells.length === 0) break;
    const idx = Math.min(Math.floor((i * cells.length) / units.length), cells.length - 1);
    const [y, x] = cells[idx];
    units[i].y = y;
    units[i].x = x;
    occupied.add(`${y},${x}`);
  }
}

/**
 * 运行一场 PvP 战术对决推演。
 *
 * @param {object} input
 * @param {string} [input.duelMapId] - 固化对决图 id（与 preset 二选一）
 * @param {object} [input.preset]    - 直接传入 preset（优先级低于 duelMapId）
 * @param {number} [input.mapSeed]   - 预留：覆盖地图随机种子（暂以 preset.seed 为准）
 * @param {{ a: object[], b: object[] }} input.lineupSnapshots - 两侧冻结编组快照（canonical a/b）
 * @param {number} input.battleSeed  - 推演 RNG 种子（hashSeed(room_id, player_a, player_b)）
 * @param {{ a: string, b: string }} [input.sideLabels] - 战报用阵营标签
 * @param {{ a?: number, b?: number }} [input.defenseBonus] - 守城方城防（cityDefense，如 100/150）：
 *        当受击单元位于该侧时，按 `siegeCityDefenseMult = cityDefense/100` 增益其防御
 *        （与 `siegeCombatCore` / `pvpAutoDuelSim` 城防口径一致；切磋默认不传 = 无城防）。
 * @returns {{ events: object[], winnerSide: 'a'|'b'|null, rounds: number, finalState: object, battleLog: string[] }}
 */
export function runPvpTacticalDuel(input) {
  const {
    duelMapId,
    preset,
    lineupSnapshots,
    battleSeed,
    sideLabels = DEFAULT_SIDE_LABELS,
    defenseBonus = null,
  } = input || {};

  if (!lineupSnapshots || !Array.isArray(lineupSnapshots.a) || !Array.isArray(lineupSnapshots.b)) {
    throw new Error('runPvpTacticalDuel: lineupSnapshots.{a,b} 必须为数组');
  }
  if (!duelMapId && !preset) {
    throw new Error('runPvpTacticalDuel: 须提供 duelMapId 或 preset');
  }

  const mapResult = buildDuelMapFromPreset(preset || duelMapId);
  const resolvedDuelMapId = preset?.duel_map_id ?? duelMapId ?? mapResult.duel_map_id ?? null;
  const objMap = buildObjectMap(mapResult);
  const rng = createSeededRng((battleSeed ?? 0) >>> 0);

  const unitsA = lineupSnapshots.a.map((snap, i) => snapshotToUnit(snap, 'a', i));
  const unitsB = lineupSnapshots.b.map((snap, i) => snapshotToUnit(snap, 'b', i));
  const allUnits = [...unitsA, ...unitsB];

  const occupied = new Set();
  deployUnits(unitsA, ZONE.deployA, mapResult, objMap, occupied);
  deployUnits(unitsB, ZONE.deployB, mapResult, objMap, occupied);

  const events = [];
  const battleLog = [];
  let seq = 0;
  const emit = (type, payload) => events.push({ seq: seq++, type, payload });
  const label = (side) => sideLabels[side] ?? side;
  const unitName = (u) => u.character?.courtesyName || u.name;
  /** 受击单元所在侧的城防 cityDefense（无则 null）；用作 calcDamageSeeded 的 def 防御增益 */
  const cityDefenseForSide = (side) => {
    const v = defenseBonus && defenseBonus[side];
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  emit('BATTLE_START', {
    duelMapId: resolvedDuelMapId,
    battleSeed: (battleSeed ?? 0) >>> 0,
    units: allUnits.map((u) => ({
      instanceId: u.instanceId,
      side: u.side,
      name: u.name,
      troopType: u.troopType,
      y: u.y,
      x: u.x,
      troops: u.currentTroops,
    })),
  });

  const aliveBySide = (side) => allUnits.filter((u) => u.side === side && u.currentTroops > 0);

  // ── 首回合阵型：a 在北带(deployA)、敌在南(enemyDir +1)；b 在南带(deployB)、敌在北(enemyDir -1) ──
  const applySideFormation = (side, deployRows, enemyDir) => {
    const sideUnits = aliveBySide(side);
    const formation = selectFormationForTroops(sideUnits, mapResult.terrain);
    if (!formation) return;
    const res = applyFormation(sideUnits, mapResult, {
      formation,
      deployRows,
      enemyDir,
      enemyUnits: aliveBySide(side === 'a' ? 'b' : 'a'),
      objMap,
    });
    if (!res) return;
    emit('FORMATION_APPLIED', {
      side,
      formationId: res.formation.id,
      formationName: res.formation.name,
      effects: res.formation.effects,
      units: sideUnits.map((u) => ({ instanceId: u.instanceId, y: u.y, x: u.x })),
    });
    battleLog.push(`[${label(side)}] 布阵「${res.formation.name}」（${res.formation.desc}）。`);
  };
  applySideFormation('a', ZONE.deployA, 1);
  applySideFormation('b', ZONE.deployB, -1);

  let round = 0;
  let winnerSide = null;

  while (round < MAX_TACTICAL_ROUNDS) {
    round += 1;
    emit('ROUND_START', { round });
    battleLog.push(`═══ 第 ${round} 回合 ═══`);

    if (aliveBySide('a').length === 0) { winnerSide = 'b'; break; }
    if (aliveBySide('b').length === 0) { winnerSide = 'a'; break; }

    // 行动顺序：速度降序 + rng 打破并列（确定性，与 pvpAutoDuelSim 同策略）
    const actors = allUnits
      .filter((u) => u.currentTroops > 0)
      .map((u) => ({ u, tie: rng() }))
      .sort((p, q) => (q.u.speed - p.u.speed) || (p.tie - q.tie))
      .map((e) => e.u);

    for (const atk of actors) {
      if (atk.currentTroops <= 0) continue;
      const enemies = aliveBySide(atk.side === 'a' ? 'b' : 'a');
      if (enemies.length === 0) break;

      // 真实走位/选敌 AI（打满射程、弓兵后撤、危险格规避）；PvP 禁宝箱故 prioritizeChests=false。
      const decision = findBestMoveTarget(atk, allUnits, mapResult, { prioritizeChests: false, objMap });

      // 1) 移动：findBestMoveTarget 已计算落点路径（含移动力预算内的最远可达格）
      if (decision && Array.isArray(decision.move) && decision.move.length > 0) {
        const from = { y: atk.y, x: atk.x };
        const dest = decision.move[decision.move.length - 1];
        atk.y = dest.y;
        atk.x = dest.x;
        emit('MOVE', {
          instanceId: atk.instanceId,
          from,
          to: { y: atk.y, x: atk.x },
          path: decision.move.map((p) => [p.y, p.x]),
        });
      }

      // 2) 目标：findBestMoveTarget 仅在落点可攻击时返回 target；否则本回合仅移动
      const def = decision && decision.target && decision.target.currentTroops > 0
        ? decision.target
        : null;
      if (!def) continue;

      // 3) 主动一击
      const roll = rollCritDodgeSeeded(atk, def, rng);
      const dodged = roll === 'dodge';
      if (dodged) {
        emit('ATTACK', { attacker: atk.instanceId, defender: def.instanceId, result: 'dodge' });
        battleLog.push(`[${label(atk.side)}]${unitName(atk)} 攻击被 [${label(def.side)}]${unitName(def)} 闪避。`);
      } else {
        // 透传真实地图地形（地形防御 + 攻方地形适应）与受击侧城防（cityDefense），与 siegeCombatCore 口径一致。
        const defCityDefense = cityDefenseForSide(def.side);
        let dmg = calcDamageSeeded(atk, def, mapResult.terrain, rng, {
          strike: 'normal',
          ...(defCityDefense != null ? { cityDefense: defCityDefense } : {}),
        });
        if (roll === 'crit') dmg = Math.max(1, Math.round(dmg * 1.5));
        const casualties = troopDamageToCasualties(def, dmg);
        def.currentTroops = Math.max(0, def.currentTroops - casualties);
        emit('ATTACK', { attacker: atk.instanceId, defender: def.instanceId, result: roll });
        emit('DAMAGE', { target: def.instanceId, casualties, remain: def.currentTroops, crit: roll === 'crit' });
        battleLog.push(
          `[${label(atk.side)}]${unitName(atk)} 对 [${label(def.side)}]${unitName(def)} 造成 ${casualties} 损失（${roll === 'crit' ? '暴击' : '命中'}）。`,
        );
        if (def.currentTroops <= 0) {
          emit('UNIT_ELIMINATED', { instanceId: def.instanceId });
          battleLog.push(`　└ [${label(def.side)}]${unitName(def)} 部队被歼灭。`);
        }
      }

      // 4) 反击（与 pvpAutoDuelSim 对齐：主动击被闪避则不反击；目标存活且在其反击射程内）
      if (!dodged && def.currentTroops > 0 && atk.currentTroops > 0 && gridDist(def, atk) <= troopAttackRange(def)) {
        const rollC = rollCritDodgeSeeded(def, atk, rng);
        if (rollC === 'dodge') {
          emit('COUNTER', { attacker: def.instanceId, defender: atk.instanceId, result: 'dodge' });
          battleLog.push(`　└ 反击：[${label(def.side)}]${unitName(def)} 攻击被 [${label(atk.side)}]${unitName(atk)} 闪避。`);
        } else {
          // 反击：此处受击者为原攻方 atk → 城防取 atk.side
          const atkCityDefense = cityDefenseForSide(atk.side);
          let dmgC = calcDamageSeeded(def, atk, mapResult.terrain, rng, {
            strike: 'counter',
            ...(atkCityDefense != null ? { cityDefense: atkCityDefense } : {}),
          });
          if (rollC === 'crit') dmgC = Math.max(1, Math.round(dmgC * 1.5));
          const casualtiesC = troopDamageToCasualties(atk, dmgC);
          atk.currentTroops = Math.max(0, atk.currentTroops - casualtiesC);
          emit('COUNTER', { attacker: def.instanceId, defender: atk.instanceId, result: rollC });
          emit('DAMAGE', { target: atk.instanceId, casualties: casualtiesC, remain: atk.currentTroops, crit: rollC === 'crit' });
          battleLog.push(
            `　└ 反击：[${label(def.side)}]${unitName(def)} 对 [${label(atk.side)}]${unitName(atk)} 造成 ${casualtiesC} 损失（${rollC === 'crit' ? '暴击' : '命中'}）。`,
          );
          if (atk.currentTroops <= 0) {
            emit('UNIT_ELIMINATED', { instanceId: atk.instanceId });
            battleLog.push(`　└ [${label(atk.side)}]${unitName(atk)} 部队被歼灭。`);
          }
        }
      }

      if (aliveBySide('a').length === 0) { winnerSide = 'b'; break; }
      if (aliveBySide('b').length === 0) { winnerSide = 'a'; break; }
    }

    if (winnerSide) break;
  }

  if (!winnerSide) {
    // 达回合上限：存活总兵力多者胜，相等判平局（null）
    const sumA = aliveBySide('a').reduce((s, u) => s + u.currentTroops, 0);
    const sumB = aliveBySide('b').reduce((s, u) => s + u.currentTroops, 0);
    winnerSide = sumA === sumB ? null : sumA > sumB ? 'a' : 'b';
    battleLog.push(`达到战术回合上限（第 ${MAX_TACTICAL_ROUNDS} 回合），按存活兵力判定。`);
  }

  const finalState = {
    duelMapId: resolvedDuelMapId,
    units: allUnits.map((u) => ({
      instanceId: u.instanceId,
      side: u.side,
      name: u.name,
      y: u.y,
      x: u.x,
      currentTroops: u.currentTroops,
      initialTroops: u.initialTroops,
      alive: u.currentTroops > 0,
    })),
    survivors: { a: aliveBySide('a').length, b: aliveBySide('b').length },
    troopsRemain: {
      a: aliveBySide('a').reduce((s, u) => s + u.currentTroops, 0),
      b: aliveBySide('b').reduce((s, u) => s + u.currentTroops, 0),
    },
  };

  const winnerLabel = winnerSide ? label(winnerSide) : '平局';
  battleLog.push(`战斗结束：${winnerLabel}${winnerSide ? '获胜' : ''}（共 ${round} 回合）。`);

  emit('BATTLE_END', { winnerSide, rounds: round, finalState });

  return { events, winnerSide, rounds: round, finalState, battleLog };
}

export default runPvpTacticalDuel;
