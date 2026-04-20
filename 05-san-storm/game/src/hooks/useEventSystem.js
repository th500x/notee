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
import { useExploreQuota } from '@/hooks/useExploreQuota';
import { PHASE, FORTUNE_LEVELS } from '@/components/event/EventConstants';
import {
  pickRandomEvent,
  isFortuneSuccess,
  filterExploreEventsPool,
  getExploreOptionResolution,
  eventSkipsExploreQuota,
  getEffectiveExploreChainMaxCompleted,
  TUTORIAL_EXPLORE_CHAIN_ID,
} from '@/components/event/eventUtils';
import { validateMainLineupBattleGate } from '@/utils/mainLineupTroops';
import { resolveEventLocationForUi } from '@/utils/eventLocationPlaceholders';
import {
  EVENT_PUNISHMENT_COMBAT_BANDIT_LOCATION_SLOT_RARITIES,
  isBanditMapObjectId,
} from '@shared/utils/smallMapEnemyRoster.js';
import { strategicExploreReopenBridge } from '@/utils/strategicExploreReopenBridge.js';
import {
  resolveExploreAnchorCityIdFromPlayerRoad,
  resolveExploreAnchorCityIdFromStrategicGrid,
} from '@/utils/resolveExploreAnchorCityId.js';

function pendingMapEventHintStorageKey(playerId) {
  const id = playerId != null ? String(playerId).trim() : '';
  return id ? `pending_map_event_hint_${id}` : null;
}

/** 与大地图探索、荒郊/集市内嵌条、匪寨格共用的配置池；勿只拉 explore（荒郊/集市在库中为 wilderness / market） */
const EXPLORE_RELATED_TRIGGER_CONTEXTS = ['explore', 'wilderness', 'market', 'mystery', 'tutorial'];

/**
 * 将 PlayerContext 的 player 数据（×10存储）转为显示值（个位数）
 * 与 ExploreDemo 的 MOCK_PLAYER 格式一致
 */
function toDisplayAttrs(player) {
  if (!player) return null;
  return {
    name: player.character_name,
    luck:         player.luck / 10,
    courage:      player.courage / 10,
    command:      player.command / 10,
    combat:       player.combat / 10,
    intelligence: player.intelligence / 10,
    politics:     player.politics / 10,
    charm:        player.charm / 10,
  };
}

/**
 * 从 cards 中提取已装备的将领配置属性（显示值）
 * 将领卡的 config 中属性已经是 camelCase 且已÷10（由后端 formatCharacterData 处理）
 * 如果将领卡尚未实装配置关联，使用默认值
 */
function getEquippedGenerals(cards) {
  if (!cards || cards.length === 0) return [];
  // 筛选已装备的将领卡
  const equipped = cards.filter(c => c.card_type === 'character' && c.is_equipped);
  return equipped.map(c => {
    const cfg = c.config;
    if (cfg) {
      return {
        name: cfg.name || '将领',
        luck:         cfg.luck ?? 5.0,
        courage:      cfg.courage ?? 5.0,
        command:      cfg.command ?? 5.0,
        combat:       cfg.combat ?? 5.0,
        intelligence: cfg.intelligence ?? 5.0,
        politics:     cfg.politics ?? 5.0,
        charm:        cfg.charm ?? 5.0,
      };
    }
    // 无配置时使用默认值
    return {
      name: '未知将领',
      luck: 5.0, courage: 5.0, command: 5.0, combat: 5.0,
      intelligence: 5.0, politics: 5.0, charm: 5.0,
    };
  });
}

// 默认将领（当玩家未装备将领时使用）
const DEFAULT_GENERAL = {
  name: '无将领',
  luck: 5.0, courage: 5.0, command: 5.0, combat: 5.0,
  intelligence: 5.0, politics: 5.0, charm: 5.0,
};

/**
 * @param {{ tutorialAutoplay?: boolean, persistMapEventHint?: boolean, exploreAnchorGridRef?: { current: null | { cells: unknown[][], mapColumns: number, mapRows: number, countyCityRows?: object[] } }, exploreAnchorGridSeq?: number }} [options] — 仅大地图挂载时应为 true，用于教程链 IDLE 自动开事件；探索 Tab 等第二实例勿开，避免双轨。
 */
export default function useEventSystem(player, cards, options = {}) {
  const tutorialAutoplay = options.tutorialAutoplay === true;
  const persistMapEventHint = options.persistMapEventHint === true;
  const exploreAnchorGridRef = options.exploreAnchorGridRef;
  const exploreAnchorGridSeq = options.exploreAnchorGridSeq ?? 0;
  const quota = useExploreQuota(player?.player_id);

  // 事件数据（全量）
  const [allExploreEvents, setAllExploreEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  // 玩家事件进度 { eventId: { status, ... } }
  const [completedEvents, setCompletedEvents] = useState({});
  /**
   * 首次 GET /events/explore 落位前为 false：此时 `completedEvents` 仍是初始 `{}`，若 `allExploreEvents` 已加载，
   * `getEffectiveExploreChainMaxCompleted` 会把教程链算成未推进，池里误含 1001，`tutorialAutoplay` 会抢先开局（刷新后重复链首）。
   */
  const [exploreProgressReady, setExploreProgressReady] = useState(false);
  /** 服务端 `explore_session_lock`：链式探索/教程独占会话（跨设备）；见 PATCH …/events/explore/session-lock */
  const [exploreSessionLock, setExploreSessionLock] = useState(null);

  /** 背包道具数量 { item_id: qty }，用于事件链 required_items 过滤（链1 选 B 无道具则不得抽链2） */
  const [playerItemCounts, setPlayerItemCounts] = useState({});

  // 道具名称映射 { item_id → item_name }
  const [itemNameMap, setItemNameMap] = useState({});

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

  // 未完成的事件（关闭对话框后保留，下次探索复用）
  // 持久化到 localStorage，防止刷新页面刷事件
  const pendingKey = player?.player_id ? `pending_event_${player.player_id}` : null;
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

  // player 加载后从 localStorage 恢复 pendingEvent
  // 如果检测到事件进行中（选了选项但未完成），视为失败：清除事件，次数不退还
  useEffect(() => {
    if (!pendingKey) return;
    const inProgress = localStorage.getItem(pendingKey + '_inprogress');
    if (inProgress) {
      // 事件进行中刷新 → 失败处理
      localStorage.removeItem(pendingKey + '_inprogress');
      localStorage.removeItem(pendingKey);
      setPendingEventRaw(null);
      console.warn('[useEventSystem] 检测到未完成事件，视为失败处理');
      return;
    }
    try {
      const saved = localStorage.getItem(pendingKey);
      if (saved) setPendingEventRaw(JSON.parse(saved));
    } catch { /* ignore */ }
  }, [pendingKey]);

  // 后端实际发放的奖励详情（含随机卡牌的实际cardId）
  const [rewardDetails, setRewardDetails] = useState(null);
  /** 教程链官职授予短期遮罩 */
  const [positionAnimation, setPositionAnimation] = useState(null);
  // 后端响应缓存（骰子动画期间存储，动画结束后读取）
  const pendingRewardResponse = useRef(null);
  /** 教程 IDLE 自动 startExplore 失败（池为空等）时避免死循环 */
  const tutorialExploreBlockedRef = useRef(false);

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
    () => getEffectiveExploreChainMaxCompleted(
      allExploreEvents,
      TUTORIAL_EXPLORE_CHAIN_ID,
      completedEvents,
      playerItemCounts
    ),
    [allExploreEvents, completedEvents, playerItemCounts]
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
    return cards.some((c) => c.card_type === 'troop' && c.is_equipped);
  }, [cards]);

  /** 已完成 2 环时下一环为指引叁（chain_level 3），未装部队则拦截自动开局并显示引导 */
  const needsLineupFirst =
    isTutorial &&
    tutorialChainCompleted === 2 &&
    !hasEquippedLineup;
  const showLineupGuide = needsLineupFirst && phase === PHASE.IDLE;

  // 从 API 合并加载探索相关事件（荒郊/集市/匪寨与 explore 分 trigger_context，单拉 explore 会导致池恒为空）
  useEffect(() => {
    let cancelled = false;
    const base = API_CONFIG.BASE_URL;
    Promise.all(
      EXPLORE_RELATED_TRIGGER_CONTEXTS.map((ctx) =>
        fetch(`${base}/config/events?triggerContext=${encodeURIComponent(ctx)}`)
          .then((r) => r.json())
          .catch(() => ({ success: false, events: [] }))
      )
    )
      .then((results) => {
        if (cancelled) return;
        const byId = new Map();
        for (const data of results) {
          if (!data?.success || !Array.isArray(data.events)) continue;
          for (const e of data.events) {
            if (e?.event_id) byId.set(e.event_id, e);
          }
        }
        setAllExploreEvents(Array.from(byId.values()));
        const anySuccess = results.some((d) => d?.success);
        if (!anySuccess) {
          const msg = results.find((d) => d?.message)?.message;
          console.error('[useEventSystem] 加载事件失败:', msg || '全部请求失败');
        }
      })
      .catch((err) => {
        if (!cancelled) console.error('[useEventSystem] 请求事件API失败:', err);
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const refetchExploreProgress = useCallback(async () => {
    if (!player?.player_id) return null;
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/players/${player.player_id}/events/explore`);
      const data = await res.json();
      if (data.success) {
        const ev = data.data.events || {};
        setCompletedEvents(ev);
        setExploreSessionLock(data.data.sessionLock ?? null);
        return ev;
      }
    } catch (err) {
      console.error('[useEventSystem] 加载事件进度失败:', err);
    }
    return null;
  }, [player?.player_id]);

  // 加载玩家事件进度；切换角色时先置「未就绪」避免用空进度抽池
  useEffect(() => {
    if (!player?.player_id) {
      setExploreProgressReady(false);
      return undefined;
    }
    setExploreProgressReady(false);
    let cancelled = false;
    (async () => {
      try {
        await refetchExploreProgress();
      } finally {
        if (!cancelled) setExploreProgressReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [player?.player_id, refetchExploreProgress]);

  // 同步背包道具（探索池过滤链式事件用）
  useEffect(() => {
    if (!player?.player_id) {
      setPlayerItemCounts({});
      return;
    }
    fetch(`${API_CONFIG.BASE_URL}/players/${player.player_id}/items`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.items) {
          const m = {};
          for (const it of d.data.items) {
            if (it.itemId && it.quantity > 0) m[it.itemId] = it.quantity;
          }
          setPlayerItemCounts(m);
        }
      })
      .catch(() => {});
  }, [player?.player_id]);

  /** 城市列表：解析 location 占位符（含 {city_medium_wilderness} 等）、探索池与 exploreLocationMatchesEvent 对齐 */
  const [citiesList, setCitiesList] = useState([]);
  useEffect(() => {
    fetch(`${API_CONFIG.BASE_URL}/cities?season=san_1`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.cities) setCitiesList(d.cities);
      })
      .catch(() => {});
  }, []);

  /**
   * 当前探索锚点 `city_id`：
   * - 事件进行中由本局已选 `startExplore(override)` 保持，不随地图移动被冲掉；
   * - **IDLE** 时以 `road_*` + `cities` 库坐标解析的立足城为准（M2 按位置抽池），随移动/回城更新。
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
    if (!anchor) return;
    setExploreLocationId((prev) => {
      const p = prev != null ? String(prev).trim() : '';
      if (p === anchor) return prev;
      return anchor;
    });
  }, [
    phase,
    player?.road_jun_id,
    player?.road_position_x,
    player?.road_position_y,
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
    const k = pendingMapEventHintStorageKey(player?.player_id);
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
  }, [persistMapEventHint, player?.player_id]);

  // 仅在有文案时写入；不在此处 removeItem——否则首帧 pending 仍为 null 时会在 layout  hydrate 之前误删 session（刷新/Strict 双挂载后指引丢失）。
  useEffect(() => {
    if (!persistMapEventHint) return;
    const k = pendingMapEventHintStorageKey(player?.player_id);
    if (!k) return;
    const t = pendingMapEventHint && String(pendingMapEventHint).trim();
    if (!t) return;
    try {
      sessionStorage.setItem(k, t);
    } catch {
      /* ignore */
    }
  }, [persistMapEventHint, player?.player_id, pendingMapEventHint]);

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

  // 加载道具名称映射
  useEffect(() => {
    fetch(`${API_CONFIG.BASE_URL}/config/items`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.items) {
          const map = {};
          data.items.forEach(i => { map[i.item_id] = i.item_name; });
          setItemNameMap(map);
        }
      })
      .catch(err => console.error('[useEventSystem] 加载道具配置失败:', err));
  }, []);

  const resolvedEventLocation = useMemo(() => {
    if (!currentEvent?.location) {
      return { displayLocationId: '', cityName: '', isPlaceholder: false };
    }
    const seed = `${player?.player_id || ''}:${currentEvent.event_id}:${currentEvent.location}`;
    return resolveEventLocationForUi(currentEvent.location, citiesList, seed);
  }, [currentEvent, citiesList, player?.player_id]);

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
    if (!eventSkipsExploreQuota(raw) && !quota.canExplore) return false;

    const { explore_anchor_city_id: _a, explore_subsidiary_kind: _k, ...eventCore } = raw;
    const event = {
      ...eventCore,
      explore_anchor_city_id: locIdNorm,
      explore_subsidiary_kind: subsidiaryKind,
    };

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
  ]);

  /** 探索结算 RETURNING→IDLE：先拉库内 explore_events，再用快照抽下一环（避免教程 autoplay 抢在 setState 前重复链首） */
  const prevPhaseForExploreRef = useRef(phase);
  useEffect(() => {
    const prev = prevPhaseForExploreRef.current;
    prevPhaseForExploreRef.current = phase;
    if (prev !== PHASE.RETURNING || phase !== PHASE.IDLE || !player?.player_id) return undefined;

    let cancelled = false;
    (async () => {
      const serverEv = await refetchExploreProgress();
      if (cancelled) return;
      tutorialDeferExploreAutoplayRef.current = false;
      if (!tutorialAutoplay || !isTutorial || eventsLoading || needsLineupFirst) return;
      if (tutorialExploreBlockedRef.current) return;
      if (serverEv == null) return;
      let countsFresh = null;
      try {
        const ir = await fetch(`${API_CONFIG.BASE_URL}/players/${player.player_id}/items`);
        const idata = await ir.json();
        if (idata.success && idata.data?.items) {
          const m = {};
          for (const it of idata.data.items) {
            if (it.itemId && it.quantity > 0) m[it.itemId] = it.quantity;
          }
          countsFresh = m;
          if (!cancelled) setPlayerItemCounts(m);
        }
      } catch {
        /* 背包拉取失败则仍用 state 内 counts */
      }
      if (cancelled) return;
      const ok = startExplore(undefined, undefined, serverEv, countsFresh ?? undefined);
      if (ok === false) tutorialExploreBlockedRef.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, [
    phase,
    player?.player_id,
    refetchExploreProgress,
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
   * 教程自动探索在池空或配额不足时会 `tutorialExploreBlockedRef = true`。
   * - 空 → 非空：首次有锚点，允许重试（原逻辑）。
   * - 非空 A → 非空 B：换城后池可能从中空变为有（例链 2 仅 `{city_medium}`），须解除 block，否则会卡死在黄条「请前往中城」。
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
    if (prevNorm !== '' && nowNorm !== '' && prevNorm !== nowNorm) {
      tutorialExploreBlockedRef.current = false;
    }
  }, [exploreLocationId]);

  useEffect(() => {
    if (!tutorialAutoplay || !isTutorial || phase !== PHASE.IDLE || eventsLoading || needsLineupFirst) return;
    if (!exploreProgressReady) return;
    if (tutorialDeferExploreAutoplayRef.current) return;
    if (tutorialExploreBlockedRef.current) return;
    const ok = startExplore();
    if (ok === false) tutorialExploreBlockedRef.current = true;
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
  ]);

  // 关闭事件对话框（未选择选项，不消耗次数）
  const closeEvent = useCallback(() => {
    tutorialExploreBlockedRef.current = false;
    strategicExploreReopenBridge.clear();
    setPhase(PHASE.IDLE);
    setCurrentEvent(null);
  }, []);

  // 请求后端发放奖励（统一入口）
  const requestRewards = useCallback((optKey, extraBody = {}) => {
    if (!currentEvent || !player?.player_id) return Promise.resolve(null);
    const body = {
      eventId: currentEvent.event_id,
      optionKey: optKey,
      playerAttrs,
      general1Attrs: general1,
      general2Attrs: general2,
      ...extraBody,
    };
    return fetch(`${API_CONFIG.BASE_URL}/players/${player.player_id}/rewards`, {
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
      console.error('[useEventSystem] 奖励发放失败:', data?.error);
      const err = data?.error || '';
      const isDup = err.includes('已完成') || err.includes('重复');
      if (isDup) {
        console.log('[useEventSystem] 事件已完成或重复领取，跳过并退还探索次数');
        if (!eventSkipsExploreQuota(currentEvent)) quota.refund();
        refetchExploreProgress();
        setCurrentEvent(null);
        setPendingEvent(null);
        setChosenOption(null);
        setChosenOptionKey(null);
        setRewardDetails(null);
        setFortune(null);
        setMinigameInfo(null);
        setBattleResult(null);
        setBattleSilverSpent(0);
        setBattleScore(null);
        setBattleChestRewards([]);
        if (pendingKey) localStorage.removeItem(pendingKey + '_inprogress');
        setPhase(PHASE.IDLE);
        return false;
      }
      if (!eventSkipsExploreQuota(currentEvent)) quota.refund();
      setRewardDetails({ rewards: [], bonusRewards: [] });
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
      if (pendingKey) localStorage.removeItem(pendingKey + '_inprogress');
      setPhase(PHASE.IDLE);
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
    });
    if (player?.player_id) {
      fetch(`${API_CONFIG.BASE_URL}/players/${player.player_id}/items`)
        .then(r => r.json())
        .then(d => {
          if (d.success && d.data?.items) {
            const m = {};
            for (const it of d.data.items) {
              if (it.itemId && it.quantity > 0) m[it.itemId] = it.quantity;
            }
            setPlayerItemCounts(m);
          }
        })
        .catch(() => {});
      // 与后端 /rewards 写入 explore_events 同步，避免关面板前本地进度滞后仍抽到链上一环
      refetchExploreProgress();
    }
    return true;
  }, [quota, setPendingEvent, pendingKey, player?.player_id, refetchExploreProgress, currentEvent]);

  // 选择选项
  const chooseOption = useCallback((option, optionKey) => {
    if (!eventSkipsExploreQuota(currentEvent)) quota.consume();
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
  }, [quota, requestRewards, applyRewardResponse, pendingKey, currentEvent]);

  const dismissBattleEntryBlocked = useCallback(() => setBattleEntryBlockedMessage(null), []);

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

    if (ev && optKey && player?.player_id) {
      try {
        await fetch(`${API_CONFIG.BASE_URL}/players/${player.player_id}/events`, {
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
      } catch (err2) {
        console.error('[useEventSystem] 记录事件进度失败:', err2);
      }
    }

    let nextMapEventHint = null;
    if (ev) {
      const h = ev.event_hint ?? ev.eventHint;
      nextMapEventHint = typeof h === 'string' && h.trim() ? h.trim() : null;
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

    if (persistMapEventHint && player?.player_id) {
      try {
        const k = pendingMapEventHintStorageKey(player.player_id);
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
    if (pendingKey) localStorage.removeItem(pendingKey + '_inprogress');

    if (tutorialPosAnim) {
      setPositionAnimation(positionDetail);
      setTimeout(() => {
        setPositionAnimation(null);
        setPhase(PHASE.IDLE);
      }, 1000);
    } else {
      setTimeout(() => setPhase(PHASE.IDLE), 1000);
    }
  }, [currentEvent, chosenOptionKey, player?.player_id, rewardDetails, pendingKey, setPendingEvent, persistMapEventHint]);

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
    playerId: player?.player_id || null,
    battleEntryBlockedMessage,
    dismissBattleEntryBlocked,

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
    /** 战略荒郊 tooltip 等与 `filterExploreEventsPool` 共用，解析 `city_type` 展示 13-1 荒郊稀有度区间 */
    citiesList,

    /** 服务端会话锁 JSON；新开探索/教程链前可依此禁止并行（PATCH 写入见 playerApi.patchExploreSessionLock） */
    exploreSessionLock,

    /** 完成探索事件后在大地图展示的下一步提示（来自事件 `event_hint`） */
    pendingMapEventHint,

    isTutorial,
    showLineupGuide,
    needsLineupFirst,
    positionAnimation,
  };
}
