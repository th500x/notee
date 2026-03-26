/**
 * useManualBattle - 手动战斗状态机
 *
 * 管理手动模式下玩家部队的操作流程：
 *   单兵：SELECT_MOVE → SELECT_ACTION → 结束
 *   阵型：FORMATION_MOVE → FORMATION_ACTION → 结束
 *
 * 阵型移动：以中心部队为基准计算可达范围，点击格子后整个阵型平移。
 */

import { useState, useCallback, useRef } from 'react';
import { getReachableTiles, getMoveCost, findPath, dist } from '@/systems/battleFlowManager';
import { MAP_W } from '@/components/battle/battleConstants';
import * as fmt from '@/systems/battleTextFormatter';

/** 手动战斗阶段 */
export const MANUAL_PHASE = {
  IDLE: 'idle',
  SELECT_MOVE: 'select_move',
  SELECT_ACTION: 'select_action',
  ANIMATING: 'animating',
  FORMATION_MOVE: 'formation_move',
  FORMATION_ACTION: 'formation_action',
};

function inB(y, x) { return y >= 0 && y < 10 && x >= 0 && x < 8; }

export function useManualBattle({
  battleTroops, mapResult, mapCardRef,
  performAttack, performCounterAttack, battleKill, battleMove,
  formationGroupMove, removeFormationBuffs,
  addLog,
}) {
  const [phase, setPhase] = useState(MANUAL_PHASE.IDLE);
  const [activeTroop, setActiveTroop] = useState(null);
  const [remainingMove, setRemainingMove] = useState(0);
  const [reachableTiles, setReachableTiles] = useState(null);
  const [attackTargets, setAttackTargets] = useState([]);

  // 阵型手动状态
  const [formationTroops, setFormationTroops] = useState(null);
  const [formationObj, setFormationObj] = useState(null);
  const [formationRemMove, setFormationRemMove] = useState(0);

  const resolveRef = useRef(null);

  // ── 高亮渲染 helpers ──

  const clearHighlights = useCallback(() => {
    const card = mapCardRef?.current;
    if (!card) return;
    card.querySelectorAll('.manual-hl').forEach(el => el.remove());
  }, [mapCardRef]);

  const showMoveHighlights = useCallback((troop, remMove) => {
    clearHighlights();
    const card = mapCardRef?.current;
    if (!card || !mapResult) return;
    const tmpTroop = { ...troop, movement: remMove };
    const reachable = getReachableTiles(tmpTroop, mapResult, battleTroops);
    setReachableTiles(reachable);
    const tiles = card.querySelectorAll('.map-grid .tile');
    for (const [key] of reachable) {
      const [ry, rx] = key.split(',').map(Number);
      const tile = tiles[ry * MAP_W + rx];
      if (!tile) continue;
      const hl = document.createElement('div');
      hl.className = 'manual-hl move-range';
      tile.appendChild(hl);
    }
    // 高亮攻击范围内的敌人
    const range = troop.range || 1;
    for (const e of battleTroops) {
      if (e.faction === troop.faction || e.currentTroops <= 0) continue;
      if (dist(troop, e) <= range) {
        const tile = tiles[e.y * MAP_W + e.x];
        if (!tile) continue;
        const hl = document.createElement('div');
        hl.className = 'manual-hl atk-target';
        tile.appendChild(hl);
      }
    }
  }, [mapCardRef, mapResult, battleTroops, clearHighlights]);

  const showAttackHighlights = useCallback((troop) => {
    clearHighlights();
    const card = mapCardRef?.current;
    if (!card) return;
    const range = troop.range || 1;
    const enemies = battleTroops.filter(t =>
      t.faction !== troop.faction && t.currentTroops > 0 &&
      (Math.abs(t.y - troop.y) + Math.abs(t.x - troop.x)) <= range
    );
    setAttackTargets(enemies);
    const tiles = card.querySelectorAll('.map-grid .tile');
    for (const e of enemies) {
      const tile = tiles[e.y * MAP_W + e.x];
      if (!tile) continue;
      const hl = document.createElement('div');
      hl.className = 'manual-hl atk-target';
      tile.appendChild(hl);
    }
  }, [mapCardRef, battleTroops, clearHighlights]);

  const highlightActiveTroop = useCallback((troop) => {
    const card = mapCardRef?.current;
    if (!card) return;
    const tiles = card.querySelectorAll('.map-grid .tile');
    const tile = tiles[troop.y * MAP_W + troop.x];
    if (!tile) return;
    const hl = document.createElement('div');
    hl.className = 'manual-hl active-troop';
    tile.appendChild(hl);
  }, [mapCardRef]);

  // ── 引擎调用：开始单兵手动回合 ──

  const startManualTurn = useCallback((troop) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      const move = troop.movement || 3;
      setActiveTroop(troop);
      setRemainingMove(move);
      setPhase(MANUAL_PHASE.SELECT_MOVE);
      highlightActiveTroop(troop);
      showMoveHighlights(troop, move);
    });
  }, [highlightActiveTroop, showMoveHighlights]);

  // ── 结束当前行动 ──

  const endTurn = useCallback(() => {
    clearHighlights();
    setPhase(MANUAL_PHASE.IDLE);
    setActiveTroop(null);
    setRemainingMove(0);
    setReachableTiles(null);
    setAttackTargets([]);
    setFormationTroops(null);
    setFormationObj(null);
    setFormationRemMove(0);
    if (resolveRef.current) {
      resolveRef.current();
      resolveRef.current = null;
    }
  }, [clearHighlights]);

  const enterActionPhase = useCallback((troop) => {
    setPhase(MANUAL_PHASE.SELECT_ACTION);
    setRemainingMove(0);
    showAttackHighlights(troop);
  }, [showAttackHighlights]);

  // ══════════════════════════════════════════
  // ── 阵型手动操控（点击格子移动） ──
  // ══════════════════════════════════════════

  /**
   * 计算阵型中心可达范围（以中心部队为基准）
   * 自行BFS，不检查部队占据（阵型整体移动，内部部队不算障碍）
   * 额外检查：中心移到目标后，所有阵型部队的偏移位置也必须合法
   */
  const getFormationReachable = useCallback((fTroops, remMove) => {
    if (!mapResult || remMove <= 0) return new Map();
    const alive = fTroops.filter(t => t.currentTroops > 0);
    if (alive.length === 0) return new Map();

    // 阵型中心
    const centerY = Math.round(alive.reduce((s, t) => s + t.y, 0) / alive.length);
    const centerX = Math.round(alive.reduce((s, t) => s + t.x, 0) / alive.length);

    // 各部队相对中心的偏移
    const offsets = alive.map(t => ({ dy: t.y - centerY, dx: t.x - centerX }));
    // 阵型部队坐标集合（用于排除自身占据检查）
    const fSet = new Set(alive.map(t => `${t.y},${t.x}`));

    // BFS：只检查中心点地形通行性，不检查部队占据
    const visited = new Map();
    const queue = [{ y: centerY, x: centerX, rem: remMove }];
    visited.set(`${centerY},${centerX}`, remMove);
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    while (queue.length > 0) {
      const { y, x, rem } = queue.shift();
      for (const [dy, dx] of dirs) {
        const ny = y + dy, nx = x + dx;
        if (!inB(ny, nx)) continue;
        const cost = getMoveCost(ny, nx, mapResult);
        if (cost === Infinity) continue;
        const newRem = rem - cost;
        if (newRem < 0) continue;
        const key = `${ny},${nx}`;
        if (visited.has(key) && visited.get(key) >= newRem) continue;
        visited.set(key, newRem);
        queue.push({ y: ny, x: nx, rem: newRem });
      }
    }
    visited.delete(`${centerY},${centerX}`); // 移除起点

    // 过滤：中心移到目标后，所有偏移位置也必须合法
    const validReachable = new Map();
    for (const [key, remaining] of visited) {
      const [cy, cx] = key.split(',').map(Number);
      const allValid = offsets.every(({ dy, dx }) => {
        const ny = cy + dy, nx = cx + dx;
        if (!inB(ny, nx)) return false;
        if (getMoveCost(ny, nx, mapResult) === Infinity) return false;
        // 不能撞到非阵型部队
        const occupant = battleTroops.find(bt =>
          bt.currentTroops > 0 && bt.y === ny && bt.x === nx
        );
        if (occupant && !fSet.has(`${occupant.y},${occupant.x}`)) return false;
        return true;
      });
      if (allValid) validReachable.set(key, remaining);
    }
    return validReachable;
  }, [mapResult, battleTroops]);

  /** 高亮阵型部队 + 中心可达范围 + 攻击范围内的敌人 */
  const showFormationMoveHighlights = useCallback((fTroops, remMove) => {
    clearHighlights();
    const card = mapCardRef?.current;
    if (!card) return;
    const tiles = card.querySelectorAll('.map-grid .tile');

    // 高亮阵型部队
    for (const t of fTroops) {
      if (t.currentTroops <= 0) continue;
      const tile = tiles[t.y * MAP_W + t.x];
      if (!tile) continue;
      const hl = document.createElement('div');
      hl.className = 'manual-hl active-troop';
      tile.appendChild(hl);
    }

    // 高亮可达范围
    const reachable = getFormationReachable(fTroops, remMove);
    setReachableTiles(reachable);
    for (const [key] of reachable) {
      const [ry, rx] = key.split(',').map(Number);
      const tile = tiles[ry * MAP_W + rx];
      if (!tile) continue;
      const hl = document.createElement('div');
      hl.className = 'manual-hl move-range';
      tile.appendChild(hl);
    }

    // 高亮攻击范围内的敌人（让玩家知道可以直接点击攻击）
    const alive = fTroops.filter(t => t.currentTroops > 0);
    const enemySet = new Set();
    for (const atk of alive) {
      const range = atk.range || 1;
      for (const e of battleTroops) {
        if (e.faction === 'player' || e.currentTroops <= 0) continue;
        if (dist(atk, e) <= range && !enemySet.has(e.id)) {
          enemySet.add(e.id);
          const tile = tiles[e.y * MAP_W + e.x];
          if (!tile) continue;
          const hl = document.createElement('div');
          hl.className = 'manual-hl atk-target';
          tile.appendChild(hl);
        }
      }
    }
  }, [mapCardRef, clearHighlights, getFormationReachable, battleTroops]);

  /** 引擎调用：开始阵型手动回合 */
  const startFormationTurn = useCallback((fTroops, formation) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      const formationMove = Math.min(...fTroops.map(t => t.movement || 3));
      setFormationTroops(fTroops);
      setFormationObj(formation);
      setFormationRemMove(formationMove);
      setPhase(MANUAL_PHASE.FORMATION_MOVE);
      addLog(fmt.fmtFormationAction(formation?.name), 'skill');
      showFormationMoveHighlights(fTroops, formationMove);
    });
  }, [addLog, showFormationMoveHighlights]);

  /** 进入阵型攻击阶段：高亮所有阵型部队攻击范围内的敌人 */
  const enterFormationAction = useCallback(() => {
    setPhase(MANUAL_PHASE.FORMATION_ACTION);
    clearHighlights();
    const card = mapCardRef?.current;
    if (!card || !formationTroops) return;

    const alive = formationTroops.filter(t => t.currentTroops > 0);
    // 收集所有阵型部队攻击范围内的敌人（去重）
    const enemySet = new Map();
    for (const atk of alive) {
      const range = atk.range || 1;
      for (const e of battleTroops) {
        if (e.faction === 'player' || e.currentTroops <= 0) continue;
        if (dist(atk, e) <= range && !enemySet.has(e.id)) {
          enemySet.set(e.id, e);
        }
      }
    }
    const targets = [...enemySet.values()];
    setAttackTargets(targets);

    // 高亮可攻击敌人
    const tiles = card.querySelectorAll('.map-grid .tile');
    for (const e of targets) {
      const tile = tiles[e.y * MAP_W + e.x];
      if (!tile) continue;
      const hl = document.createElement('div');
      hl.className = 'manual-hl atk-target';
      tile.appendChild(hl);
    }
  }, [clearHighlights, mapCardRef, formationTroops, battleTroops]);

  /** 停止阵型移动 → 进入攻击 */
  const handleFormationStopMove = useCallback(() => {
    if (phase !== MANUAL_PHASE.FORMATION_MOVE) return;
    enterFormationAction();
  }, [phase, enterFormationAction]);

  /** 执行阵型攻击（点击敌人触发，每个部队攻击范围内最近敌人，攻击后解散阵型） */
  const doFormationAttack = useCallback(async (clickedEnemy) => {
    if (!formationTroops) return;
    setPhase(MANUAL_PHASE.ANIMATING);
    clearHighlights();

    const alive = formationTroops.filter(t => t.currentTroops > 0);
    const enemies = battleTroops.filter(t => t.faction === 'enemy' && t.currentTroops > 0);

    // 按距离排序敌人（以点击的敌人优先）
    const centerY = Math.round(alive.reduce((s, t) => s + t.y, 0) / alive.length);
    const centerX = Math.round(alive.reduce((s, t) => s + t.x, 0) / alive.length);
    const sortedEnemies = [...enemies].sort((a, b) => {
      // 被点击的敌人排最前
      if (a === clickedEnemy) return -1;
      if (b === clickedEnemy) return 1;
      const da = Math.abs(a.y - centerY) + Math.abs(a.x - centerX);
      const db = Math.abs(b.y - centerY) + Math.abs(b.x - centerX);
      return da - db;
    });

    addLog(fmt.fmtFormationAttack(), 'skill');
    for (const atk of alive) {
      if (atk.currentTroops <= 0) continue;
      let target = null;
      for (const e of sortedEnemies) {
        if (e.currentTroops > 0 && dist(atk, e) <= (atk.range || 1)) { target = e; break; }
      }
      if (!target) continue;
      await performAttack(atk, target);
      if (target.currentTroops <= 0) await battleKill(target);
    }
    // 敌方反击
    const survivingEnemies = enemies.filter(e => e.currentTroops > 0);
    const survivingF = alive.filter(t => t.currentTroops > 0);
    if (survivingEnemies.length > 0 && survivingF.length > 0) {
      const ce = survivingEnemies[0];
      const ct = survivingF.find(t => dist(ce, t) <= (ce.range || 1));
      if (ct) {
        addLog(fmt.fmtEnemyCounter(), 'attack');
        await performAttack(ce, ct);
        if (ct.currentTroops <= 0) await battleKill(ct);
      }
    }

    for (const t of formationTroops) t._formationHandled = true;
    removeFormationBuffs();
    endTurn();
  }, [formationTroops, battleTroops, clearHighlights, addLog,
      performAttack, battleKill, removeFormationBuffs, endTurn]);

  /** 阵型待机（跳过移动+攻击） */
  const handleFormationStandby = useCallback(() => {
    if (phase !== MANUAL_PHASE.FORMATION_MOVE && phase !== MANUAL_PHASE.FORMATION_ACTION) return;
    clearHighlights();
    addLog(fmt.fmtFormationWait(), 'move');
    for (const t of (formationTroops || [])) t._formationHandled = true;
    endTurn();
  }, [phase, formationTroops, clearHighlights, addLog, endTurn]);

  // ══════════════════════════════════════════
  // ── tile 点击处理（单兵 + 阵型） ──
  // ══════════════════════════════════════════

  const handleTileClick = useCallback(async (y, x) => {
    // ── 阵型移动阶段：点击格子整体平移 ──
    if (phase === MANUAL_PHASE.FORMATION_MOVE && formationTroops) {
      // 先检查：点击的是否是攻击范围内的敌人 → 直接进入攻击
      const alive = formationTroops.filter(t => t.currentTroops > 0);
      const clickedEnemy = battleTroops.find(t =>
        t.faction === 'enemy' && t.currentTroops > 0 && t.y === y && t.x === x
      );
      if (clickedEnemy) {
        const inRange = alive.some(atk => dist(atk, clickedEnemy) <= (atk.range || 1));
        if (inRange) {
          await doFormationAttack(clickedEnemy);
          return;
        }
      }

      const key = `${y},${x}`;
      if (!reachableTiles || !reachableTiles.has(key)) return;

      if (alive.length === 0) { endTurn(); return; }

      // 计算当前中心
      const centerY = Math.round(alive.reduce((s, t) => s + t.y, 0) / alive.length);
      const centerX = Math.round(alive.reduce((s, t) => s + t.x, 0) / alive.length);
      const totalDy = y - centerY;
      const totalDx = x - centerX;
      if (totalDy === 0 && totalDx === 0) return;

      setPhase(MANUAL_PHASE.ANIMATING);
      clearHighlights();

      // 逐步移动（先纵向再横向，和自动模式一致）
      let remMove = formationRemMove;
      // 纵向
      const stepY = totalDy > 0 ? 1 : -1;
      for (let i = 0; i < Math.abs(totalDy) && remMove > 0; i++) {
        const curAlive = formationTroops.filter(t => t.currentTroops > 0);
        const maxCost = Math.max(...curAlive.map(t => {
          const ny = t.y + stepY;
          return inB(ny, t.x) ? getMoveCost(ny, t.x, mapResult) : Infinity;
        }));
        if (maxCost > remMove || maxCost === Infinity) break;
        addLog(fmt.fmtFormationMove(stepY), 'move');
        const ok = await formationGroupMove(curAlive, stepY, 0);
        if (!ok) break;
        remMove -= maxCost;
      }
      // 横向
      const stepX = totalDx > 0 ? 1 : -1;
      for (let i = 0; i < Math.abs(totalDx) && remMove > 0; i++) {
        const curAlive = formationTroops.filter(t => t.currentTroops > 0);
        const maxCost = Math.max(...curAlive.map(t => {
          const nx = t.x + stepX;
          return inB(t.y, nx) ? getMoveCost(t.y, nx, mapResult) : Infinity;
        }));
        if (maxCost > remMove || maxCost === Infinity) break;
        addLog(fmt.fmtFormationMoveX(stepX), 'move');
        const ok = await formationGroupMove(curAlive, 0, stepX);
        if (!ok) break;
        remMove -= maxCost;
      }

      setFormationRemMove(remMove);
      // 检查阵型部队是否全灭（如踩陷阱）
      const stillAlive = formationTroops.filter(t => t.currentTroops > 0);
      if (stillAlive.length === 0) { endTurn(); return; }
      if (remMove > 0) {
        setPhase(MANUAL_PHASE.FORMATION_MOVE);
        showFormationMoveHighlights(formationTroops, remMove);
      } else {
        enterFormationAction();
      }
      return;
    }

    // ── 阵型攻击阶段：点击红色高亮敌人触发整体攻击 ──
    if (phase === MANUAL_PHASE.FORMATION_ACTION && formationTroops) {
      const clickedEnemy = attackTargets.find(t => t.y === y && t.x === x);
      if (clickedEnemy) {
        await doFormationAttack(clickedEnemy);
        return;
      }
      return;
    }

    // ── 单兵移动阶段 ──
    if (phase === MANUAL_PHASE.SELECT_MOVE && activeTroop) {
      const key = `${y},${x}`;

      if (reachableTiles && reachableTiles.has(key)) {
        setPhase(MANUAL_PHASE.ANIMATING);
        clearHighlights();
        const tmpTroop = { ...activeTroop, y: activeTroop.y, x: activeTroop.x, movement: remainingMove };
        const path = findPath(tmpTroop, y, x, mapResult, battleTroops);
        if (!path || path.length === 0) return;

        await battleMove(activeTroop, path);
        if (activeTroop.currentTroops <= 0) { endTurn(); return; }

        let totalCost = 0;
        for (const step of path) totalCost += getMoveCost(step.y, step.x, mapResult);
        const newRemaining = remainingMove - totalCost;
        setRemainingMove(newRemaining);

        if (newRemaining > 0) {
          setPhase(MANUAL_PHASE.SELECT_MOVE);
          highlightActiveTroop(activeTroop);
          showMoveHighlights(activeTroop, newRemaining);
        } else {
          enterActionPhase(activeTroop);
        }
        return;
      }

      // 直接攻击范围内敌人
      const range = activeTroop.range || 1;
      const clickedEnemy = battleTroops.find(t =>
        t.faction !== activeTroop.faction && t.currentTroops > 0 &&
        t.y === y && t.x === x &&
        (Math.abs(t.y - activeTroop.y) + Math.abs(t.x - activeTroop.x)) <= range
      );
      if (clickedEnemy) {
        setPhase(MANUAL_PHASE.ANIMATING);
        clearHighlights();
        await performAttack(activeTroop, clickedEnemy);
        if (clickedEnemy.currentTroops <= 0) {
          await battleKill(clickedEnemy);
        } else {
          await performCounterAttack(activeTroop, clickedEnemy);
        }
        endTurn();
        return;
      }
      return;
    }

    // ── 单兵行动阶段 ──
    if (phase === MANUAL_PHASE.SELECT_ACTION && activeTroop) {
      const clickedEnemy = attackTargets.find(t => t.y === y && t.x === x);
      if (clickedEnemy) {
        setPhase(MANUAL_PHASE.ANIMATING);
        clearHighlights();
        await performAttack(activeTroop, clickedEnemy);
        if (clickedEnemy.currentTroops <= 0) {
          await battleKill(clickedEnemy);
        } else {
          await performCounterAttack(activeTroop, clickedEnemy);
        }
        endTurn();
        return;
      }
      return;
    }
  }, [phase, activeTroop, formationTroops, reachableTiles, remainingMove,
      formationRemMove, attackTargets, battleTroops, mapResult,
      clearHighlights, highlightActiveTroop, showMoveHighlights,
      showFormationMoveHighlights, enterActionPhase, enterFormationAction,
      endTurn, battleMove, formationGroupMove, doFormationAttack,
      performAttack, performCounterAttack, battleKill, addLog]);

  // ── 单兵待机 ──

  const handleStandby = useCallback(() => {
    if (phase !== MANUAL_PHASE.SELECT_MOVE && phase !== MANUAL_PHASE.SELECT_ACTION) return;
    clearHighlights();
    addLog(`  💤 ${activeTroop?.character?.courtesyName || activeTroop?.name || '部队'} 原地待机`, 'move');
    endTurn();
  }, [phase, activeTroop, clearHighlights, addLog, endTurn]);

  // ── 跳过移动 ──

  const handleSkipMove = useCallback(() => {
    if (phase !== MANUAL_PHASE.SELECT_MOVE || !activeTroop) return;
    enterActionPhase(activeTroop);
  }, [phase, activeTroop, enterActionPhase]);

  return {
    // 状态
    phase,
    activeTroop,
    remainingMove,
    attackTargets,
    // 阵型状态
    formationTroops,
    formationObj,
    formationRemMove,
    // 引擎接口
    startManualTurn,
    startFormationTurn,
    // UI 事件（单兵 + 阵型共用 handleTileClick）
    handleTileClick,
    handleStandby,
    handleSkipMove,
    // 阵型 UI 事件
    handleFormationStopMove,
    handleFormationStandby,
  };
}
