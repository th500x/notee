/**
 * 大地图：颍川郡战略格网（world）；攻城/城况/荒郊等经格上 tooltip 与共享面板。
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { useRoadDefenseFriction } from '@/contexts/RoadDefenseFrictionContext';
import useEventSystem from '@/hooks/useEventSystem';
import ExplorePanel from '@/components/event/ExplorePanel';
import BattleArena from '@/components/battle/BattleArena';
import { buildPlayerUnitsFromContext } from '@/utils/battlePlayerBuilder';
import { fetchSiegeQuotaJson, postSiegeQuotaAction } from '@/hooks/useSiegeQuota';
import { PHASE } from '@/components/event/EventConstants';
import { playerAPI } from '@/services/playerApi';
import AncientModal from '@/components/common/AncientModal';
import GarrisonLineup from '@/components/garrison/GarrisonLineup';
import MainCityBarracksPostPanel from '@/components/garrison/MainCityBarracksPostPanel';
import SanGongFuPanel from '@/components/game/SanGongFuPanel';
import PositionCard from '@shared/components/card/PositionCard';
import { garrisonAPI } from '@/services/garrisonApi';
import { API_CONFIG, getRarityHex, getRarityLabelCn } from '@/constants';
import SiegeReplayMini from '@/components/game/SiegeReplayMini';
import { validateMainLineupBattleGate } from '@/utils/mainLineupTroops';
import { shortEquipmentDisplayName } from '@/utils/equipmentDisplayName';
import { buildBanditLayerSmallMapPveLoot } from '@shared/utils/banditRaidLayerRewards';
import { banditNpcSlotRaritiesFromLayer } from '@shared/utils/smallMapEnemyRoster';
import {
  getConfiguredGarrisonCityIds,
  MAX_GARRISON_CONFIGURED_CITIES,
} from '@/utils/garrisonScopeUtils';
import WorldYingchuanMapSection from '@/components/world/WorldYingchuanMapSection';
import { worldMapCityIsPlayerSameFaction } from '@/utils/worldMapCityPanelCopy';
import { worldMapOverlayRefs, notifyWorldMapOverlayGate } from '@/utils/worldMapOverlayRefs';
import PvpDefenseOutcomeModal from '@/components/game/PvpDefenseOutcomeModal';

/** 裁定中遮罩最短展示时长（与其它短动画一致，约 3 秒） */
const PVP_ADJUDICATION_UI_MS = 3000;

function scheduleAfterMinAdjudicationUi(startedAt, fn) {
  const elapsed = Date.now() - startedAt;
  const wait = Math.max(0, PVP_ADJUDICATION_UI_MS - elapsed);
  if (wait <= 0) {
    fn();
    return;
  }
  setTimeout(fn, wait);
}

/** 攻城结算里服务端权威战报的简化回放入口 */
function AuthoritativeSiegeReplayButton({
  battleLogLines,
  initialAttackerTroops,
  initialDefenderTroops,
}) {
  const [open, setOpen] = useState(false);
  const logStr = Array.isArray(battleLogLines) ? battleLogLines.join('\n') : '';
  const canReplay =
    logStr.length > 12 &&
    /═══\s*第\s*\d+\s*回合\s*═══/.test(logStr) &&
    /次攻击/.test(logStr) &&
    /\[攻方\]/.test(logStr);
  if (!canReplay) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full py-2 rounded-lg bg-stone-800 border border-amber-600/40 text-amber-200 text-xs hover:bg-stone-700"
      >
        攻城战报 · 简化回放
      </button>
      {open && (
        <AncientModal
          isOpen
          onClose={() => setOpen(false)}
          type="confirm"
          title="攻城战报 · 简化回放"
          hideButtons
          width="max-w-md"
        >
          <div className="-mx-2 -my-2 bg-[#1a1a2e] rounded p-2 text-left">
            <SiegeReplayMini
              open
              onClose={() => setOpen(false)}
              battleLog={logStr}
              leftLabel="攻方"
              rightLabel="守军"
              initialAttackerTroops={initialAttackerTroops}
              initialDefenderTroops={initialDefenderTroops}
            />
          </div>
        </AncientModal>
      )}
    </>
  );
}

/**
 * 攻城 / 匪寨小型图战后结算：同一容器、标题「战斗结算」与同色系奖励行（避免另起一套样式）。
 * @param {'siege'|'bandit'} settlementKind
 */
function StrategicSettlementCard({
  onConfirm,
  /** 匪寨胜利：左侧「继续」进入下一层（不扣次）；与 `onConfirm`（退出）并存时渲染双按钮 */
  onBanditContinue = null,
  settlementKind = 'siege',
  /** `settlementKind === 'bandit'` 时用于顶栏 emoji：胜利 ⚔️ / 失败 💀（匪寨不展示本场击杀行，不能再用击杀数推 emoji） */
  banditOutcome = null,
  silverReward = 0,
  reputationReward = 0,
  contributionReward = 0,
  equipmentDrop = null,
  chestRewards = [],
  killCount = null,
  /** 攻城累计段：npcTotal>0 时展示「累计已消灭」 */
  siegeNpcKilled = null,
  siegeNpcTotal = null,
  /** 匪寨：副标题层名 */
  banditOpponentName = '',
  /** 匪寨：如「战术评分：C · 757 分」 */
  tacticalScoreText = null,
  authoritativeBattleLog = null,
  initialAttackerTroops = null,
  initialDefenderTroops = null,
  showZeroKillNote = false,
  siegeCompleted = false,
  battleReportFailed = false,
  extraFooterNote = null,
}) {
  const sr = Math.max(0, Number(silverReward) || 0);
  const rr = Math.max(0, Number(reputationReward) || 0);
  const cr = Math.max(0, Number(contributionReward) || 0);
  const kc = killCount != null && Number.isFinite(Number(killCount)) ? Number(killCount) : null;
  const kcShown = kc != null ? kc : 0;
  /** 攻城：`(击杀||银两||贡献)`；匪寨：按胜负（结算卡不展示击杀行） */
  const showVictoryEmoji =
    settlementKind === 'bandit'
      ? banditOutcome === 'victory'
      : !!((kc != null ? kcShown : 0) || sr || cr);

  const chestList = Array.isArray(chestRewards) ? chestRewards : [];

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-xl border border-amber-500/30 bg-gray-900/95 p-6 text-center space-y-3">
        <div className="text-4xl">{showVictoryEmoji ? '⚔️' : '💀'}</div>
        <div className="text-xl font-bold text-amber-400">战斗结算</div>
        {settlementKind === 'bandit' && banditOpponentName ? (
          <div className="text-sm text-stone-300">{banditOpponentName}</div>
        ) : null}
        {tacticalScoreText ? (
          <div className="text-sm text-gray-300">{tacticalScoreText}</div>
        ) : null}
        {sr > 0 && <div className="text-amber-300 text-sm">💰 获得 {sr} 银两</div>}
        {rr > 0 && <div className="text-yellow-300 text-sm">⭐ 获得 {rr} 声望</div>}
        {cr > 0 && <div className="text-sky-300 text-sm">贡献 +{cr}</div>}
        {equipmentDrop && (
          <div
            className="text-sm font-medium"
            style={{ color: getRarityHex(equipmentDrop.rarity) }}
          >
            🎁 攻城战后随机掉落（约 5%）：{equipmentDrop.name}（{getRarityLabelCn(equipmentDrop.rarity)}）
          </div>
        )}
        {chestList.length > 0 && (
          <div className="mt-1 space-y-1 border-t border-amber-500/25 pt-2 text-left text-sm">
            <div className="text-[11px] text-stone-500">📦 地图内宝箱</div>
            {chestList.map((r, i) => (
              <div
                key={`${r.equipmentId || 'eq'}-${i}`}
                className="text-sm font-medium"
                style={{ color: getRarityHex(r.rarity) }}
              >
                {shortEquipmentDisplayName(r.name)}（{getRarityLabelCn(r.rarity)}）
              </div>
            ))}
          </div>
        )}
        {kc != null && settlementKind === 'siege' ? (
          <div className="text-sm text-gray-300">本场击杀：{kc}</div>
        ) : null}
        {settlementKind === 'siege' ? (
          <div className="text-sm text-gray-400">
            NPC守军：本场消灭 {kcShown} 支
            {siegeNpcTotal != null && Number(siegeNpcTotal) > 0 && (
              <>
                {' '}
                · 累计已消灭 {siegeNpcKilled ?? 0}/{siegeNpcTotal}
              </>
            )}
          </div>
        ) : null}
        {extraFooterNote ? (
          <div className="text-xs text-stone-500 text-center leading-snug">{extraFooterNote}</div>
        ) : null}
        {battleReportFailed ? (
          <div className="text-xs text-red-300 text-left leading-snug">
            战报未能可靠保存到服务器，奖励以服务端记录为准；若反复出现请稍后重试或联系管理。
          </div>
        ) : null}
        {Array.isArray(authoritativeBattleLog) && authoritativeBattleLog.length > 0 && (
          <>
            <AuthoritativeSiegeReplayButton
              battleLogLines={authoritativeBattleLog}
              initialAttackerTroops={initialAttackerTroops}
              initialDefenderTroops={initialDefenderTroops}
            />
            <details className="mt-2 max-h-32 overflow-y-auto text-left text-[11px] text-stone-400">
              <summary className="cursor-pointer text-amber-500/90">文字战报（服务端）</summary>
              <pre className="mt-1 whitespace-pre-wrap font-sans">{authoritativeBattleLog.join('\n')}</pre>
            </details>
          </>
        )}
        {showZeroKillNote && (
          <div className="text-xs text-stone-500">（目标已被其他玩家击杀，无新增奖励）</div>
        )}
        {siegeCompleted && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-900/50 p-3">
            <div className="font-bold text-amber-400">🏰 城池攻破！</div>
          </div>
        )}
        {typeof onBanditContinue === 'function' ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onBanditContinue}
              className="flex-1 min-w-0 rounded-lg bg-gradient-to-r from-amber-700 to-yellow-700 py-2.5 text-sm font-bold text-amber-100"
            >
              继续
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 min-w-0 rounded-lg bg-gradient-to-r from-amber-700 to-yellow-700 py-2.5 text-sm font-bold text-amber-100"
            >
              退出
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onConfirm}
            className="w-full rounded-lg bg-gradient-to-r from-amber-700 to-yellow-700 py-2.5 text-sm font-bold text-amber-100"
          >
            确定
          </button>
        )}
      </div>
    </div>
  );
}

export default function WorldMap({
  onEventBusyChange,
  sanGongFuCardPool,
  /** 特色介绍层展示中时勿触发教程链 IDLE 自动探索（避免叠层竞态） */
  blockTutorialAutoplay = false,
}) {
  const { player, cards, attributeBonusBySlot, refresh: refreshPlayer } = usePlayerContext();
  const roadFriction = useRoadDefenseFriction();
  /** 与 `WorldYingchuanMapSection` 同步：战略格网 + 郡内城行，供探索锚点在「路格≠库锚格」时用 footprint 反查 city_id */
  const exploreAnchorGridRef = useRef(null);
  const [exploreAnchorGridSeq, setExploreAnchorGridSeq] = useState(0);
  const onExploreAnchorGridContext = useCallback((ctx) => {
    exploreAnchorGridRef.current = ctx;
    setExploreAnchorGridSeq((n) => n + 1);
  }, []);

  const eventSystem = useEventSystem(player, cards, {
    tutorialAutoplay: !blockTutorialAutoplay,
    persistMapEventHint: true,
    exploreAnchorGridRef,
    exploreAnchorGridSeq,
  });
  const {
    phase,
    pendingMapEventHint,
    quota,
    eventsLoading,
    explorePoolAt,
    startExplore,
    citiesList,
    itemNameMap,
    isTutorial,
    positionAnimation,
    showLineupGuide,
  } = eventSystem;

  // ── 城市攻城状态 ──
  const [siegeData, setSiegeData] = useState(null); // 非null时进入战斗
  const [siegeResult, setSiegeResult] = useState(null); // 战斗结算
  const [siegeLoading, setSiegeLoading] = useState(false);
  /** 驻守统计全图拉取在 `WorldYingchuanMapSection`；披挂等操作后 bump 以刷新格上 tooltip 用槽数 */
  const [garrisonStatsRefreshKey, setGarrisonStatsRefreshKey] = useState(0);
  /** 匪寨小型图战斗：与攻城互斥；payload 见 `handleBanditRaidStart` */
  const [banditRaidData, setBanditRaidData] = useState(null);
  /** 匪寨战后结算面板（与攻城 `siegeResult` 同层 portal，点确定后关闭） */
  const [banditRaidResult, setBanditRaidResult] = useState(null);
  /** 匪寨战后 bump：战略 tooltip 内 `useBanditRaidQuota` 主动刷新 */
  const [postBanditRaidRefreshKey, setPostBanditRaidRefreshKey] = useState(0);
  const banditRaidDataRef = useRef(null);
  useEffect(() => {
    banditRaidDataRef.current = banditRaidData;
  }, [banditRaidData]);

  const banditRaidStartBlockedReason = useMemo(() => {
    const phaseOk = phase === PHASE.IDLE || phase === PHASE.RETURNING;
    if (!phaseOk) return '当前处于事件/探索流程中，请返回空闲后再攻打匪寨';
    if (siegeData) return '已有攻城或结算占用，请先结束上一场';
    if (banditRaidData) return '匪寨战斗进行中';
    if (banditRaidResult) return '请先关闭上一场匪寨结算';
    return null;
  }, [phase, siegeData, banditRaidData, banditRaidResult]);

  // ── 驻地编组面板（由格上 tooltip「驻地编组」打开，必带 cityId） ──
  const [showGarrison, setShowGarrison] = useState(false);
  const [garrisonCityId, setGarrisonCityId] = useState(null);
  const [garrisonCityName, setGarrisonCityName] = useState('');
  const [showBarracksPost, setShowBarracksPost] = useState(false);
  const [barracksPostCityId, setBarracksPostCityId] = useState(null);
  const [barracksPostCityName, setBarracksPostCityName] = useState('');
  const [showSanGongFu, setShowSanGongFu] = useState(false);
  const [sanGongFuCityName, setSanGongFuCityName] = useState('');
  const [sanGongPositionAnim, setSanGongPositionAnim] = useState(null);
  const sanGongAnimTimerRef = useRef(null);
  const [onDuty, setOnDuty] = useState(false); // 玩家是否处于披挂待命（任意城）

  // ── PVP 挑战状态 ──
  const [pvpChallenge, setPvpChallenge] = useState(null); // { challengeId, waitSeconds, defenseUnits, ... }
  const [pvpCountdown, setPvpCountdown] = useState(0);
  const pvpTimerRef = useRef(null);
  const pvpResolveOnceRef = useRef(false);

  // ── 防守方：轮询是否有 PVP 挑战 ──
  const [pvpDefenseAlert, setPvpDefenseAlert] = useState(null); // 防守方收到的挑战通知
  const [pvpDefenseWaiting, setPvpDefenseWaiting] = useState(null); // { challengeId, attackerName, startedAt } 已接受，等待裁定
  const [pvpDefenseOutcome, setPvpDefenseOutcome] = useState(null); // 裁定结果展示
  /** 攻城方：倒计时结束或对方已 accept，等待 siege-resolve 与最短 3s 裁定 UI */
  const [pvpAttackerAdjudicating, setPvpAttackerAdjudicating] = useState(null); // { defenderName, startedAt }
  /** 统一替代 window.alert（攻城/驻守等 API 错误） */
  const [simpleAlertMessage, setSimpleAlertMessage] = useState(null);
  /** 设为主城成功后立刻用于 UI，避免等 profile 返回前按钮仍可点（战略 tooltip 另见 WorldStrategicMapGrid 同步） */
  const [pendingMainCityCityId, setPendingMainCityCityId] = useState(null);
  const defPollRef = useRef(null);
  const pvpDefenseOutcomeHandledRef = useRef(false);
  /** 用户已点「确定」或窗口到期进入裁定等待时，不再重复弹出遇袭框（pending 轮询会持续数秒） */
  const silencedDefenseChallengeRef = useRef(null);

  /** 道路遭遇 · 攻方：`road/move` 触发遭遇后先提示再进场（与守方对称，复用 AncientModal） */
  const [roadAttackerAlert, setRoadAttackerAlert] = useState(null);
  /** 守方：因道路开战门闸不足被移回城内时的一次性文案（GET road/self 读即清库） */
  const [roadGateRetreatNotice, setRoadGateRetreatNotice] = useState(null);
  /** 披挂 PVP 攻城倒计时用「绝对时刻」刷新 UI，避免后台标签页 `setInterval` 节流卡死 */
  const [pvpSiegeNowTick, setPvpSiegeNowTick] = useState(() => Date.now());
  /** 服务端裁定后、进结算页面前的「攻城战报·简化回放」全屏层（攻城道路同源 `SiegeReplayMini`） */
  const [authoritativeReplayOverlay, setAuthoritativeReplayOverlay] = useState(null);
  /** `getRoadSelf` 读到的退让文案在战斗演示/结算未结束前先暂存，避免盖住回放 */
  const deferredRoadGateNoticeRef = useRef(null);
  const roadNoticeUiBlockRef = useRef({
    authoritativeReplayOverlay: false,
    siegeResult: false,
    siegeData: false,
    banditRaidData: false,
    banditRaidResult: false,
    roadAuthoritativeOutcomeModal: false,
    pvpAttackerAdjudicating: false,
    pvpDefenseOutcome: false,
    roadAttackerAlert: false,
    pvpChallenge: false,
    roadDefenseAlert: false,
    roadAwaitingAuthoritativeOutcome: false,
    roadDefenseOutcomeReplay: false,
  });
  /** 由 `WorldYingchuanMapSection` 注入：道路坐标刷新后 bump 郡内他人 presence，与守方自刷新互补 */
  const bumpStrategicRoadPresenceRef = useRef(null);
  /** 与上次 `getRoadSelf` 快照比较，避免无意义的 profile 重拉 */
  const lastApiRoadSnapRef = useRef('');

  useEffect(() => {
    if (!player?.player_id || !onDuty) return;
    const pollPending = async () => {
      try {
        const res = await fetch(`${API_CONFIG.BASE_URL}/pvp/pending/${player.player_id}`).then(r => r.json());
        if (res.success && res.challenge) {
          const c = res.challenge;
          if (silencedDefenseChallengeRef.current && silencedDefenseChallengeRef.current === c.challengeId) {
            return;
          }
          if (silencedDefenseChallengeRef.current && silencedDefenseChallengeRef.current !== c.challengeId) {
            silencedDefenseChallengeRef.current = null;
          }
          setPvpDefenseAlert(c);
          if (Notification.permission === 'granted') {
            new Notification('🏰 城池遭袭', {
              body: `${c.attackerName} 正在攻打我方城池，${c.remainingSeconds} 秒内可点确定查看战报`,
              tag: 'siege-pvp',
            });
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission();
          }
        } else if (res.success && !res.challenge) {
          silencedDefenseChallengeRef.current = null;
        }
      } catch {}
    };
    pollPending();
    defPollRef.current = setInterval(pollPending, 3000);
    return () => clearInterval(defPollRef.current);
  }, [player?.player_id, onDuty]);

  useEffect(() => {
    worldMapOverlayRefs.worldMapMounted = true;
    worldMapOverlayRefs.pvpDefenseAlertActive = !!pvpDefenseAlert;
    worldMapOverlayRefs.siegeRoadEncounterId = siegeData?.roadEncounterId ?? null;
    notifyWorldMapOverlayGate();
    return () => {
      worldMapOverlayRefs.worldMapMounted = false;
      worldMapOverlayRefs.pvpDefenseAlertActive = false;
      worldMapOverlayRefs.siegeRoadEncounterId = null;
      notifyWorldMapOverlayGate();
    };
  }, [pvpDefenseAlert, siegeData?.roadEncounterId]);

  /** 遇袭：关闭通知并进入「裁定中」轮询（与是否点确定一致；不再调用 /accept，避免与 siege-resolve 竞态） */
  const beginDefenseFollowUp = useCallback((alert) => {
    if (!alert?.challengeId) return;
    silencedDefenseChallengeRef.current = alert.challengeId;
    setPvpDefenseAlert(null);
    setPvpDefenseWaiting({
      challengeId: alert.challengeId,
      attackerName: alert.attackerName || '未知',
      startedAt: Date.now(),
    });
  }, []);

  // 遇袭通知：产品在约 waitSeconds 后自动关闭并进入裁定等待
  useEffect(() => {
    const id = pvpDefenseAlert?.challengeId;
    if (!id || !pvpDefenseAlert?.waitSeconds) return undefined;
    const sec = Math.min(60, Math.max(1, Number(pvpDefenseAlert.waitSeconds)));
    const snap = { ...pvpDefenseAlert };
    const t = setTimeout(() => beginDefenseFollowUp(snap), sec * 1000);
    return () => clearTimeout(t);
  }, [pvpDefenseAlert?.challengeId, pvpDefenseAlert?.waitSeconds, beginDefenseFollowUp]);

  /**
   * 道路：本人 `road_*` 与一次性退让提示（守方被攻方踏格门闸击退时）。
   * 短间隔拉 `GET road/self`（读即清 `pendingRoadNotice`），位置变化则 `refresh` 以立刻移动本人叠层。
   */
  useEffect(() => {
    const pid = player?.player_id;
    if (!pid) {
      lastApiRoadSnapRef.current = '';
      return undefined;
    }
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      try {
        const res = await playerAPI.getRoadSelf(pid);
        if (cancelled || !res?.success || !res.data) return;
        const d = res.data;
        const j = d.road_jun_id != null ? String(d.road_jun_id) : '';
        const snap = `${j}|${d.road_position_x}|${d.road_position_y}`;
        const notice = typeof d.pendingRoadNotice === 'string' ? d.pendingRoadNotice.trim() : '';
        if (notice) {
          const b = roadNoticeUiBlockRef.current;
          const noticeBlocked =
            b.authoritativeReplayOverlay ||
            b.siegeResult ||
            b.siegeData ||
            b.banditRaidData ||
            b.banditRaidResult ||
            b.roadAuthoritativeOutcomeModal ||
            b.pvpAttackerAdjudicating ||
            b.pvpDefenseOutcome ||
            b.roadAttackerAlert ||
            b.pvpChallenge ||
            b.roadDefenseAlert ||
            b.roadAwaitingAuthoritativeOutcome ||
            roadFriction.roadDefenseOutcomeReplayBlockingRef.current;
          if (noticeBlocked) {
            deferredRoadGateNoticeRef.current = notice;
          } else {
            setRoadGateRetreatNotice(notice);
          }
        }
        if (lastApiRoadSnapRef.current === '') {
          lastApiRoadSnapRef.current = snap;
          if (notice) {
            await refreshPlayer({ silent: true });
            bumpStrategicRoadPresenceRef.current?.();
          }
          return;
        }
        if (snap !== lastApiRoadSnapRef.current || notice) {
          lastApiRoadSnapRef.current = snap;
          await refreshPlayer({ silent: true });
          bumpStrategicRoadPresenceRef.current?.();
        }
        const queued = deferredRoadGateNoticeRef.current;
        if (queued) {
          const bq = roadNoticeUiBlockRef.current;
          const stillBlocked =
            bq.authoritativeReplayOverlay ||
            bq.siegeResult ||
            bq.siegeData ||
            bq.banditRaidData ||
            bq.banditRaidResult ||
            bq.roadAuthoritativeOutcomeModal ||
            bq.pvpAttackerAdjudicating ||
            bq.pvpDefenseOutcome ||
            bq.roadAttackerAlert ||
            bq.pvpChallenge ||
            bq.roadDefenseAlert ||
            bq.roadAwaitingAuthoritativeOutcome ||
            roadFriction.roadDefenseOutcomeReplayBlockingRef.current;
          if (!stillBlocked) {
            deferredRoadGateNoticeRef.current = null;
            setRoadGateRetreatNotice(queued);
          }
        }
      } catch {
        /* 静默 */
      }
    };
    lastApiRoadSnapRef.current = '';
    tick();
    const iv = setInterval(tick, 700);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [player?.player_id, refreshPlayer]);

  /** 阻塞 UI 关闭后立刻弹出已暂存的退让提示（不必再等下一轮 getRoadSelf） */
  useEffect(() => {
    const queued = deferredRoadGateNoticeRef.current;
    if (!queued) return;
    const bq = roadNoticeUiBlockRef.current;
    const stillBlocked =
      bq.authoritativeReplayOverlay ||
      bq.siegeResult ||
      bq.siegeData ||
      bq.banditRaidData ||
      bq.banditRaidResult ||
      bq.roadAuthoritativeOutcomeModal ||
      bq.pvpAttackerAdjudicating ||
      bq.pvpDefenseOutcome ||
      bq.roadAttackerAlert ||
      bq.pvpChallenge ||
      bq.roadDefenseAlert ||
      bq.roadAwaitingAuthoritativeOutcome ||
      roadFriction.roadDefenseOutcomeReplayBlockingRef.current;
    if (!stillBlocked) {
      deferredRoadGateNoticeRef.current = null;
      setRoadGateRetreatNotice(queued);
    }
  }, [
    authoritativeReplayOverlay,
    siegeResult,
    siegeData,
    roadFriction.roadAuthoritativeOutcomeModal,
    pvpAttackerAdjudicating,
    pvpDefenseOutcome,
    roadAttackerAlert,
    pvpChallenge,
    roadFriction.roadDefenseAlert,
    roadFriction.roadAwaitingAuthoritativeOutcome,
    roadFriction.roadDefenseAuthoritativeReplayOpen,
    banditRaidData,
    banditRaidResult,
  ]);

  useEffect(() => {
    if (player?.on_duty == null) return;
    setOnDuty(!!player.on_duty);
  }, [player?.on_duty]);

  useEffect(() => {
    if (pendingMainCityCityId == null) return;
    const cur = player?.main_city_id;
    if (cur != null && String(cur) === String(pendingMainCityCityId)) {
      setPendingMainCityCityId(null);
    }
  }, [player?.main_city_id, pendingMainCityCityId]);

  const playerMainCityIdForUi =
    pendingMainCityCityId != null ? pendingMainCityCityId : (player?.main_city_id ?? null);

  const handleToggleDutyForCity = useCallback(async (cityId, newVal) => {
    if (!player?.player_id) return false;
    const res = await garrisonAPI.setOnDuty(player.player_id, newVal, cityId);
    if (res.success) {
      await refreshPlayer();
      setGarrisonStatsRefreshKey((k) => k + 1);
      return true;
    }
    if (res.error) setSimpleAlertMessage(res.error);
    return false;
  }, [player?.player_id, refreshPlayer]);

  const handleSetMainCityRequest = useCallback(
    async (targetCityId) => {
      if (!player?.player_id || !targetCityId) return;
      try {
        const res = await playerAPI.setMainCity(player.player_id, targetCityId);
        if (res.success) {
          const d = res.data || {};
          let msg;
          if (d.already) {
            msg = '该城已是您的主城（存卡）';
          } else if (Number(d.costSilver) > 0) {
            msg = `已将主城更换为此城，消耗 ${d.costSilver} 银两`;
          } else {
            msg = '已将该城设为主城（存卡仓库）';
          }
          setSimpleAlertMessage(msg);
          setPendingMainCityCityId(String(targetCityId));
          await refreshPlayer({ silent: true });
          return;
        }
        setSimpleAlertMessage(res.error || '设置主城失败');
      } catch (e) {
        setSimpleAlertMessage(e?.message || '设置主城失败');
      }
    },
    [player?.player_id, refreshPlayer],
  );

  /** 主城「驻军所」：军营部队顺序（全屏） */
  const handleOpenBarracksPost = useCallback((cityId, cityBaseName) => {
    if (!cityId) return;
    setBarracksPostCityId(cityId);
    setBarracksPostCityName(cityBaseName || '城池');
    setShowBarracksPost(true);
  }, []);

  /** 大城/中城「三公府」：官职晋升等 */
  const handleOpenSanGongFu = useCallback((_cityId, cityBaseName) => {
    setSanGongFuCityName(cityBaseName || '城池');
    setShowSanGongFu(true);
  }, []);

  const handleSanGongPromoted = useCallback((data) => {
    if (sanGongAnimTimerRef.current) {
      clearTimeout(sanGongAnimTimerRef.current);
      sanGongAnimTimerRef.current = null;
    }
    const pos = data?.position;
    if (pos && typeof pos === 'object') {
      setSanGongPositionAnim({ position: pos, positionName: data.positionName, positionLevel: data.positionLevel });
      sanGongAnimTimerRef.current = setTimeout(() => {
        setSanGongPositionAnim(null);
        sanGongAnimTimerRef.current = null;
      }, 1000);
    }
  }, []);

  useEffect(() => () => {
    if (sanGongAnimTimerRef.current) clearTimeout(sanGongAnimTimerRef.current);
  }, []);

  /** 与攻城结算同源：刷新 `/garrisons/stats/cities` + `/cities`，避免格上 tooltip 驻地槽位 / NPC 等卡旧值 */
  const bumpStrategicMapRuntimeCaches = useCallback(() => {
    setGarrisonStatsRefreshKey((k) => k + 1);
  }, []);

  /** 攻方：弹窗点确定 → 服务端权威推演（与披挂攻城同源），演示后进结算 */
  const confirmRoadAttackerEnterBattle = useCallback(async () => {
    if (!roadAttackerAlert?.encounterId || !player?.player_id) return;
    const eid = roadAttackerAlert.encounterId;
    const gate = validateMainLineupBattleGate({
      cards,
      playerUnits: null,
      playerFood: player?.food ?? 0,
    });
    if (!gate.ok) {
      setSimpleAlertMessage(gate.message);
      return;
    }
    try {
      const res = await playerAPI.resolveRoadEncounterAuthoritative(player.player_id, eid);
      if (!res?.success || !res.data) {
        setSimpleAlertMessage(res?.error || '道路权威结算失败');
        return;
      }
      const d = res.data;
      setRoadAttackerAlert(null);
      const logStr = Array.isArray(d.battleLog) ? d.battleLog.join('\n') : '';
      const siegeResultSnapshot = {
        ...(d.settlement && typeof d.settlement === 'object' ? d.settlement : {}),
        authoritativeBattleLog: d.battleLog,
        battleSeed: d.battleSeed,
        siegeReplayAttackerNames: d.siegeReplayAttackerNames,
        siegeReplayDefenderNames: d.siegeReplayDefenderNames,
        initialAttackerTroops: d.initialAttackerTroops,
        initialDefenderTroops: d.initialDefenderTroops,
      };
      setAuthoritativeReplayOverlay({
        battleLogStr: logStr,
        initialAttackerTroops: d.initialAttackerTroops,
        initialDefenderTroops: d.initialDefenderTroops,
        leftLabel: '攻方',
        rightLabel: '守军',
        onPlaybackComplete: () => {
          setAuthoritativeReplayOverlay(null);
          setSiegeResult(siegeResultSnapshot);
          setGarrisonStatsRefreshKey((k) => k + 1);
          refreshPlayer({ silent: true });
        },
      });
    } catch (e) {
      setSimpleAlertMessage(e?.message || '网络异常');
    }
  }, [roadAttackerAlert, player, cards, refreshPlayer]);

  const openGarrisonForCity = useCallback(async (cityId, cityBaseName) => {
    if (!player?.player_id || !cityId) return;
    try {
      const res = await garrisonAPI.getAll(player.player_id);
      if (!res.success) {
        setSimpleAlertMessage(res.error || '无法加载驻地信息，请稍后重试');
        return;
      }
      const configured = getConfiguredGarrisonCityIds(res.garrisons || []);
      const cid = String(cityId);
      if (!configured.has(cid) && configured.size >= MAX_GARRISON_CONFIGURED_CITIES) {
        setSimpleAlertMessage(
          `已达驻地编组城池上限（${MAX_GARRISON_CONFIGURED_CITIES} 座）。请先在其它城池清空驻地编组，再在本城编组。`
        );
        return;
      }
      setGarrisonCityId(cityId);
      setGarrisonCityName(cityBaseName || '城池');
      setShowGarrison(true);
    } catch (e) {
      setSimpleAlertMessage(e?.message || '打开驻地编组失败');
    }
  }, [player?.player_id]);

  const startSiegeForCity = useCallback(async (cityId, cityRow) => {
    if (!cityId || !player?.player_id) return;
    const phaseOk = phase === PHASE.IDLE || phase === PHASE.RETURNING;
    if (!phaseOk) {
      setSimpleAlertMessage('当前处于事件/探索流程中，请返回空闲后再发起攻城');
      return;
    }
    if (siegeData) {
      setSimpleAlertMessage('已有战斗或结算占用，请先结束上一场或刷新页面后再试。');
      return;
    }
    if (banditRaidData) {
      setSimpleAlertMessage('匪寨战斗进行中，请先结束上一场后再发起攻城。');
      return;
    }
    if (banditRaidResult) {
      setSimpleAlertMessage('请先关闭匪寨结算面板后再发起攻城。');
      return;
    }
    if (worldMapCityIsPlayerSameFaction(cityRow, player?.faction_id)) return;

    const qRes = await fetchSiegeQuotaJson(player.player_id, cityId);
    if (!qRes.success || !(Number(qRes.data?.remaining) > 0)) {
      setSimpleAlertMessage('攻城次数不足');
      return;
    }

    const gate = validateMainLineupBattleGate({
      cards,
      playerUnits: null,
      playerFood: player?.food ?? 0,
    });
    if (!gate.ok) {
      setSimpleAlertMessage(gate.message);
      return;
    }
    setSiegeLoading(true);
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/cities/${encodeURIComponent(cityId)}/siege`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: player.player_id }),
      }).then(r => r.json());
      if (res.success) {
        await postSiegeQuotaAction(player.player_id, cityId, 'consume');

        if (res.data.defenderType === 'pvp_online') {
          try {
            const pvpRes = await fetch(`${API_CONFIG.BASE_URL}/pvp/challenge`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                warId: res.data.warId, cityId,
                attackerId: player.player_id, attackerFaction: res.data.playerFaction,
                defenderId: res.data.defenderPlayerId,
                defenderGarrisonSlot: res.data.defenderGarrisonSlot,
              }),
            }).then(r => r.json());
            if (pvpRes.success) {
              const ws = Number(pvpRes.waitSeconds) || 10;
              setPvpChallenge({
                ...pvpRes,
                siegeData: res.data,
                defenderName: res.data.defenderName,
                countdownEndsAt: Date.now() + ws * 1000,
                waitSeconds: ws,
              });
              setPvpCountdown(ws);
              setPvpSiegeNowTick(Date.now());
              setSiegeResult(null);
            }
          } catch (e) {
            console.error('[PVP] 创建挑战失败:', e);
            setSiegeData(res.data); setSiegeResult(null);
          }
        } else {
          setSiegeData(res.data); setSiegeResult(null);
        }
      } else {
        setSimpleAlertMessage(
          typeof res.error === 'string' && res.error.trim()
            ? res.error
            : '攻城请求失败，请稍后重试',
        );
      }
    } catch (e) {
      setSimpleAlertMessage(e?.message || '网络异常，攻城请求失败');
    }
    setSiegeLoading(false);
  }, [phase, siegeData, banditRaidData, banditRaidResult, player, cards, attributeBonusBySlot]);

  const handleBanditRaidStart = useCallback((payload) => {
    if (!player?.player_id) return;
    if (!payload?.banditPoiId || payload?.attackedLayer == null) return;
    if (!payload?.smallMapPveLoot || typeof payload.smallMapPveLoot !== 'object') return;
    if (!Array.isArray(payload.enemySlotRarities) || payload.enemySlotRarities.length !== 4) return;
    const layer = Number(payload.attackedLayer);
    setBanditRaidData({
      banditPoiId: String(payload.banditPoiId).trim(),
      attackedLayer: layer,
      enemySlotRarities: payload.enemySlotRarities,
      smallMapPveLoot: payload.smallMapPveLoot,
      opponentName: `匪寨 · 第 ${Number.isFinite(layer) ? layer : 1} 层`,
    });
  }, [player?.player_id]);

  const handleBanditRaidEnd = useCallback(
    (result, silverSpent, scoreResult, killedIndices, meta) => {
      const cur = banditRaidDataRef.current;
      const opponentName = cur?.opponentName || '匪寨';
      const rawLoot = cur?.smallMapPveLoot && typeof cur.smallMapPveLoot === 'object' ? cur.smallMapPveLoot : {};
      const lootRest = { ...rawLoot };
      delete lootRest.banditRaidSettlement;
      let silverReward = 0;
      let reputationReward = 0;
      if (result === 'victory') {
        silverReward = Math.max(0, Number(lootRest.silver) || 0);
        reputationReward = Math.max(0, Number(lootRest.reputation) || 0);
      }
      const tk =
        meta?.totalKills != null && Number.isFinite(Number(meta.totalKills))
          ? Math.max(0, Math.floor(Number(meta.totalKills)))
          : Array.isArray(killedIndices)
            ? killedIndices.length
            : 0;
      const killCount = tk;
      const sc = scoreResult && typeof scoreResult === 'object' ? scoreResult : null;
      const tacticalScoreText =
        sc && (sc.grade != null || sc.score != null)
          ? `战术评分：${sc.grade ?? '-'} · ${Number(sc.score) || 0} 分`
          : null;
      setBanditRaidData(null);
      setBanditRaidResult({
        result,
        banditPoiId: cur?.banditPoiId != null ? String(cur.banditPoiId).trim() : null,
        attackedLayer: cur?.attackedLayer != null ? Number(cur.attackedLayer) : null,
        silverSpent: Math.max(0, Number(silverSpent) || 0),
        scoreResult: sc,
        killedIndices: Array.isArray(killedIndices) ? killedIndices : [],
        meta: meta && typeof meta === 'object' ? meta : {},
        opponentName,
        silverReward,
        reputationReward,
        killCount,
        tacticalScoreText,
        defeatHint:
          result !== 'victory'
            ? '本场已扣攻打次数，个人层与全服耐久不因失败前进。'
            : null,
      });
      setPostBanditRaidRefreshKey((k) => k + 1);
      setGarrisonStatsRefreshKey((k) => k + 1);
      refreshPlayer({ silent: true });
      bumpStrategicRoadPresenceRef.current?.();
    },
    [refreshPlayer],
  );

  const closeBanditRaidResult = useCallback(() => {
    setBanditRaidResult(null);
    setPostBanditRaidRefreshKey((k) => k + 1);
  }, []);

  /** 匪寨胜利结算「继续」：不调用 consume，直接进下一层（次数已在首层攻打时扣除） */
  const handleBanditRaidContinue = useCallback(async () => {
    if (!banditRaidResult || banditRaidResult.result !== 'victory') return;
    const banditPoiId = banditRaidResult.banditPoiId;
    if (!banditPoiId || !player?.player_id) return;
    setBanditRaidResult(null);
    try {
      const res = await playerAPI.getBanditRaidQuota(player.player_id, banditPoiId);
      if (!res?.success || !res.data) {
        setSimpleAlertMessage(typeof res?.error === 'string' && res.error.trim() ? res.error : '无法读取匪寨攻打进度');
        return;
      }
      const d = res.data;
      const wd = d.worldDurability;
      const worldDepleted =
        wd &&
        typeof wd === 'object' &&
        Number.isFinite(Number(wd.layersRemaining)) &&
        Number(wd.layersRemaining) <= 0;
      if (d.towerCompleted) {
        setSimpleAlertMessage('本寨个人塔已通关。');
        return;
      }
      if (worldDepleted) {
        setSimpleAlertMessage('本寨全服耐久已耗尽，无法继续攻打。');
        return;
      }
      if (!d.canBattle) {
        setSimpleAlertMessage('当前不可继续攻打（攻打次数或条件不足）。');
        return;
      }
      const attackedLayer = Number(d.nextLayer);
      if (!Number.isFinite(attackedLayer) || attackedLayer < 1) {
        setSimpleAlertMessage('层进度异常，请返回大地图重试。');
        return;
      }
      const gate = validateMainLineupBattleGate({
        cards,
        playerUnits: null,
        playerFood: player?.food ?? 0,
      });
      if (!gate.ok) {
        setSimpleAlertMessage(gate.message || '无法进入下一层');
        return;
      }
      const enemySlotRarities = banditNpcSlotRaritiesFromLayer(attackedLayer);
      const lootBase = buildBanditLayerSmallMapPveLoot(attackedLayer);
      setBanditRaidData({
        banditPoiId: String(banditPoiId).trim(),
        attackedLayer,
        enemySlotRarities,
        smallMapPveLoot: {
          ...lootBase,
          banditRaidSettlement: { banditPoiId: String(banditPoiId).trim(), attackedLayer },
        },
        opponentName: `匪寨 · 第 ${attackedLayer} 层`,
      });
      setPostBanditRaidRefreshKey((k) => k + 1);
    } catch (e) {
      setSimpleAlertMessage(e?.message || '网络异常');
    }
  }, [banditRaidResult, player?.player_id, player?.food, cards]);

  // 战斗结束
  const handleSiegeEnd = useCallback(async (result, silverSpent, scoreResult, killedIndices, meta) => {
    if (!siegeData) return;
    // 防守方本地进入战场：兵力结算仅以攻城方提交的 siege-result 为准，此处只关界面并刷新
    if (siegeData.skipSiegeResult) {
      setSiegeData(null);
      setSiegeResult(null);
      setGarrisonStatsRefreshKey((k) => k + 1);
      refreshPlayer({ silent: true });
      return;
    }

    if (siegeData.roadEncounterId) {
      try {
        const res = await playerAPI.submitRoadEncounterBattleResult(player.player_id, {
          encounterId: siegeData.roadEncounterId,
          factionId: siegeData.playerFaction,
          killedIndices: killedIndices || [],
          result: result === 'victory' ? 'win' : 'lose',
          silverSpent: silverSpent || 0,
          battleScore: Number(scoreResult?.score) || 0,
          battleReportSaved: meta?.battleReportSaved !== false,
          battleId: meta?.battleId || null,
          ...(Array.isArray(meta?.defenderLineupTroopUpdates) && meta.defenderLineupTroopUpdates.length
            ? { defenderLineupTroopUpdates: meta.defenderLineupTroopUpdates }
            : {}),
        });
        if (res.success) {
          setSiegeResult({
            ...res.data,
            chestRewards: Array.isArray(meta?.chestRewards) ? meta.chestRewards : [],
          });
        } else {
          setSiegeResult({ npcKilled: 0, killCount: 0, npcTotal: 0, silverReward: 0, error: res.error });
        }
      } catch (err) {
        console.error('[RoadEncounter] 结算请求失败:', err);
        setSiegeResult({ npcKilled: 0, killCount: 0, npcTotal: 0, silverReward: 0, error: '结算请求失败' });
      }
      setGarrisonStatsRefreshKey((k) => k + 1);
      refreshPlayer({ silent: true });
      return;
    }

    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/cities/siege-result`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warId: siegeData.warId, playerId: player.player_id,
          factionId: siegeData.playerFaction,
          killedIndices: killedIndices || [],
          result: result === 'victory' ? 'win' : 'lose',
          silverSpent: silverSpent || 0,
          battleScore: Number(scoreResult?.score) || 0,
          battleReportSaved: meta?.battleReportSaved !== false,
          defenderType: siegeData.defenderType || 'npc',
          defenderPlayerId: siegeData.defenderPlayerId || null,
          defenderGarrisonSlot: siegeData.defenderGarrisonSlot ?? null,
          garrisonUnits: (siegeData.defenderType === 'player_garrison' || siegeData.defenderType === 'pvp_online')
            ? siegeData.npcGarrison
            : null,
          npcBatchIndex: siegeData.defenderType === 'npc' ? siegeData.npcBatchIndex ?? null : null,
          ...(Array.isArray(meta?.defenderLineupTroopUpdates) && meta.defenderLineupTroopUpdates.length
            ? { defenderLineupTroopUpdates: meta.defenderLineupTroopUpdates }
            : {}),
        }),
      }).then(r => r.json());
      if (res.success) {
        setSiegeResult({
          ...res.data,
          chestRewards: Array.isArray(meta?.chestRewards) ? meta.chestRewards : [],
        });
      } else {
        // 后端报错，仍然显示结算页（无奖励数据）
        setSiegeResult({ npcKilled: 0, npcTotal: 0, silverReward: 0, error: res.error });
      }
    } catch (err) {
      console.error('[Siege] 结算请求失败:', err);
      setSiegeResult({ npcKilled: 0, npcTotal: 0, silverReward: 0, error: '结算请求失败' });
    }
    setGarrisonStatsRefreshKey((k) => k + 1);
    refreshPlayer({ silent: true });
  }, [siegeData, player, refreshPlayer]);

  const closeSiegeResult = useCallback(() => { setSiegeData(null); setSiegeResult(null); }, []);

  /** 攻城方倒计时 UI：按绝对时刻刷新，避免后台标签页 `setInterval(1000)` 停住导致永不请求裁定 */
  useEffect(() => {
    if (!pvpChallenge?.countdownEndsAt) return undefined;
    const iv = setInterval(() => setPvpSiegeNowTick(Date.now()), 400);
    return () => clearInterval(iv);
  }, [pvpChallenge?.countdownEndsAt]);

  // ── PVP 攻城方：`deadline` 触发 `siege-resolve` → 最短裁定 UI → 简化回放 → 结算 ──
  useEffect(() => {
    if (!pvpChallenge || !player?.player_id) return;
    pvpResolveOnceRef.current = false;

    const runResolve = async () => {
      if (pvpResolveOnceRef.current) return;
      pvpResolveOnceRef.current = true;
      if (pvpTimerRef.current) clearTimeout(pvpTimerRef.current);
      const ch = pvpChallenge;
      const adjudicationStartedAt = Date.now();
      setPvpAttackerAdjudicating({
        defenderName: ch.defenderName || '未知',
        startedAt: adjudicationStartedAt,
      });
      setPvpChallenge(null);
      try {
        const r = await fetch(`${API_CONFIG.BASE_URL}/pvp/siege-resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeId: ch.challengeId, attackerId: player.player_id }),
        }).then((x) => x.json());
        if (r.success && r.data?.siegeData) {
          const siegeResultSnapshot = {
            ...r.data.siegeData,
            authoritativeBattleLog: r.data.battleLog,
            battleSeed: r.data.battleSeed,
            siegeReplayAttackerNames: r.data.siegeReplayAttackerNames,
            siegeReplayDefenderNames: r.data.siegeReplayDefenderNames,
            initialAttackerTroops: r.data.initialAttackerTroops,
            initialDefenderTroops: r.data.initialDefenderTroops,
          };
          const logStr = Array.isArray(r.data.battleLog) ? r.data.battleLog.join('\n') : '';
          scheduleAfterMinAdjudicationUi(adjudicationStartedAt, () => {
            setPvpAttackerAdjudicating(null);
            setAuthoritativeReplayOverlay({
              battleLogStr: logStr,
              initialAttackerTroops: r.data.initialAttackerTroops,
              initialDefenderTroops: r.data.initialDefenderTroops,
              leftLabel: '攻方',
              rightLabel: '守军',
              onPlaybackComplete: () => {
                setAuthoritativeReplayOverlay(null);
                setSiegeResult(siegeResultSnapshot);
                setGarrisonStatsRefreshKey((k) => k + 1);
                refreshPlayer({ silent: true });
              },
            });
          });
        } else {
          scheduleAfterMinAdjudicationUi(adjudicationStartedAt, () => {
            setPvpAttackerAdjudicating(null);
            setSimpleAlertMessage(r.error || '攻城结算失败');
          });
        }
      } catch (e) {
        console.error('[PVP] siege-resolve', e);
        scheduleAfterMinAdjudicationUi(adjudicationStartedAt, () => {
          setPvpAttackerAdjudicating(null);
          setSimpleAlertMessage('攻城结算请求失败');
        });
      }
    };

    const endsAt = Number(pvpChallenge.countdownEndsAt) || Date.now() + 10_000;
    const delay = Math.max(0, endsAt - Date.now());
    pvpTimerRef.current = setTimeout(runResolve, delay);

    const onVis = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
      if (Date.now() < endsAt) return;
      clearTimeout(pvpTimerRef.current);
      runResolve();
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);

    return () => {
      clearTimeout(pvpTimerRef.current);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
    };
  }, [pvpChallenge, player?.player_id, refreshPlayer]);

  // ── 防守方：已点「进入战场」→ 轮询服务端裁定结果 ──
  useEffect(() => {
    if (!pvpDefenseWaiting?.challengeId || !player?.player_id) {
      pvpDefenseOutcomeHandledRef.current = false;
      return;
    }
    pvpDefenseOutcomeHandledRef.current = false;
    const poll = async () => {
      if (pvpDefenseOutcomeHandledRef.current) return;
      try {
        const r = await fetch(
          `${API_CONFIG.BASE_URL}/pvp/challenge/${pvpDefenseWaiting.challengeId}/siege-outcome?playerId=${encodeURIComponent(player.player_id)}`
        ).then((x) => x.json());
        if (r.success && r.outcome && !pvpDefenseOutcomeHandledRef.current) {
          pvpDefenseOutcomeHandledRef.current = true;
          const startedAt = pvpDefenseWaiting.startedAt ?? Date.now();
          const outcome = r.outcome;
          scheduleAfterMinAdjudicationUi(startedAt, () => {
            setPvpDefenseWaiting(null);
            setPvpDefenseOutcome(outcome);
            setGarrisonStatsRefreshKey((k) => k + 1);
            refreshPlayer({ silent: true });
          });
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [pvpDefenseWaiting, player?.player_id, refreshPlayer]);

  // 新手指引完成时，给满探索次数
  const prevTutorialRef = useRef(isTutorial);
  useEffect(() => {
    if (prevTutorialRef.current && !isTutorial) {
      // tutorial 刚从 active 变为 inactive → 新手指引完成
      quota.fillMax();
    }
    prevTutorialRef.current = isTutorial;
  }, [isTutorial]);

  // 加载玩家道具
  const [playerItems, setPlayerItems] = useState([]);
  const fetchItems = useCallback(() => {
    if (!player?.player_id) return;
    playerAPI.getItems(player.player_id)
      .then(res => {
        if (res.success) setPlayerItems(res.data.items || []);
      })
      .catch(() => {});
  }, [player?.player_id]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  /** 战略格 tooltip 荒郊/集市：`WorldMapCityInfoBlock` 内嵌 `ExploreLocationDockPanel`（与底栏无关） */
  const subsidiaryExploreEmbed = useMemo(
    () => ({
      quota,
      eventsLoading,
      explorePoolAt,
      startExplore,
      playerItems,
      isTutorial,
      phase,
      citiesList,
      itemNameMap,
    }),
    [quota, eventsLoading, explorePoolAt, startExplore, playerItems, isTutorial, phase, citiesList, itemNameMap],
  );

  /** 探索「返回中」动画结束后再拉档，避免 RETURNING 阶段整图重绘把战略城池 tooltip 顶掉，玩家可留在荒郊/集市连点探索 */
  const prevPhaseForPostExploreRefreshRef = useRef(phase);
  useEffect(() => {
    const prev = prevPhaseForPostExploreRefreshRef.current;
    prevPhaseForPostExploreRefreshRef.current = phase;
    if (prev !== PHASE.RETURNING || phase !== PHASE.IDLE) return;
    fetchItems();
    refreshPlayer({ silent: true });
  }, [phase, fetchItems, refreshPlayer]);

  // 通知父组件事件是否进行中（隐藏底部Tab）
  useEffect(() => {
    const busy = [PHASE.EVENT, PHASE.ROLLING, PHASE.RESULT, PHASE.BATTLE, PHASE.REWARD, PHASE.MINIGAME, PHASE.RETURNING].includes(phase)
      || !!siegeData
      || !!banditRaidData
      || !!banditRaidResult
      || !!pvpChallenge
      || !!pvpDefenseWaiting
      || !!pvpAttackerAdjudicating
      || !!roadAttackerAlert
      || !!authoritativeReplayOverlay
      || roadFriction.roadDefenseAuthoritativeReplayOpen;
    onEventBusyChange?.(busy);
  }, [
    phase,
    onEventBusyChange,
    siegeData,
    banditRaidData,
    banditRaidResult,
    pvpChallenge,
    pvpDefenseWaiting,
    pvpAttackerAdjudicating,
    roadAttackerAlert,
    authoritativeReplayOverlay,
    roadFriction.roadDefenseAuthoritativeReplayOpen,
  ]);

  useEffect(
    () => () => {
      onEventBusyChange?.(false);
    },
    [onEventBusyChange],
  );

  const strategicFullScreenOverlayOpen =
    showSanGongFu || !!showGarrison || !!showBarracksPost;

  /** 攻城/探索/道路等全屏或模态流程中不渲染大地图 event_hint portal，避免「指引」压在战斗或弹窗之上 */
  const strategicMapEventHintSuppressed =
    !!siegeData ||
    !!siegeResult ||
    !!banditRaidData ||
    !!banditRaidResult ||
    !!pvpChallenge ||
    !!pvpDefenseWaiting ||
    !!roadAttackerAlert ||
    !!authoritativeReplayOverlay ||
    roadFriction.roadDefenseAuthoritativeReplayOpen ||
    [
      PHASE.EVENT,
      PHASE.ROLLING,
      PHASE.RESULT,
      PHASE.BATTLE,
      PHASE.REWARD,
      PHASE.MINIGAME,
      PHASE.RETURNING,
    ].includes(phase);

  const pvpCountdownDisplay = useMemo(() => {
    if (!pvpChallenge?.countdownEndsAt) return Math.max(0, Number(pvpCountdown) || 0);
    return Math.max(0, Math.ceil((pvpChallenge.countdownEndsAt - pvpSiegeNowTick) / 1000));
  }, [pvpChallenge, pvpCountdown, pvpSiegeNowTick]);

  roadNoticeUiBlockRef.current = {
    authoritativeReplayOverlay:
      !!authoritativeReplayOverlay || roadFriction.roadDefenseAuthoritativeReplayOpen,
    siegeResult: !!siegeResult,
    siegeData: !!siegeData,
    banditRaidData: !!banditRaidData,
    banditRaidResult: !!banditRaidResult,
    roadAuthoritativeOutcomeModal: roadFriction.roadAuthoritativeOutcomeModal,
    pvpAttackerAdjudicating: !!pvpAttackerAdjudicating,
    pvpDefenseOutcome: !!pvpDefenseOutcome,
    roadAttackerAlert: !!roadAttackerAlert,
    pvpChallenge: !!pvpChallenge,
    roadDefenseAlert: roadFriction.roadDefenseAlert,
    roadAwaitingAuthoritativeOutcome: roadFriction.roadAwaitingAuthoritativeOutcome,
    roadDefenseOutcomeReplay: !!roadFriction.roadDefenseOutcomeReplayBlockingRef.current,
  };

  return (
    <div className="relative flex flex-col h-full min-h-0 w-full bg-stone-950">
      <WorldYingchuanMapSection
        className="flex-1 min-h-0 h-full"
        bumpStrategicRoadPresenceRef={bumpStrategicRoadPresenceRef}
        strategicFullScreenOverlayOpen={strategicFullScreenOverlayOpen}
        strategicMapEventHintSuppressed={strategicMapEventHintSuppressed}
        pendingMapEventHint={pendingMapEventHint}
        playerId={player?.player_id}
        playerFactionId={player?.faction_id}
        siegeLoading={siegeLoading}
        onStartSiegeForCity={startSiegeForCity}
        onRoadEncounterBattle={(enc) => {
          if (enc?.encounterId) setRoadAttackerAlert(enc);
        }}
        garrisonStatsRefreshKey={garrisonStatsRefreshKey}
        playerOnDuty={!!player?.on_duty}
        playerOnDutyCityId={player?.on_duty_city_id ?? null}
        playerMainCityId={playerMainCityIdForUi}
        playerMainCityChangedAt={player?.main_city_changed_at ?? null}
        playerSilver={player?.silver ?? null}
        onSetMainCityRequest={handleSetMainCityRequest}
        onSetMainCityError={setSimpleAlertMessage}
        onOpenBarracksPost={handleOpenBarracksPost}
        onOpenSanGongFu={handleOpenSanGongFu}
        onOpenGarrisonForCity={openGarrisonForCity}
        onToggleDutyForCity={handleToggleDutyForCity}
        onDutyError={setSimpleAlertMessage}
        subsidiaryExploreEmbed={subsidiaryExploreEmbed}
        onExploreAnchorGridContext={onExploreAnchorGridContext}
        onStartBanditRaid={handleBanditRaidStart}
        banditRaidStartBlockedReason={banditRaidStartBlockedReason}
        postBanditRaidRefreshKey={postBanditRaidRefreshKey}
      />

      {/* ── PVP 攻城方等待界面 ── */}
      {pvpChallenge && (
        <AncientModal isOpen type="confirm" title="⚔️ 攻城对战" preventClose hideButtons>
          <div className="text-center space-y-4">
            <p className="text-gray-800 text-base">
              约 <span className="text-red-700 font-bold text-xl">{pvpCountdownDisplay}</span> 秒后由服务端裁定本场（AI 代打）
            </p>
            <p className="text-gray-500 text-xs">
              对手：{pvpChallenge.defenderName || '未知'}
            </p>
            <div className="w-full bg-gray-300 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-600 to-red-600 transition-all duration-1000"
                style={{
                  width: `${Math.min(100, (pvpCountdownDisplay / Math.max(1, Number(pvpChallenge.waitSeconds) || 10)) * 100)}%`,
                }}
              />
            </div>
            <p className="text-gray-400 text-xs">无需对方点接受，请稍候…</p>
          </div>
        </AncientModal>
      )}

      {/* ── PVP 防守方通知弹窗 ── */}
      {pvpAttackerAdjudicating && (
        <AncientModal isOpen type="confirm" title="⚔️ 战场裁定中" preventClose hideButtons>
          <div className="text-center space-y-3 text-gray-800 text-sm py-2 px-1">
            <p>本场由服务端演算，请稍候…</p>
            <p className="text-gray-500 text-xs">
              守军主公：<span className="text-amber-800 font-semibold">{pvpAttackerAdjudicating.defenderName}</span>
            </p>
          </div>
        </AncientModal>
      )}

      {pvpDefenseWaiting && (
        <AncientModal isOpen type="confirm" title="⚔️ 战场裁定中" preventClose hideButtons>
          <div className="text-center space-y-3 text-gray-700 text-sm py-2 px-1">
            <p>本场由服务端演算，请稍候…</p>
            <p className="text-gray-500 text-xs">
              攻城方：<span className="text-red-800 font-semibold">{pvpDefenseWaiting.attackerName || '未知'}</span>
            </p>
          </div>
        </AncientModal>
      )}

      {pvpDefenseOutcome && (
        <PvpDefenseOutcomeModal
          outcome={pvpDefenseOutcome}
          onClose={() => {
            silencedDefenseChallengeRef.current = null;
            setPvpDefenseOutcome(null);
          }}
        />
      )}

      {typeof document !== 'undefined' &&
        authoritativeReplayOverlay &&
        createPortal(
          <div className="pointer-events-auto fixed inset-0 z-[235] flex items-center justify-center bg-black/85 px-3 py-6">
            <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-amber-600/40 bg-[#12121e] p-3 shadow-2xl">
              <div className="text-center text-amber-200/95 text-sm font-bold mb-2">战场演示</div>
              <SiegeReplayMini
                open
                battleLog={authoritativeReplayOverlay.battleLogStr}
                leftLabel={authoritativeReplayOverlay.leftLabel || '攻方'}
                rightLabel={authoritativeReplayOverlay.rightLabel || '守军'}
                initialAttackerTroops={authoritativeReplayOverlay.initialAttackerTroops}
                initialDefenderTroops={authoritativeReplayOverlay.initialDefenderTroops}
                onPlaybackComplete={authoritativeReplayOverlay.onPlaybackComplete}
                onClose={() => setAuthoritativeReplayOverlay(null)}
              />
            </div>
          </div>,
          document.body,
        )}

      {roadAttackerAlert && !siegeData && !banditRaidData && !banditRaidResult && (
        <AncientModal
          isOpen
          type="warning"
          title="🛤️ 道路遭遇"
          confirmText="确定"
          showCancel={false}
          invokeOnCloseAfterConfirm={false}
          onConfirm={confirmRoadAttackerEnterBattle}
          onClose={() => setRoadAttackerAlert(null)}
        >
          <div className="text-center space-y-3">
            <p className="text-gray-800 text-base">您已与对方在道路上触发对战。</p>
            <p className="text-gray-800">
              点击 <span className="font-semibold text-amber-900">确定</span> 由服务端权威推演本场（与攻城披挂同源），先观看战场演示再进入结算。
            </p>
          </div>
        </AncientModal>
      )}

      {roadGateRetreatNotice &&
        !siegeData &&
        !banditRaidData &&
        !banditRaidResult &&
        !roadFriction.roadDefenseAlert &&
        !pvpDefenseAlert &&
        !roadAttackerAlert && (
        <AncientModal
          isOpen
          type="info"
          title="道路位置已调整"
          confirmText="知道了"
          showCancel={false}
          onConfirm={() => setRoadGateRetreatNotice(null)}
          onClose={() => setRoadGateRetreatNotice(null)}
        >
          <p className="text-gray-800 text-sm text-left leading-relaxed px-1">{roadGateRetreatNotice}</p>
        </AncientModal>
      )}

      {pvpDefenseAlert && !siegeData && !banditRaidData && !banditRaidResult && (
        <AncientModal
          isOpen
          type="warning"
          title="🏰 城池遭袭"
          confirmText="确定"
          showCancel={false}
          onConfirm={() => beginDefenseFollowUp(pvpDefenseAlert)}
        >
          <div className="text-center space-y-3">
            <p className="text-gray-800 text-base">
              <span className="font-bold text-red-700">{pvpDefenseAlert.attackerName}</span> 正在攻打城池
            </p>
            <p className="text-gray-800">
              点击 <span className="font-semibold text-amber-900">确定</span> 可等待裁定结束后在战报中查看文字记录；也可稍后打开「聊天」面板「战报」页。
            </p>
            <p className="text-gray-800">
              约 <span className="text-red-700 font-bold text-xl">{pvpDefenseAlert.remainingSeconds}</span> 秒后本提示将自动关闭（战斗由服务端 AI 演算，与是否观战无关）。
            </p>
            <p className="text-gray-500 text-xs">提示关闭后请勿反复操作，稍候即弹出裁定结果。</p>
          </div>
        </AncientModal>
      )}

      {simpleAlertMessage != null && (
        <AncientModal
          isOpen
          type="warning"
          title="提示"
          confirmText="确定"
          onConfirm={() => setSimpleAlertMessage(null)}
          onClose={() => setSimpleAlertMessage(null)}
        >
          <p className="text-center text-gray-800 text-sm whitespace-pre-wrap">{simpleAlertMessage}</p>
        </AncientModal>
      )}

      {/* ── 驻地编组面板 ── */}
      {showGarrison && garrisonCityId ? (
        <GarrisonLineup
          onClose={() => {
            setShowGarrison(false);
            bumpStrategicMapRuntimeCaches();
          }}
          onAfterMutation={bumpStrategicMapRuntimeCaches}
          cityId={garrisonCityId}
          cityName={garrisonCityName || '城池'}
        />
      ) : null}

      {showBarracksPost && barracksPostCityId ? (
        <MainCityBarracksPostPanel
          cityId={barracksPostCityId}
          cityName={barracksPostCityName || '城池'}
          onClose={() => {
            setShowBarracksPost(false);
            setBarracksPostCityId(null);
          }}
          onAfterSave={bumpStrategicMapRuntimeCaches}
        />
      ) : null}

      {showSanGongFu ? (
        <SanGongFuPanel
          cityName={sanGongFuCityName || '城池'}
          onClose={() => setShowSanGongFu(false)}
          onPromoted={handleSanGongPromoted}
          sanGongFuCardPool={sanGongFuCardPool}
        />
      ) : null}

      {sanGongPositionAnim?.position ? (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/65 px-4">
          <div className="mb-3 text-center text-amber-400 text-lg font-bold">官职授予</div>
          <div style={{ transform: 'scale(0.72)', transformOrigin: 'center center' }}>
            <PositionCard position={sanGongPositionAnim.position} showDetails />
          </div>
        </div>
      ) : null}

      {/* 攻城/道路战斗与结算：挂 body，避免 GamePage main overflow-hidden 裁切 fixed 全屏层 */}
      {typeof document !== 'undefined' &&
        ((siegeData && !siegeResult) || siegeResult || banditRaidData || banditRaidResult) &&
        createPortal(
          <div className="pointer-events-auto fixed inset-0 z-[225] flex min-h-0 flex-col">
            {banditRaidData ? (
              <BattleArena
                key={`bandit-${banditRaidData.banditPoiId}-${banditRaidData.attackedLayer}`}
                playerUnits={buildPlayerUnitsFromContext(player, cards, attributeBonusBySlot)}
                cards={cards}
                enemySlotRarities={banditRaidData.enemySlotRarities}
                silverAmount={player?.silver ?? 0}
                playerFood={player?.food ?? 0}
                playerId={player?.player_id}
                battleType="pve_bandit"
                opponentName={banditRaidData.opponentName || '匪寨'}
                smallMapPveLoot={banditRaidData.smallMapPveLoot}
                onBattleEnd={handleBanditRaidEnd}
              />
            ) : null}
            {!banditRaidData && siegeData && !siegeResult ? (
              <BattleArena
                key={siegeData.roadEncounterId || siegeData.warId || siegeData.cityName || 'siege'}
                playerUnits={buildPlayerUnitsFromContext(player, cards, attributeBonusBySlot)}
                cards={cards}
                enemyUnits={siegeData.npcGarrison}
                silverAmount={player?.silver ?? 0}
                playerFood={player?.food ?? 0}
                playerId={player?.player_id}
                battleType={siegeData.isPvp ? 'pvp_siege' : 'pve_siege'}
                siegeDefenderType={siegeData.defenderType || 'npc'}
                opponentName={
                  siegeData.pvpSiegeRole === 'defender'
                    ? (siegeData.attackerName || '攻城方')
                    : siegeData.isPvp
                      ? (siegeData.defenderName || `${siegeData.cityName || ''}守军`)
                      : `${siegeData.cityName}守军`
                }
                onBattleEnd={handleSiegeEnd}
                recordOnly={!!siegeData.skipSiegeResult}
                defenseReportMeta={
                  siegeData.pvpSiegeRole === 'defender'
                    ? null
                    : siegeData.defenderType === 'player_garrison' && siegeData.defenderPlayerId
                      ? {
                          warId: siegeData.warId,
                          defenderPlayerId: siegeData.defenderPlayerId,
                          defenderGarrisonSlot: siegeData.defenderGarrisonSlot,
                          attackerPlayerId: player?.player_id,
                          attackerName: player?.character_name || player?.name || '攻城方',
                          cityName: siegeData.cityName,
                          defenderName: siegeData.defenderName,
                        }
                      : siegeData.defenderType === 'pvp_online' && siegeData.defenderPlayerId
                        ? {
                            warId: siegeData.warId,
                            defenderPlayerId: siegeData.defenderPlayerId,
                            defenderGarrisonSlot: siegeData.defenderGarrisonSlot ?? 0,
                            attackerPlayerId: player?.player_id,
                            attackerName: player?.character_name || player?.name || '攻城方',
                            cityName: siegeData.cityName,
                            defenderName: siegeData.defenderName,
                          }
                        : null
                }
              />
            ) : null}
            {!banditRaidData && siegeResult ? (
              <StrategicSettlementCard
                onConfirm={closeSiegeResult}
                settlementKind="siege"
                silverReward={siegeResult.silverReward}
                reputationReward={siegeResult.reputationReward}
                contributionReward={siegeResult.contributionReward}
                equipmentDrop={siegeResult.equipmentDrop ?? null}
                chestRewards={siegeResult.chestRewards}
                killCount={siegeResult.killCount}
                siegeNpcKilled={siegeResult.npcKilled}
                siegeNpcTotal={siegeResult.npcTotal}
                authoritativeBattleLog={siegeResult.authoritativeBattleLog}
                initialAttackerTroops={siegeResult.initialAttackerTroops}
                initialDefenderTroops={siegeResult.initialDefenderTroops}
                showZeroKillNote={siegeResult.killCount === 0}
                siegeCompleted={!!siegeResult.siegeCompleted}
                battleReportFailed={false}
              />
            ) : null}
            {banditRaidResult ? (
              <StrategicSettlementCard
                onConfirm={closeBanditRaidResult}
                onBanditContinue={
                  banditRaidResult.result === 'victory' ? handleBanditRaidContinue : null
                }
                banditOutcome={banditRaidResult.result}
                settlementKind="bandit"
                silverReward={banditRaidResult.silverReward}
                reputationReward={banditRaidResult.reputationReward}
                contributionReward={0}
                equipmentDrop={null}
                chestRewards={banditRaidResult.meta?.chestRewards}
                killCount={null}
                banditOpponentName={banditRaidResult.opponentName}
                tacticalScoreText={banditRaidResult.tacticalScoreText}
                authoritativeBattleLog={null}
                initialAttackerTroops={null}
                initialDefenderTroops={null}
                showZeroKillNote={false}
                siegeCompleted={false}
                battleReportFailed={banditRaidResult.meta?.battleReportSaved === false}
                extraFooterNote={banditRaidResult.defeatHint}
              />
            ) : null}
          </div>,
          document.body,
        )}

      {/* 官职装配动画（教程链事件获得官职后） */}
      {positionAnimation && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
          <div className="text-center animate-bounce">
            <div className="text-6xl mb-4">👑</div>
            <div className="text-amber-400 text-2xl font-bold mb-2">
              官职授予
            </div>
            <div className="text-white text-lg">
              {positionAnimation.positionName}
            </div>
            <div className="text-amber-300/60 text-sm mt-2">
              Lv.{positionAnimation.positionLevel}
            </div>
          </div>
        </div>
      )}

      {/* 编组引导（指引叁前需至少 1 支部队） */}
      {showLineupGuide && (
        <div className="fixed inset-0 z-[150] pointer-events-none">
          {/* 半透明遮罩 */}
          <div className="absolute inset-0 bg-black/40" />
          {/* 提示文字 */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 text-center pointer-events-auto">
            <div className="bg-stone-900/90 border border-amber-500/50 rounded-xl px-6 py-4 shadow-2xl">
              <div className="text-amber-400 text-lg font-bold mb-2">⚔️ 编组部队</div>
              <div className="text-stone-300 text-sm mb-1">在继续征程之前，先装备你的将领和部队吧！</div>
              <div className="text-stone-400 text-xs">至少装备 1 支部队</div>
            </div>
          </div>
          {/* 指向左下角编组按钮的箭头 */}
          <div className="absolute bottom-20 left-24 pointer-events-none animate-bounce">
            <div className="text-4xl">👇</div>
            <div className="text-amber-400 text-xs font-bold mt-1">点击编组</div>
          </div>
        </div>
      )}

      <ExplorePanel eventSystem={eventSystem} />
    </div>
  );
}
