/**
 * 大型战术地图战斗壳层（格网尺寸由 `mapSim.cells` 决定）
 *
 * 现由 **章节战棋**（`pve_chapter`）与章节生图调试页使用；扁平战役已归档（`_archive/zhan-yi-xi-tong/`）。
 *
 * @see SmallMapBattle  小型战术地图（8×10，事件/攻城/PVP）
 *
 * 与小型图壳层共用：useBattleMap、useBattleEngine、useManualBattle、
 *   useBattleSettlement、BattleLog、BattleAuxPanel、MapLegend
 * 本壳层专有：LargeMapGrid 渲染、createLargeMapBattleSurface、
 *   格网部署+确认、commitBattleTroopsThenPlayRound
 * 调用方须传 `playerDeployRect`（可部署矩形）与 `mapSim`；生图见 chapterStageMapGenerator
 */
import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { useBattleMap } from '@/hooks/useBattleMap';
import { useBattleEngine } from '@/battle/tacticalBattleEngine';
import { useManualBattle, MANUAL_PHASE } from '@/hooks/useManualBattle';
import { useAwayTimeout } from '@/hooks/useAwayTimeout';
import { useBattleSettlement } from '@/hooks/useBattleSettlement';
import { createLargeMapBattleSurface } from '@/battle/largeMapBattleSurface';
import { commitBattleTroopsThenPlayRound } from '@/battle/commitBattleTroopsThenPlayRound';
import { buildLargeMapBattleMapResult } from '@/battle/buildLargeMapBattleMapResult';
import { buildLargeMapBattleTroopsFromSim } from '@/battle/buildLargeMapBattleTroopsFromSim';
import {
  listPassableDeployCellsInRect,
  isCellInDeployRect,
  isCellDeployableForPlayer,
} from '@/utils/largeMapDeployRect';
import LargeMapGrid from '@/components/largemap/LargeMapGrid';
import BattleLog from '@/components/battle/BattleLog';
import BattleAuxPanel from '@/components/battle/BattleAuxPanel';
import MapLegend from '@/components/battle/MapLegend';
import AttackPreview from '@/components/battle/AttackPreview';
import ChestRewardOverlay from '@/components/battle/ChestRewardOverlay';
import VeteranPromotionOverlay from '@/components/battle/VeteranPromotionOverlay';
import AncientModal from '@/components/common/AncientModal';
import '@/components/battle/BattleMap.css';
import { validateMainLineupBattleGate } from '@/utils/mainLineupTroops';
import { writeInflightBattleTroopSnapshot } from '@/utils/inflightBattleTroopSnapshot';
import { useBgmScene } from '@/hooks/useBgmScene';

const STAGE = { LOADING: 'loading', READY: 'ready' };
const BATTLE_TYPE = 'pve_chapter';

function isHumanPlayerTroop(t) {
  return t.faction === 'player' && t.currentTroops > 0;
}

/**
 * @param {Array}   playerUnits
 * @param {number}  [silverAmount]
 * @param {number}  [playerFood]
 * @param {number}  [deploymentFoodCost]  出征粮草（与 LineupTab / mainLineupTroops 一致）
 * @param {string}  [playerId]
 * @param {string}  [opponentName]
 * @param {string}  [chapterId]         章节战棋
 * @param {string}  [nodeId]
 * @param {string}  [battleType]        默认 pve_chapter
 * @param {function} onBattleEnd        (result, silverSpent, scoreResult, killedIndices, meta)
 * @param {boolean} [recordOnly]
 * @param {Array}   [cards]             PlayerContext.cards，出征门槛校验
 * @param {object}  [mapSim]    generateChapterStageMap 等生图结果（cells / seed / deployRects）
 * @param {string}  [stageKey]  关卡标识；变化时重置部署初始化状态
 * @param {{ colMin:number,colMax:number,rowMin:number,rowMax:number,cols?:number,rows?:number }|null} [playerDeployRect]
 *        玩家可部署矩形（由生图给出）；缺失则不进入部署与开战
 * @param {string}  [battleTitle]
 * @param {Record<string, object>} [skillsMap] skills.json 字典；关卡 NPC 阶段2被动
 */
export default function LargeMapBattle({
  playerUnits,
  silverAmount = 0,
  playerFood = 0,
  deploymentFoodCost = 0,
  playerId,
  opponentName = '敌军',
  chapterId = null,
  nodeId = null,
  battleType = BATTLE_TYPE,
  onBattleEnd,
  recordOnly = false,
  cards = null,
  mapSim = null,
  stageKey = null,
  playerDeployRect = null,
  battleTitle = '',
  minRounds = null,
  maxRounds = 30,
  skillsMap = null,
}) {
  useBgmScene('battle_large');

  const [stage, setStage] = useState(STAGE.LOADING);
  const [layoutWidth, setLayoutWidth] = useState('auto');
  const mapShellRef = useRef(null);
  const engineFallbackMapRef = useRef(null);
  const gridTooltipApiRef = useRef(null);
  const battleSurfaceRef = useRef(null);
  battleSurfaceRef.current = createLargeMapBattleSurface(mapShellRef);
  const initRef = useRef(false);
  const mountedRef = useRef(true);
  const manualBattleRef = useRef(null);
  const playBattleRoundRef = useRef(() => {});
  const battleSettledRef = useRef(false);
  const bm = useBattleMap();
  const bmRef = useRef(bm);
  bmRef.current = bm;
  const playerIdRef = useRef(playerId);
  playerIdRef.current = playerId;
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const autoBattleRef = useRef(bm.autoBattle);
  autoBattleRef.current = bm.autoBattle;

  const engine = useBattleEngine({
    battleTroops: bm.battleTroops, setBattleTroops: bm.setBattleTroops,
    mapResult: bm.mapResult, addLog: bm.addLog, setLogs: bm.setLogs,
    battlePlaying: bm.battlePlaying, setBattlePlaying: bm.setBattlePlaying,
    roundNum: bm.roundNum, setRoundNum: bm.setRoundNum,
    silverAmount: bm.silverAmount, setSilverAmount: bm.setSilverAmount,
    activeFormation: bm.activeFormation, setActiveFormation: bm.setActiveFormation,
    autoBattle: bm.autoBattle, autoFormation: bm.autoFormation,
    mapCardRef: engineFallbackMapRef,
    battleSurfaceRef, manualBattleRef,
    minRounds,
    maxRounds,
    setBattleEndReason: bm.setBattleEndReason,
    trimAllyBattleLog: true,
    battleReportDigestRef: bm.battleReportDigestRef,
    setMapResult: bm.setMapResult,
  });

  playBattleRoundRef.current = engine.playBattleRound;

  const manual = useManualBattle({
    battleTroops: bm.battleTroops, mapResult: bm.mapResult,
    setBattleTroops: bm.setBattleTroops,
    setMapResult: bm.setMapResult,
    performAttack: engine.performAttack, performCounterAttack: engine.performCounterAttack,
    performPhase3Heal: engine.performPhase3Heal,
    performPhase4Damage: engine.performPhase4Damage,
    performPhase5Composite: engine.performPhase5Composite,
    battleKill: engine.battleKill, battleMove: engine.battleMove,
    formationGroupMove: engine.formationGroupMove, removeFormationBuffs: engine.removeFormationBuffs,
    addLog: bm.addLog,
    requireSkillModeToggle: false,
    skillsMap: skillsMap || {},
  });

  manualBattleRef.current = manual;

  const engineRef = useRef(engine);
  engineRef.current = engine;

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // ── 离开超时：大型图不启用（回合多，30s 失焦会误触发） ──
  const { pendingAwayNoticeRef } = useAwayTimeout({
    enabled: false,
    battlePlaying: bm.battlePlaying,
    autoBattleRef,
  });

  // ── 老兵晋升浮层 ──
  const [pendingVeteranEnd, setPendingVeteranEnd] = useState(null);
  const onBattleEndRef_vet = useRef(onBattleEnd);
  onBattleEndRef_vet.current = onBattleEnd;

  const wrappedOnBattleEnd = useCallback((result, silverSpent, scoreResult, killedIndices, meta) => {
    if (meta?.veteranPromotions?.length > 0) {
      setPendingVeteranEnd({ result, silverSpent, scoreResult, killedIndices, meta });
    } else {
      onBattleEndRef_vet.current?.(result, silverSpent, scoreResult, killedIndices, meta);
    }
  }, []);

  const flushVeteranEnd = useCallback(() => {
    const p = pendingVeteranEnd;
    if (!p) return;
    setPendingVeteranEnd(null);
    onBattleEndRef_vet.current?.(p.result, p.silverSpent, p.scoreResult, p.killedIndices, p.meta);
  }, [pendingVeteranEnd]);

  // ── 战斗结算 ──
  const { awayNoticeOpen: _awayNoticeOpen, flushAwayEndNotice: _flush } = useBattleSettlement({
    stage, bmRef, manualBattleRef, engineRef, mountedRef,
    battlePlaying: bm.battlePlaying,
    battleType, playerId, silverAmount, deploymentFoodCost,
    chapterId, nodeId,
    defenseReportMeta: null, recordOnly,
    siegeDefenderType: null, opponentName,
    battleSettledRef,
    pendingAwayNoticeRef,
    onBattleEnd: wrappedOnBattleEnd,
  });

  useEffect(() => {
    if (!playerId || stage !== STAGE.READY) return undefined;
    const playerTroops = (bm.battleTroops || []).filter((t) => t.faction === 'player');
    if (playerTroops.length === 0) return undefined;
    writeInflightBattleTroopSnapshot(playerId, playerTroops);

    const flushInflightSnap = () => {
      const pid = playerIdRef.current;
      const b = bmRef.current;
      if (!pid || stageRef.current !== STAGE.READY) return;
      const rows = (b.battleTroops || []).filter((t) => t.faction === 'player');
      if (rows.length === 0) return;
      writeInflightBattleTroopSnapshot(pid, rows);
    };
    window.addEventListener('pagehide', flushInflightSnap);
    return () => {
      window.removeEventListener('pagehide', flushInflightSnap);
    };
  }, [playerId, stage, bm.battleTroops]);

  // ── 部署状态 ──
  const [manualActionMenuOpen, setManualActionMenuOpen] = useState(false);
  const [deployReady, setDeployReady] = useState(false);
  const [deployTroopId, setDeployTroopId] = useState(null);
  const [deploySlots, setDeploySlots] = useState({});
  const deploySlotsRef = useRef({});
  const deployInitRef = useRef(false);

  useEffect(() => { deploySlotsRef.current = deploySlots; }, [deploySlots]);

  const deployRect =
    playerDeployRect && typeof playerDeployRect === 'object' ? playerDeployRect : null;

  // 我方部队在战略格网上的位置映射（部署阶段用）
  const deployedPlayerByCell = useMemo(() => {
    const m = new Map();
    if (!deployRect) return m;
    for (const t of bm.battleTroops.filter(isHumanPlayerTroop)) {
      const pos = deploySlots[t.id];
      if (pos) m.set(`${pos.col},${pos.row}`, t);
    }
    return m;
  }, [bm.battleTroops, deploySlots, deployRect]);

  // 战略格网 overlay：仅部署阶段（战斗中由引擎渲染）
  const overlayPlayerByCell = useMemo(() => {
    if (bm.battlePlaying || bm.roundNum > 0) return new Map();
    return deployedPlayerByCell;
  }, [bm.battlePlaying, bm.roundNum, deployedPlayerByCell]);

  // 关卡/生图切换时重置部署初始化标志
  useEffect(() => {
    deployInitRef.current = false;
  }, [mapSim?.seed, stageKey]);

  // 初始部署位置：将我方部队均匀摆入可通行部署格
  useEffect(() => {
    if (!mapSim?.cells || !deployRect) return;
    if (stage !== STAGE.READY || deployInitRef.current) return;
    const players = bm.battleTroops.filter(isHumanPlayerTroop);
    if (players.length === 0) return;
    const passable = listPassableDeployCellsInRect(mapSim.cells, deployRect);
    const next = {};
    players.forEach((p, i) => { if (passable[i]) next[p.id] = { col: passable[i].col, row: passable[i].row }; });
    if (Object.keys(next).length > 0) {
      setDeploySlots(next);
      deploySlotsRef.current = next;
      deployInitRef.current = true;
    }
  }, [mapSim, deployRect, stage, bm.battleTroops]);

  // 换位：将选中部队移至目标格（或与目标格上的我军互换）
  const applyDeploySwap = useCallback((col, row) => {
    if (deployTroopId == null || !deployRect || !mapSim?.cells) return;
    if (!isCellInDeployRect(col, row, deployRect)) return;
    const cell = mapSim.cells[row]?.[col];
    if (!isCellDeployableForPlayer(cell)) return;
    const players = bmRef.current.battleTroops.filter(isHumanPlayerTroop);
    const selected = players.find((t) => t.id === deployTroopId);
    if (!selected) return;
    setDeploySlots((prev) => {
      const next = { ...prev };
      const occupantId = Object.keys(next).find(
        (id) => next[id].col === col && next[id].row === row && id !== selected.id,
      );
      if (occupantId) {
        const selPos = next[selected.id];
        next[selected.id] = { col, row };
        next[occupantId] = selPos;
      } else {
        next[selected.id] = { col, row };
      }
      deploySlotsRef.current = next;
      return next;
    });
  }, [deployTroopId, deployRect, mapSim]);

  const handlePlayerUnitMarkerClick = useCallback((troop) => {
    if (!troop || !isHumanPlayerTroop(troop)) return;
    setDeployTroopId((prev) => (prev === troop.id ? null : troop.id));
  }, []);

  const manualActorPosKey = useMemo(() => {
    if (!manual.activeTroop) return '';
    return `${manual.activeTroop.y},${manual.activeTroop.x}`;
  }, [manual.activeTroop]);

  const manualFormationCenterKey = useMemo(() => {
    const ft = manual.formationTroops;
    if (!ft?.length) return '';
    const alive = ft.filter((t) => t.currentTroops > 0);
    if (!alive.length) return '';
    const cy = Math.round(alive.reduce((s, t) => s + t.y, 0) / alive.length);
    const cx = Math.round(alive.reduce((s, t) => s + t.x, 0) / alive.length);
    return `${cy},${cx}`;
  }, [manual.formationTroops]);

  useEffect(() => {
    setManualActionMenuOpen(false);
  }, [manual.phase, manualActorPosKey, manualFormationCenterKey]);

  const clickIsCurrentActorCell = useCallback(
    (col, row) => {
      const p = manual.phase;
      if (p === MANUAL_PHASE.SELECT_MOVE || p === MANUAL_PHASE.SELECT_ACTION) {
        const t = manual.activeTroop;
        if (!t) return false;
        return t.y === row && t.x === col;
      }
      if (p === MANUAL_PHASE.FORMATION_MOVE || p === MANUAL_PHASE.FORMATION_ACTION) {
        const ft = manual.formationTroops;
        if (!ft?.length) return false;
        const alive = ft.filter((u) => u.currentTroops > 0);
        if (!alive.length) return false;
        const cy = Math.round(alive.reduce((s, t) => s + t.y, 0) / alive.length);
        const cx = Math.round(alive.reduce((s, t) => s + t.x, 0) / alive.length);
        return cy === row && cx === col;
      }
      return false;
    },
    [manual.phase, manual.activeTroop, manual.formationTroops],
  );

  const handleGridCellClick = useCallback((col, row) => {
    if (bm.battlePlaying && !bm.autoBattle) {
      if (clickIsCurrentActorCell(col, row)) {
        setManualActionMenuOpen((open) => !open);
        return;
      }
      setManualActionMenuOpen(false);
      manual.handleTileClick(row, col);
      return;
    }
    if (deployReady || bm.battlePlaying) return;
    applyDeploySwap(col, row);
  }, [
    deployReady,
    bm.battlePlaying,
    bm.autoBattle,
    applyDeploySwap,
    manual.handleTileClick,
    clickIsCurrentActorCell,
  ]);

  // 须等 skills.json 就绪后再写入战场部队，否则 NPC/我方将领阶段1 被动未叠入 `character._skillPhase1Combat`
  useEffect(() => {
    if (initRef.current || !playerUnits || playerUnits.length === 0) return;
    if (!mapSim || bm.allTroops.length < 1) return;
    if (!deployRect) return;
    if (Object.keys(skillsMap || {}).length === 0) return;

    initRef.current = true;

    bm.setMapResult(buildLargeMapBattleMapResult(mapSim));
    bm.setMapLabel(battleTitle || '战场');
    bm.setBattleTroops(
      buildLargeMapBattleTroopsFromSim({
        playerUnits, mapSim,
        deployRect,
        allTroops: bm.allTroops,
        allCharacters: bm.allCharacters,
        skillsMap: skillsMap || undefined,
      }),
    );
    bm.toggleBattle();
    bm.setSilverAmount(silverAmount);
    bm.toggleAutoFormation(false); // 大型图关闭自动阵型，避免首回合挪动 ally/NPC
    // 保持 isBattle=false：战前 LargeMapGrid 显示蓝色部署区
    setStage(STAGE.READY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerUnits, mapSim, deployRect, bm.allTroops.length, skillsMap, silverAmount, battleTitle]);

  // ── 开战（含门槛校验 + 战略→战术坐标写入） ──
  const [battleGateModalOpen, setBattleGateModalOpen] = useState(false);
  const [battleGateMessage, setBattleGateMessage] = useState('');

  const startBattleWithLineupGate = useCallback(() => {
    if (!deployReady) {
      setBattleGateMessage('请先在蓝色可部署区内完成部署：点击地图上的我方部队选中，再点蓝色格调整位置；完成后点「确认部署」。');
      setBattleGateModalOpen(true);
      return;
    }
    // recordOnly：跳过编组/粮草门槛，但仍须确认部署并把战略坐标写入战术 x,y
    if (!recordOnly) {
      const v = validateMainLineupBattleGate({ recordOnly, cards, playerUnits, playerFood });
      if (!v.ok) {
        setBattleGateMessage(v.message || '条件不足');
        setBattleGateModalOpen(true);
        return;
      }
    }
    const slots = deploySlotsRef.current;
    const nextTroops = bmRef.current.battleTroops.map((t) => {
      if (t.faction !== 'player') return t;
      const pos = slots[t.id];
      return pos ? { ...t, x: pos.col, y: pos.row } : t;
    });
    const setT = bmRef.current?.setBattleTroops;
    if (setT) {
      commitBattleTroopsThenPlayRound(setT, nextTroops, playBattleRoundRef, () => {
        if (!bmRef.current?.isBattle) bmRef.current?.toggleBattle();
      });
    }
  }, [recordOnly, deployReady, cards, playerUnits, playerFood]);

  // ── 同步布局宽度 ──
  const syncLayoutWidth = useCallback(() => {
    const el = mapShellRef.current;
    if (el?.offsetWidth) setLayoutWidth(`${el.offsetWidth}px`);
  }, []);
  useLayoutEffect(() => { syncLayoutWidth(); }, [bm.mapResult, syncLayoutWidth]);
  useEffect(() => {
    const el = mapShellRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => syncLayoutWidth());
    ro.observe(el);
    return () => ro.disconnect();
  }, [bm.mapResult, syncLayoutWidth]);

  // ── 手动操控悬浮按钮 ──
  const manualChromeNode = useMemo(() => {
    if (bm.autoBattle) return null;
    const { phase, activeTroop, formationTroops } = manual;
    const isFormation = phase === MANUAL_PHASE.FORMATION_MOVE || phase === MANUAL_PHASE.FORMATION_ACTION;
    const isMove = phase === MANUAL_PHASE.SELECT_MOVE || phase === MANUAL_PHASE.FORMATION_MOVE;
    const isAction = phase === MANUAL_PHASE.SELECT_ACTION || phase === MANUAL_PHASE.FORMATION_ACTION;
    const isSingleAction = phase === MANUAL_PHASE.SELECT_ACTION;
    if (!isMove && !isAction) return null;

    const healSlots = activeTroop?.character?._skillPhase3Heal?.slots;
    const p4Slots = activeTroop?.character?._skillPhase4Damage?.slots;
    const p5Slots = activeTroop?.character?._skillPhase5Composite?.slots;
    const healCharges =
      isSingleAction &&
      healSlots?.length > 0 &&
      healSlots.some(
        (s) => (activeTroop._phase3HealRuntime?.chargesBySkillId?.[s.skillId] ?? 0) > 0,
      );
    const p4Charges =
      isSingleAction &&
      p4Slots?.length > 0 &&
      p4Slots.some(
        (s) => (activeTroop._phase4DamageRuntime?.chargesBySkillId?.[s.skillId] ?? 0) > 0,
      );
    const p5Charges =
      isSingleAction &&
      p5Slots?.length > 0 &&
      p5Slots.some(
        (s) => (activeTroop._phase5CompositeRuntime?.chargesBySkillId?.[s.skillId] ?? 0) > 0,
      );
    const anySkillCharges = healCharges || p4Charges || p5Charges;

    let ty, tx;
    if (isFormation && formationTroops?.length) {
      const alive = formationTroops.filter((t) => t.currentTroops > 0);
      if (!alive.length) return null;
      ty = Math.round(alive.reduce((s, t) => s + t.y, 0) / alive.length);
      tx = Math.round(alive.reduce((s, t) => s + t.x, 0) / alive.length);
    } else if (activeTroop) {
      ty = activeTroop.y; tx = activeTroop.x;
    } else return null;

    const onStandby = () => {
      setManualActionMenuOpen(false);
      if (isFormation) void manual.handleFormationStandby();
      else void manual.handleStandby();
    };

    const actionMenu = manualActionMenuOpen ? (
      <div
        className="floating-action-btns"
        style={{
          position: 'absolute',
          top: `calc(${ty} * (var(--lm-tile) + 1px))`,
          left: `calc(${tx} * (var(--lm-tile) + 1px))`,
          width: 'calc(var(--lm-tile) + 1px)',
          height: 'calc(var(--lm-tile) + 1px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'stretch', justifyContent: 'stretch',
          gap: 0, zIndex: 50, pointerEvents: 'auto',
        }}
      >
        <button
          type="button"
          className="floating-act"
          disabled={!anySkillCharges}
          title={manual.activeSkillArmUi?.armedLabel || (anySkillCharges ? '切换主动技' : '无可用主动技')}
          onClick={() => manual.cycleActiveSkillArm?.()}
        >
          🔮 技能
        </button>
        <button type="button" className="floating-act" onClick={onStandby}>💤 待机</button>
      </div>
    ) : null;

    return (
      <>
        {actionMenu}
        {(manual.attackPreview || manual.healPreview || manual.phase4ShapeOverlay) && (
          <AttackPreview
            attackPreview={manual.attackPreview}
            healPreview={manual.healPreview}
            phase4ShapeOverlay={manual.phase4ShapeOverlay}
            largeMapGridOverlay
          />
        )}
      </>
    );
  }, [bm.autoBattle, manual, manualActionMenuOpen]);

  if (!mapSim) {
    return (
      <div className="fixed inset-0 z-[240] flex flex-col items-center justify-center gap-4 bg-[#1a1a2e] px-6 text-center">
        <p className="text-red-300 text-sm">战场地图数据缺失，无法开战。</p>
        <button
          type="button"
          className="rounded-lg bg-stone-700 px-4 py-2 text-stone-100 text-sm"
          onClick={() => onBattleEnd?.()}
        >
          关闭
        </button>
      </div>
    );
  }

  const shellZ = 'z-[240]';

  return (
    <div className={`fixed inset-0 ${shellZ} overflow-auto bg-[#1a1a2e]`}>
      <div className="battle-page">
        {stage === STAGE.LOADING && (
          <div className="maps-row">
            <div style={{ color: '#555', fontSize: 14, padding: 40 }}>正在准备战场...</div>
          </div>
        )}

        {/* 关卡格网：部署阶段 + 战斗阶段共用同一地图（尺寸随 cells） */}
        {stage === STAGE.READY && deployRect && mapSim && bm.mapResult && (
          <div className="w-full max-w-[min(98vw,900px)] mx-auto px-1 pb-2">
            <LargeMapGrid
              ref={mapShellRef}
              cells={mapSim.cells}
              seed={mapSim.seed}
              title={battleTitle || opponentName || '战场地图'}
              meta={
                <span className="text-[11px] text-stone-500">
                  可部署区 {deployRect ? `${deployRect.cols}×${deployRect.rows}` : ''} · 种子 {mapSim.seed}
                </span>
              }
              battleTroops={bm.battleTroops}
              deploymentMode={!deployReady && !bm.battlePlaying}
              battleManual={bm.battlePlaying && !bm.autoBattle}
              deployRect={deployRect}
              onCellClick={handleGridCellClick}
              playerByCell={overlayPlayerByCell}
              deployTroopSelectMode={!deployReady && !bm.battlePlaying}
              selectedDeployTroopId={deployTroopId}
              onPlayerUnitMarkerClick={handlePlayerUnitMarkerClick}
              showBattleEngineHosts={bm.battlePlaying || bm.roundNum > 0}
              showStaticNpcUnits={bm.roundNum === 0 && !bm.battlePlaying}
              manualHighlightModel={!bm.autoBattle ? manual.manualHighlightModel : null}
              manualChrome={manualChromeNode}
              tooltipApiRef={gridTooltipApiRef}
              suppressEnemyTroopTooltip={
                bm.battlePlaying &&
                !bm.autoBattle &&
                !!(manual.attackPreview || manual.healPreview || manual.phase4ShapeOverlay)
              }
              roundNum={bm.roundNum}
              manualActionHintText={
                bm.battlePlaying && !bm.autoBattle && bm.roundNum > 0 ? '请点击当前部队打开行动' : null
              }
            />
          </div>
        )}

        {/* 部署操作说明 + 确认/重新部署 */}
        {bm.mapResult && bm.roundNum === 0 && !bm.battlePlaying && (
          <div className="w-full max-w-[min(98vw,520px)] mx-auto px-2 pb-2 flex flex-col items-center gap-2">
            <div className="text-[11px] text-stone-400 text-center leading-relaxed space-y-1">
              {deployReady ? (
                <p>已确认部署。可点「重新部署」修改，或开始战斗。</p>
              ) : (
                <>
                  <p className="text-amber-100/90 font-medium">部署操作</p>
                  <p>① 在地图上<strong className="text-stone-200">直接点击我方部队头像</strong>进入选择状态（再点同一部队可取消）。</p>
                  <p>② 选择后，仅<strong className="text-sky-300">蓝色高亮可部署格</strong>可落位；点击其它区域无效。可与另一名我军互换位置。</p>
                  {deployTroopId ? (
                    <p className="text-amber-200/95 pt-0.5">当前已选中一支部队 → 请点击蓝色区域内的目标格。</p>
                  ) : (
                    <p className="text-stone-500 pt-0.5">尚未选中部队。</p>
                  )}
                </>
              )}
            </div>
            {!deployReady ? (
              <button
                type="button"
                className="rounded-lg bg-emerald-800/90 border border-emerald-600 px-4 py-1.5 text-xs text-emerald-50"
                onClick={() => { setDeployTroopId(null); setDeployReady(true); }}
              >
                确认部署
              </button>
            ) : (
              <button
                type="button"
                className="rounded-lg bg-stone-700 border border-stone-500 px-3 py-1 text-xs text-stone-200"
                onClick={() => { setDeployReady(false); setDeployTroopId(null); }}
              >
                重新部署
              </button>
            )}
          </div>
        )}

        {manual.chestReward && (
          <ChestRewardOverlay reward={manual.chestReward} onConfirm={manual.confirmChestReward} />
        )}
        {engine.autoChestReward && <ChestRewardOverlay reward={engine.autoChestReward} />}

        {bm.roundNum === 0 && (
          <BattleAuxPanel
            silverAmount={bm.silverAmount}
            autoBattle={bm.autoBattle} toggleAutoBattle={bm.toggleAutoBattle}
            autoFormation={bm.autoFormation} toggleAutoFormation={bm.toggleAutoFormation}
            maxWidth={layoutWidth}
            onStartBattle={stage === STAGE.READY ? startBattleWithLineupGate : null}
            battlePlaying={bm.battlePlaying}
          />
        )}
        {bm.roundNum === 0 && <MapLegend maxWidth={layoutWidth} />}
        <BattleLog
          logs={bm.logs}
          visible={
            bm.isBattle ||
            bm.battlePlaying ||
            bm.roundNum > 0 ||
            bm.logs.length > 0
          }
          maxWidth={layoutWidth}
        />
      </div>

      <AncientModal
        isOpen={battleGateModalOpen}
        type="warning"
        title="无法开战"
        confirmText="确定"
        onConfirm={() => setBattleGateModalOpen(false)}
        onClose={() => setBattleGateModalOpen(false)}
      >
        <p className="text-center text-gray-800 text-sm whitespace-pre-wrap">{battleGateMessage}</p>
        <p className="text-center text-gray-500 text-xs mt-2">请返回编组调整兵力或补充粮草后再试。</p>
      </AncientModal>

      {pendingVeteranEnd && (
        <VeteranPromotionOverlay
          promotions={pendingVeteranEnd.meta.veteranPromotions}
          onDismiss={flushVeteranEnd}
        />
      )}
    </div>
  );
}
