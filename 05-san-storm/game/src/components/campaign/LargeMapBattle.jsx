/**
 * 大型战役地图战斗壳层（16×20 格，pve_campaign 专用）
 *
 * @see SmallMapBattle  小型战术地图（8×10，事件/攻城/PVP）
 *
 * 与小型图壳层共用：useBattleMap、useBattleEngine、useManualBattle、
 *   useBattleSettlement、BattleLog、BattleAuxPanel、MapLegend
 * 战役专有：CampaignMapGrid 渲染、createCampaignBattleSurface、
 *   战略格网部署+确认、commitBattleTroopsThenPlayRound、
 *   beforeunload sendBeacon（中断计为一次失败）
 */
import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { useBattleMap } from '@/hooks/useBattleMap';
import { useBattleEngine } from '@/battle/tacticalBattleEngine';
import { useManualBattle, MANUAL_PHASE } from '@/hooks/useManualBattle';
import { useAwayTimeout } from '@/hooks/useAwayTimeout';
import { useBattleSettlement } from '@/hooks/useBattleSettlement';
import { createCampaignBattleSurface } from '@/battle/campaignBattleSurface';
import { commitBattleTroopsThenPlayRound } from '@/battle/commitBattleTroopsThenPlayRound';
import { buildCampaignBattleMapResult } from '@/campaign/buildCampaignBattleMapResult';
import { buildCampaignBattleTroopsFromSim } from '@/campaign/buildCampaignBattleTroopsFromSim';
import {
  getPlayerDeployRectGlobal,
  listPassableDeployCellsInRect,
  isCellInDeployRect,
  isCampaignCellDeployableForPlayer,
} from '@/utils/campaignDeployRect';
import CampaignMapGrid from '@/components/campaign/CampaignMapGrid';
import BattleLog from '@/components/battle/BattleLog';
import BattleAuxPanel from '@/components/battle/BattleAuxPanel';
import MapLegend from '@/components/battle/MapLegend';
import AttackPreview from '@/components/battle/AttackPreview';
import ChestRewardOverlay from '@/components/battle/ChestRewardOverlay';
import VeteranPromotionOverlay from '@/components/battle/VeteranPromotionOverlay';
import AncientModal from '@/components/common/AncientModal';
import '@/components/battle/BattleMap.css';
import { validateMainLineupBattleGate } from '@/utils/mainLineupTroops';
import { API_CONFIG } from '@/constants';
import { writeInflightBattleTroopSnapshot } from '@/utils/inflightBattleTroopSnapshot';

const STAGE = { LOADING: 'loading', READY: 'ready' };
const BATTLE_TYPE = 'pve_campaign';

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
 * @param {string}  [campaignId]
 * @param {function} onBattleEnd        (result, silverSpent, scoreResult, killedIndices, meta)
 * @param {boolean} [recordOnly]
 * @param {Array}   [cards]             PlayerContext.cards，出征门槛校验
 * @param {object}  [campaignMapSim]    generateCampaignMapSimulated 结果
 * @param {object}  [campaignPreset]    战役 preset（含 quad_C deploy 矩形）
 * @param {object}  [campaignPreset]    战役 preset（含 quad_C deploy 矩形）
 * @param {string}  [campaignBattleTitle]
 * @param {Record<string, object>} [skillsMap] skills.json 字典；战役 NPC 阶段2被动
 */
export default function LargeMapBattle({
  playerUnits,
  silverAmount = 0,
  playerFood = 0,
  deploymentFoodCost = 0,
  playerId,
  opponentName = '战役敌军',
  campaignId = null,
  onBattleEnd,
  recordOnly = false,
  cards = null,
  campaignMapSim = null,
  campaignPreset = null,
  campaignBattleTitle = '',
  minRounds = null,
  maxRounds = 30,
  skillsMap = null,
}) {
  const [stage, setStage] = useState(STAGE.LOADING);
  const [layoutWidth, setLayoutWidth] = useState('auto');
  const campaignShellRef = useRef(null);
  const campaignEngineFallbackMapRef = useRef(null);
  const campaignTooltipApiRef = useRef(null);
  const battleSurfaceRef = useRef(null);
  battleSurfaceRef.current = createCampaignBattleSurface(campaignShellRef);
  const initRef = useRef(false);
  const mountedRef = useRef(true);
  const manualBattleRef = useRef(null);
  const playBattleRoundRef = useRef(() => {});
  const battleStartedRef = useRef(false);
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
    mapCardRef: campaignEngineFallbackMapRef,
    battleSurfaceRef, manualBattleRef,
    minRounds,
    maxRounds,
    setBattleEndReason: bm.setBattleEndReason,
    trimAllyBattleLog: true,
  });

  playBattleRoundRef.current = engine.playBattleRound;

  const manual = useManualBattle({
    battleTroops: bm.battleTroops, mapResult: bm.mapResult,
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

  // ── 离开超时：战役不启用（回合多，30s 失焦会误触发） ──
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
    battleType: BATTLE_TYPE, playerId, silverAmount, deploymentFoodCost, campaignId,
    defenseReportMeta: null, recordOnly,
    siegeDefenderType: null, opponentName,
    battleSettledRef,
    pendingAwayNoticeRef,
    onBattleEnd: wrappedOnBattleEnd,
  });

  // ── 首轮开始时标记已发起（供 sendBeacon 判断） ──
  useEffect(() => {
    if (bm.battlePlaying) battleStartedRef.current = true;
  }, [bm.battlePlaying]);

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

  // ── sendBeacon：页面关闭/刷新视为中断，计为一次失败 ──
  useEffect(() => {
    if (!campaignId || !playerId) return undefined;
    const onBeforeUnload = () => {
      if (!battleStartedRef.current || battleSettledRef.current) return;
      const payload = JSON.stringify({
        battleId: `battle_abandon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        playerId, battleType: BATTLE_TYPE,
        opponentType: 'campaign_enemy', campaignId,
        opponentName: opponentName || campaignBattleTitle || undefined,
        result: 'lose',
      });
      navigator.sendBeacon(
        `${API_CONFIG.BASE_URL}/battles`,
        new Blob([payload], { type: 'application/json' }),
      );
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [campaignId, playerId, opponentName, campaignBattleTitle]);

  // ── 部署状态 ──
  const [manualActionMenuOpen, setManualActionMenuOpen] = useState(false);
  const [campaignDeployReady, setCampaignDeployReady] = useState(false);
  const [campaignDeployTroopId, setCampaignDeployTroopId] = useState(null);
  const [campaignDeploySlots, setCampaignDeploySlots] = useState({});
  const campaignDeploySlotsRef = useRef({});
  const campaignDeployInitRef = useRef(false);

  useEffect(() => { campaignDeploySlotsRef.current = campaignDeploySlots; }, [campaignDeploySlots]);

  const deployRect = useMemo(
    () => (campaignPreset ? getPlayerDeployRectGlobal(campaignPreset) : null),
    [campaignPreset],
  );

  // 我方部队在战略格网上的位置映射（部署阶段用）
  const campaignPlayerByCell = useMemo(() => {
    const m = new Map();
    if (!deployRect) return m;
    for (const t of bm.battleTroops.filter(isHumanPlayerTroop)) {
      const pos = campaignDeploySlots[t.id];
      if (pos) m.set(`${pos.col},${pos.row}`, t);
    }
    return m;
  }, [bm.battleTroops, campaignDeploySlots, deployRect]);

  // 战略格网 overlay：仅部署阶段（战斗中由引擎渲染）
  const campaignMapUnitsByCell = useMemo(() => {
    if (bm.battlePlaying || bm.roundNum > 0) return new Map();
    return campaignPlayerByCell;
  }, [bm.battlePlaying, bm.roundNum, campaignPlayerByCell]);

  // 战役/预设切换时重置部署初始化标志
  useEffect(() => {
    campaignDeployInitRef.current = false;
  }, [campaignMapSim?.seed, campaignPreset?.campaign_id]);

  // 初始部署位置：将我方部队均匀摆入可通行部署格
  useEffect(() => {
    if (!campaignPreset || !campaignMapSim?.cells || !deployRect) return;
    if (stage !== STAGE.READY || campaignDeployInitRef.current) return;
    const players = bm.battleTroops.filter(isHumanPlayerTroop);
    if (players.length === 0) return;
    const passable = listPassableDeployCellsInRect(campaignMapSim.cells, deployRect);
    const next = {};
    players.forEach((p, i) => { if (passable[i]) next[p.id] = { col: passable[i].col, row: passable[i].row }; });
    if (Object.keys(next).length > 0) {
      setCampaignDeploySlots(next);
      campaignDeploySlotsRef.current = next;
      campaignDeployInitRef.current = true;
    }
  }, [campaignPreset, campaignMapSim, deployRect, stage, bm.battleTroops]);

  // 换位：将选中部队移至目标格（或与目标格上的我军互换）
  const applyCampaignDeploySwap = useCallback((col, row) => {
    if (campaignDeployTroopId == null || !campaignPreset || !deployRect || !campaignMapSim?.cells) return;
    if (!isCellInDeployRect(col, row, deployRect)) return;
    const cell = campaignMapSim.cells[row]?.[col];
    if (!isCampaignCellDeployableForPlayer(cell)) return;
    const players = bmRef.current.battleTroops.filter(isHumanPlayerTroop);
    const selected = players.find((t) => t.id === campaignDeployTroopId);
    if (!selected) return;
    setCampaignDeploySlots((prev) => {
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
      campaignDeploySlotsRef.current = next;
      return next;
    });
  }, [campaignDeployTroopId, campaignPreset, deployRect, campaignMapSim]);

  const onCampaignPlayerUnitMarkerClick = useCallback((troop) => {
    if (!troop || !isHumanPlayerTroop(troop)) return;
    setCampaignDeployTroopId((prev) => (prev === troop.id ? null : troop.id));
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

  const onCampaignCellClick = useCallback((col, row) => {
    if (bm.battlePlaying && !bm.autoBattle) {
      if (clickIsCurrentActorCell(col, row)) {
        setManualActionMenuOpen((open) => !open);
        return;
      }
      setManualActionMenuOpen(false);
      manual.handleTileClick(row, col);
      return;
    }
    if (campaignDeployReady || bm.battlePlaying) return;
    applyCampaignDeploySwap(col, row);
  }, [
    campaignDeployReady,
    bm.battlePlaying,
    bm.autoBattle,
    applyCampaignDeploySwap,
    manual.handleTileClick,
    clickIsCurrentActorCell,
  ]);

  // 须等 skills.json 就绪后再写入战场部队，否则 NPC/我方将领阶段1 被动未叠入 `character._skillPhase1Combat`
  useEffect(() => {
    if (initRef.current || !playerUnits || playerUnits.length === 0) return;
    if (!campaignMapSim || !campaignPreset || bm.allTroops.length < 1) return;
    if (Object.keys(skillsMap || {}).length === 0) return;

    initRef.current = true;

    bm.setMapResult(buildCampaignBattleMapResult(campaignMapSim));
    bm.setMapLabel('战役战场');
    bm.setBattleTroops(
      buildCampaignBattleTroopsFromSim({
        playerUnits, campaignMapSim,
        deployRect: getPlayerDeployRectGlobal(campaignPreset),
        allTroops: bm.allTroops,
        allCharacters: bm.allCharacters,
        skillsMap: skillsMap || undefined,
      }),
    );
    bm.toggleBattle();
    bm.setSilverAmount(silverAmount);
    bm.toggleAutoFormation(false); // 战役关闭自动阵型，避免首回合挪动 ally/NPC
    // 保持 isBattle=false：战前 CampaignMapGrid 显示蓝色部署区
    setStage(STAGE.READY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerUnits, campaignMapSim, campaignPreset, bm.allTroops.length, skillsMap, silverAmount]);

  // ── 开战（含门槛校验 + 战略→战术坐标写入） ──
  const [battleGateModalOpen, setBattleGateModalOpen] = useState(false);
  const [battleGateMessage, setBattleGateMessage] = useState('');

  const startBattleWithLineupGate = useCallback(() => {
    if (recordOnly) { playBattleRoundRef.current(); return; }
    if (!campaignDeployReady) {
      setBattleGateMessage('请先在蓝色可部署区内完成部署：点击地图上的我方部队选中，再点蓝色格调整位置；完成后点「确认部署」。');
      setBattleGateModalOpen(true);
      return;
    }
    const v = validateMainLineupBattleGate({ recordOnly, cards, playerUnits, playerFood });
    if (!v.ok) {
      setBattleGateMessage(v.message || '条件不足');
      setBattleGateModalOpen(true);
      return;
    }
    // 将战略部署坐标写入战术 x,y，再用 flushSync + queueMicrotask 开战
    const slots = campaignDeploySlotsRef.current;
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
  }, [recordOnly, campaignDeployReady, cards, playerUnits, playerFood]);

  // ── 同步布局宽度 ──
  const syncLayoutWidth = useCallback(() => {
    const el = campaignShellRef.current;
    if (el?.offsetWidth) setLayoutWidth(`${el.offsetWidth}px`);
  }, []);
  useLayoutEffect(() => { syncLayoutWidth(); }, [bm.mapResult, syncLayoutWidth]);
  useEffect(() => {
    const el = campaignShellRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => syncLayoutWidth());
    ro.observe(el);
    return () => ro.disconnect();
  }, [bm.mapResult, syncLayoutWidth]);

  // ── 战役手动操控悬浮按钮 ──
  const campaignManualChrome = useMemo(() => {
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
          top: `calc(${ty} * (var(--camp-tile) + 1px))`,
          left: `calc(${tx} * (var(--camp-tile) + 1px))`,
          width: 'calc(var(--camp-tile) + 1px)',
          height: 'calc(var(--camp-tile) + 1px)',
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
            campaignGridOverlay
          />
        )}
      </>
    );
  }, [bm.autoBattle, manual, manualActionMenuOpen]);

  if (!campaignMapSim) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-[#1a1a2e] px-6 text-center">
        <p className="text-red-300 text-sm">战役地图数据缺失，无法开战。</p>
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

  return (
    <div className="fixed inset-0 z-[60] overflow-auto bg-[#1a1a2e]">
      <div className="battle-page">
        {stage === STAGE.LOADING && (
          <div className="maps-row">
            <div style={{ color: '#555', fontSize: 14, padding: 40 }}>正在准备战场...</div>
          </div>
        )}

        {/* 战役 16×20 战略格网：部署阶段 + 战斗阶段共用同一地图 */}
        {stage === STAGE.READY && campaignPreset && campaignMapSim && bm.mapResult && (
          <div className="w-full max-w-[min(98vw,900px)] mx-auto px-1 pb-2">
            <CampaignMapGrid
              ref={campaignShellRef}
              cells={campaignMapSim.cells}
              seed={campaignMapSim.seed}
              title={campaignBattleTitle || opponentName || '战役地图'}
              meta={
                <span className="text-[11px] text-stone-500">
                  可部署区 {deployRect ? `${deployRect.cols}×${deployRect.rows}` : ''} · 种子 {campaignMapSim.seed}
                </span>
              }
              battleTroops={bm.battleTroops}
              deploymentMode={!campaignDeployReady && !bm.battlePlaying}
              battleManual={bm.battlePlaying && !bm.autoBattle}
              deployRect={deployRect}
              onCellClick={onCampaignCellClick}
              playerByCell={campaignMapUnitsByCell}
              deployTroopSelectMode={!campaignDeployReady && !bm.battlePlaying}
              selectedDeployTroopId={campaignDeployTroopId}
              onPlayerUnitMarkerClick={onCampaignPlayerUnitMarkerClick}
              showBattleEngineHosts={bm.battlePlaying || bm.roundNum > 0}
              showStaticNpcUnits={bm.roundNum === 0 && !bm.battlePlaying}
              manualHighlightModel={!bm.autoBattle ? manual.manualHighlightModel : null}
              manualChrome={campaignManualChrome}
              tooltipApiRef={campaignTooltipApiRef}
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
              {campaignDeployReady ? (
                <p>已确认部署。可点「重新部署」修改，或开始战斗。</p>
              ) : (
                <>
                  <p className="text-amber-100/90 font-medium">部署操作</p>
                  <p>① 在地图上<strong className="text-stone-200">直接点击我方部队头像</strong>进入选择状态（再点同一部队可取消）。</p>
                  <p>② 选择后，仅<strong className="text-sky-300">蓝色高亮可部署格</strong>可落位；点击其它区域无效。可与另一名我军互换位置。</p>
                  {campaignDeployTroopId ? (
                    <p className="text-amber-200/95 pt-0.5">当前已选中一支部队 → 请点击蓝色区域内的目标格。</p>
                  ) : (
                    <p className="text-stone-500 pt-0.5">尚未选中部队。</p>
                  )}
                </>
              )}
            </div>
            {!campaignDeployReady ? (
              <button
                type="button"
                className="rounded-lg bg-emerald-800/90 border border-emerald-600 px-4 py-1.5 text-xs text-emerald-50"
                onClick={() => { setCampaignDeployTroopId(null); setCampaignDeployReady(true); }}
              >
                确认部署
              </button>
            ) : (
              <button
                type="button"
                className="rounded-lg bg-stone-700 border border-stone-500 px-3 py-1 text-xs text-stone-200"
                onClick={() => { setCampaignDeployReady(false); setCampaignDeployTroopId(null); }}
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
