/**
 * useManualBattle - 手动战斗状态机
 *
 * 管理手动模式下玩家部队的操作流程：
 *   单兵：SELECT_MOVE → SELECT_ACTION → 结束
 *   阵型：FORMATION_MOVE → FORMATION_ACTION → 结束
 *
 * 阵型移动：以中心部队为基准计算可达范围，点击格子后整个阵型平移。
 *
 * 行动阶段默认仅 **普通攻击** 预览与确认；点击小型图左侧「技能」进入 **技能施放模式**（再点一次关闭）。
 * **移动阶段**亦可点「技能」仅查看/预选施法格，**不消耗移动力**；再点「技能」关闭后仍可继续移动；真正攻击/施法/待机后才结束本回合行动。
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { getReachableTiles, getMoveCost, findPathForAi, dist, troopAttackRange } from '@/systems/battleFlowManager';
import { computeFormationReachable, findFormationCenterPath } from '@/battle/formationReachable';
import { estimateDamage, isMoraleCollapsed } from '@/systems/combatSystem';
import { getMapTerrainDimensions } from '@shared/utils/tacticalBattleGrid';
import { getActiveSkillChargesForMapDimensions } from '@shared/utils/tacticalActiveSkillCharges.js';
import { getTacticalActiveSkillCastRange } from '@shared/utils/tacticalSkillCastRange';
import {
  getRemainingPhase3HealCharges,
  listPhase3HealTargetTroops,
  previewPhase3HealGains,
} from '@shared/utils/skillPhase3ActiveHeal';
import {
  cellsForPhase4TargetPattern,
  filterPatternCellsInMap,
  listPhase4AnchorEnemyCandidates,
  listPhase4ShapeVictims,
  pickPhase4LineCellsForAnchor,
  pickPhase4RandomVictims,
} from '@shared/utils/skillPhase4ActiveDamage';
import {
  getRemainingPhase5CompositeCharges,
  healDamageHasHostileInRange,
  phase5HealSlotStub,
} from '@shared/utils/skillPhase5CompositeDamage';
import {
  buildManualActiveSkillArms,
  activeSkillArmCharges,
  armHasActionableTargets,
} from '@/battle/manualActiveSkillArms';
import * as fmt from '@/systems/battleTextFormatter';
import { resolveChestReward } from '@/battle/chestRewardResolver';
import { resolveRandomBoxEffect } from '@/battle/randomBoxResolver';
import { buildSkillDamagePreviewMetaLines } from '@/components/battle/battleConstants';

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
  performAttack, performCounterAttack, performPhase3Heal, performPhase4Damage, performPhase5Composite, battleKill, battleMove,
  formationGroupMove, removeFormationBuffs,
  addLog,
  /** 可选：随机箱增援/天罚后强制刷新战场列表 */
  setBattleTroops = null,
  /** 宝箱/随机箱/农场消耗后刷新对象瓦 */
  setMapResult = null,
  /** 小型图左栏：为 true 时须先点「技能」才进入主动技选格；战役大地图等传 false，保持始终可施放主动技 */
  requireSkillModeToggle = true,
  /** `useSkillsMap()`：左栏技能名旁 tooltip 用主数据 `description` */
  skillsMap = {},
  /** 小型图等：玩家本局首次提交手动操作（移动/攻击/待机等）时回调一次 */
  onManualPlayerActionCommitted,
}) {
  const manualActionCommittedGateRef = useRef(false);
  const fireManualPlayerActionCommitted = useCallback(() => {
    if (manualActionCommittedGateRef.current) return;
    manualActionCommittedGateRef.current = true;
    onManualPlayerActionCommitted?.();
  }, [onManualPlayerActionCommitted]);
  const [phase, setPhase] = useState(MANUAL_PHASE.IDLE);
  const [activeTroop, setActiveTroop] = useState(null);
  const [remainingMove, setRemainingMove] = useState(0);
  const [reachableTiles, setReachableTiles] = useState(null);
  const [attackTargets, setAttackTargets] = useState([]);
  /** 阶段3 治疗可选目标（与 attackTargets 并列，行动阶段双击确认） */
  const [healTargets, setHealTargets] = useState([]);

  // 阵型手动状态
  const [formationTroops, setFormationTroops] = useState(null);
  const [formationObj, setFormationObj] = useState(null);
  const [formationRemMove, setFormationRemMove] = useState(0);

  // 两次点击攻击预览
  const [attackPreview, setAttackPreview] = useState(null);
  /** 阶段3 治疗预览：{ target, slot, selfGain, allyGain } */
  const [healPreview, setHealPreview] = useState(null);
  /** 阶段4 形状技：已选锚点敌军，第二次点击同一格确认施放 */
  const [phase4ShapePreview, setPhase4ShapePreview] = useState(null);
  /** 阶段3/4 多主动技时，「技能」键切换武装槽（先列阶段4，再阶段3） */
  const [activeSkillArmIndex, setActiveSkillArmIndex] = useState(0);
  /** 左侧「技能」键展开：可选主动技列表（多武装时先选技） */
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  /** 为 true 时行动阶段才响应阶段3/4/5 选格；否则仅普通攻击预览（默认关，点「技能」开启，再点一次关闭） */
  const [skillTargetingActive, setSkillTargetingActive] = useState(false);
  // 宝箱奖励
  const [chestReward, setChestReward] = useState(null);
  const chestResolveRef = useRef(null);
  const collectedChestRewards = useRef([]);

  const resolveRef = useRef(null);
  /** 移动阶段点「技能」：仅切换技能意向，不再强制切入行动阶段（保留剩余移动力与蓝格） */

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

  const pickInitialActiveSkillArmIndex = useCallback(
    (troop) => {
      const { w: mapW, h: mapH } = getMapTerrainDimensions(mapResult);
      const arms = buildManualActiveSkillArms(troop);
      for (let i = 0; i < arms.length; i++) {
        if (activeSkillArmCharges(troop, arms[i]) <= 0) continue;
        if (armHasActionableTargets(troop, arms[i], battleTroops, mapH, mapW)) return i;
      }
      return 0;
    },
    [battleTroops, mapResult],
  );

  const showCombatActionHighlights = useCallback(
    (troop, armedIdx, opts = {}) => {
      if (!mapResult) return;
      const mergeRemRaw = opts?.mergeRemainingMove;
      const mergeRem =
        mergeRemRaw != null && Number.isFinite(Number(mergeRemRaw)) && Number(mergeRemRaw) > 0
          ? Number(mergeRemRaw)
          : null;
      const skillOverlayOn =
        mergeRem != null
          ? (!requireSkillModeToggle || skillTargetingActive)
          : (!requireSkillModeToggle || skillTargetingActive || skillPickerOpen);

      const range = troopAttackRange(troop);
      const meleeEnemies = battleTroops.filter(
        (t) =>
          t.faction === 'enemy' &&
          t.currentTroops > 0 &&
          Math.abs(t.y - troop.y) + Math.abs(t.x - troop.x) <= range,
      );
      setAttackTargets(meleeEnemies);
      const { w: mapW, h: mapH } = getMapTerrainDimensions(mapResult);
      const arms = buildManualActiveSkillArms(troop);
      const arm = arms.length ? arms[Math.min(Math.max(0, armedIdx), arms.length - 1)] : null;

      const eff5 = arm?.kind === 'phase5' ? String(arm.slot?.skillEffectType || '').toLowerCase() : '';

      let healTiles = [];
      let hList = [];
      let skillPreview = [];
      if (skillOverlayOn) {
        if (arm?.kind === 'phase3' && activeSkillArmCharges(troop, arm) > 0) {
          hList = listPhase3HealTargetTroops(troop, arm.slot, battleTroops);
          healTiles = hList.map((t) => ({ y: t.y, x: t.x }));
        } else if (
          arm?.kind === 'phase5' &&
          eff5 === 'heal_damage' &&
          getRemainingPhase5CompositeCharges(troop, arm.slot.skillId) > 0
        ) {
          const stub = phase5HealSlotStub(arm.slot);
          const { selfGain, allyGain } = previewPhase3HealGains(troop, troop, stub);
          if (selfGain + allyGain > 0 && healDamageHasHostileInRange(troop, battleTroops, getTacticalActiveSkillCastRange(arm.slot.skillId))) {
            hList = listPhase3HealTargetTroops(troop, stub, battleTroops);
            healTiles = hList.map((t) => ({ y: t.y, x: t.x }));
          }
        }

        const shapeArmOk =
          activeSkillArmCharges(troop, arm) > 0 &&
          phase4ShapePreview &&
          phase4ShapePreview.slot?.skillId === arm.slot.skillId &&
          phase4ShapePreview.anchor;
        if (arm?.kind === 'phase4' && shapeArmOk) {
          const a = phase4ShapePreview.anchor;
          const trArm = String(arm.slot.targetRange || '').toLowerCase();
          const cells =
            trArm === 'line'
              ? pickPhase4LineCellsForAnchor(a, troop, battleTroops, mapH, mapW)
              : filterPatternCellsInMap(cellsForPhase4TargetPattern(a.y, a.x, arm.slot.targetRange), mapH, mapW);
          skillPreview = cells.map((c) => ({ y: c.y, x: c.x }));
        } else if (arm?.kind === 'phase5' && eff5 !== 'heal_damage' && shapeArmOk) {
          const a = phase4ShapePreview.anchor;
          const trArm = String(arm.slot.targetRange || '').toLowerCase();
          const cells =
            trArm === 'line'
              ? pickPhase4LineCellsForAnchor(a, troop, battleTroops, mapH, mapW)
              : filterPatternCellsInMap(cellsForPhase4TargetPattern(a.y, a.x, arm.slot.targetRange), mapH, mapW);
          skillPreview = cells.map((c) => ({ y: c.y, x: c.x }));
        }
      }

      setHealTargets(hList);

      if (mergeRem != null) {
        const tmpTroop = { ...troop, movement: mergeRem };
        const reachable = getReachableTiles(tmpTroop, mapResult, battleTroops);
        setReachableTiles(reachable);
        const move = [];
        for (const [key] of reachable) {
          const [ry, rx] = key.split(',').map(Number);
          const cost = getMoveCost(ry, rx, mapResult);
          move.push({ y: ry, x: rx, ...(cost > 1 ? { cost } : {}) });
        }
        setManualHighlightModel({
          active: [{ y: troop.y, x: troop.x }],
          move,
          atk: meleeEnemies.map((e) => ({ y: e.y, x: e.x })),
          heal: healTiles,
          skillPreview,
        });
      } else {
        setReachableTiles(null);
        setManualHighlightModel({
          active: [{ y: troop.y, x: troop.x }],
          move: [],
          atk: meleeEnemies.map((e) => ({ y: e.y, x: e.x })),
          heal: healTiles,
          skillPreview,
        });
      }
    },
    [battleTroops, mapResult, phase4ShapePreview, skillTargetingActive, skillPickerOpen, requireSkillModeToggle],
  );

  useEffect(() => {
    if (!activeTroop) return;
    if (phase === MANUAL_PHASE.SELECT_ACTION) {
      showCombatActionHighlights(activeTroop, activeSkillArmIndex);
      return;
    }
    if (
      phase === MANUAL_PHASE.SELECT_MOVE &&
      requireSkillModeToggle &&
      (skillTargetingActive || skillPickerOpen)
    ) {
      if (remainingMove > 0) {
        showCombatActionHighlights(activeTroop, activeSkillArmIndex, {
          mergeRemainingMove: remainingMove,
        });
      } else {
        showCombatActionHighlights(activeTroop, activeSkillArmIndex);
      }
    }
  }, [
    phase,
    activeTroop,
    activeSkillArmIndex,
    remainingMove,
    skillTargetingActive,
    skillPickerOpen,
    phase4ShapePreview,
    battleTroops,
    mapResult,
    requireSkillModeToggle,
    showCombatActionHighlights,
  ]);

  // ── 引擎调用：开始单兵手动回合 ──

  const startManualTurn = useCallback((troop) => {
    return new Promise((resolve) => {
      if (isMoraleCollapsed(troop)) {
        addLog(fmt.fmtMoraleCollapseSkip(troop), 'move');
        resolve();
        return;
      }
      resolveRef.current = resolve;
      setAttackPreview(null);
      setHealPreview(null);
      setPhase4ShapePreview(null);
      setSkillTargetingActive(false);
      setSkillPickerOpen(false);
      const move = troop.movement || 3;
      setActiveTroop(troop);
      setRemainingMove(move);
      setPhase(MANUAL_PHASE.SELECT_MOVE);
      showMoveHighlights(troop, move);
    });
  }, [showMoveHighlights, addLog]);

  // ── 宝箱检查：行动结束后检查当前格子是否有未开启的宝箱 ──

  const checkChestAtTroop = useCallback(async (troop) => {
    if (!troop || troop.faction !== 'player') return;

    const bumpObjects = () => {
      if (!mapResult || typeof setMapResult !== 'function') return;
      setMapResult({
        ...mapResult,
        objects: [...(mapResult.objects || [])],
      });
    };

    const reward = await resolveChestReward(troop, mapResult, battleTroops);
    if (reward) {
      bumpObjects();
      addLog(`  📦 ${reward.troopName} 开启宝箱，获得 ${reward.name}（${reward.rarityLabel}）`, 'skill');
      collectedChestRewards.current.push(reward);
      return new Promise((resolve) => {
        chestResolveRef.current = resolve;
        setChestReward(reward);
      });
    }

    const rand = await resolveRandomBoxEffect(troop, mapResult, battleTroops, {
      baseUrl: import.meta.env.BASE_URL,
    });
    if (!rand) return;
    bumpObjects();
    addLog(`  🎲 ${rand.troopName} 开启随机箱：${rand.label}`, 'skill');
    if (rand.itemId) collectedChestRewards.current.push(rand);
    if (rand.effect === 'heaven_punish') {
      const root = document.querySelector('.battle-map-card');
      if (root) {
        root.classList.add('heaven-punish-flash');
        setTimeout(() => root.classList.remove('heaven-punish-flash'), 900);
      }
      if (typeof setBattleTroops === 'function') setBattleTroops((prev) => [...prev]);
      await new Promise((r) => setTimeout(r, 900));
    } else if (rand.effect === 'heal_100' || rand.effect === 'spawn_enemy') {
      if (typeof setBattleTroops === 'function') setBattleTroops((prev) => [...prev]);
    }
  }, [mapResult, battleTroops, addLog, setBattleTroops, setMapResult]);

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
    setHealPreview(null);
    setPhase4ShapePreview(null);
    setHealTargets([]);
    setPhase(MANUAL_PHASE.IDLE);
    setActiveTroop(null);
    setRemainingMove(0);
    setReachableTiles(null);
    setAttackTargets([]);
    setActiveSkillArmIndex(0);
    setSkillPickerOpen(false);
    setSkillTargetingActive(false);
    setFormationTroops(null);
    setFormationObj(null);
    setFormationRemMove(0);
    if (resolveRef.current) {
      resolveRef.current();
      resolveRef.current = null;
    }
  }, [clearHighlights]);

  const enterActionPhase = useCallback(
    (troop) => {
      const idx = pickInitialActiveSkillArmIndex(troop);
      setActiveSkillArmIndex(idx);
      setPhase(MANUAL_PHASE.SELECT_ACTION);
      setRemainingMove(0);
      setHealPreview(null);
      setAttackPreview(null);
      setPhase4ShapePreview(null);
      setSkillPickerOpen(false);
      setSkillTargetingActive(false);
      showCombatActionHighlights(troop, idx);
    },
    [pickInitialActiveSkillArmIndex, showCombatActionHighlights],
  );

  const cycleActiveSkillArm = useCallback(() => {
    if (!activeTroop) return;
    const moveSkillMode =
      phase === MANUAL_PHASE.SELECT_MOVE &&
      requireSkillModeToggle &&
      skillTargetingActive;
    if (phase !== MANUAL_PHASE.SELECT_ACTION && !moveSkillMode) return;
    setSkillPickerOpen(false);
    const arms = buildManualActiveSkillArms(activeTroop);
    if (arms.length <= 1) return;
    for (let step = 1; step <= arms.length; step++) {
      const ni = (activeSkillArmIndex + step) % arms.length;
      if (activeSkillArmCharges(activeTroop, arms[ni]) > 0) {
        setActiveSkillArmIndex(ni);
        setPhase4ShapePreview(null);
        setHealPreview(null);
        setAttackPreview(null);
        if (moveSkillMode) {
          showCombatActionHighlights(activeTroop, ni, { mergeRemainingMove: remainingMove });
        } else {
          showCombatActionHighlights(activeTroop, ni);
        }
        return;
      }
    }
  }, [
    phase,
    activeTroop,
    activeSkillArmIndex,
    showCombatActionHighlights,
    requireSkillModeToggle,
    skillTargetingActive,
    remainingMove,
  ]);

  /** 有剩余次数且在当格网下存在可施放目标的武装槽下标（与左栏「技能」能否真正进入施放模式一致） */
  const listViableSkillArmIndices = useCallback(() => {
    if (!activeTroop) return [];
    const { w: mapW, h: mapH } = getMapTerrainDimensions(mapResult);
    const arms = buildManualActiveSkillArms(activeTroop);
    const viable = [];
    for (let i = 0; i < arms.length; i++) {
      const a = arms[i];
      if (activeSkillArmCharges(activeTroop, a) <= 0) continue;
      if (!armHasActionableTargets(activeTroop, a, battleTroops, mapH, mapW)) continue;
      viable.push(i);
    }
    return viable;
  }, [activeTroop, battleTroops, mapResult]);

  const tryTurnOnSkillTargetingForSidebar = useCallback(() => {
    if (!activeTroop) return;
    const viable = listViableSkillArmIndices();
    if (viable.length === 0) return;
    if (viable.length === 1) {
      setActiveSkillArmIndex(viable[0]);
      setSkillTargetingActive(true);
      setSkillPickerOpen(false);
      return;
    }
    setSkillPickerOpen(true);
  }, [activeTroop, listViableSkillArmIndices]);

  const toggleSkillTargeting = useCallback(() => {
    if (!requireSkillModeToggle) return;
    if (!activeTroop) return;
    if (skillTargetingActive) {
      if (phase === MANUAL_PHASE.SELECT_MOVE) {
        setSkillTargetingActive(false);
        setSkillPickerOpen(false);
        setAttackPreview(null);
        setHealPreview(null);
        setPhase4ShapePreview(null);
        setHealTargets([]);
        showMoveHighlights(activeTroop, remainingMove);
        return;
      }
      if (phase !== MANUAL_PHASE.SELECT_ACTION) return;
      setSkillTargetingActive(false);
      setSkillPickerOpen(false);
      setAttackPreview(null);
      setHealPreview(null);
      setPhase4ShapePreview(null);
      return;
    }
    if (phase === MANUAL_PHASE.SELECT_MOVE) {
      const viable = listViableSkillArmIndices();
      if (viable.length === 0) {
        addLog('  ⚠️ 当前无可施放的主动技目标（范围内无合法目标或次数已尽），请先移动或待机', 'skill');
        return;
      }
      if (viable.length === 1) {
        setActiveSkillArmIndex(viable[0]);
        setSkillTargetingActive(true);
        setSkillPickerOpen(false);
        showCombatActionHighlights(activeTroop, viable[0], {
          mergeRemainingMove: remainingMove,
        });
        return;
      }
      setSkillPickerOpen(true);
      setActiveSkillArmIndex(viable[0]);
      showCombatActionHighlights(activeTroop, viable[0], {
        mergeRemainingMove: remainingMove,
      });
      return;
    }
    if (phase !== MANUAL_PHASE.SELECT_ACTION) return;
    tryTurnOnSkillTargetingForSidebar();
  }, [
    requireSkillModeToggle,
    phase,
    activeTroop,
    skillTargetingActive,
    tryTurnOnSkillTargetingForSidebar,
    listViableSkillArmIndices,
    addLog,
    showMoveHighlights,
    showCombatActionHighlights,
    remainingMove,
  ]);

  const dismissSkillPicker = useCallback(() => {
    setSkillPickerOpen(false);
    if (phase === MANUAL_PHASE.SELECT_MOVE && activeTroop && requireSkillModeToggle) {
      showMoveHighlights(activeTroop, remainingMove);
    }
  }, [phase, activeTroop, remainingMove, requireSkillModeToggle, showMoveHighlights]);

  const selectSkillArm = useCallback(
    (armIndex) => {
      if (!activeTroop) return;
      const fromMovePicker =
        phase === MANUAL_PHASE.SELECT_MOVE &&
        requireSkillModeToggle &&
        skillPickerOpen;
      if (phase !== MANUAL_PHASE.SELECT_ACTION && !fromMovePicker) return;
      const arms = buildManualActiveSkillArms(activeTroop);
      const arm = arms[armIndex];
      if (!arm || activeSkillArmCharges(activeTroop, arm) <= 0) return;
      const { w: mapW, h: mapH } = getMapTerrainDimensions(mapResult);
      if (!armHasActionableTargets(activeTroop, arm, battleTroops, mapH, mapW)) return;
      setSkillPickerOpen(false);
      setSkillTargetingActive(true);
      setActiveSkillArmIndex(armIndex);
      setPhase4ShapePreview(null);
      setHealPreview(null);
      setAttackPreview(null);
      if (fromMovePicker) {
        showCombatActionHighlights(activeTroop, armIndex, {
          mergeRemainingMove: remainingMove,
        });
      } else {
        showCombatActionHighlights(activeTroop, armIndex);
      }
    },
    [
      phase,
      activeTroop,
      battleTroops,
      mapResult,
      showCombatActionHighlights,
      requireSkillModeToggle,
      skillPickerOpen,
      remainingMove,
    ],
  );

  const skillPickerItems = useMemo(() => {
    if (!activeTroop) return [];
    const pickerFromMove =
      phase === MANUAL_PHASE.SELECT_MOVE && requireSkillModeToggle && skillPickerOpen;
    if (phase !== MANUAL_PHASE.SELECT_ACTION && !pickerFromMove) return [];
    const arms = buildManualActiveSkillArms(activeTroop);
    const { w: mapW, h: mapH } = getMapTerrainDimensions(mapResult);
    return arms.map((arm, armIndex) => {
      const ch = activeSkillArmCharges(activeTroop, arm);
      const okTargets = ch > 0 && armHasActionableTargets(activeTroop, arm, battleTroops, mapH, mapW);
      const tag = arm.kind === 'phase5' ? '复' : arm.kind === 'phase4' ? '伤' : '疗';
      return {
        armIndex,
        label: `${arm.slot.name}（${tag}）`,
        charges: ch,
        disabled: ch <= 0 || !okTargets,
      };
    });
  }, [activeTroop, phase, battleTroops, mapResult, skillPickerOpen, requireSkillModeToggle]);

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
    fireManualPlayerActionCommitted();
    enterFormationAction();
  }, [phase, enterFormationAction, fireManualPlayerActionCommitted]);

  /** 执行阵型攻击（点击敌人触发，每个部队攻击范围内最近敌人，攻击后解散阵型） */
  const doFormationAttack = useCallback(async (clickedEnemy) => {
    if (!formationTroops) return;
    fireManualPlayerActionCommitted();
    setPhase(MANUAL_PHASE.ANIMATING);
    clearHighlights();

    const alive = formationTroops.filter(t => t.currentTroops > 0);
    const enemies = battleTroops.filter(t => t.faction === 'enemy' && t.currentTroops > 0);

    const centerY = Math.round(alive.reduce((s, t) => s + t.y, 0) / alive.length);
    const centerX = Math.round(alive.reduce((s, t) => s + t.x, 0) / alive.length);
    const sortedEnemies = [...enemies].sort((a, b) => {
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

    for (const t of formationTroops.filter(ft => ft.currentTroops > 0)) {
      await checkChestAtTroop(t);
    }

    endTurn();
  }, [formationTroops, battleTroops, clearHighlights, addLog,
      performAttack, battleKill, removeFormationBuffs, endTurn, checkChestAtTroop, fireManualPlayerActionCommitted]);

  /** 阵型待机（跳过移动+攻击） */
  const handleFormationStandby = useCallback(async () => {
    if (phase !== MANUAL_PHASE.FORMATION_MOVE && phase !== MANUAL_PHASE.FORMATION_ACTION) return;
    fireManualPlayerActionCommitted();
    clearHighlights();
    addLog(fmt.fmtFormationWait(), 'move');
    for (const t of (formationTroops || []).filter(ft => ft.currentTroops > 0)) {
      await checkChestAtTroop(t);
    }
    for (const t of (formationTroops || [])) t._formationHandled = true;
    endTurn();
  }, [phase, formationTroops, clearHighlights, addLog, endTurn, checkChestAtTroop, fireManualPlayerActionCommitted]);

  // ══════════════════════════════════════════
  // ── tile 点击处理（单兵 + 阵型） ──
  // ══════════════════════════════════════════

  const handleTileClick = useCallback(async (y, x) => {
    setSkillPickerOpen(false);
    const { w: mapW, h: mapH } = getMapTerrainDimensions(mapResult);
    const inB = (ry, rx) => ry >= 0 && ry < mapH && rx >= 0 && rx < mapW;

    if (phase === MANUAL_PHASE.FORMATION_MOVE && formationTroops) {
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

      const centerY = Math.round(alive.reduce((s, t) => s + t.y, 0) / alive.length);
      const centerX = Math.round(alive.reduce((s, t) => s + t.x, 0) / alive.length);
      if (y === centerY && x === centerX) return;

      const steps = findFormationCenterPath(formationTroops, centerY, centerX, y, x, formationRemMove, mapResult, battleTroops);
      if (steps == null) return;

      fireManualPlayerActionCommitted();
      setPhase(MANUAL_PHASE.ANIMATING);
      clearHighlights();

      let remMove = formationRemMove;
      for (const st of steps) {
        const curAlive = formationTroops.filter(t => t.currentTroops > 0);
        const maxCost = Math.max(...curAlive.map(t => {
          const ny = t.y + st.dy;
          const nx = t.x + st.dx;
          return inB(ny, nx) ? getMoveCost(ny, nx, mapResult) : Infinity;
        }));
        if (maxCost > remMove || maxCost === Infinity) break;
        if (st.dy !== 0) addLog(fmt.fmtFormationMove(st.dy), 'move');
        else if (st.dx !== 0) addLog(fmt.fmtFormationMoveX(st.dx), 'move');
        const ok = await formationGroupMove(curAlive, st.dy, st.dx);
        if (!ok) break;
        remMove -= maxCost;
      }

      setFormationRemMove(remMove);
      const stillAlive = formationTroops.filter(t => t.currentTroops > 0);
      if (stillAlive.length === 0) { endTurn(); return; }
      for (const t of stillAlive) {
        await checkChestAtTroop(t);
      }
      if (remMove > 0) {
        setPhase(MANUAL_PHASE.FORMATION_MOVE);
        showFormationMoveHighlights(formationTroops, remMove);
      } else {
        enterFormationAction();
      }
      return;
    }

    if (phase === MANUAL_PHASE.FORMATION_ACTION && formationTroops) {
      const clickedEnemy = attackTargets.find(t => t.y === y && t.x === x);
      if (clickedEnemy) {
        await doFormationAttack(clickedEnemy);
        return;
      }
      return;
    }

    if (phase === MANUAL_PHASE.SELECT_MOVE && activeTroop) {
      const key = `${y},${x}`;

      if (reachableTiles && reachableTiles.has(key)) {
        fireManualPlayerActionCommitted();
        setSkillTargetingActive(false);
        setSkillPickerOpen(false);
        setAttackPreview(null);
        setHealPreview(null);
        setPhase4ShapePreview(null);
        setPhase(MANUAL_PHASE.ANIMATING);
        clearHighlights();
        const tmpTroop = { ...activeTroop, y: activeTroop.y, x: activeTroop.x, movement: remainingMove };
        const path = findPathForAi(tmpTroop, y, x, mapResult, battleTroops);
        if (!path || path.length === 0) return;

        await battleMove(activeTroop, path);
        if (activeTroop.currentTroops <= 0) { endTurn(); return; }

        await checkChestAtTroop(activeTroop);

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

      /** 技能预览开启时敌军格点击走下方 skillTileAction，不得在此走近战普攻 */
      const moveSkillPreview =
        requireSkillModeToggle && skillTargetingActive;
      if (!moveSkillPreview) {
        const range = troopAttackRange(activeTroop);
        const clickedEnemy = battleTroops.find(t =>
          t.faction !== activeTroop.faction && t.currentTroops > 0 &&
          t.y === y && t.x === x &&
          (Math.abs(t.y - activeTroop.y) + Math.abs(t.x - activeTroop.x)) <= range
        );
        if (clickedEnemy) {
          if (attackPreview && attackPreview.target === clickedEnemy) {
            fireManualPlayerActionCommitted();
            setAttackPreview(null);
            setHealPreview(null);
            setPhase4ShapePreview(null);
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
          const estimate = estimateDamage(activeTroop, clickedEnemy, mapResult?.terrain, { strike: 'normal', battleTroops });
          const canCounter =
            dist(clickedEnemy, activeTroop) <= troopAttackRange(clickedEnemy);
          const counterEstimate = canCounter
            ? estimateDamage(clickedEnemy, activeTroop, mapResult?.terrain, { strike: 'counter', battleTroops })
            : null;
          setAttackPreview({ target: clickedEnemy, estimate, counterEstimate });
          setHealPreview(null);
          setPhase4ShapePreview(null);
          return;
        }

        setAttackPreview(null);
        setHealPreview(null);
        setPhase4ShapePreview(null);
        if (remainingMove > 0) {
          showMoveHighlights(activeTroop, remainingMove);
        }
        return;
      }
    }

    const skillTileAction =
      phase === MANUAL_PHASE.SELECT_ACTION ||
      (phase === MANUAL_PHASE.SELECT_MOVE &&
        requireSkillModeToggle &&
        skillTargetingActive);
    if (skillTileAction && activeTroop) {
      const fromMoveSkillPreview =
        phase === MANUAL_PHASE.SELECT_MOVE &&
        requireSkillModeToggle &&
        skillTargetingActive;
      const arms = buildManualActiveSkillArms(activeTroop);
      const arm = arms.length ? arms[Math.min(Math.max(0, activeSkillArmIndex), arms.length - 1)] : null;

      if (!requireSkillModeToggle || skillTargetingActive) {
      if (arm?.kind === 'phase3') {
        const slot = arm.slot;
        const clickedHeal =
          slot && getRemainingPhase3HealCharges(activeTroop, slot.skillId) > 0
            ? healTargets.find((t) => t.y === y && t.x === x)
            : null;
        if (clickedHeal) {
          if (healPreview && healPreview.target === clickedHeal && !healPreview.phase5HealDamage) {
            fireManualPlayerActionCommitted();
            setAttackPreview(null);
            setHealPreview(null);
            setPhase4ShapePreview(null);
            setPhase(MANUAL_PHASE.ANIMATING);
            clearHighlights();
            if (performPhase3Heal) {
              await performPhase3Heal(activeTroop, clickedHeal, slot);
            }
            await checkChestAtTroop(activeTroop);
            endTurn();
            return;
          }
          const { selfGain, allyGain } = previewPhase3HealGains(activeTroop, clickedHeal, slot);
          setHealPreview({ target: clickedHeal, slot, selfGain, allyGain, casterTroop: activeTroop });
          setAttackPreview(null);
          setPhase4ShapePreview(null);
          return;
        }
      }

      if (arm?.kind === 'phase5' && performPhase5Composite) {
        const slot = arm.slot;
        const eff = String(slot.skillEffectType || '').toLowerCase();
        const skillCast = getTacticalActiveSkillCastRange(slot.skillId);

        if (eff === 'heal_damage') {
          const stub = phase5HealSlotStub(slot);
          const clickedHeal =
            slot && getRemainingPhase5CompositeCharges(activeTroop, slot.skillId) > 0
              ? healTargets.find((t) => t.y === y && t.x === x)
              : null;
          if (clickedHeal) {
            if (
              healPreview &&
              healPreview.target === clickedHeal &&
              healPreview.phase5HealDamage &&
              healPreview.slot?.skillId === slot.skillId
            ) {
              fireManualPlayerActionCommitted();
              setAttackPreview(null);
              setHealPreview(null);
              setPhase4ShapePreview(null);
              setPhase(MANUAL_PHASE.ANIMATING);
              clearHighlights();
              const killList = await performPhase5Composite(activeTroop, slot, []);
              for (const v of killList || []) {
                if (v && v.currentTroops <= 0) await battleKill(v);
              }
              await checkChestAtTroop(activeTroop);
              endTurn();
              return;
            }
            const { selfGain, allyGain } = previewPhase3HealGains(activeTroop, clickedHeal, stub);
            setHealPreview({
              target: clickedHeal,
              slot,
              selfGain,
              allyGain,
              phase5HealDamage: true,
              casterTroop: activeTroop,
            });
            setAttackPreview(null);
            setPhase4ShapePreview(null);
            return;
          }
        } else if (getRemainingPhase5CompositeCharges(activeTroop, slot.skillId) > 0) {
          const tr = String(slot.targetRange || '').toLowerCase();
          const dk = String(slot.damageType || 'physical').toLowerCase() === 'strategy' ? 'strategy' : 'physical';
          const mult = Number(slot.damageMultiplier);
          const estBase = {
            strike: 'normal',
            battleTroops,
            damageKind: dk,
            skillDamageMultiplier: Number.isFinite(mult) && mult > 0 ? mult : 1,
          };

          if (tr === 'random') {
            const pool = listPhase4AnchorEnemyCandidates(activeTroop, slot, battleTroops, mapH, mapW, skillCast);
            const clickedEnemy = pool.find((t) => t.y === y && t.x === x);
            if (clickedEnemy) {
              const estimate = estimateDamage(activeTroop, clickedEnemy, mapResult?.terrain, estBase);
              if (
                attackPreview &&
                attackPreview.target === clickedEnemy &&
                attackPreview.phase4Random?.slot?.skillId === slot.skillId
              ) {
                fireManualPlayerActionCommitted();
                setAttackPreview(null);
                setHealPreview(null);
                setPhase4ShapePreview(null);
                setPhase(MANUAL_PHASE.ANIMATING);
                clearHighlights();
                const victims = pickPhase4RandomVictims(activeTroop, slot, battleTroops, skillCast);
                const killList = await performPhase5Composite(activeTroop, slot, victims);
                for (const v of killList || []) {
                  if (v && v.currentTroops <= 0) await battleKill(v);
                }
                await checkChestAtTroop(activeTroop);
                endTurn();
                return;
              }
              setAttackPreview({
                target: clickedEnemy,
                estimate,
                phase4Random: { slot },
                casterTroop: activeTroop,
              });
              setHealPreview(null);
              setPhase4ShapePreview(null);
              return;
            }
          } else {
            const anchors = listPhase4AnchorEnemyCandidates(activeTroop, slot, battleTroops, mapH, mapW, skillCast);
            const clickedEnemy = anchors.find((t) => t.y === y && t.x === x);
            if (clickedEnemy) {
              if (
                phase4ShapePreview &&
                phase4ShapePreview.anchor === clickedEnemy &&
                phase4ShapePreview.slot?.skillId === slot.skillId
              ) {
                fireManualPlayerActionCommitted();
                setAttackPreview(null);
                setHealPreview(null);
                setPhase4ShapePreview(null);
                setPhase(MANUAL_PHASE.ANIMATING);
                clearHighlights();
                const victims = listPhase4ShapeVictims(activeTroop, clickedEnemy, slot, battleTroops, mapH, mapW);
                const killList = await performPhase5Composite(activeTroop, slot, victims);
                for (const v of killList || []) {
                  if (v && v.currentTroops <= 0) await battleKill(v);
                }
                await checkChestAtTroop(activeTroop);
                endTurn();
                return;
              }
              setPhase4ShapePreview({ anchor: clickedEnemy, slot });
              setAttackPreview(null);
              setHealPreview(null);
              return;
            }
          }
        }
      }

      if (arm?.kind === 'phase4' && performPhase4Damage) {
        const slot = arm.slot;
        const tr = String(slot.targetRange || '').toLowerCase();
        const skillCast = getTacticalActiveSkillCastRange(slot.skillId);
        const dk = String(slot.damageType || 'physical').toLowerCase() === 'strategy' ? 'strategy' : 'physical';
        const mult = Number(slot.damageMultiplier);
        const estBase = {
          strike: 'normal',
          battleTroops,
          damageKind: dk,
          skillDamageMultiplier: Number.isFinite(mult) && mult > 0 ? mult : 1,
        };

        if (tr === 'random') {
          const pool = listPhase4AnchorEnemyCandidates(activeTroop, slot, battleTroops, mapH, mapW, skillCast);
          const clickedEnemy = pool.find((t) => t.y === y && t.x === x);
          if (clickedEnemy) {
            const estimate = estimateDamage(activeTroop, clickedEnemy, mapResult?.terrain, estBase);
            if (
              attackPreview &&
              attackPreview.target === clickedEnemy &&
              attackPreview.phase4Random?.slot?.skillId === slot.skillId
            ) {
              fireManualPlayerActionCommitted();
              setAttackPreview(null);
              setHealPreview(null);
              setPhase4ShapePreview(null);
              setPhase(MANUAL_PHASE.ANIMATING);
              clearHighlights();
              const victims = pickPhase4RandomVictims(activeTroop, slot, battleTroops, skillCast);
              await performPhase4Damage(activeTroop, slot, victims);
              for (const v of victims) {
                if (v && v.currentTroops <= 0) await battleKill(v);
              }
              await checkChestAtTroop(activeTroop);
              endTurn();
              return;
            }
            setAttackPreview({
              target: clickedEnemy,
              estimate,
              phase4Random: { slot },
              casterTroop: activeTroop,
            });
            setHealPreview(null);
            setPhase4ShapePreview(null);
            return;
          }
        } else {
          const anchors = listPhase4AnchorEnemyCandidates(activeTroop, slot, battleTroops, mapH, mapW, skillCast);
          const clickedEnemy = anchors.find((t) => t.y === y && t.x === x);
          if (clickedEnemy) {
            if (
              phase4ShapePreview &&
              phase4ShapePreview.anchor === clickedEnemy &&
              phase4ShapePreview.slot?.skillId === slot.skillId
            ) {
              fireManualPlayerActionCommitted();
              setAttackPreview(null);
              setHealPreview(null);
              setPhase4ShapePreview(null);
              setPhase(MANUAL_PHASE.ANIMATING);
              clearHighlights();
              const victims = listPhase4ShapeVictims(activeTroop, clickedEnemy, slot, battleTroops, mapH, mapW);
              await performPhase4Damage(activeTroop, slot, victims);
              for (const v of victims) {
                if (v && v.currentTroops <= 0) await battleKill(v);
              }
              await checkChestAtTroop(activeTroop);
              endTurn();
              return;
            }
            setPhase4ShapePreview({ anchor: clickedEnemy, slot });
            setAttackPreview(null);
            setHealPreview(null);
            return;
          }
        }
      }
      }

      const clickedEnemy = attackTargets.find(t => t.y === y && t.x === x);
      if (clickedEnemy && !fromMoveSkillPreview) {
        if (attackPreview && attackPreview.target === clickedEnemy && !attackPreview.phase4Random) {
          fireManualPlayerActionCommitted();
          setAttackPreview(null);
          setHealPreview(null);
          setPhase4ShapePreview(null);
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
        const estimate = estimateDamage(activeTroop, clickedEnemy, mapResult?.terrain, { strike: 'normal', battleTroops });
        const canCounter =
          dist(clickedEnemy, activeTroop) <= troopAttackRange(clickedEnemy);
        const counterEstimate = canCounter
          ? estimateDamage(clickedEnemy, activeTroop, mapResult?.terrain, { strike: 'counter', battleTroops })
          : null;
        setAttackPreview({ target: clickedEnemy, estimate, counterEstimate });
        setHealPreview(null);
        setPhase4ShapePreview(null);
        return;
      }

      setAttackPreview(null);
      setHealPreview(null);
      setPhase4ShapePreview(null);
      if (fromMoveSkillPreview) {
        if (remainingMove > 0) {
          showCombatActionHighlights(activeTroop, activeSkillArmIndex, {
            mergeRemainingMove: remainingMove,
          });
        } else {
          showCombatActionHighlights(activeTroop, activeSkillArmIndex);
        }
      }
      return;
    }
  }, [phase, activeTroop, formationTroops, reachableTiles, remainingMove,
      formationRemMove, attackTargets, attackPreview, healTargets, healPreview, activeSkillArmIndex,
      phase4ShapePreview,
      battleTroops, mapResult,
      clearHighlights, showMoveHighlights, showCombatActionHighlights,
      showFormationMoveHighlights, enterActionPhase, enterFormationAction,
      endTurn, battleMove, formationGroupMove, doFormationAttack,
      performAttack, performCounterAttack, performPhase3Heal, performPhase4Damage, performPhase5Composite, battleKill, addLog, checkChestAtTroop,
      fireManualPlayerActionCommitted, skillTargetingActive, requireSkillModeToggle]);

  const handleStandby = useCallback(async () => {
    if (phase !== MANUAL_PHASE.SELECT_MOVE && phase !== MANUAL_PHASE.SELECT_ACTION) return;
    fireManualPlayerActionCommitted();
    clearHighlights();
    setAttackPreview(null);
    setHealPreview(null);
    setPhase4ShapePreview(null);
    addLog(`  💤 ${activeTroop?.character?.courtesyName || activeTroop?.name || '部队'} 原地待机`, 'move');
    await checkChestAtTroop(activeTroop);
    endTurn();
  }, [phase, activeTroop, clearHighlights, addLog, endTurn, checkChestAtTroop, fireManualPlayerActionCommitted]);

  const handleSkipMove = useCallback(() => {
    if (phase !== MANUAL_PHASE.SELECT_MOVE || !activeTroop) return;
    fireManualPlayerActionCommitted();
    enterActionPhase(activeTroop);
  }, [phase, activeTroop, enterActionPhase, fireManualPlayerActionCommitted]);

  const phase4ShapeOverlay = useMemo(() => {
    const shapePhaseOk =
      phase === MANUAL_PHASE.SELECT_ACTION ||
      (phase === MANUAL_PHASE.SELECT_MOVE &&
        requireSkillModeToggle &&
        skillTargetingActive);
    if (!phase4ShapePreview || !activeTroop || !shapePhaseOk) return null;
    const { anchor, slot } = phase4ShapePreview;
    if (!anchor || !slot) return null;
    const { w: mapW, h: mapH } = getMapTerrainDimensions(mapResult);
    const victims = listPhase4ShapeVictims(activeTroop, anchor, slot, battleTroops, mapH, mapW);
    const dk = String(slot.damageType || 'physical').toLowerCase() === 'strategy' ? 'strategy' : 'physical';
    const mult = Number(slot.damageMultiplier);
    const opts = {
      strike: 'normal',
      battleTroops,
      damageKind: dk,
      skillDamageMultiplier: Number.isFinite(mult) && mult > 0 ? mult : 1,
    };
    const lines = victims.map((v) => {
      const est = estimateDamage(activeTroop, v, mapResult?.terrain, opts);
      const nm = v.character?.courtesyName || v.name || '敌军';
      return `${nm} ~${est.damage}`;
    });
    const anchorEst = estimateDamage(activeTroop, anchor, mapResult?.terrain, opts);
    const skillMetaLines = buildSkillDamagePreviewMetaLines(slot);
    return {
      anchor,
      slot,
      lines,
      casterTroop: activeTroop,
      /** 阶段4/5 主动伤害不触发反击，预览不含反击块 */
      anchorEstimate: { estimate: anchorEst, counterEstimate: null },
      skillMetaLines,
    };
  }, [phase4ShapePreview, activeTroop, battleTroops, mapResult, phase, requireSkillModeToggle, skillTargetingActive]);

  const activeSkillArmUi = useMemo(() => {
    const empty = {
      canCycle: false,
      armedLabel: '',
      armedSkillName: '',
      armedSkillDescription: '',
      armedSkillSidebarVisible: false,
      armedSkillChargesRemaining: 0,
      armedSkillChargesMax: 0,
      armedSkillChargesDisplay: '',
    };
    const arms = buildManualActiveSkillArms(activeTroop);
    const captionPhaseOk =
      phase === MANUAL_PHASE.SELECT_ACTION ||
      (requireSkillModeToggle &&
        phase === MANUAL_PHASE.SELECT_MOVE &&
        (skillTargetingActive || skillPickerOpen));
    if (!arms.length || !captionPhaseOk) {
      return empty;
    }
    const armed = arms[Math.min(Math.max(0, activeSkillArmIndex), arms.length - 1)];
    if (!armed) {
      return { ...empty, canCycle: arms.length > 1 };
    }
    const ch = activeSkillArmCharges(activeTroop, armed);
    const { h: mapH, w: mapW } = mapResult
      ? getMapTerrainDimensions(mapResult)
      : { h: 10, w: 8 };
    const maxCh = getActiveSkillChargesForMapDimensions(mapH, mapW);
    const armedSkillChargesDisplay = `${Math.max(0, Math.floor(ch))}/${maxCh}`;
    const tag =
      armed.kind === 'phase5' ? '复' : armed.kind === 'phase4' ? '伤' : '疗';
    const armedLabel = `${armed.slot.name}·${tag}·剩${ch}`;
    const withCharges = arms.filter((a) => activeSkillArmCharges(activeTroop, a) > 0);
    const sid = armed.slot?.skillId;
    const meta = sid != null && skillsMap ? skillsMap[sid] : null;
    const armedSkillName = String(armed.slot?.name ?? '').trim();
    const armedSkillDescription = String(meta?.description ?? '').trim();
    const armedSkillSidebarVisible = !requireSkillModeToggle
      ? true
      : (skillTargetingActive || skillPickerOpen);
    return {
      canCycle: withCharges.length > 1,
      armedLabel,
      armedSkillName,
      armedSkillDescription,
      armedSkillSidebarVisible,
      armedSkillChargesRemaining: Math.max(0, Math.floor(ch)),
      armedSkillChargesMax: maxCh,
      armedSkillChargesDisplay,
    };
  }, [activeTroop, phase, activeSkillArmIndex, skillsMap, requireSkillModeToggle, skillTargetingActive, skillPickerOpen, mapResult]);

  return {
    phase,
    activeTroop,
    remainingMove,
    reachableTiles,
    attackTargets,
    manualHighlightModel,
    attackPreview,
    healPreview,
    phase4ShapeOverlay,
    activeSkillArmUi,
    cycleActiveSkillArm,
    skillPickerOpen,
    skillPickerItems,
    dismissSkillPicker,
    selectSkillArm,
    skillTargetingActive,
    toggleSkillTargeting,
    chestReward,
    confirmChestReward,
    getCollectedChestRewards: () => collectedChestRewards.current.slice(),
    formationTroops,
    formationObj,
    formationRemMove,
    startManualTurn,
    startFormationTurn,
    handleTileClick,
    handleStandby,
    handleSkipMove,
    handleFormationStopMove,
    handleFormationStandby,
    /** @deprecated 兼容旧壳层 prop 名 */
    phase3HealUi: activeSkillArmUi,
    cyclePhase3HealSlot: cycleActiveSkillArm,
  };
}
