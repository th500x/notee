/**
 * 小型战术地图战斗壳层（8×10 格）
 * 适用：pve_event（事件战）、pve_bandit（匪寨）、pve_siege（攻城战）、pvp_siege（PVP 攻城）
 *
 * @see LargeMapBattle  大型战役地图（16×20，pve_campaign）
 *
 * 与战役壳层共用：useBattleMap、useBattleEngine、useManualBattle、
 *   useBattleSettlement、useAwayTimeout、BattleLog、BattleAuxPanel、MapLegend
 * 小型图专有：BattleMap 渲染、createTacticalMapCardSurface、
 *   renderTroopsToBattleMapDom、点格部署
 */
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useBattleMap } from '@/hooks/useBattleMap';
import { useBattleEngine } from '@/battle/tacticalBattleEngine';
import { useManualBattle } from '@/hooks/useManualBattle';
import { useAwayTimeout } from '@/hooks/useAwayTimeout';
import { useBattleSettlement } from '@/hooks/useBattleSettlement';
import { buildSiegeUnits } from '@/battle/buildSiegeUnits';
import { renderTroopsToBattleMapDom } from '@/battle/renderTroopsToBattleMapDom';
import { createTacticalMapCardSurface } from '@/battle/tacticalMapCardSurface';
import BattleMap from '@/components/battle/BattleMap';
import BattleLog from '@/components/battle/BattleLog';
import BattleAuxPanel from '@/components/battle/BattleAuxPanel';
import MapLegend from '@/components/battle/MapLegend';
import ChestRewardOverlay from '@/components/battle/ChestRewardOverlay';
import VeteranPromotionOverlay from '@/components/battle/VeteranPromotionOverlay';
import AncientModal from '@/components/common/AncientModal';
import '@/components/battle/BattleMap.css';
import { ZONE } from '@/components/battle/battleConstants';
import { getMoveCost } from '@/systems/battleFlowManager';
import { validateMainLineupBattleGate } from '@/utils/mainLineupTroops';
import { writeInflightBattleTroopSnapshot } from '@/utils/inflightBattleTroopSnapshot';
import { useSkillsMap } from '@/hooks/useSkillsMap';

const STAGE = { LOADING: 'loading', READY: 'ready' };

/**
 * @param {Array}   playerUnits
 * @param {string}  [enemyRarity]                    事件模式：敌方整体稀有度（无 enemySlotRarities 时四面同稀有度）
 * @param {string[]} [enemySlotRarities]             可选：长度 4 时每槽稀有度（匪寨等，见 @shared/utils/smallMapEnemyRoster）
 * @param {object|null} [smallMapPveLoot]           可选：胜利时写入 rewards.smallMapPveLoot，后端 smallMapBattleLootService 即发奖
 * @param {Array}   [enemyUnits]                     攻城模式：直接传入敌方 NPC 阵容
 * @param {Array}   [allyUnits]                      御驾等友军（攻城，最多 1 支）
 * @param {number}  [silverAmount]
 * @param {number}  [playerFood]
 * @param {string}  [playerId]
 * @param {string}  [battleType]                     'pve_event'|'pve_bandit'|'pve_siege'|'pvp_siege'
 * @param {string}  [opponentName]
 * @param {function} onBattleEnd                     (result, silverSpent, scoreResult, killedIndices, meta)
 * @param {object}  [defenseReportMeta]              驻守战：为守城方写镜像战报
 * @param {boolean} [recordOnly]                     仅记录战报，不通过 /battles 改兵力
 * @param {string}  [siegeDefenderType]              攻城积分倍率类型
 * @param {Array}   [eventExtraEnemyCharacterIds]    事件惩罚战额外将领（指定将领 ID 时 5 编制；与 eventPunishmentExtraSlot 二选一，新配置已不用）
 * @param {boolean} [eventPunishmentExtraSlot]        事件因子 type-b：在默认编制上多 1 支敌方部队（池同事件稀有度）
 * @param {Array}   [cards]                          PlayerContext.cards，用于出征门槛校验
 */
export default function SmallMapBattle({
  playerUnits,
  enemyRarity,
  enemySlotRarities = null,
  smallMapPveLoot = null,
  enemyUnits,
  allyUnits = null,
  silverAmount = 0,
  playerFood = 0,
  playerId,
  battleType = 'pve_event',
  opponentName = '敌军',
  onBattleEnd,
  defenseReportMeta = null,
  recordOnly = false,
  siegeDefenderType = null,
  eventExtraEnemyCharacterIds = null,
  eventPunishmentExtraSlot = false,
  cards = null,
}) {
  const [stage, setStage] = useState(STAGE.LOADING);
  const [layoutWidth, setLayoutWidth] = useState('auto');
  const mapCardRef = useRef(null);
  const battleSurfaceRef = useRef(null);
  battleSurfaceRef.current = createTacticalMapCardSurface(mapCardRef);
  const initRef = useRef(false);
  const siegeInitErrorShownRef = useRef(false);
  const troopsRendered = useRef(false);
  const mountedRef = useRef(true);
  const manualBattleRef = useRef(null);
  const siegeAutoStartedRef = useRef(false);
  const playBattleRoundRef = useRef(() => {});
  const bm = useBattleMap();
  const skillsMap = useSkillsMap();
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
    mapCardRef, battleSurfaceRef, manualBattleRef,
    setBattleEndReason: bm.setBattleEndReason,
  });

  playBattleRoundRef.current = engine.playBattleRound;

  const [manualOptionsHintOpen, setManualOptionsHintOpen] = useState(false);
  const onManualPlayerActionCommitted = useCallback(() => {
    setManualOptionsHintOpen(true);
  }, []);

  const manual = useManualBattle({
    battleTroops: bm.battleTroops, mapResult: bm.mapResult,
    performAttack: engine.performAttack, performCounterAttack: engine.performCounterAttack,
    performPhase3Heal: engine.performPhase3Heal,
    performPhase4Damage: engine.performPhase4Damage,
    performPhase5Composite: engine.performPhase5Composite,
    battleKill: engine.battleKill, battleMove: engine.battleMove,
    formationGroupMove: engine.formationGroupMove, removeFormationBuffs: engine.removeFormationBuffs,
    addLog: bm.addLog,
    skillsMap,
    onManualPlayerActionCommitted,
  });

  useEffect(() => {
    if (!manualOptionsHintOpen) return undefined;
    const t = window.setTimeout(() => setManualOptionsHintOpen(false), 3000);
    return () => clearTimeout(t);
  }, [manualOptionsHintOpen]);

  manualBattleRef.current = manual;

  const engineRef = useRef(engine);
  engineRef.current = engine;

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // ── 离开超时（小型图 PVE：事件 / 匪寨 / 攻城） ──
  const awayTimeoutEnabled =
    battleType === 'pve_event' || battleType === 'pve_bandit' || battleType === 'pve_siege';
  const { pendingAwayNoticeRef } = useAwayTimeout({
    enabled: awayTimeoutEnabled,
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
  const { awayNoticeOpen, flushAwayEndNotice } = useBattleSettlement({
    stage, bmRef, manualBattleRef, engineRef, mountedRef,
    battlePlaying: bm.battlePlaying,
    battleType, playerId, silverAmount, campaignId: null,
    defenseReportMeta, recordOnly, siegeDefenderType, opponentName,
    battleSettledRef: null,
    pendingAwayNoticeRef,
    smallMapPveLoot,
    onBattleEnd: wrappedOnBattleEnd,
  });

  // 须等 skills.json 字典就绪后再落子，否则 buildPlayerUnitsFromContext / assignRealBattleTroops
  // 叠不上阶段1 被动（如战神 critRate），预估与 hover 与结算不一致。
  useEffect(() => {
    if (initRef.current || !playerUnits || playerUnits.length === 0) return;
    if (!enemyUnits && bm.allTroops.length < 3) return;
    if (Object.keys(skillsMap || {}).length === 0) return;

    initRef.current = true;

    bm.generate('standard');

    if (enemyUnits) {
      bm.setBattleTroops(buildSiegeUnits({
        playerUnits,
        enemyUnits,
        allyUnits: Array.isArray(allyUnits) ? allyUnits : [],
        baseUrl: import.meta.env.BASE_URL,
      }));
    } else {
      bm.assignRealBattleTroops(playerUnits, enemyRarity || 'common', {
        extraEnemyCharacterIds: eventExtraEnemyCharacterIds,
        eventPunishmentExtraSlot,
        skillsMap,
        ...(Array.isArray(enemySlotRarities) && enemySlotRarities.length === 4
          ? { enemySlotRarities }
          : {}),
      });
    }

    // 双次 toggleBattle：第一次进入战斗壳层，第二次退回（保持战前部署状态）
    bm.toggleBattle();
    bm.setSilverAmount(silverAmount);
    bm.toggleAutoFormation(true);
    bm.toggleBattle();
    setStage(STAGE.READY);
    // bm.* 来自 useBattleMap；不把整个 bm 列入依赖以免多余重跑 init
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    playerUnits,
    enemyUnits,
    allyUnits,
    enemyRarity,
    enemySlotRarities,
    eventExtraEnemyCharacterIds,
    eventPunishmentExtraSlot,
    bm.allTroops.length,
    skillsMap,
    silverAmount,
  ]);

  /** 须用 stage===READY 判断「仍在战术壳内」，勿用 battlePlaying：后者仅在 playBattleRound 动画循环内为 true，回合间隙为 false 导致快照从不写入。 */
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

  // 攻城 / PVP：若我方单位为空或敌方阵容缺失，init 会永远不跑 → 长期「正在准备战场…」且无控制台报错
  useEffect(() => {
    if (initRef.current || siegeInitErrorShownRef.current) return;
    const needEnemyList = battleType === 'pvp_siege' || battleType === 'pve_siege';
    if (!needEnemyList) return;
    const noPlayer = !playerUnits || playerUnits.length === 0;
    const noEnemy = !enemyUnits || enemyUnits.length === 0;
    if (!noPlayer && !noEnemy) return;
    siegeInitErrorShownRef.current = true;
    setBattleGateMessage(
      noPlayer
        ? '缺少我方上阵单位，战术图无法初始化。请返回大地图，在「卡牌」中检查主公与将领的部队装配。'
        : '缺少敌方阵容数据，战术图无法初始化。若持续出现请刷新页面。',
    );
    setBattleGateModalOpen(true);
  }, [playerUnits, enemyUnits, battleType]);

  // ── PVP 攻城：预置敌方阵容时自动开战，避免未点「开始」导致不落战报 ──
  useEffect(() => {
    if (stage !== STAGE.READY || siegeAutoStartedRef.current) return;
    if (!enemyUnits || enemyUnits.length === 0 || battleType !== 'pvp_siege') return;
    const v = validateMainLineupBattleGate({ recordOnly, cards, playerUnits, playerFood });
    if (!v.ok) {
      setBattleGateMessage(v.message || '无法开战');
      setBattleGateModalOpen(true);
      return;
    }
    siegeAutoStartedRef.current = true;
    const t = requestAnimationFrame(() => { playBattleRoundRef.current(); });
    return () => cancelAnimationFrame(t);
  }, [stage, enemyUnits, battleType, recordOnly, cards, playerUnits, playerFood]);

  // ── 渲染部队到 DOM（战前可重复刷新；战中由引擎维护，勿全量覆盖） ──
  useEffect(() => {
    if (!bm.mapResult || bm.battleTroops.length === 0 || !mapCardRef.current) return;
    const preBattle = bm.roundNum === 0 && !bm.battlePlaying;
    if (!preBattle && troopsRendered.current) return;
    requestAnimationFrame(() => {
      renderTroopsToBattleMapDom(mapCardRef, bm.battleTroops, import.meta.env.BASE_URL);
      troopsRendered.current = true;
    });
  }, [bm.mapResult, bm.battleTroops, bm.battlePlaying, bm.roundNum]);

  // ── 同步布局宽度 ──
  const syncLayoutWidth = useCallback(() => {
    const el = mapCardRef.current;
    if (el?.offsetWidth) setLayoutWidth(`${el.offsetWidth}px`);
  }, []);
  useLayoutEffect(() => { syncLayoutWidth(); }, [bm.mapResult, syncLayoutWidth]);
  useEffect(() => {
    const el = mapCardRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => syncLayoutWidth());
    ro.observe(el);
    return () => ro.disconnect();
  }, [bm.mapResult, syncLayoutWidth]);

  // ── 战前部署：点击我军部队选中，再点蓝色 deployB 区格子换位 ──
  const [eventDeployTroopId, setEventDeployTroopId] = useState(null);
  const eventDeployTroopIdRef = useRef(null);
  eventDeployTroopIdRef.current = eventDeployTroopId;
  useEffect(() => { if (bm.battlePlaying) setEventDeployTroopId(null); }, [bm.battlePlaying]);

  const onBattleTileClick = useCallback((y, x) => {
    const m = bmRef.current;
    if (m.roundNum === 0 && !m.battlePlaying && !m.autoBattle && m.mapResult) {
      if (!ZONE.deployB.includes(y)) return;
      if (getMoveCost(y, x, m.mapResult) === Infinity) return;
      const atCell = m.battleTroops.find((t) => t.currentTroops > 0 && t.y === y && t.x === x);

      if (atCell?.faction === 'player') {
        setEventDeployTroopId((prev) => (prev === atCell.id ? null : atCell.id));
        return;
      }
      const selId = eventDeployTroopIdRef.current;
      if (selId == null || atCell?.faction === 'enemy') return;

      m.setBattleTroops((prev) => {
        const next = prev.map((t) => ({ ...t }));
        const sel = next.find((t) => t.id === selId);
        if (!sel || sel.faction !== 'player' || sel.currentTroops <= 0) return prev;
        if (!atCell) { sel.y = y; sel.x = x; return next; }
        const occ = next.find((t) => t.id === atCell.id);
        if (!occ || occ.faction !== 'player') return prev;
        const sy = sel.y, sx = sel.x;
        sel.y = y; sel.x = x;
        occ.y = sy; occ.x = sx;
        return next;
      });
      return;
    }
    if (!m.autoBattle) manual.handleTileClick(y, x);
  }, [manual.handleTileClick]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 开战（含前置门槛校验） ──
  const [battleGateModalOpen, setBattleGateModalOpen] = useState(false);
  const [battleGateMessage, setBattleGateMessage] = useState('');

  const startBattleWithLineupGate = useCallback(() => {
    if (recordOnly) { playBattleRoundRef.current(); return; }
    const v = validateMainLineupBattleGate({ recordOnly, cards, playerUnits, playerFood });
    if (!v.ok) {
      setBattleGateMessage(v.message || '条件不足');
      setBattleGateModalOpen(true);
      return;
    }
    playBattleRoundRef.current();
  }, [recordOnly, cards, playerUnits, playerFood]);

  return (
    <div className="fixed inset-0 z-[60] overflow-auto bg-[#1a1a2e]">
      <div className="battle-page">
        {stage === STAGE.LOADING && (
          <div className="maps-row">
            <div style={{ color: '#555', fontSize: 14, padding: 40 }}>正在准备战场...</div>
          </div>
        )}
        {bm.mapResult && (
          <div>
            {/*
              小型图战前常把 bm.isBattle 抵消为 false（双次 toggleBattle），实战中应以 playing/回合为准，
              否则 BattleMap 左侧「战区」行标、技能名格等依赖 isBattle 的分支在交战中永远不成立。
            */}
            <BattleMap
              mapResult={bm.mapResult} mapLabel={bm.mapLabel}
              battleTroops={bm.battleTroops} showTroops={false}
              isBattle={bm.isBattle || bm.battlePlaying || bm.roundNum > 0}
              roundNum={bm.roundNum}
              highlightPlayerDeployZone={bm.roundNum === 0 && !bm.battlePlaying && !bm.isBattle}
              preBattleDeployTroopId={
                bm.roundNum === 0 && !bm.battlePlaying && !bm.autoBattle ? eventDeployTroopId : null
              }
              mapCardRef={mapCardRef}
              autoBattle={bm.autoBattle}
              onTakeover={() => bm.toggleAutoBattle(false)}
              onTileClick={!bm.autoBattle ? onBattleTileClick : undefined}
              manualProps={!bm.autoBattle ? {
                phase: manual.phase, activeTroop: manual.activeTroop,
                formationTroops: manual.formationTroops, reachableTiles: manual.reachableTiles,
                onStandby: manual.handleStandby, onFormationStandby: manual.handleFormationStandby,
                attackPreview: manual.attackPreview,
                healPreview: manual.healPreview,
                phase4ShapeOverlay: manual.phase4ShapeOverlay,
                toggleSkillTargeting: manual.toggleSkillTargeting,
                dismissSkillPicker: manual.dismissSkillPicker,
                skillTargetingActive: manual.skillTargetingActive,
                selectSkillArm: manual.selectSkillArm,
                skillPickerOpen: manual.skillPickerOpen,
                skillPickerItems: manual.skillPickerItems,
                cyclePhase3HealSlot: manual.cyclePhase3HealSlot,
                phase3HealUi: manual.phase3HealUi,
                chestReward: manual.chestReward, confirmChestReward: manual.confirmChestReward,
                manualHighlightModel: manual.manualHighlightModel,
              } : undefined}
            />
            {bm.roundNum === 0 && !bm.battlePlaying && !bm.autoBattle && (
              <p className="text-[11px] text-stone-400 text-center max-w-[min(98vw,520px)] mx-auto px-2 pb-1 leading-relaxed">
                战前部署：点击我军部队选中（再点同一部队取消），再点击底部蓝色「我」区内可通行格或友军格调整位置。
              </p>
            )}
            {engine.autoChestReward && <ChestRewardOverlay reward={engine.autoChestReward} />}
          </div>
        )}
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
        {/* 小型图战前 isBattle 常为 false（init 双次 toggleBattle 抵消）；开战仅靠 battlePlaying/roundNum */}
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

      {manualOptionsHintOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 px-4"
          onClick={() => setManualOptionsHintOpen(false)}
          role="presentation"
        >
          <div className="pointer-events-none max-w-[min(92vw,320px)] rounded-xl border border-amber-600/50 bg-stone-900/96 px-4 py-3 text-center shadow-2xl">
            <p className="text-amber-400 text-sm font-bold mb-1.5">操作提示</p>
            <p className="text-stone-200 text-xs leading-relaxed">
              「选项」相关按钮已移至地图 <span className="text-white font-semibold">左侧</span>（⬅️），与「技能」「待机」同一列。
            </p>
          </div>
        </div>
      )}

      <AncientModal
        isOpen={awayNoticeOpen}
        type="info"
        title="本场已自动结算"
        confirmText="确定"
        onConfirm={flushAwayEndNotice}
        onClose={flushAwayEndNotice}
      >
        <p className="text-center text-gray-800">
          离开超过 30 秒未操作，本场将按规则自动结算并返回大地图。
        </p>
      </AncientModal>

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
