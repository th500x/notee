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
import { getReachableTiles, getMoveCost, findPath, dist, troopAttackRange } from '@/systems/battleFlowManager';
import { computeFormationReachable } from '@/battle/formationReachable';
import { estimateDamage } from '@/systems/combatSystem';
import { getMapTerrainDimensions } from '@shared/utils/tacticalBattleGrid';
import * as fmt from '@/systems/battleTextFormatter';
import { resolveChestReward } from '@/battle/chestRewardResolver';

/** 手动战斗阶段 */
export const MANUAL_PHASE = {
  IDLE: 'idle',
  SELECT_MOVE: 'select_move',
  SELECT_ACTION: 'select_action',
  ANIMATING: 'animating',
  FORMATION_MOVE: 'formation_move',
  FORMATION_ACTION: 'formation_action',
};

export function useManualBattle({
  battleTroops, mapResult,
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

  // 两次点击攻击预览
  const [attackPreview, setAttackPreview] = useState(null); // { target, estimate, counterEstimate? }

  // 宝箱奖励
  const [chestReward, setChestReward] = useState(null); // 装备件对象
  const chestResolveRef = useRef(null);
  const collectedChestRewards = useRef([]); // 收集所有宝箱奖励，战斗结束时发送后端

  const resolveRef = useRef(null);

  const [manualHighlightModel, setManualHighlightModel] = useState(null);

  const clearHighlights = useCallback(() => {
    setManualHighlightModel(null);
  }, []);

  const showMoveHighlights = useCallback((troop, remMove) => {
    if (!mapResult) return;
    const tmpTroop = { ...troop, movement: remMove };
    const reachable = getReachableTiles(tmpTroop, mapResult, battleTroops);
    setReachableTiles(reachable);
    const move = [];
    for (const [key] of reachable) {
      const [ry, rx] = key.split(',').map(Number);
      const cost = getMoveCost(ry, rx, mapResult);
      move.push({ y: ry, x: rx, ...(cost > 1 ? { cost } : {}) });
    }
    const range = troopAttackRange(troop);
    const atk = [];
    for (const e of battleTroops) {
      if (e.currentTroops <= 0 || e.faction !== 'enemy') continue;
      if (dist(troop, e) <= range) atk.push({ y: e.y, x: e.x });
    }
    setManualHighlightModel({
      active: [{ y: troop.y, x: troop.x }],
      move,
      atk,
    });
  }, [mapResult, battleTroops]);

  const showAttackHighlights = useCallback((troop) => {
    const range = troopAttackRange(troop);
    const enemies = battleTroops.filter(
      (t) =>
        t.faction === 'enemy' &&
        t.currentTroops > 0 &&
        Math.abs(t.y - troop.y) + Math.abs(t.x - troop.x) <= range,
    );
    setAttackTargets(enemies);
    setManualHighlightModel({
      active: [],
      move: [],
      atk: enemies.map((e) => ({ y: e.y, x: e.x })),
    });
  }, [battleTroops]);

  // ── 引擎调用：开始单兵手动回合 ──

  const startManualTurn = useCallback((troop) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      const move = troop.movement || 3;
      setActiveTroop(troop);
      setRemainingMove(move);
      setPhase(MANUAL_PHASE.SELECT_MOVE);
      showMoveHighlights(troop, move);
    });
  }, [showMoveHighlights]);

  // ── 宝箱检查：行动结束后检查当前格子是否有未开启的宝箱 ──

  const checkChestAtTroop = useCallback(async (troop) => {
    const reward = await resolveChestReward(troop, mapResult, battleTroops);
    if (!reward) return;

    addLog(`  📦 ${reward.troopName} 开启宝箱，获得 ${reward.name}（${reward.rarityLabel}）`, 'skill');
    collectedChestRewards.current.push(reward);

    return new Promise((resolve) => {
      chestResolveRef.current = resolve;
      setChestReward(reward);
    });
  }, [mapResult, battleTroops, addLog]);

  /** 玩家确认收下宝箱奖励 */
  const confirmChestReward = useCallback(() => {
    setChestReward(null);
    if (chestResolveRef.current) {
      chestResolveRef.current();
      chestResolveRef.current = null;
    }
  }, []);

  // ── 结束当前行动 ──

  const endTurn = useCallback(() => {
    clearHighlights();
    setAttackPreview(null);
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

  /** 阵型中心可达范围（委托给纯函数 computeFormationReachable，便于测试与复用） */
  const getFormationReachable = useCallback((fTroops, remMove) => {
    return computeFormationReachable(fTroops, remMove, mapResult, battleTroops);
  }, [mapResult, battleTroops]);

  /** 高亮阵型部队 + 中心可达范围 + 攻击范围内的敌人 */
  const showFormationMoveHighlights = useCallback((fTroops, remMove) => {
    const reachable = getFormationReachable(fTroops, remMove);
    setReachableTiles(reachable);
    const move = [];
    for (const [key] of reachable) {
      const [ry, rx] = key.split(',').map(Number);
      const cost = getMoveCost(ry, rx, mapResult);
      move.push({ y: ry, x: rx, ...(cost > 1 ? { cost } : {}) });
    }
    const active = [];
    for (const t of fTroops) {
      if (t.currentTroops <= 0) continue;
      active.push({ y: t.y, x: t.x });
    }
    const atkTiles = [];
    const alive = fTroops.filter((t) => t.currentTroops > 0);
    const enemySeen = new Set();
    for (const atkTroop of alive) {
      const rng = troopAttackRange(atkTroop);
      for (const e of battleTroops) {
        if (e.faction !== 'enemy' || e.currentTroops <= 0) continue;
        if (dist(atkTroop, e) <= rng && !enemySeen.has(e.id)) {
          enemySeen.add(e.id);
          atkTiles.push({ y: e.y, x: e.x });
        }
      }
    }
    setManualHighlightModel({ active, move, atk: atkTiles });
  }, [getFormationReachable, battleTroops, mapResult]);

  /** 引擎调用：开始阵型手动回合 */
  const startFormationTurn = useCallback((fTroops, formation) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      const movements = fTroops.map(t => t.movement || 3);
      const formationMove = Math.round(movements.reduce((a, b) => a + b, 0) / movements.length);
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
    if (!formationTroops) return;

    const alive = formationTroops.filter(t => t.currentTroops > 0);
    const enemySet = new Map();
    for (const atk of alive) {
      const range = troopAttackRange(atk);
      for (const e of battleTroops) {
        if (e.faction !== 'enemy' || e.currentTroops <= 0) continue;
        if (dist(atk, e) <= range && !enemySet.has(e.id)) {
          enemySet.set(e.id, e);
        }
      }
    }
    const targets = [...enemySet.values()];
    setAttackTargets(targets);
    setManualHighlightModel({
      active: [],
      move: [],
      atk: targets.map((e) => ({ y: e.y, x: e.x })),
    });
  }, [formationTroops, battleTroops]);

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
        if (e.currentTroops > 0 && dist(atk, e) <= troopAttackRange(atk)) { target = e; break; }
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
      const ct = survivingF.find(t => dist(ce, t) <= troopAttackRange(ce));
      if (ct) {
        addLog(fmt.fmtEnemyCounter(), 'attack');
        await performAttack(ce, ct);
        if (ct.currentTroops <= 0) await battleKill(ct);
      }
    }

    for (const t of formationTroops) t._formationHandled = true;
    removeFormationBuffs();

    // 宝箱检查：阵型中所有存活部队检查脚下宝箱
    for (const t of formationTroops.filter(ft => ft.currentTroops > 0)) {
      await checkChestAtTroop(t);
    }

    endTurn();
  }, [formationTroops, battleTroops, clearHighlights, addLog,
      performAttack, battleKill, removeFormationBuffs, endTurn, checkChestAtTroop]);

  /** 阵型待机（跳过移动+攻击） */
  const handleFormationStandby = useCallback(async () => {
    if (phase !== MANUAL_PHASE.FORMATION_MOVE && phase !== MANUAL_PHASE.FORMATION_ACTION) return;
    clearHighlights();
    addLog(fmt.fmtFormationWait(), 'move');
    // 宝箱检查
    for (const t of (formationTroops || []).filter(ft => ft.currentTroops > 0)) {
      await checkChestAtTroop(t);
    }
    for (const t of (formationTroops || [])) t._formationHandled = true;
    endTurn();
  }, [phase, formationTroops, clearHighlights, addLog, endTurn, checkChestAtTroop]);

  // ══════════════════════════════════════════
  // ── tile 点击处理（单兵 + 阵型） ──
  // ══════════════════════════════════════════

  const handleTileClick = useCallback(async (y, x) => {
    const { w: mapW, h: mapH } = getMapTerrainDimensions(mapResult);
    const inB = (ry, rx) => ry >= 0 && ry < mapH && rx >= 0 && rx < mapW;

    // ── 阵型移动阶段：点击格子整体平移 ──
    if (phase === MANUAL_PHASE.FORMATION_MOVE && formationTroops) {
      // 先检查：点击的是否是攻击范围内的敌人 → 直接进入攻击
      const alive = formationTroops.filter(t => t.currentTroops > 0);
      const clickedEnemy = battleTroops.find(t =>
        t.faction === 'enemy' && t.currentTroops > 0 && t.y === y && t.x === x
      );
      if (clickedEnemy) {
        const inRange = alive.some(atk => dist(atk, clickedEnemy) <= troopAttackRange(atk));
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
        setAttackPreview(null);
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
          showMoveHighlights(activeTroop, newRemaining);
        } else {
          enterActionPhase(activeTroop);
        }
        return;
      }

      // 两次点击攻击：范围内敌人
      const range = troopAttackRange(activeTroop);
      const clickedEnemy = battleTroops.find(t =>
        t.faction !== activeTroop.faction && t.currentTroops > 0 &&
        t.y === y && t.x === x &&
        (Math.abs(t.y - activeTroop.y) + Math.abs(t.x - activeTroop.x)) <= range
      );
      if (clickedEnemy) {
        // 第二次点击同一目标 → 确认攻击
        if (attackPreview && attackPreview.target === clickedEnemy) {
          setAttackPreview(null);
          setPhase(MANUAL_PHASE.ANIMATING);
          clearHighlights();
          await performAttack(activeTroop, clickedEnemy);
          if (clickedEnemy.currentTroops <= 0) {
            await battleKill(clickedEnemy);
          } else {
            await performCounterAttack(activeTroop, clickedEnemy);
          }
          await checkChestAtTroop(activeTroop);
          endTurn();
          return;
        }
        // 第一次点击 → 显示预估伤害（与 calcDamage：主动 normal / 反击 counter 一致）
        const estimate = estimateDamage(activeTroop, clickedEnemy, mapResult?.terrain, { strike: 'normal' });
        const canCounter =
          dist(clickedEnemy, activeTroop) <= troopAttackRange(clickedEnemy);
        const counterEstimate = canCounter
          ? estimateDamage(clickedEnemy, activeTroop, mapResult?.terrain, { strike: 'counter' })
          : null;
        setAttackPreview({ target: clickedEnemy, estimate, counterEstimate });
        return;
      }

      // 点击空白处取消预览
      setAttackPreview(null);
      return;
    }

    // ── 单兵行动阶段 ──
    if (phase === MANUAL_PHASE.SELECT_ACTION && activeTroop) {
      const clickedEnemy = attackTargets.find(t => t.y === y && t.x === x);
      if (clickedEnemy) {
        // 第二次点击同一目标 → 确认攻击
        if (attackPreview && attackPreview.target === clickedEnemy) {
          setAttackPreview(null);
          setPhase(MANUAL_PHASE.ANIMATING);
          clearHighlights();
          await performAttack(activeTroop, clickedEnemy);
          if (clickedEnemy.currentTroops <= 0) {
            await battleKill(clickedEnemy);
          } else {
            await performCounterAttack(activeTroop, clickedEnemy);
          }
          await checkChestAtTroop(activeTroop);
          endTurn();
          return;
        }
        // 第一次点击 → 显示预估伤害
        const estimate = estimateDamage(activeTroop, clickedEnemy, mapResult?.terrain, { strike: 'normal' });
        const canCounter =
          dist(clickedEnemy, activeTroop) <= troopAttackRange(clickedEnemy);
        const counterEstimate = canCounter
          ? estimateDamage(clickedEnemy, activeTroop, mapResult?.terrain, { strike: 'counter' })
          : null;
        setAttackPreview({ target: clickedEnemy, estimate, counterEstimate });
        return;
      }

      // 点击空白处取消预览
      setAttackPreview(null);
      return;
    }
  }, [phase, activeTroop, formationTroops, reachableTiles, remainingMove,
      formationRemMove, attackTargets, attackPreview, battleTroops, mapResult,
      clearHighlights, showMoveHighlights,
      showFormationMoveHighlights, enterActionPhase, enterFormationAction,
      endTurn, battleMove, formationGroupMove, doFormationAttack,
      performAttack, performCounterAttack, battleKill, addLog, checkChestAtTroop]);

  // ── 单兵待机 ──

  const handleStandby = useCallback(async () => {
    if (phase !== MANUAL_PHASE.SELECT_MOVE && phase !== MANUAL_PHASE.SELECT_ACTION) return;
    clearHighlights();
    setAttackPreview(null);
    addLog(`  💤 ${activeTroop?.character?.courtesyName || activeTroop?.name || '部队'} 原地待机`, 'move');
    await checkChestAtTroop(activeTroop);
    endTurn();
  }, [phase, activeTroop, clearHighlights, addLog, endTurn, checkChestAtTroop]);

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
    reachableTiles,
    attackTargets,
    /** 战术格高亮（由 BattleMap / 战役格网各自渲染，非 DOM 注入） */
    manualHighlightModel,
    // 两次点击攻击预览
    attackPreview,
    // 宝箱奖励
    chestReward,
    confirmChestReward,
    /** 战斗结束保存战报时务必调用此函数；勿用快照字段（闭包/渲染时机会导致始终为空） */
    getCollectedChestRewards: () => collectedChestRewards.current.slice(),
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
