/**
 * useEventSystem - 事件系统核心 Hook
 * 
 * @description 从 ExploreDemo 提取的核心状态管理和流程控制
 *              管理事件加载、选项选择、运势判定、阶段流转
 * 
 * 数据来源：
 *   - 玩家属性：PlayerContext（×10存储，hook内部÷10转显示值）
 *   - 上阵将领：PlayerContext cards 中 is_equipped=1 的 character 类型卡牌
 *   - 事件配置：GET /api/config/events?triggerContext=… 多路合并（explore / wilderness / market / mystery），与 config 中 trigger_context 一致后再由 filterExploreEventsPool 按地点过滤
 */

import { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { API_CONFIG } from '@/constants';
import { fetchWithTimeout } from '@/services/httpClient';
import { playerAPI } from '@/services/playerApi';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { PHASE, FORTUNE_LEVELS } from '@/components/event/EventConstants';
import {
  pickRandomEvent,
  isFortuneSuccess,
  filterExploreEventsPool,
  getExploreOptionResolution,
  eventSkipsExploreQuota,
  getTutorialChainCompletedLevelForPool,
  getTutorialChainCompletedLevelForMapHint,
  TUTORIAL_EXPLORE_CHAIN_ID,
  playerMeetsEventRequiredItems,
} from '@/components/event/eventUtils';
import { validateMainLineupBattleGate } from '@/utils/mainLineupTroops';
import { resolveEventLocationForUi, exploreLocationMatchesEvent } from '@/utils/eventLocationPlaceholders';
import {
  EVENT_PUNISHMENT_COMBAT_BANDIT_LOCATION_SLOT_RARITIES,
  isBanditMapObjectId,
} from '@shared/utils/smallMapEnemyRoster.js';
import { strategicExploreReopenBridge } from '@/utils/strategicExploreReopenBridge.js';
import {
  resolveExploreAnchorCityIdFromPlayerRoad,
  resolveExploreAnchorCityIdFromStrategicGrid,
} from '@/utils/resolveExploreAnchorCityId.js';
import { clearInflightBattleTroopSnapshot } from '@/utils/inflightBattleTroopSnapshot';
import {
  pendingMapEventHintStorageKey,
  exploreResumeStorageKey,
  clearExploreResumeLocal,
  exploreAwayBattleEndStorageKey,
  clearExploreAwayBattleEndLocal,
} from '@/utils/eventExplorePersistence';
import {
  parseExplorePunishBattleLock,
  isPendingPunishRewardRequest,
  fortuneUiFromPunishBattleLock,
  chosenOptionFromPunishLock,
} from '@/utils/explorePunishBattleLock';
import {
  toDisplayAttrs,
  getEquippedGenerals,
  DEFAULT_GENERAL,
} from '@/utils/eventPlayerDisplayAdapters';
import useExploreEventCatalog from '@/hooks/useExploreEventCatalog';

/**
 * @param {{ tutorialAutoplay?: boolean, suppressMapEventHint?: boolean, persistMapEventHint?: boolean, exploreAnchorGridRef?: { current: null | { cells: unknown[][], mapColumns: number, mapRows: number, countyCityRows?: object[] } }, exploreAnchorGridSeq?: number }} [options] — 仅大地图挂载时应为 true，用于教程链 IDLE 自动开事件；探索 Tab 等第二实例勿开，避免双轨。
 */
export default function useEventSystem(player, cards, options = {}) {
  const tutorialAutoplay = options.tutorialAutoplay === true;
  const suppressMapEventHint = options.suppressMapEventHint === true;
  const persistMapEventHint = options.persistMapEventHint === true;
  const exploreAnchorGridRef = options.exploreAnchorGridRef;
  const exploreAnchorGridSeq = options.exploreAnchorGridSeq ?? 0;
  const { exploreQuota: quota } = usePlayerContext();

  const {
    allExploreEvents,
    eventsLoading,
    completedEvents,
    setCompletedEvents,
    exploreProgressReady,
    exploreSessionLock,
    setExploreSessionLock,
    refetchExploreProgress,
    refetchExplorePlayerBundle,
    playerItemCounts,
    citiesList,
    itemNameMap,
  } = useExploreEventCatalog(player?.playerId);

  // 流程状态
  const [phase, setPhase] = useState(PHASE.IDLE);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [chosenOption, setChosenOption] = useState(null);
  const [chosenOptionKey, setChosenOptionKey] = useState(null);
  const [fortune, setFortune] = useState(null);
  const [battleResult, setBattleResult] = useState(null);
  const [battleSilverSpent, setBattleSilverSpent] = useState(0);
  const [battleScore, setBattleScore] = useState(null);
  /** 战术图宝箱装备（POST /battles chestRewards 已入库；与事件 /rewards 配置奖励独立） */
  const [battleChestRewards, setBattleChestRewards] = useState([]);
  const [minigameInfo, setMinigameInfo] = useState(null);
  /** 进入惩罚战斗前校验失败（避免进入无退出的 BattleArena） */
  const [battleEntryBlockedMessage, setBattleEntryBlockedMessage] = useState(null);
  /** 奖励发放 API 失败（传奇/核心部队、道具不足等）：须弹窗告知玩家 */
  const [exploreNoticeMessage, setExploreNoticeMessage] = useState(null);

  // 未完成的事件（关闭对话框后保留，下次探索复用）
  // 持久化到 localStorage，防止刷新页面刷事件
  const pendingKey = player?.playerId ? `pending_event_${player.playerId}` : null;
  const [pendingEvent, setPendingEventRaw] = useState(() => {
    if (!pendingKey) return null;
    try {
      const saved = localStorage.getItem(pendingKey);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const setPendingEvent = useCallback((event) => {
    setPendingEventRaw(event);
    if (pendingKey) {
      if (event) localStorage.setItem(pendingKey, JSON.stringify(event));
      else localStorage.removeItem(pendingKey);
    }
  }, [pendingKey]);

  const clearRemoteExploreSessionLock = useCallback(async () => {
    if (!player?.playerId) return;
    try {
      await playerAPI.patchExploreSessionLock(player.playerId, null);
      setExploreSessionLock(null);
      await refetchExploreProgress();
    } catch {
      /* ignore */
    }
  }, [player?.playerId, setExploreSessionLock, refetchExploreProgress]);

  const restoreFromPunishLock = useCallback((event, lock, phaseOverride = PHASE.RESULT) => {
    if (!event || !lock) return;
    setCurrentEvent(event);
    setPendingEventRaw(event);
    setChosenOptionKey(lock.optionKey);
    const opt = chosenOptionFromPunishLock(event, lock);
    if (opt) setChosenOption(opt);
    const f = fortuneUiFromPunishBattleLock(lock);
    if (f) setFortune(f);
    setPhase(phaseOverride);
  }, []);

  const [rewardDetails, setRewardDetails] = useState(null);
  /** 教程链官职授予短期遮罩 */
  const [positionAnimation, setPositionAnimation] = useState(null);
  // 后端响应缓存（骰子动画期间存储，动画结束后读取）
  const pendingRewardResponse = useRef(null);
  /** 教程 IDLE 自动 startExplore 失败（池为空等）时避免死循环 */
  const tutorialExploreBlockedRef = useRef(false);

  // 仅大地图权威实例：从 localStorage 恢复 pending + 子流程（F5 后续战/掷骰/结算壳）；勿在探索 Tab 第二实例执行以免双写。
  useEffect(() => {
    if (!pendingKey || !persistMapEventHint) return;

    const hadInProgress = localStorage.getItem(`${pendingKey}_inprogress`) === '1';
    if (hadInProgress) {
      try {
        localStorage.removeItem(`${pendingKey}_inprogress`);
      } catch {
        /* ignore */
      }
    }

    let pendingFromLs = null;
    try {
      const s = localStorage.getItem(pendingKey);
      if (s) pendingFromLs = JSON.parse(s);
    } catch {
      /* ignore */
    }

    const rk = exploreResumeStorageKey(pendingKey);
    let resume = null;
    try {
      if (rk) {
        const rs = localStorage.getItem(rk);
        if (rs) resume = JSON.parse(rs);
      }
    } catch {
      /* ignore */
    }

    if (pendingFromLs) {
      setPendingEventRaw(pendingFromLs);
    }

    const phasesNeedResume = new Set([
      PHASE.ROLLING,
      PHASE.RESULT,
      PHASE.BATTLE,
      PHASE.MINIGAME,
      PHASE.REWARD,
      PHASE.RETURNING,
    ]);

    if (resume && typeof resume.phase === 'string' && pendingFromLs && phasesNeedResume.has(resume.phase)) {
      setCurrentEvent(pendingFromLs);
      if (resume.chosenOptionKey != null) setChosenOptionKey(resume.chosenOptionKey);
      if (resume.chosenOption != null) setChosenOption(resume.chosenOption);
      if (resume.fortune != null) setFortune(resume.fortune);
      setPhase(resume.phase);
    } else if (pendingFromLs && !resume) {
      setCurrentEvent(pendingFromLs);
    }
  }, [pendingKey, persistMapEventHint]);

  /** 无 local resume 时：依服务端 punish_battle 锁恢复 RESULT，避免回到 EVENT 重掷骰 */
  useEffect(() => {
    if (!pendingKey || !persistMapEventHint || !exploreProgressReady) return;

    let pendingFromLs = null;
    try {
      const s = localStorage.getItem(pendingKey);
      if (s) pendingFromLs = JSON.parse(s);
    } catch {
      /* ignore */
    }
    if (!pendingFromLs) return;

    const rk = exploreResumeStorageKey(pendingKey);
    try {
      if (rk && localStorage.getItem(rk)) return;
    } catch {
      /* ignore */
    }

    const punishLock = parseExplorePunishBattleLock(exploreSessionLock);
    if (punishLock && punishLock.eventId === pendingFromLs.event_id) {
      restoreFromPunishLock(pendingFromLs, punishLock, PHASE.RESULT);
      return;
    }

    if (phase === PHASE.IDLE) {
      setCurrentEvent(pendingFromLs);
      setPhase(PHASE.EVENT);
    }
  }, [
    exploreProgressReady,
    exploreSessionLock,
    pendingKey,
    persistMapEventHint,
    restoreFromPunishLock,
    phase,
  ]);

  /** 服务端已锁凶运但本地停在 ROLLING（杀进程丢失 setTimeout）→ 直接进 RESULT */
  useEffect(() => {
    if (phase !== PHASE.ROLLING || !currentEvent) return;
    const punishLock = parseExplorePunishBattleLock(exploreSessionLock);
    if (!punishLock || punishLock.eventId !== currentEvent.event_id) return;
    const f = fortuneUiFromPunishBattleLock(punishLock);
    if (f) setFortune(f);
    setPhase(PHASE.RESULT);
  }, [phase, exploreSessionLock, currentEvent]);

  useEffect(() => {
    if (!pendingKey || !persistMapEventHint) return;
    const rk = exploreResumeStorageKey(pendingKey);
    if (!rk) return;
    const persistPhases = new Set([
      PHASE.ROLLING,
      PHASE.RESULT,
      PHASE.BATTLE,
      PHASE.MINIGAME,
      PHASE.REWARD,
      PHASE.RETURNING,
    ]);
    if (!currentEvent || !persistPhases.has(phase)) return;
    try {
      localStorage.setItem(
        rk,
        JSON.stringify({
          phase,
          chosenOptionKey,
          chosenOption,
          fortune,
        }),
      );
    } catch {
      /* ignore */
    }
  }, [phase, chosenOptionKey, chosenOption, fortune, currentEvent, pendingKey, persistMapEventHint]);

  // 将玩家属性转为显示值
  const playerAttrs = useMemo(() => toDisplayAttrs(player), [player]);

  // 提取上阵将领
  const equippedGenerals = useMemo(() => getEquippedGenerals(cards), [cards]);
  const general1 = equippedGenerals[0] || DEFAULT_GENERAL;
  const general2 = equippedGenerals[1] || DEFAULT_GENERAL;

  // 队伍信息（供 FortunePreview 显示）
  const team = useMemo(() => ({
    player: playerAttrs,
    general1,
    general2,
  }), [playerAttrs, general1, general2]);

  const tutorialChainMaxLevel = useMemo(() => {
    let m = 0;
    for (const e of allExploreEvents) {
      if (String(e.chain_id || '').trim() !== TUTORIAL_EXPLORE_CHAIN_ID) continue;
      const n = Number(e.chain_level);
      if (Number.isFinite(n) && n > 0) m = Math.max(m, n);
    }
    return m;
  }, [allExploreEvents]);

  const tutorialChainCompleted = useMemo(
    () => getTutorialChainCompletedLevelForPool(
      allExploreEvents,
      completedEvents,
      playerItemCounts
    ),
    [allExploreEvents, completedEvents, playerItemCounts]
  );

  /** 大地图 `event_hint` 用严格连打环数（与左上角「教程 n/max」一致，不受背包钥匙抬高） */
  const tutorialChainCompletedForHint = useMemo(
    () => getTutorialChainCompletedLevelForMapHint(allExploreEvents, completedEvents),
    [allExploreEvents, completedEvents]
  );

  /** M2：是否处于教程流程仅看 `chain_tutorial_v1` 的 explore 进度，不用 tutorial_step */
  const isTutorial =
    tutorialChainMaxLevel > 0 &&
    tutorialChainCompleted < tutorialChainMaxLevel;

  /**
   * 奖励面板关闭后先经 RETURNING 再 IDLE：此期间为 true，禁止独立教程 autoplay 用陈旧 `completedEvents` 抽池；
   * 与 `RETURNING→IDLE` 内 `await refetchExploreProgress` 后再开局配合，避免无限重复链首环。
   */
  const tutorialDeferExploreAutoplayRef = useRef(false);

  const hasEquippedLineup = useMemo(() => {
    if (!cards || cards.length === 0) return false;
    return cards.some((c) => c.cardType === 'troop' && c.isEquipped);
  }, [cards]);

  /** 已完成 2 环时下一环为指引叁（chain_level 3），未装部队则拦截自动开局并显示引导 */
  const needsLineupFirst =
    isTutorial &&
    tutorialChainCompleted === 2 &&
    !hasEquippedLineup;
  const showLineupGuide = needsLineupFirst && phase === PHASE.IDLE;

  /**
   * 当前探索锚点 `city_id`（「到了哪座城」）：
   * - 事件进行中由本局已选 `startExplore(override)` 保持，不随地图移动被冲掉；
   * - **IDLE** 时：路格须在城 **POI footprint 内**（或库 `position_*` 与路格一致）才更新；**非**路边即算到城（见 `resolveExploreAnchorCityIdFromStrategicGrid`）。
   * 池过滤见 `filterExploreEventsPool` + `exploreLocationMatchesEvent`。
   */
  const [exploreLocationId, setExploreLocationId] = useState(null);

  /** IDLE 时把探索锚点绑到路网立足城；解决旧逻辑「只补一次空锚点」导致移动后仍按旧城抽事件/教程死循环。 */
  useEffect(() => {
    if (phase !== PHASE.IDLE) return;
    const grid = exploreAnchorGridRef?.current;
    const anchor =
      grid?.cells?.length
        ? resolveExploreAnchorCityIdFromStrategicGrid(player, citiesList, grid)
        : resolveExploreAnchorCityIdFromPlayerRoad(player, citiesList);
    const anchorNorm = anchor != null && String(anchor).trim() !== '' ? String(anchor).trim() : '';
    setExploreLocationId((prev) => {
      const p = prev != null ? String(prev).trim() : '';
      if (p === anchorNorm) return prev;
      return anchorNorm !== '' ? anchorNorm : null;
    });
  }, [
    phase,
    player?.roadJunId,
    player?.roadPositionX,
    player?.roadPositionY,
    citiesList,
    exploreAnchorGridRef,
    exploreAnchorGridSeq,
  ]);

  const [pendingMapEventHint, setPendingMapEventHint] = useState(null);

  /**
   * 大地图 `event_hint`：切走底栏 Tab（如编组）会卸载 `WorldMap` 与本 hook，内存中的 `pendingMapEventHint` 会丢。
   * 仅 `persistMapEventHint===true` 时读写（由 `WorldMap` 传入），避免 ExploreTab 等第二实例清空同键。
   */
  useLayoutEffect(() => {
    if (!persistMapEventHint) return;
    const k = pendingMapEventHintStorageKey(player?.playerId);
    if (!k) return;
    try {
      const raw = sessionStorage.getItem(k);
      const t = raw && String(raw).trim();
      if (t) {
        setPendingMapEventHint((prev) => (prev && String(prev).trim() ? prev : t));
      }
    } catch {
      /* ignore */
    }
  }, [persistMapEventHint, player?.playerId]);

  // 仅在有文案时写入；不在此处 removeItem——否则首帧 pending 仍为 null 时会在 layout  hydrate 之前误删 session（刷新/Strict 双挂载后指引丢失）。
  useEffect(() => {
    if (!persistMapEventHint) return;
    const k = pendingMapEventHintStorageKey(player?.playerId);
    if (!k) return;
    const t = pendingMapEventHint && String(pendingMapEventHint).trim();
    if (!t) return;
    try {
      sessionStorage.setItem(k, t);
    } catch {
      /* ignore */
    }
  }, [persistMapEventHint, player?.playerId, pendingMapEventHint]);

  /**
   * 教程链 IDLE、且尚无 `closeReward` 写入的 pending：用**上一环已完成模板**上的 `event_hint`。
   * `event_hint` 写在 chain_level=N 表示「进行教程第 N+1 步 / 触发第 N+1 环前」应做的事（例 2/6 显示 1001 文案，非 1002）。
   */
  const tutorialIdleMapEventHint = useMemo(() => {
    if (suppressMapEventHint || !persistMapEventHint || !isTutorial || phase !== PHASE.IDLE) return null;
    if (!exploreProgressReady || !allExploreEvents?.length) return null;
    const currentStep = tutorialChainCompletedForHint + 1;
    if (currentStep < 1 || currentStep > tutorialChainMaxLevel) return null;
    const hintChainLevel = Math.max(1, tutorialChainCompletedForHint);
    const hintEvt = allExploreEvents.find(
      (e) =>
        String(e.chain_id || '').trim() === TUTORIAL_EXPLORE_CHAIN_ID &&
        Number(e.chain_level) === hintChainLevel
    );
    const hn = hintEvt?.event_hint ?? hintEvt?.eventHint;
    const base = typeof hn === 'string' && hn.trim() ? hn.trim() : null;
    if (!base) return null;

    const nextLevel = tutorialChainCompletedForHint + 1;
    const nextEvt = allExploreEvents.find(
      (e) =>
        String(e.chain_id || '').trim() === TUTORIAL_EXPLORE_CHAIN_ID &&
        Number(e.chain_level) === nextLevel
    );
    if (!nextEvt) return base;

    const extras = [];
    const minRepRaw = nextEvt.min_reputation ?? nextEvt.minReputation;
    if (minRepRaw != null && minRepRaw !== '') {
      const need = Number(minRepRaw);
      const pr = Number(player?.reputation ?? 0);
      if (Number.isFinite(need) && need > 0 && (Number.isFinite(pr) ? pr : 0) < need) {
        extras.push(`当前声望 ${Number.isFinite(pr) ? pr : 0}，触发本步需≥${need}`);
      }
    }
    const reqItems = nextEvt.required_items ?? nextEvt.requiredItems;
    const loc = exploreLocationId != null ? String(exploreLocationId).trim() : '';
    if (reqItems && loc && exploreLocationMatchesEvent(String(nextEvt.location ?? '').trim(), loc, citiesList)) {
      if (!playerMeetsEventRequiredItems(reqItems, playerItemCounts)) {
        extras.push('教程道具同步中，请稍候或重进大地图');
      }
    }
    return extras.length ? `${base}（${extras.join('；')}）` : base;
  }, [
    suppressMapEventHint,
    persistMapEventHint,
    isTutorial,
    phase,
    exploreProgressReady,
    tutorialChainCompletedForHint,
    tutorialChainMaxLevel,
    allExploreEvents,
    player?.reputation,
    exploreLocationId,
    citiesList,
    playerItemCounts,
  ]);

  /** 教程进行中：用推导文案覆盖 session 内旧的「下一环」匪寨等脏数据 */
  useEffect(() => {
    if (!persistMapEventHint || !isTutorial || phase !== PHASE.IDLE || !tutorialIdleMapEventHint) return;
    const canonical = String(tutorialIdleMapEventHint).trim();
    const pending = pendingMapEventHint && String(pendingMapEventHint).trim();
    if (pending === canonical) return;
    setPendingMapEventHint(canonical);
  }, [
    persistMapEventHint,
    isTutorial,
    phase,
    tutorialIdleMapEventHint,
    pendingMapEventHint,
  ]);

  const mapEventHintDisplay = useMemo(() => {
    if (suppressMapEventHint) return null;
    if (isTutorial && phase === PHASE.IDLE && tutorialIdleMapEventHint) {
      return tutorialIdleMapEventHint;
    }
    const p = pendingMapEventHint && String(pendingMapEventHint).trim();
    if (p) return p;
    return tutorialIdleMapEventHint || null;
  }, [
    suppressMapEventHint,
    isTutorial,
    phase,
    pendingMapEventHint,
    tutorialIdleMapEventHint,
  ]);

  // 根据地点 + 链进度过滤可用事件池（用于 UI 展示默认地点池子大小等）
  const exploreEvents = useMemo(() => {
    if (!exploreProgressReady) return [];
    return filterExploreEventsPool(
      allExploreEvents,
      completedEvents,
      exploreLocationId,
      playerItemCounts,
      citiesList,
      null,
      player?.reputation ?? 0
    );
  }, [exploreProgressReady, allExploreEvents, completedEvents, exploreLocationId, playerItemCounts, citiesList, player?.reputation]);

  const explorePoolAt = useCallback((locationId, subsidiaryKind = null) => {
    if (!exploreProgressReady) return [];
    return filterExploreEventsPool(
      allExploreEvents,
      completedEvents,
      locationId,
      playerItemCounts,
      citiesList,
      subsidiaryKind,
      player?.reputation ?? 0
    );
  }, [exploreProgressReady, allExploreEvents, completedEvents, playerItemCounts, citiesList, player?.reputation]);

  const resolvedEventLocation = useMemo(() => {
    if (!currentEvent?.location) {
      return { displayLocationId: '', cityName: '', isPlaceholder: false };
    }
    const seed = `${player?.playerId || ''}:${currentEvent.event_id}:${currentEvent.location}`;
    return resolveEventLocationForUi(currentEvent.location, citiesList, seed);
  }, [currentEvent, citiesList, player?.playerId]);

  const eventLocationLabel = useMemo(() => {
    if (!currentEvent?.location) return '';
    const { cityName, displayLocationId, unresolved, allLocations } = resolvedEventLocation;
    if (unresolved) return currentEvent.location;
    if (allLocations) return '任意地点';
    return cityName || displayLocationId || '';
  }, [currentEvent, resolvedEventLocation]);

  /** 匪寨格上探索事件 → 惩罚战敌方四槽固定传奇档（与事件卡稀有度、匪寨层数玩法无关） */
  const eventBattleEnemySlotRarities = useMemo(() => {
    if (!exploreLocationId) return null;
    if (isBanditMapObjectId(exploreLocationId)) {
      return EVENT_PUNISHMENT_COMBAT_BANDIT_LOCATION_SLOT_RARITIES;
    }
    return null;
  }, [exploreLocationId]);

  // 变量替换
  const replaceVars = useCallback((text) => {
    if (!text || !playerAttrs) return text || '';
    const citySubst = resolvedEventLocation.allLocations
      ? '任意地点'
      : (resolvedEventLocation.cityName || '');
    let s = text.replace(/\{player_name\}/g, playerAttrs.name || '');
    s = s.replace(/\{city_name\}/g, citySubst);
    return s;
  }, [playerAttrs, resolvedEventLocation]);

  /**
   * 开始探索
   * @param {string|null|undefined} locationOverride - 探索点 city_id（大地图多点必传）
   * @param {{ subsidiaryKind?: 'wilderness'|'market' }|null} [exploreOpts] - 战略城 tooltip 荒郊/集市分池；不传则与当前 `exploreLocationId` 默认探索点一致
   * @param {Record<string, { status?: string }>|null|undefined} [completedEventsOverride] - 与 `GET …/events/explore` 同步快照；用于结算后避免链进度竞态
   * @param {Record<string, number>|null|undefined} [playerItemCountsOverride] - 与 `GET …/items` 同步快照；用于领奖后链钥匙 `required_items` 尚未写入 React state 时抽池
   */
  const startExplore = useCallback((locationOverride, exploreOpts, completedEventsOverride, playerItemCountsOverride) => {
    if (!playerAttrs) return false;
    setExploreNoticeMessage(null);

    const punishLockEarly = parseExplorePunishBattleLock(exploreSessionLock);
    if (punishLockEarly) {
      if (pendingEvent?.event_id === punishLockEarly.eventId) {
        restoreFromPunishLock(pendingEvent, punishLockEarly, PHASE.RESULT);
        return true;
      }
      setExploreNoticeMessage('请先完成进行中的惩罚战');
      return false;
    }

    if (pendingKey) {
      clearExploreResumeLocal(pendingKey);
      try {
        localStorage.removeItem(`${pendingKey}_inprogress`);
      } catch {
        /* ignore */
      }
    }
    const hasCompletedOverride =
      completedEventsOverride != null && typeof completedEventsOverride === 'object';
    if (!hasCompletedOverride && !exploreProgressReady) return false;
    const opts = exploreOpts && typeof exploreOpts === 'object' ? exploreOpts : {};
    const subsidiaryKind = opts.subsidiaryKind ?? null;
    const completedForPool = hasCompletedOverride ? completedEventsOverride : completedEvents;
    const countsForPool =
      playerItemCountsOverride != null && typeof playerItemCountsOverride === 'object'
        ? playerItemCountsOverride
        : playerItemCounts;

    // 未传地点时用 pending 的锚点 city_id 或当前探索点；勿用事件配置的 location 占位符（会与 city_id 比较失败导致反复清 pending）
    const locId = (locationOverride != null && locationOverride !== '')
      ? locationOverride
      : (pendingEvent?.explore_anchor_city_id ?? exploreLocationId);
    const locIdNorm = locId != null && String(locId).trim() !== '' ? String(locId).trim() : '';
    if (!locIdNorm) return false;
    if (locationOverride) setExploreLocationId(locationOverride);

    if (subsidiaryKind === 'wilderness' || subsidiaryKind === 'market') {
      strategicExploreReopenBridge.setPendingReopen(locIdNorm, subsidiaryKind);
    } else {
      strategicExploreReopenBridge.clear();
    }

    const pool = filterExploreEventsPool(
      allExploreEvents,
      completedForPool,
      locIdNorm,
      countsForPool,
      citiesList,
      subsidiaryKind,
      player?.reputation ?? 0
    );
    const poolIds = new Set(pool.map((e) => e.event_id));

    let usePending = pendingEvent;
    if (usePending?.explore_anchor_city_id != null && usePending.explore_anchor_city_id !== locIdNorm) {
      setPendingEvent(null);
      usePending = null;
    }
    if (
      usePending != null &&
      subsidiaryKind != null &&
      usePending.explore_subsidiary_kind != null &&
      usePending.explore_subsidiary_kind !== subsidiaryKind
    ) {
      setPendingEvent(null);
      usePending = null;
    }
    if (usePending && !poolIds.has(usePending.event_id)) {
      setPendingEvent(null);
      usePending = null;
    }

    const raw = (usePending && poolIds.has(usePending.event_id) ? usePending : null) || pickRandomEvent(pool);
    if (!raw) return false;
    if (!eventSkipsExploreQuota(raw) && !quota?.canExplore) return false;

    const {
      explore_anchor_city_id: _a,
      explore_subsidiary_kind: _k,
      _exploreQuotaConsumed: exploreQuotaAlreadyCharged,
      ...eventCore
    } = raw;
    const event = {
      ...eventCore,
      explore_anchor_city_id: locIdNorm,
      explore_subsidiary_kind: subsidiaryKind,
    };
    // 与匪寨/攻城一致：在「已抽到事件并进入 EVENT」时即扣探索次数，避免仅弹出事件未点选项时 F5 仍显示满次数。
    // `_exploreQuotaConsumed` 随 pending 写入 localStorage，刷新后同一条 pending 不会二次扣费。
    if (!eventSkipsExploreQuota(event)) {
      if (!exploreQuotaAlreadyCharged) quota?.consume?.();
      event._exploreQuotaConsumed = true;
    }

    setPendingEvent(event);
    setCurrentEvent(event);
    setChosenOption(null);
    setChosenOptionKey(null);
    setFortune(null);
    setBattleResult(null);
    setBattleSilverSpent(0);
    setBattleScore(null);
    setBattleChestRewards([]);
    setMinigameInfo(null);
    setRewardDetails(null);
    setPhase(PHASE.EVENT);
    return true;
  }, [
    quota,
    playerAttrs,
    pendingEvent,
    allExploreEvents,
    completedEvents,
    exploreLocationId,
    playerItemCounts,
    citiesList,
    player?.reputation,
    setPendingEvent,
    exploreProgressReady,
    pendingKey,
    exploreSessionLock,
    restoreFromPunishLock,
  ]);

  /** 探索结算 RETURNING→IDLE：先拉库内 explore_events，再用快照抽下一环（避免教程 autoplay 抢在 setState 前重复链首） */
  const prevPhaseForExploreRef = useRef(phase);
  useEffect(() => {
    const prev = prevPhaseForExploreRef.current;
    prevPhaseForExploreRef.current = phase;
    if (prev !== PHASE.RETURNING || phase !== PHASE.IDLE || !player?.playerId) return undefined;

    let cancelled = false;
    (async () => {
      const bundle = await refetchExplorePlayerBundle();
      if (cancelled) return;
      tutorialDeferExploreAutoplayRef.current = false;
      if (!tutorialAutoplay || !isTutorial || eventsLoading || needsLineupFirst) return;
      tutorialExploreBlockedRef.current = false;
      if (bundle.events == null) return;
      const ok = startExplore(
        undefined,
        undefined,
        bundle.events,
        bundle.itemCounts ?? undefined,
      );
      if (ok === false) tutorialExploreBlockedRef.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, [
    phase,
    refetchExplorePlayerBundle,
    tutorialAutoplay,
    isTutorial,
    eventsLoading,
    needsLineupFirst,
    startExplore,
  ]);

  useEffect(() => {
    tutorialExploreBlockedRef.current = false;
  }, [tutorialChainCompleted]);

  /**
   * 教程自动探索在池空或次数不足时会 `tutorialExploreBlockedRef = true`。
   * - 空 → 非空：首次有锚点，允许重试（原逻辑）。
   * - 非空 A → 非空 B：换城后池可能从中空变为有（例链 2 仅 `{city_medium}`），须解除 block，否则会卡死在黄条「请前往中城」。
   * - **同格**升声望、补探索次数、背包出现链钥匙、合并格 `exploreAnchorGridSeq` 刷新：见下方 `tutorialAutoplayGateRef`。
   */
  const prevExploreLocationIdRef = useRef(exploreLocationId);
  useEffect(() => {
    const prev = prevExploreLocationIdRef.current;
    prevExploreLocationIdRef.current = exploreLocationId;
    const prevNorm = prev != null && String(prev).trim() !== '' ? String(prev).trim() : '';
    const nowNorm =
      exploreLocationId != null && String(exploreLocationId).trim() !== ''
        ? String(exploreLocationId).trim()
        : '';
    const wasEmpty = prevNorm === '';
    if (wasEmpty && nowNorm !== '') {
      tutorialExploreBlockedRef.current = false;
      return;
    }
    if (prevNorm !== nowNorm) {
      tutorialExploreBlockedRef.current = false;
    }
  }, [exploreLocationId]);

  /**
   * 教程 IDLE 自动 `startExplore`：曾在「池空 / 次数不足 / 声望未达 min_reputation」时置 `tutorialExploreBlockedRef`，
   * 若仅 **`exploreLocationId`** 变化才解除封锁，则**同格**升声望、补次数、背包出现链钥匙后**永不重试**（汝阳中城 + rep≥10 仍不开局）。
   * 在下列「闸门」任一变化时解除封锁再抽池；`startExplore` 仍失败则再次封锁，避免无意义空转。
   */
  const tutorialAutoplayGateRef = useRef({
    rep: null,
    canQx: null,
    loc: null,
    chainDone: null,
    gridSeq: null,
    itemsJson: null,
  });
  useEffect(() => {
    if (!tutorialAutoplay || !isTutorial || phase !== PHASE.IDLE || eventsLoading || needsLineupFirst) return;
    if (!exploreProgressReady) return;
    if (tutorialDeferExploreAutoplayRef.current) return;

    const repN = Number(player?.reputation ?? 0);
    const canQx = !!quota.canExplore;
    const locN = exploreLocationId != null ? String(exploreLocationId).trim() : '';
    const chainDone = tutorialChainCompleted;
    const gridSeq = exploreAnchorGridSeq ?? 0;
    const itemsJson = JSON.stringify(playerItemCounts || {});

    const g = tutorialAutoplayGateRef.current;
    const gateChanged =
      g.rep !== repN ||
      g.canQx !== canQx ||
      g.loc !== locN ||
      g.chainDone !== chainDone ||
      g.gridSeq !== gridSeq ||
      g.itemsJson !== itemsJson;
    if (gateChanged) {
      tutorialExploreBlockedRef.current = false;
      tutorialAutoplayGateRef.current = {
        rep: repN,
        canQx,
        loc: locN,
        chainDone,
        gridSeq,
        itemsJson,
      };
    }

    if (tutorialExploreBlockedRef.current) return undefined;
    const ok = startExplore();
    if (ok !== false) return undefined;

    tutorialExploreBlockedRef.current = true;
    let cancelled = false;
    void (async () => {
      const bundle = await refetchExplorePlayerBundle();
      if (cancelled || tutorialDeferExploreAutoplayRef.current) return;
      tutorialExploreBlockedRef.current = false;
      const ok2 = startExplore(
        undefined,
        undefined,
        bundle.events,
        bundle.itemCounts ?? undefined,
      );
      if (ok2 === false) tutorialExploreBlockedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [
    tutorialAutoplay,
    isTutorial,
    phase,
    eventsLoading,
    needsLineupFirst,
    tutorialChainCompleted,
    exploreLocationId,
    playerItemCounts,
    startExplore,
    exploreAnchorGridSeq,
    exploreProgressReady,
    quota.canExplore,
    player?.reputation,
    refetchExplorePlayerBundle,
  ]);

  /** 探索中断：关弹窗、清 pending、回 IDLE（开战门闸与奖励失败共用） */
  const resetExploreSessionAfterAbort = useCallback(() => {
    clearInflightBattleTroopSnapshot();
    strategicExploreReopenBridge.clear();
    tutorialExploreBlockedRef.current = false;
    if (pendingKey) {
      clearExploreResumeLocal(pendingKey);
      clearExploreAwayBattleEndLocal(pendingKey);
      try {
        localStorage.removeItem(`${pendingKey}_inprogress`);
      } catch {
        /* ignore */
      }
    }
    void clearRemoteExploreSessionLock();
    if (persistMapEventHint && player?.playerId) {
      try {
        const k = pendingMapEventHintStorageKey(player.playerId);
        if (k) sessionStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    }
    setPendingMapEventHint(null);
    setCurrentEvent(null);
    setPendingEvent(null);
    setChosenOption(null);
    setChosenOptionKey(null);
    setFortune(null);
    setMinigameInfo(null);
    setBattleResult(null);
    setBattleSilverSpent(0);
    setBattleScore(null);
    setBattleChestRewards([]);
    setRewardDetails(null);
    setPhase(PHASE.IDLE);
    void refetchExploreProgress();
  }, [pendingKey, setPendingEvent, persistMapEventHint, player?.playerId, refetchExploreProgress, clearRemoteExploreSessionLock]);

  // 关闭事件对话框（未选选项）：已在本轮 `startExplore` 扣过次数则退还，并清空 pending，避免与「已扣费」状态不一致。
  const closeEvent = useCallback(() => {
    setExploreNoticeMessage(null);
    clearInflightBattleTroopSnapshot();
    if (pendingKey) {
      clearExploreResumeLocal(pendingKey);
      clearExploreAwayBattleEndLocal(pendingKey);
      try {
        localStorage.removeItem(`${pendingKey}_inprogress`);
      } catch {
        /* ignore */
      }
    }
    const punishLock = parseExplorePunishBattleLock(exploreSessionLock);
    if (punishLock && currentEvent?.event_id === punishLock.eventId) {
      void clearRemoteExploreSessionLock();
    }
    tutorialExploreBlockedRef.current = false;
    strategicExploreReopenBridge.clear();
    if (currentEvent && !eventSkipsExploreQuota(currentEvent)) {
      quota.refund();
    }
    setPhase(PHASE.IDLE);
    setCurrentEvent(null);
    setPendingEvent(null);
  }, [currentEvent, quota, setPendingEvent, pendingKey, exploreSessionLock, clearRemoteExploreSessionLock]);

  // 请求后端发放奖励（统一入口）
  const requestRewards = useCallback((optKey, extraBody = {}) => {
    if (!currentEvent || !player?.playerId) return Promise.resolve(null);
    const body = {
      eventId: currentEvent.event_id,
      optionKey: optKey,
      playerAttrs,
      general1Attrs: general1,
      general2Attrs: general2,
      ...extraBody,
    };
    return fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${player.playerId}/rewards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(res => res.json())
      .catch(err => { console.error('[useEventSystem] 奖励API请求失败:', err); return null; });
  }, [currentEvent, player, playerAttrs, general1, general2]);

  // 应用后端返回的fortune和奖励到state；失败时退回 IDLE 并退还次数，避免卡在 REWARD/RESULT 导致全图无法点
  const applyRewardResponse = useCallback((data) => {
    if (!data?.success) {
      const err =
        (data && typeof data.error === 'string' && data.error.trim())
        || (data == null ? '网络异常，请稍后重试' : '奖励发放失败，请稍后重试');
      const errCode = data && typeof data.code === 'string' ? data.code : '';
      console.error('[useEventSystem] 奖励发放失败:', err);
      if (errCode === 'EXPLORE_PUNISH_BATTLE_PENDING' && currentEvent) {
        const punishLock = parseExplorePunishBattleLock(exploreSessionLock);
        if (punishLock) {
          restoreFromPunishLock(currentEvent, punishLock, PHASE.RESULT);
        }
        setExploreNoticeMessage(err);
        return false;
      }
      const isDup = err.includes('已完成') || err.includes('重复');
      if (isDup) {
        console.log('[useEventSystem] 事件已完成或重复领取，跳过并退还探索次数');
        if (!eventSkipsExploreQuota(currentEvent)) quota.refund();
        resetExploreSessionAfterAbort();
        return false;
      }
      if (!eventSkipsExploreQuota(currentEvent)) quota.refund();
      setExploreNoticeMessage(err);
      resetExploreSessionAfterAbort();
      return false;
    }
    const sf = data.data.fortune;
    if (sf) {
      const level = FORTUNE_LEVELS.find(f => f.name === sf.name) || FORTUNE_LEVELS[2];
      setFortune({
        name: level.name, emoji: level.emoji, color: level.color,
        multiplier: sf.multiplier, dice: sf.dice,
        diceMultiplier: sf.diceMultiplier, baseScore: sf.baseScore, finalRate: sf.finalRate,
      });
    }
    setRewardDetails({
      rewards: data.data.rewards || [],
      bonusRewards: data.data.bonusRewards || [],
      troopRepair: data.data.troopRepair || null,
      milestoneUnlock: data.data.milestoneUnlock || null,
    });
    if (player?.playerId) {
      void refetchExplorePlayerBundle();
    }
    return true;
  }, [
    quota,
    currentEvent,
    resetExploreSessionAfterAbort,
    player?.playerId,
    refetchExplorePlayerBundle,
    exploreSessionLock,
    restoreFromPunishLock,
  ]);

  // 选择选项（探索次数已在 `startExplore` 扣除，此处不再 consume）
  const chooseOption = useCallback((option, optionKey) => {
    const punishLock = parseExplorePunishBattleLock(exploreSessionLock);
    if (
      punishLock &&
      currentEvent?.event_id === punishLock.eventId &&
      punishLock.optionKey === optionKey
    ) {
      setChosenOption(option);
      setChosenOptionKey(optionKey);
      const f = fortuneUiFromPunishBattleLock(punishLock);
      if (f) setFortune(f);
      setPhase(PHASE.RESULT);
      return;
    }

    setChosenOption(option);
    setChosenOptionKey(optionKey);
    pendingRewardResponse.current = null;

    // 标记事件进行中
    if (pendingKey) {
      localStorage.setItem(pendingKey + '_inprogress', '1');
    }

    const flow = getExploreOptionResolution(option);

    // minigame：进入小游戏，结束后再请求后端
    if (flow === 'minigame') {
      const req = option.mainRequirement != null ? String(option.mainRequirement) : '';
      const [game, difficulty] = req.split(':');
      setMinigameInfo({ game, difficulty });
      setPhase(PHASE.MINIGAME);
      return;
    }

    // always：无需掷骰，直接请求后端后进结算
    if (flow === 'always') {
      setFortune({ name: '吉', emoji: '⭐', color: 'text-blue-600', multiplier: 1.0 });
      requestRewards(optionKey).then((data) => {
        if (applyRewardResponse(data)) setPhase(PHASE.REWARD);
      });
      return;
    }

    // 因子判定（luck 等）：先播掷骰再展示判定结果
    setPhase(PHASE.ROLLING);
    const rewardPromise = requestRewards(optionKey);
    rewardPromise.then((data) => { pendingRewardResponse.current = data; });

    setTimeout(() => {
      const cached = pendingRewardResponse.current;
      if (cached) {
        const ok = applyRewardResponse(cached);
        pendingRewardResponse.current = null;
        if (cached.success && ok) setPhase(PHASE.RESULT);
      } else {
        rewardPromise.then((data) => {
          if (applyRewardResponse(data)) setPhase(PHASE.RESULT);
        });
      }
    }, 1000);
  }, [requestRewards, applyRewardResponse, pendingKey, currentEvent, exploreSessionLock]);

  /** 离屏 30s 自动结算后写入 localStorage，重进游戏续接 endBattle */
  const persistDeferredAwayBattleEnd = useCallback((payload) => {
    if (!pendingKey || !payload?.result) return;
    const k = exploreAwayBattleEndStorageKey(pendingKey);
    if (!k) return;
    try {
      localStorage.setItem(k, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, [pendingKey]);

  /** 凶/大凶选战但门闸失败：关弹窗后必须回到 IDLE，否则 phase 仍停在 RESULT，`eventBusy` 会一直挡住底栏。不退还探索次数（已 startExplore 扣费）。 */
  const dismissBattleEntryBlocked = useCallback(() => {
    setBattleEntryBlockedMessage(null);
    resetExploreSessionAfterAbort();
  }, [resetExploreSessionAfterAbort]);

  const dismissExploreNotice = useCallback(() => {
    setExploreNoticeMessage(null);
    resetExploreSessionAfterAbort();
  }, [resetExploreSessionAfterAbort]);

  // 判定结果确认
  const confirmResult = useCallback(() => {
    if (fortune && (fortune.name === '凶' || fortune.name === '大凶')) {
      // 选项 B 为和平选项，永不进入惩罚战斗
      if (chosenOptionKey === 'B') {
        setPhase(PHASE.REWARD);
        return;
      }
      // 仅选项 A：triggerBattle=yes 时凶/大凶进入惩罚战
      if (chosenOption && chosenOption.triggerBattle) {
        const v = validateMainLineupBattleGate({
          cards,
          playerFood: player?.food ?? 0,
        });
        if (!v.ok) {
          setBattleEntryBlockedMessage(v.message || '条件不足');
          return;
        }
        setBattleEntryBlockedMessage(null);
        setPhase(PHASE.BATTLE);
        return;
      }
    }
    setPhase(PHASE.REWARD);
  }, [fortune, chosenOption, chosenOptionKey, cards, player?.food]);

  // 战斗结果（第五参 meta 与 EventBattleArena / 攻城一致，含 chestRewards）
  const endBattle = useCallback((result, silverSpent = 0, scoreResult = null, _killedIndices, meta = null) => {
    setBattleResult(result);
    setBattleSilverSpent(silverSpent);
    setBattleScore(scoreResult);
    setBattleChestRewards(Array.isArray(meta?.chestRewards) ? meta.chestRewards : []);
    // 战报已由 useBattleSettlement → POST /api/battles 入账 total_battle_score；勿再在 /rewards 重复加同一场分
    const scoreAlreadyInStatistics = meta?.battleReportSaved === true;
    // 请求后端发放奖励
    requestRewards(chosenOptionKey, {
      battleResult: result,
      ...(silverSpent > 0 ? { battleSilverSpent: silverSpent } : {}),
      ...(scoreResult && !scoreAlreadyInStatistics ? { battleScore: scoreResult.score } : {}),
    }).then((data) => {
      if (applyRewardResponse(data)) setPhase(PHASE.REWARD);
    });
  }, [chosenOptionKey, requestRewards, applyRewardResponse]);

  /** 重进游戏：续接离屏已结算但未点确定的惩罚战（仅执行一次） */
  const awayEndBootstrappedRef = useRef(false);
  useEffect(() => {
    if (awayEndBootstrappedRef.current) return;
    if (!pendingKey || !persistMapEventHint || !exploreProgressReady) return;
    const k = exploreAwayBattleEndStorageKey(pendingKey);
    if (!k) return;
    let payload = null;
    try {
      const raw = localStorage.getItem(k);
      if (raw) {
        payload = JSON.parse(raw);
        localStorage.removeItem(k);
      }
    } catch {
      /* ignore */
    }
    if (!payload?.result) return;
    awayEndBootstrappedRef.current = true;
    endBattle(
      payload.result,
      payload.silverSpent || 0,
      payload.scoreResult || null,
      payload.killedIndices,
      payload.meta || null,
    );
  }, [pendingKey, persistMapEventHint, exploreProgressReady, endBattle]);

  // 迷你游戏结果
  const endMinigame = useCallback((result, extra = {}) => {
    if (result === 'victory') {
      setFortune({ name: '吉', emoji: '⭐', color: 'text-blue-600', multiplier: 1.0 });
    } else {
      setFortune({ name: '凶', emoji: '💀', color: 'text-orange-600', multiplier: 0.5 });
    }
    // 请求后端发放奖励（附带筹码盈亏）
    requestRewards(chosenOptionKey, { minigameResult: result, minigameSilverDelta: extra.silverDelta || 0 }).then((data) => {
      if (applyRewardResponse(data)) setPhase(PHASE.REWARD);
    });
  }, [chosenOptionKey, requestRewards, applyRewardResponse]);

  // PHASE.REWARD 阶段：奖励已由 chooseOption/endMinigame/endBattle 请求后端获取
  // 无需额外请求

  // 关闭奖励 → 记录 explore 进度（教程链与否均只写 explore_events；M2 不再写 tutorial_step）
  const closeReward = useCallback(async () => {
    const ev = currentEvent;
    const rd = rewardDetails;
    const optKey = chosenOptionKey;
    const chainIdNorm = String(ev?.chain_id || '').trim();

    if (ev && optKey && player?.playerId) {
      try {
        await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${player.playerId}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: ev.event_id,
            eventType: 6,
            status: 'completed',
            data: { chainId: ev.chain_id || null, chainLevel: ev.chain_level || null },
          }),
        });
        setCompletedEvents((prev) => ({
          ...prev,
          [ev.event_id]: { status: 'completed' },
        }));
        const lvl = Number(ev.chain_level);
        if (
          chainIdNorm === TUTORIAL_EXPLORE_CHAIN_ID &&
          tutorialChainMaxLevel > 0 &&
          Number.isFinite(lvl) &&
          lvl === tutorialChainMaxLevel
        ) {
          quota.fillMax();
        }
      } catch (err2) {
        console.error('[useEventSystem] 记录事件进度失败:', err2);
      }
    }

    let nextMapEventHint = null;
    if (ev) {
      const hSelf = ev.event_hint ?? ev.eventHint;
      const selfHint = typeof hSelf === 'string' && hSelf.trim() ? hSelf.trim() : null;
      // 教程链 event_hint 写在第 L 环、指引第 L+1 步；勿再取 L+1 环模板（会与 2/6 误显匪寨等）
      nextMapEventHint = selfHint;
      setPendingMapEventHint(nextMapEventHint);
      const anchorCityId = ev.explore_anchor_city_id;
      const subKind = ev.explore_subsidiary_kind;
      if (
        anchorCityId != null &&
        String(anchorCityId).trim() !== '' &&
        (subKind === 'wilderness' || subKind === 'market')
      ) {
        strategicExploreReopenBridge.setPendingReopen(anchorCityId, subKind);
      }
    } else {
      setPendingMapEventHint(null);
    }

    if (persistMapEventHint && player?.playerId) {
      try {
        const k = pendingMapEventHintStorageKey(player.playerId);
        if (k) {
          if (nextMapEventHint) sessionStorage.setItem(k, nextMapEventHint);
          else sessionStorage.removeItem(k);
        }
      } catch {
        /* ignore */
      }
    }

    const hasPosition = rd?.rewards?.some((d) => d.type === 'position');
    const positionDetail = rd?.rewards?.find((d) => d.type === 'position');
    const tutorialPosAnim = chainIdNorm === TUTORIAL_EXPLORE_CHAIN_ID && hasPosition && positionDetail;

    tutorialDeferExploreAutoplayRef.current = true;
    setPhase(PHASE.RETURNING);
    setCurrentEvent(null);
    setPendingEvent(null);
    setRewardDetails(null);
    setBattleChestRewards([]);
    if (pendingKey) {
      clearExploreResumeLocal(pendingKey);
      clearExploreAwayBattleEndLocal(pendingKey);
      try {
        localStorage.removeItem(`${pendingKey}_inprogress`);
      } catch {
        /* ignore */
      }
    }

    if (tutorialPosAnim) {
      setPositionAnimation(positionDetail);
      setTimeout(() => {
        setPositionAnimation(null);
        setPhase(PHASE.IDLE);
      }, 1000);
    } else {
      setTimeout(() => setPhase(PHASE.IDLE), 1000);
    }
  }, [
    currentEvent,
    chosenOptionKey,
    player?.playerId,
    rewardDetails,
    pendingKey,
    setPendingEvent,
    persistMapEventHint,
    tutorialChainMaxLevel,
    quota,
    allExploreEvents,
    clearRemoteExploreSessionLock,
  ]);

  const isSuccess = isFortuneSuccess(fortune);

  return {
    // 状态
    phase,
    currentEvent,
    chosenOption,
    chosenOptionKey,
    fortune,
    battleResult,
    minigameInfo,
    isSuccess,
    eventsLoading,
    exploreEvents,
    exploreLocationId,
    setExploreLocationId,
    explorePoolAt,
    quota,
    team,
    playerAttrs,
    itemNameMap,
    playerSilver: player?.silver ?? 0,
    playerResources: player ? {
      silver: player.silver ?? 0,
      food: player.food ?? 0,
      reputation: player.reputation ?? 0,
      contribution: player.contribution ?? 0,
      morale: player.morale ?? 0,
    } : null,
    playerItemsList: player?.items || null,
    rewardDetails,
    battleScore,
    battleChestRewards,
    playerId: player?.playerId || null,
    battleEntryBlockedMessage,
    dismissBattleEntryBlocked,
    exploreNoticeMessage,
    dismissExploreNotice,

    // 操作
    startExplore,
    closeEvent,
    chooseOption,
    confirmResult,
    endBattle,
    endMinigame,
    closeReward,
    replaceVars,
    eventLocationLabel,
    eventBattleEnemySlotRarities,
    /** 探索惩罚战离屏结算持久化（SmallMapBattle → useBattleSettlement） */
    exploreAwayBattlePersistKey: pendingKey,
    persistDeferredAwayBattleEnd,
    /** 战略荒郊 tooltip 等与 `filterExploreEventsPool` 共用，解析 `city_type` 展示 13-1 荒郊稀有度区间 */
    citiesList,

    /** 服务端会话锁 JSON；新开探索/教程链前可依此禁止并行（PATCH 写入见 playerApi.patchExploreSessionLock） */
    exploreSessionLock,

    /** 完成探索事件后在大地图展示的下一步提示（`event_hint`）；教程链取刚完成环模板文案 */
    pendingMapEventHint,
    /** 左上探索/教程钮用：`pendingMapEventHint` 或教程 IDLE 时由「当前步对应上一环」`event_hint` 推导（32-4 §1.5） */
    mapEventHintDisplay,

    /** 教程链进行中时供大地图等展示「教程 current/max」（与 `isTutorial` 同条件） */
    tutorialExploreStep:
      tutorialChainMaxLevel > 0 && tutorialChainCompleted < tutorialChainMaxLevel
        ? {
            current: Math.min(tutorialChainCompleted + 1, tutorialChainMaxLevel),
            max: tutorialChainMaxLevel,
          }
        : null,

    isTutorial,
    showLineupGuide,
    needsLineupFirst,
    positionAnimation,
  };
}
