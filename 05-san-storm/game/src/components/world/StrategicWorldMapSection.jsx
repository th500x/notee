import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import WorldStrategicMapGrid from './WorldStrategicMapGrid';
import ZhouJunMapJumpPanel from '@/components/game/ZhouJunMapJumpPanel';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { toCharCardData } from '@/utils/cardDataTransforms';
import {
  resolveStrategicRecordedStandpointPx,
  resolveStrategicRecordedStandpointCell,
  strategicRoadCellCenterPx,
} from '@/utils/strategicMapCityAnchor';
import { resolveStrategicTileCityCover } from '@/utils/strategicMapTileContext';
import {
  collectBanditAnchorCellsByJunFromWorldGrid,
  findNearestFactionMajorMediumCityStrategicCell,
  pickNearestBanditStrategicCellInJun,
} from '@/utils/strategicMapProgressLocate';
import './WorldStrategicMap.css';
import {
  generateYingchuanCountyMergedSimulated,
  YINGCHUAN_COUNTY_MAP_COLS,
  YINGCHUAN_COUNTY_MAP_ROWS,
} from '@shared/utils/junCountyMapGenerator';
import { ensureYingchuanMergedMapCells, getPhase1BanditPoiIdsForJun } from '@shared/utils/strategicBanditPlaceholderPhase1.js';
import { useStrategicCountyCityRuntime } from '@/hooks/useStrategicCountyCityRuntime';
import { useSiegeQuota } from '@/hooks/useSiegeQuota';
import { useStrategicJunBanditRaidQuotas } from '@/hooks/useStrategicJunBanditRaidQuotas';
import { API_CONFIG } from '@/constants';
import { fetchWithTimeout } from '@/services/httpClient';
import { useStrategicMapNavigation } from '@/contexts/StrategicMapNavigationContext';
import { playerAPI } from '@/services/playerApi';
import {
  buildMarchPath,
  buildMarchPathToPoi,
  estimateMarchFoodCost,
} from '@/utils/strategicRoadMarchPath';
import {
  canPlayerMarchToPoiCity,
  collectStrategicPoiFootprint,
  buildStrategicPoiFootprintFromDbCityRow,
  resolveMergedStandpointStrategicPoiAnchorId,
} from '@shared/utils/strategicMarchPoi.js';
import { readStrategicCellAnchorId } from '@shared/utils/strategicCellAnchorId.js';
import {
  findActiveRoadEncounterLockOnCell,
  isPlayerRoadEncounterParticipant,
} from '@shared/utils/roadEncounterLockPassage.js';
import StrategicMarchMoveConfirm from './StrategicMarchMoveConfirm';
import { buildStrategicRoadStackStripForFocal, roadCellStackKey } from '@/utils/strategicRoadStackStrip';
import {
  buildSan1YuVerticalStackFromMergedPayloads,
  stackWorldGyFromLocalJunRow,
  stackLocalJunRowFromWorldGy,
  stackWorldRowOffsetForJunId,
  SAN_1_STRATEGIC_VERTICAL_STACK_JUN_ORDER,
  STRATEGIC_COUNTY_MAP_ROWS,
} from '@shared/utils/strategicWorldMapStack.js';

/** 合并图缺 `seed` 时勿卡「加载中」：`buildCampaignVisualVariants` 已用 `Number(seed)||0`；此处与之一致 */
function normalizeMergedMapSeed(data) {
  if (!data || typeof data !== 'object') return 0;
  if (data.seed != null && data.seed !== '') {
    const n = Number(data.seed);
    return Number.isFinite(n) ? n : 0;
  }
  if (data.version != null && data.version !== '') {
    const n = Number(data.version);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** 道路移动成功后跳跳棋逐格回放（31-6 §9.1）；纯前端、不额外请求 */
const MARCH_ANIM_MS_PER_STEP = 200;

/**
 * `road/move` 成功后的提示：遭遇战优先；否则守方被门闸击退时给说明；默认成功。
 * @param {object} p
 * @param {object|null|undefined} p.encounter
 * @param {unknown} p.defenderAutoRetreats
 * @param {(enc: object) => void|Promise<void>} [p.onRoadEncounterBattle]
 * @param {(t: { type: string, message: string }) => void} p.setMarchToast
 */
function showRoadMarchMoveFinishToast({ encounter, defenderAutoRetreats, onRoadEncounterBattle, setMarchToast }) {
  if (encounter?.encounterId) {
    if (typeof onRoadEncounterBattle === 'function') {
      void onRoadEncounterBattle(encounter);
    } else {
      setMarchToast({
        type: 'info',
        message: `已触发道路遭遇：${encounter.encounterId}。请完成战斗后走战后解锁（resolve-encounter）。`,
      });
    }
    return;
  }
  if (Array.isArray(defenderAutoRetreats) && defenderAutoRetreats.length > 0) {
    setMarchToast({
      type: 'info',
      message: '对格玩家未达开战兵力或粮草要求，已退回本郡内最近的己方城池。',
    });
    return;
  }
  setMarchToast({ type: 'success', message: '移动已完成' });
}

/**
 * @param {boolean} onRoadAtStart
 * @param {{ x: number, y: number }[]} fullPath
 * @param {number} stepsApplied
 */
function buildMarchAnimPath(onRoadAtStart, fullPath, stepsApplied) {
  if (!fullPath?.length) return [];
  const n = Number(stepsApplied);
  const sa = Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : fullPath.length;
  if (onRoadAtStart) {
    return fullPath.slice(0, Math.min(fullPath.length, sa + 1));
  }
  return fullPath.slice(0, Math.min(fullPath.length, sa));
}

/** 已装备部队卡：当前兵力合计 / 上限合计（与披挂口径一致） */
/** 大地图本人头像（与 `strategicSelfPawn` 一致：character1 装备立绘优先） */
function resolveSelfMapPortraitUrl(ctxPlayer, ctxCards, attributeBonusBySlot) {
  const characterCards = (ctxCards || []).filter((c) => c.card_type === 'character');
  const char1 = characterCards.find(
    (c) => c.equipped_by === 'character1' && c.is_equipped && c.equipped_slot === 'character',
  );
  let portraitUrl = ctxPlayer?.avatar || null;
  if (char1) {
    const bonus = attributeBonusBySlot?.character1 || {};
    const cd = toCharCardData(char1, bonus);
    if (cd.avatar) portraitUrl = cd.avatar;
  }
  return portraitUrl;
}

function sumEquippedTroopStrength(cards) {
  let current = 0;
  let max = 0;
  for (const c of cards || []) {
    if (c?.card_type !== 'troop' || !c?.is_equipped) continue;
    const cfgMax = Number(c.config?.maxTroops) || 0;
    const bonus = Number(c.bonus_max_troops) || 0;
    const cap = cfgMax + bonus;
    max += cap;
    const raw = c.current_troops;
    const cur = raw != null && raw !== '' ? Number(raw) : cap;
    current += Number.isFinite(cur) ? cur : cap;
  }
  return { current, max };
}

/** 与战术图 BattleMap.css：`--tile: 48px`；窄屏 `(100vw - 61px) / 8` */
export const WORLD_MAP_TILE_MIN = 12;
export const WORLD_MAP_TILE_MAX = 56;

/**
 * 默认单格边长：对齐战斗地图瓦片视觉（可读性优先，允许滚动查看全图）。
 */
function computeDefaultTilePx() {
  if (typeof window === 'undefined') return 48;
  const w = window.innerWidth;
  const availW = Math.max(280, w - 16);
  const battleRef =
    w >= 521 ? 48 : Math.min(48, Math.max(26, Math.floor((availW - 61) / 8)));
  return Math.min(WORLD_MAP_TILE_MAX, Math.max(22, battleRef));
}

/**
 * 游戏主界面战略大地图：S1 豫州颍川 + 汝南垂直拼接为单视口（`shared/utils/strategicWorldMapStack`），与 `*_merged.json` 及 `road_jun_id` 郡内坐标对齐。
 */
export default function StrategicWorldMapSection({
  className = '',
  /** 由 `WorldMap` 注入：`{ current: () => void }`，用于守方道路坐标被服务端改写后立即 bump `road-presence` */
  bumpStrategicRoadPresenceRef = null,
  playerId = null,
  playerFactionId = null,
  siegeLoading = false,
  onStartSiegeForCity = null,
  /** 道路遭遇触发后由 `WorldMap` 拉取开战数据并打开 BattleArena */
  onRoadEncounterBattle = null,
  garrisonStatsRefreshKey = 0,
  playerOnDuty = false,
  playerOnDutyCityId = null,
  onOpenGarrisonForCity = null,
  onToggleDutyForCity = null,
  onDutyError = null,
  subsidiaryExploreEmbed = null,
  playerMainCityId = null,
  playerMainCityChangedAt = null,
  playerSilver = null,
  onSetMainCityRequest = null,
  onSetMainCityError = null,
  onOpenBarracksPost = null,
  onOpenSanGongFu = null,
  /** 城名着色：盟友 `faction_id`（`Set` 或数组）；结盟/外交接入后由上层传入 */
  strategicCityLabelAllyFactionIds = null,
  /** 城名着色：非敌对 `faction_id` */
  strategicCityLabelNonHostileFactionIds = null,
  /** 大地图全屏浮层（三公府等）是否打开：`WorldMap` 注入，用于收起格上网格 tooltip */
  strategicFullScreenOverlayOpen = false,
  /** 攻城/探索战斗等：`WorldMap` 注入，为 true 时不渲染 event_hint portal（避免压住战场/弹窗） */
  strategicMapEventHintSuppressed = false,
  /** 探索结算后指引文案（`event_hint`）；锚在本人路点漫画对白框 */
  pendingMapEventHint = null,
  /** 向 `useEventSystem` 提交战略格网上下文，用于 `exploreLocationId` 与城 POI footprint 内落格对齐（`{city_*}` 等到城才匹配） */
  onExploreAnchorGridContext = null,
  /** 匪寨：战略 tooltip 内扣次成功后由 `WorldMap` 打开小型图战斗 */
  onStartBanditRaid = null,
  /** 不可开战时的说明（与攻城 `phase` / `siegeData` 门闸一致） */
  banditRaidStartBlockedReason = null,
  /** 匪寨战后 bump，`WorldMapCityInfoBlock` 内拉取最新攻打次数与层进度 */
  postBanditRaidRefreshKey = 0,
  /** 教程链进度（`useEventSystem.tutorialExploreStep`）；非教程时为 null */
  strategicTutorialExploreStep = null,
}) {
  const [merged, setMerged] = useState(null);
  const [mapLoadError, setMapLoadError] = useState(null);
  const [garrisonStatsByCityId, setGarrisonStatsByCityId] = useState({});
  /**
   * 郡内他人道路 presence（仅在线 + 锁格），与 31-6 §12.2 / 02 §2.1.2（3）一致。
   * 轮询粒度与现网拉城列表同量级；窗口未聚焦时不轮询以省服。
   */
  const [roadPresence, setRoadPresence] = useState(null);
  /** 供行军成功后立即拉取郡内他人路点（与轮询互补） */
  const roadPresenceFetchRef = useRef(() => Promise.resolve());
  const { player: ctxPlayer, cards: ctxCards, attributeBonusBySlot, refresh, exploreQuota } = usePlayerContext();
  /** 行军模式：与 31-6 §9.3 一致 */
  const [strategicMarchMode, setStrategicMarchMode] = useState(false);
  /** @type {null | { path: Array<{x:number,y:number}>, onRoadAtStart: boolean, preview: object, encounterHint: string|null }} */
  const [marchConfirm, setMarchConfirm] = useState(null);
  const [marchSubmitLoading, setMarchSubmitLoading] = useState(false);
  const [marchSubmitError, setMarchSubmitError] = useState('');
  /** @type {null | { type: 'error'|'info'|'success', message: string }} */
  const [marchToast, setMarchToast] = useState(null);
  /**
   * `road/move` 成功后跳跳棋回放：仅客户端改叠层锚点，播完再 `refresh`。
   * @type {null | { path: Array<{x:number,y:number}>, stepIndex: number, afterRefreshToast: { encounter: object|null, defenderAutoRetreats?: unknown } }}
   */
  const [roadMarchAnimation, setRoadMarchAnimation] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setMerged(null);
    setMapLoadError(null);
    const baseUrl = `${import.meta.env.BASE_URL}`;
    (async () => {
      try {
        const fetchJunMerged = async (jid) => {
          const rel = `data/worldmap/${encodeURIComponent(jid)}_merged.json`;
          const res = await fetch(`${baseUrl}${rel}`, { cache: 'no-store' });
          if (!res.ok) throw new Error(String(res.status));
          return res.json();
        };
        let topJson = null;
        try {
          topJson = await fetchJunMerged('san_1_jun_yingchuan');
        } catch {
          topJson = null;
        }
        if (!topJson?.cells?.length) {
          const fb = generateYingchuanCountyMergedSimulated({});
          topJson = {
            cells: fb.cells,
            seed: fb.seed,
            version: null,
            mapColumns: fb.mapColumns ?? YINGCHUAN_COUNTY_MAP_COLS,
            mapRows: fb.mapRows ?? YINGCHUAN_COUNTY_MAP_ROWS,
            junId: 'san_1_jun_yingchuan',
            season: 'san_1',
            roadCells: null,
            roadConnectivity: '4',
          };
        } else {
          const seedTop = normalizeMergedMapSeed(topJson);
          topJson = {
            ...topJson,
            cells: ensureYingchuanMergedMapCells(topJson.cells, seedTop, {
              roadCells: Array.isArray(topJson.roadCells) ? topJson.roadCells : null,
              mapColumns: topJson.mapColumns ?? YINGCHUAN_COUNTY_MAP_COLS,
              mapRows: topJson.mapRows ?? YINGCHUAN_COUNTY_MAP_ROWS,
            }),
          };
        }
        let bottomJson = null;
        try {
          bottomJson = await fetchJunMerged('san_1_jun_runan');
        } catch {
          bottomJson = null;
        }
        const stack = buildSan1YuVerticalStackFromMergedPayloads({
          yingchuan: topJson,
          runan: bottomJson,
        });
        if (!stack.ok) {
          if (!cancelled) setMapLoadError(stack.error || '大地图拼接失败');
          return;
        }
        if (cancelled) return;
        const seed = normalizeMergedMapSeed(topJson);
        setMerged({
          cells: stack.cells,
          seed,
          version: topJson.version,
          mapColumns: stack.mapColumns,
          mapRows: stack.mapRows,
          junId: 'san_1_strategic_stack_yu',
          season: stack.season,
          roadCells: stack.roadCells,
          roadConnectivity: stack.roadConnectivity,
        });
      } catch (e) {
        if (!cancelled) setMapLoadError(e?.message || '大地图加载失败');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const strategicNav = useStrategicMapNavigation();

  useEffect(() => {
    if (!playerId) {
      setGarrisonStatsByCityId({});
      return undefined;
    }
    let cancelled = false;
    fetchWithTimeout(`${API_CONFIG.BASE_URL}/garrisons/stats/cities`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled || !res?.success) return;
        const m = {};
        for (const s of res.stats || []) {
          if (s?.city_id) m[s.city_id] = s;
        }
        setGarrisonStatsByCityId(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [playerId, garrisonStatsRefreshKey]);

  useEffect(() => {
    if (!playerId || !merged?.season) {
      setRoadPresence(null);
      return undefined;
    }
    let cancelled = false;
    const season = merged.season;
    const runanWorldGyOffset = STRATEGIC_COUNTY_MAP_ROWS;
    const fetchPresence = async () => {
      try {
        const fetchOne = async (jid) => {
          const url = `${API_CONFIG.BASE_URL}/cities/road-presence?season=${encodeURIComponent(season)}&junId=${encodeURIComponent(jid)}&playerId=${encodeURIComponent(playerId)}`;
          const res = await fetchWithTimeout(url, { cache: 'no-store' });
          if (!res.ok) return null;
          const json = await res.json();
          return json?.success ? json.data : null;
        };
        const [p0, p1] = await Promise.all([
          fetchOne(SAN_1_STRATEGIC_VERTICAL_STACK_JUN_ORDER[0]),
          fetchOne(SAN_1_STRATEGIC_VERTICAL_STACK_JUN_ORDER[1]),
        ]);
        if (cancelled) return;
        const j0 = SAN_1_STRATEGIC_VERTICAL_STACK_JUN_ORDER[0];
        const j1 = SAN_1_STRATEGIC_VERTICAL_STACK_JUN_ORDER[1];
        const others = [];
        if (Array.isArray(p0?.others)) {
          for (const o of p0.others) others.push({ ...o, roadJunId: j0 });
        }
        if (Array.isArray(p1?.others)) {
          for (const o of p1.others) others.push({ ...o, roadJunId: j1 });
        }
        const lockedCells = [];
        if (Array.isArray(p0?.lockedCells)) {
          for (const l of p0.lockedCells) lockedCells.push({ ...l });
        }
        if (Array.isArray(p1?.lockedCells)) {
          for (const l of p1.lockedCells) {
            const py = Number(l.positionY ?? l.position_y);
            lockedCells.push({
              ...l,
              ...(Number.isFinite(py)
                ? { positionY: py + runanWorldGyOffset, position_y: py + runanWorldGyOffset }
                : {}),
            });
          }
        }
        setRoadPresence({
          season,
          junId: merged.junId,
          others,
          lockedCells,
        });
      } catch {
        /* 读接口失败静默重试（下一轮 tick） */
      }
    };
    roadPresenceFetchRef.current = fetchPresence;
    fetchPresence();
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      fetchPresence();
    }, 3000);
    const onVis = () => {
      if (document.visibilityState === 'visible') fetchPresence();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      roadPresenceFetchRef.current = () => Promise.resolve();
    };
  }, [playerId, merged?.junId, merged?.season]);

  useEffect(() => {
    const o = bumpStrategicRoadPresenceRef;
    if (!o || typeof o !== 'object') return undefined;
    const bump = () => {
      void roadPresenceFetchRef.current?.();
    };
    o.current = bump;
    return () => {
      if (o.current === bump) o.current = null;
    };
  }, [bumpStrategicRoadPresenceRef]);

  const cols = merged?.mapColumns ?? YINGCHUAN_COUNTY_MAP_COLS;
  const rows = merged?.mapRows ?? YINGCHUAN_COUNTY_MAP_ROWS;
  const cells = merged?.cells;
  const seed = merged ? normalizeMergedMapSeed(merged) : 0;

  const countySeason = merged?.season || 'san_1';
  const cityRuntimeJunIds = useMemo(() => [...SAN_1_STRATEGIC_VERTICAL_STACK_JUN_ORDER], []);
  const playerMarchJunId = useMemo(
    () => String(ctxPlayer?.road_jun_id || 'san_1_jun_yingchuan').trim() || 'san_1_jun_yingchuan',
    [ctxPlayer?.road_jun_id],
  );
  const { cityById, factionNameById } = useStrategicCountyCityRuntime({
    junIds: cityRuntimeJunIds,
    season: countySeason,
    refreshKey: garrisonStatsRefreshKey,
  });

  const countyCityRows = useMemo(() => Object.values(cityById || {}), [cityById]);

  useEffect(() => {
    if (typeof onExploreAnchorGridContext !== 'function') return;
    if (!merged?.cells?.length || !countyCityRows.length) {
      onExploreAnchorGridContext(null);
      return;
    }
    onExploreAnchorGridContext({
      cells: merged.cells,
      mapColumns: cols,
      mapRows: rows,
      countyCityRows,
    });
  }, [merged, cols, rows, countyCityRows, onExploreAnchorGridContext]);

  const mainCityRowFromApi = useMemo(
    () => (playerMainCityId ? cityById?.[playerMainCityId] : null),
    [cityById, playerMainCityId],
  );

  const [tilePx, setTilePx] = useState(() => computeDefaultTilePx());

  useEffect(() => {
    if (cols && rows) setTilePx(computeDefaultTilePx());
  }, [cols, rows]);

  const onWheelZoomSteps = useCallback((steps) => {
    if (steps === 0) return;
    setTilePx((p) => {
      const next = p + steps * 2;
      return Math.min(WORLD_MAP_TILE_MAX, Math.max(WORLD_MAP_TILE_MIN, next));
    });
  }, []);

  /**
   * 自身标记立点（31-6 §12.1）：`resolveStrategicRecordedStandpointPx`（道路格心 / 离路城块心 / 主城块回退）。
   * 其余 UI（圆心末字、悬停 tooltip、兵力合计）与既有设计一致。
   */
  const strategicSelfPawn = useMemo(() => {
    if (!cells?.length) return null;

    let cx = null;
    let cy = null;
    let useRoad = false;
    let fromMarchAnim = false;
    const anim = roadMarchAnimation;
    if (anim?.path?.length) {
      const i = Math.min(anim.stepIndex, anim.path.length - 1);
      const cell = anim.path[i];
      const gx = Number(cell?.x);
      const gy = Number(cell?.y);
      if (Number.isFinite(gx) && Number.isFinite(gy)) {
        ({ cx, cy } = strategicRoadCellCenterPx(gx, gy, tilePx));
        useRoad = true;
        fromMarchAnim = true;
      }
    }
    if (!fromMarchAnim) {
      const prx = Number(ctxPlayer?.road_position_x);
      const pry = Number(ctxPlayer?.road_position_y);
      const worldRy =
        ctxPlayer?.road_jun_id && Number.isFinite(prx) && Number.isFinite(pry)
          ? stackWorldGyFromLocalJunRow(ctxPlayer.road_jun_id, pry)
          : pry;
      const stand = resolveStrategicRecordedStandpointPx({
        cells,
        roadCells: merged?.roadCells,
        mapColumns: cols,
        mapRows: rows,
        countyJunId: playerMarchJunId,
        tilePx,
        playerRoadJunId: ctxPlayer?.road_jun_id,
        roadX: ctxPlayer?.road_position_x,
        roadY: worldRy,
        mainCityId: playerMainCityId,
        citiesInCountyRows: countyCityRows,
        mainCityDbRow: mainCityRowFromApi,
      });
      if (stand.cx == null || stand.cy == null) return null;
      cx = stand.cx;
      cy = stand.cy;
      useRoad = stand.onRoadCell;
    }

    const portraitUrl = resolveSelfMapPortraitUrl(ctxPlayer, ctxCards, attributeBonusBySlot);
    const factionName = String(ctxPlayer?.faction_name || '').trim();
    const charName = String(ctxPlayer?.character_name || '').trim() || '…';
    const displayName = factionName ? `[${factionName}]${charName}` : charName;
    const nameSeq = Array.from(charName);
    const centerGlyph = nameSeq.length ? nameSeq[nameSeq.length - 1] : '…';
    const { current: troopsCurrent, max: troopsMax } = sumEquippedTroopStrength(ctxCards);
    const focalRx = Number(ctxPlayer?.road_position_x);
    const focalRy = Number(ctxPlayer?.road_position_y);
    const strip = buildStrategicRoadStackStripForFocal({
      countyJunId: playerMarchJunId,
      focalPlayerId: playerId,
      focalJunId: playerMarchJunId,
      focalRx,
      focalRy,
      selfPlayerId: playerId,
      selfJunId: playerMarchJunId,
      selfRx: focalRx,
      selfRy: focalRy,
      selfPortraitUrl: portraitUrl,
      selfCharacterName: charName,
      selfDisplayName: displayName,
      othersRows: roadPresence?.others,
    });
    return {
      cx,
      cy,
      portraitUrl,
      displayName,
      centerGlyph,
      troopsCurrent,
      troopsMax,
      roadIntercept: ctxPlayer?.road_intercept ? 1 : 0,
      pawnPlayerId: playerId || null,
      playerSilver: Number.isFinite(Number(ctxPlayer?.silver)) ? Number(ctxPlayer.silver) : null,
      onRoad: useRoad,
      stackStripPeers: strip.stripPeers,
      stackStripEllipsis: strip.showEllipsis,
    };
  }, [
    playerId,
    playerMainCityId,
    cells,
    merged?.roadCells,
    cols,
    rows,
    tilePx,
    ctxCards,
    ctxPlayer,
    attributeBonusBySlot,
    playerMarchJunId,
    roadMarchAnimation,
    roadPresence?.others,
    countyCityRows,
    mainCityRowFromApi,
  ]);

  /** 「我在哪」：与本人 pawn 同锚点（行军动画中跟当前回放格）。 */
  const locateSelfStrategicCell = useCallback(() => {
    if (!cells?.length) return null;
    const anim = roadMarchAnimation;
    if (anim?.path?.length) {
      const i = Math.min(anim.stepIndex, anim.path.length - 1);
      const cell = anim.path[i];
      const gx = Number(cell?.x);
      const gy = Number(cell?.y);
      if (Number.isFinite(gx) && Number.isFinite(gy)) return { gx, gy };
    }
    const prx = Number(ctxPlayer?.road_position_x);
    const pry = Number(ctxPlayer?.road_position_y);
    const worldRy =
      ctxPlayer?.road_jun_id && Number.isFinite(prx) && Number.isFinite(pry)
        ? stackWorldGyFromLocalJunRow(ctxPlayer.road_jun_id, pry)
        : pry;
    return resolveStrategicRecordedStandpointCell({
      cells,
      roadCells: merged?.roadCells,
      mapColumns: cols,
      mapRows: rows,
      countyJunId: playerMarchJunId,
      playerRoadJunId: ctxPlayer?.road_jun_id,
      roadX: ctxPlayer?.road_position_x,
      roadY: worldRy,
      mainCityId: playerMainCityId,
      citiesInCountyRows: countyCityRows,
      mainCityDbRow: mainCityRowFromApi,
    });
  }, [
    cells,
    roadMarchAnimation,
    merged?.roadCells,
    cols,
    rows,
    playerMarchJunId,
    ctxPlayer?.road_jun_id,
    ctxPlayer?.road_position_x,
    ctxPlayer?.road_position_y,
    playerMainCityId,
    countyCityRows,
    mainCityRowFromApi,
  ]);

  /**
   * 战略浏览：城/寨交互须与 **库内路点** 一致——立于 **POI 占地块内**（`road_position` 非道路格网键）；
   * 与 `resolveMergedStandpointStrategicPoiAnchorId` 对齐。行军逐格动画中以 **当前回放格** 为准。
   */
  const playerStandingPoiAnchorId = useMemo(() => {
    if (!cells?.length) return '';
    const anim = roadMarchAnimation;
    if (anim?.path?.length) {
      const i = Math.min(anim.stepIndex, anim.path.length - 1);
      const cell = anim.path[i];
      const gx = Number(cell?.x);
      const gy = Number(cell?.y);
      if (Number.isFinite(gx) && Number.isFinite(gy)) {
        return resolveMergedStandpointStrategicPoiAnchorId(
          cells,
          merged?.roadCells,
          cols,
          rows,
          gx,
          gy,
          countyCityRows,
        );
      }
    }
    const prx = Number(ctxPlayer?.road_position_x);
    const pry = Number(ctxPlayer?.road_position_y);
    const worldRy =
      ctxPlayer?.road_jun_id && Number.isFinite(prx) && Number.isFinite(pry)
        ? stackWorldGyFromLocalJunRow(ctxPlayer.road_jun_id, pry)
        : pry;
    if (!Number.isFinite(prx) || !Number.isFinite(worldRy)) return '';
    return resolveMergedStandpointStrategicPoiAnchorId(
      cells,
      merged?.roadCells,
      cols,
      rows,
      prx,
      worldRy,
      countyCityRows,
    );
  }, [
    cells,
    merged?.roadCells,
    cols,
    rows,
    countyCityRows,
    roadMarchAnimation,
    ctxPlayer?.road_jun_id,
    ctxPlayer?.road_position_x,
    ctxPlayer?.road_position_y,
  ]);

  /** 首次进入大地图：视口滚至本人锚点（主城块或道路格）；路网加载完成后异步就绪即可触发一次 */
  const didInitialViewportScrollRef = useRef(false);
  useEffect(() => {
    if (didInitialViewportScrollRef.current) return;
    if (!strategicNav?.scrollToStrategicCell) return;
    const cell = locateSelfStrategicCell();
    if (!cell || !Number.isFinite(cell.gx) || !Number.isFinite(cell.gy)) return;
    didInitialViewportScrollRef.current = true;
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        strategicNav.scrollToStrategicCell(cell.gx, cell.gy);
      });
    });
  }, [strategicNav, locateSelfStrategicCell]);

  const siegeQuotaProgress = useSiegeQuota(playerId, playerMainCityId);
  const banditJunRaidQuotas = useStrategicJunBanditRaidQuotas(playerId, cityRuntimeJunIds, postBanditRaidRefreshKey);

  const banditAnchorCellsByJun = useMemo(
    () => collectBanditAnchorCellsByJunFromWorldGrid(cells),
    [cells],
  );

  const scrollStrategicCellNow = useCallback(
    (gx, gy) => {
      if (!strategicNav?.scrollToStrategicCell) return false;
      if (!Number.isFinite(gx) || !Number.isFinite(gy)) return false;
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      queueMicrotask(() => {
        requestAnimationFrame(() => {
          strategicNav.scrollToStrategicCell(gx, gy);
        });
      });
      return true;
    },
    [strategicNav],
  );

  const requestExploreProgressLocate = useCallback(() => {
    if (!strategicNav?.scrollToStrategicCell) return '地图未就绪';
    const ref = locateSelfStrategicCell();
    if (!ref || !Number.isFinite(ref.gx) || !Number.isFinite(ref.gy)) {
      return '暂无位置（请确认已设主城或在当前郡道路上）';
    }
    const cell = findNearestFactionMajorMediumCityStrategicCell(countyCityRows, playerFactionId, ref);
    if (!cell) return '暂无己方中/大城可定位';
    scrollStrategicCellNow(cell.gx, cell.gy);
    return null;
  }, [strategicNav, locateSelfStrategicCell, countyCityRows, playerFactionId, scrollStrategicCellNow]);

  const requestBanditProgressLocate = useCallback(
    (junId) => {
      if (!strategicNav?.scrollToStrategicCell) return '地图未就绪';
      const ref = locateSelfStrategicCell();
      if (!ref || !Number.isFinite(ref.gx) || !Number.isFinite(ref.gy)) {
        return '暂无位置（请确认已设主城或在当前郡道路上）';
      }
      const cell = pickNearestBanditStrategicCellInJun(banditAnchorCellsByJun, junId, ref);
      if (!cell) return '本郡未找到匪寨锚点';
      scrollStrategicCellNow(cell.gx, cell.gy);
      return null;
    },
    [strategicNav, locateSelfStrategicCell, banditAnchorCellsByJun, scrollStrategicCellNow],
  );

  const strategicWarSiegeLocateEnabled = false;

  const requestSiegeProgressLocate = useCallback(() => {
    if (!strategicWarSiegeLocateEnabled) return '战事定位待接入（17-2）';
    return '暂无战事发动城';
  }, []);

  const mapJumpProgressSidebar = useMemo(() => {
    if (!cells?.length) return null;
    const tutorial = strategicTutorialExploreStep;
    const eq = exploreQuota;
    const sq = siegeQuotaProgress;
    const exploreLabel = tutorial
      ? `教程 ${tutorial.current}/${tutorial.max}`
      : eq?.loaded
        ? `探索 ${eq.remaining}/${eq.max}`
        : '探索 …';
    const siegeLabel = sq?.loaded ? `攻城 ${sq.remaining}/${sq.max}` : '攻城 …';

    const banditByJunId = {};
    for (const jid of cityRuntimeJunIds) {
      if (!getPhase1BanditPoiIdsForJun(jid).length) continue;
      const q = banditJunRaidQuotas[jid];
      banditByJunId[jid] = {
        label: q?.loaded ? `匪寨 ${q.remaining}/${q.max}` : '匪寨 …',
        title: '定位本郡最近匪寨',
        requestLocate: () => requestBanditProgressLocate(jid),
      };
    }

    return {
      explore: {
        label: exploreLabel,
        title: tutorial ? '教程进行中' : '定位至己方最近中城或大城',
        disabled: !!tutorial,
        requestLocate: requestExploreProgressLocate,
      },
      siege: {
        label: siegeLabel,
        title: '战事系统接入后可定位战事发动城',
        disabled: true,
        requestLocate: requestSiegeProgressLocate,
      },
      banditByJunId,
    };
  }, [
    cells,
    strategicTutorialExploreStep,
    exploreQuota?.remaining,
    exploreQuota?.max,
    exploreQuota?.loaded,
    siegeQuotaProgress?.remaining,
    siegeQuotaProgress?.max,
    siegeQuotaProgress?.loaded,
    banditJunRaidQuotas,
    cityRuntimeJunIds,
    requestExploreProgressLocate,
    requestBanditProgressLocate,
    requestSiegeProgressLocate,
  ]);

  /**
   * 郡内「他人」道路 pawn（仅在线；服务端已按 `playerActivity` 5 分钟窗过滤并隐去敏感资源）。
   * 在未接入他人兵力与将领头像前，只展示：势力名 + 角色名 + 圆心末字；与自身 pawn 共用同一组件。
   */
  const strategicOtherPawns = useMemo(() => {
    if (!Array.isArray(roadPresence?.others) || !roadPresence.others.length) return [];
    const selfRx = Number(ctxPlayer?.road_position_x);
    const selfRy = Number(ctxPlayer?.road_position_y);
    const selfPortraitUrl = resolveSelfMapPortraitUrl(ctxPlayer, ctxCards, attributeBonusBySlot);
    const selfCharName = String(ctxPlayer?.character_name || '').trim() || '…';
    const selfFactionName = String(ctxPlayer?.faction_name || '').trim();
    const selfDisplayName = selfFactionName ? `[${selfFactionName}]${selfCharName}` : selfCharName;
    const selfStackKey = roadCellStackKey(playerMarchJunId, selfRx, selfRy);
    return roadPresence.others
      .map((other) => {
        const rx = Number(other.roadPositionX);
        const ry = Number(other.roadPositionY);
        if (!Number.isFinite(rx) || !Number.isFinite(ry)) return null;
        const otherJun = String(other.roadJunId || SAN_1_STRATEGIC_VERTICAL_STACK_JUN_ORDER[0]).trim();
        const otherStackKey = roadCellStackKey(otherJun, rx, ry);
        // 与本人同坐标叠站：只保留「本人」大头像 + strip 小头像；勿再画他人整颗 pawn，否则后绘盖住本人且点击落到无行军菜单的层上
        if (
          playerId &&
          selfStackKey &&
          otherStackKey &&
          selfStackKey === otherStackKey &&
          String(other.playerId) !== String(playerId)
        ) {
          return null;
        }
        const worldRyOther = stackWorldGyFromLocalJunRow(otherJun, ry);
        const pos = resolveStrategicRecordedStandpointPx({
          cells,
          roadCells: merged?.roadCells,
          mapColumns: cols,
          mapRows: rows,
          countyJunId: otherJun,
          tilePx,
          playerRoadJunId: otherJun,
          roadX: rx,
          roadY: worldRyOther,
          mainCityId: null,
        });
        const { cx, cy } =
          pos.cx != null && pos.cy != null ? pos : strategicRoadCellCenterPx(rx, worldRyOther, tilePx);
        const charName = String(other.characterName || '').trim() || '…';
        const factionName = String(other.factionName || '').trim();
        const displayName = factionName ? `[${factionName}]${charName}` : charName;
        const nameSeq = Array.from(charName);
        const strip = buildStrategicRoadStackStripForFocal({
          countyJunId: otherJun,
          focalPlayerId: String(other.playerId),
          focalJunId: otherJun,
          focalRx: rx,
          focalRy: ry,
          selfPlayerId: playerId,
          selfJunId: playerMarchJunId,
          selfRx,
          selfRy,
          selfPortraitUrl,
          selfCharacterName: selfCharName,
          selfDisplayName,
          othersRows: roadPresence.others,
        });
        return {
          playerId: other.playerId,
          cx,
          cy,
          portraitUrl: other.avatar || null,
          displayName,
          centerGlyph: nameSeq.length ? nameSeq[nameSeq.length - 1] : '…',
          roadIntercept: other.roadIntercept ? 1 : 0,
          factionId: other.factionId || null,
          stackStripPeers: strip.stripPeers,
          stackStripEllipsis: strip.showEllipsis,
        };
      })
      .filter(Boolean);
  }, [
    roadPresence,
    tilePx,
    cells,
    merged?.roadCells,
    cols,
    rows,
    playerMarchJunId,
    ctxPlayer,
    ctxCards,
    attributeBonusBySlot,
    playerId,
  ]);

  const strategicRoadLockedCells = useMemo(
    () => (Array.isArray(roadPresence?.lockedCells) ? roadPresence.lockedCells : []),
    [roadPresence],
  );

  const exitStrategicMarchMode = useCallback(() => {
    setStrategicMarchMode(false);
    setMarchConfirm(null);
    setMarchSubmitError('');
    setMarchSubmitLoading(false);
    setRoadMarchAnimation(null);
  }, []);

  useEffect(() => {
    const anim = roadMarchAnimation;
    if (!anim?.path?.length) return undefined;
    const { path, stepIndex, afterRefreshToast } = anim;
    const lastIdx = path.length - 1;
    if (stepIndex >= lastIdx) {
      const t = window.setTimeout(async () => {
        // 须先拉新档案再清动画：否则 `roadMarchAnimation=null` 的瞬间会按旧 `ctxPlayer` 坐标画一帧（交战态 refresh 较慢时更明显）。
        try {
          await refresh({ silent: true });
        } catch (_) {}
        void roadPresenceFetchRef.current?.();
        setRoadMarchAnimation(null);
        showRoadMarchMoveFinishToast({
          encounter: afterRefreshToast?.encounter,
          defenderAutoRetreats: afterRefreshToast?.defenderAutoRetreats,
          onRoadEncounterBattle,
          setMarchToast,
        });
        window.setTimeout(() => setMarchToast(null), 6000);
      }, MARCH_ANIM_MS_PER_STEP);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      setRoadMarchAnimation((prev) => {
        if (!prev?.path?.length) return null;
        return { ...prev, stepIndex: Math.min(prev.stepIndex + 1, prev.path.length - 1) };
      });
    }, MARCH_ANIM_MS_PER_STEP);
    return () => window.clearTimeout(t);
  }, [roadMarchAnimation, refresh, onRoadEncounterBattle]);

  /** 打开沿路移动确认（道路双击与行军点选共用；不依赖是否已点过叠层「行军」） */
  const openMarchConfirmForStrategicCell = useCallback(
    (gx, gy) => {
      if (roadMarchAnimation) return;
      if (!playerId || !ctxPlayer) return;
      if (!merged?.roadCells?.length) {
        setMarchToast({ type: 'error', message: '当前地图暂无道路数据' });
        return;
      }
      const clickSlice = stackLocalJunRowFromWorldGy(gy);
      if (!clickSlice) {
        setMarchToast({ type: 'error', message: '目标格坐标无效' });
        return;
      }
      setMarchSubmitError('');
      const useWorldStackMarch = rows > STRATEGIC_COUNTY_MAP_ROWS;

      const cell = cells[gy]?.[gx];
      const cover = resolveStrategicTileCityCover(cells, gy, gx);
      let marchTargetPoiId = null;
      const anchorPid = readStrategicCellAnchorId(cover?.anchorCell);
      if (anchorPid) marchTargetPoiId = String(anchorPid);
      else {
        const cid = readStrategicCellAnchorId(cell);
        if (cid) {
          const rowHint = cityById?.[cid];
          const fpMeta = rowHint
            ? buildStrategicPoiFootprintFromDbCityRow(rowHint, cols, rows, cells)
            : collectStrategicPoiFootprint(cells, cid, cols, rows);
          if (fpMeta?.keys?.has(`${gx},${gy}`)) marchTargetPoiId = cid;
        }
      }

      let pathRes = null;
      const marchMainRow = playerMainCityId ? cityById?.[playerMainCityId] : null;
      if (marchTargetPoiId) {
        const row = cityById?.[marchTargetPoiId];
        const gate = canPlayerMarchToPoiCity({
          cityRow: row,
          targetPoiId: marchTargetPoiId,
          playerFactionId: ctxPlayer?.faction_id,
        });
        if (!gate.ok) {
          setMarchToast({ type: 'error', message: gate.error });
          return;
        }
        pathRes = buildMarchPathToPoi({
          cells,
          roadCells: merged.roadCells,
          mapColumns: cols,
          mapRows: rows,
          countyJunId: playerMarchJunId,
          player: ctxPlayer,
          targetPoiId: marchTargetPoiId,
          targetCityDbRow: row ?? null,
          mainCityDbRow: marchMainRow ?? null,
          citiesInCountyRows: countyCityRows,
          useWorldStackRoadCoords: useWorldStackMarch,
        });
      } else {
        pathRes = buildMarchPath({
          cells,
          roadCells: merged.roadCells,
          mapColumns: cols,
          mapRows: rows,
          countyJunId: playerMarchJunId,
          player: ctxPlayer,
          targetGx: gx,
          targetGy: gy,
          mainCityDbRow: marchMainRow ?? null,
          citiesInCountyRows: countyCityRows,
          useWorldStackRoadCoords: useWorldStackMarch,
        });
      }
      if (!pathRes.ok) {
        setMarchToast({ type: 'error', message: pathRes.error });
        return;
      }
      const lastRoad = pathRes.path[pathRes.path.length - 1];
      const lockOnDest = findActiveRoadEncounterLockOnCell(strategicRoadLockedCells, lastRoad.x, lastRoad.y);
      if (lockOnDest && !isPlayerRoadEncounterParticipant(lockOnDest, playerId)) {
        setMarchToast({
          type: 'error',
          message: '目标格道路交战进行中，不可作为落脚点；请改选交战格后方或其它道路格（途经交战格可正常寻路）。',
        });
        return;
      }
      const preview = estimateMarchFoodCost({
        path: pathRes.path,
        onRoadAtStart: pathRes.onRoadAtStart,
        player: ctxPlayer,
      });
      if (!preview.steps && !pathRes.targetPoiId) {
        setMarchToast({ type: 'info', message: '目标与当前立点相同，无需移动' });
        return;
      }
      const others = Array.isArray(roadPresence?.others) ? roadPresence.others : [];
      const last = pathRes.path[pathRes.path.length - 1];
      const lastLoc = stackLocalJunRowFromWorldGy(last.y);
      const lastStackKey =
        lastLoc && Number.isFinite(last.x)
          ? roadCellStackKey(lastLoc.junId, last.x, lastLoc.localGy)
          : null;
      const occ = others.find((o) => {
        const j = String(o.roadJunId || SAN_1_STRATEGIC_VERTICAL_STACK_JUN_ORDER[0]).trim();
        const rx = Number(o.roadPositionX);
        const ry = Number(o.roadPositionY);
        if (!Number.isFinite(rx) || !Number.isFinite(ry)) return false;
        const k = roadCellStackKey(j, rx, ry);
        return lastStackKey && k === lastStackKey;
      });
      let encounterHint = null;
      if (occ) {
        const sameFaction =
          ctxPlayer.faction_id != null &&
          occ.factionId != null &&
          String(ctxPlayer.faction_id) === String(occ.factionId);
        if (sameFaction) {
          setMarchToast({
            type: 'error',
            message: '目标格已有友方，禁止主动叠格；请另选落点（途经友军格仍可在其他路径下正常通过）。',
          });
          return;
        }
        encounterHint = '落点上有其他势力玩家；提交后可能触发道路遭遇战（以服务端判定为准）。';
      }
      const tid = pathRes.targetPoiId || null;
      const poiTargetName =
        tid && cityById?.[tid]
          ? String(cityById[tid].city_name || cityById[tid].cityName || '').trim()
          : '';
      setMarchConfirm({
        path: pathRes.path,
        onRoadAtStart: pathRes.onRoadAtStart,
        preview,
        encounterHint,
        targetPoiId: tid,
        poiTargetName: poiTargetName || null,
      });
    },
    [
      roadMarchAnimation,
      playerId,
      ctxPlayer,
      merged,
      cells,
      cols,
      rows,
      playerMarchJunId,
      roadPresence,
      strategicRoadLockedCells,
      cityById,
      countyCityRows,
      playerMainCityId,
    ],
  );

  const handleStrategicMarchCellPick = useCallback(
    (gx, gy) => {
      if (!strategicMarchMode) return;
      openMarchConfirmForStrategicCell(gx, gy);
    },
    [strategicMarchMode, openMarchConfirmForStrategicCell],
  );

  const dismissMarchConfirm = useCallback(() => {
    if (marchSubmitLoading) return;
    exitStrategicMarchMode();
  }, [marchSubmitLoading, exitStrategicMarchMode]);

  const submitMarchMove = useCallback(async () => {
    if (!marchConfirm?.path?.length || !playerId) return;
    setMarchSubmitLoading(true);
    setMarchSubmitError('');
    try {
      const clientRequestId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `march_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const body = {
        season: countySeason,
        junId: playerMarchJunId,
        path: marchConfirm.path,
        clientRequestId,
        confirmFoodCost: true,
      };
      if (marchConfirm.targetPoiId) body.targetPoiId = marchConfirm.targetPoiId;
      const res = await playerAPI.roadMove(playerId, body);
      if (!res?.success) {
        const msg = res?.error || res?.message || '移动失败';
        // 关确认框 + 退行军模式，避免 409 等错误下仍可连点「确认」刷同一请求、像在「不停提醒」
        exitStrategicMarchMode();
        setMarchToast({ type: 'error', message: msg });
        window.setTimeout(() => setMarchToast(null), 8000);
        return;
      }

      const onRoadAtStart = marchConfirm.onRoadAtStart;
      const reqPath = marchConfirm.path;
      const encounter = res.data?.encounter || null;
      const defenderAutoRetreats = res.data?.defenderAutoRetreats;

      setMarchConfirm(null);
      setStrategicMarchMode(false);
      setMarchSubmitLoading(false);

      if (res.data?.idempotent) {
        await refresh({ silent: true });
        void roadPresenceFetchRef.current?.();
        showRoadMarchMoveFinishToast({
          encounter,
          defenderAutoRetreats,
          onRoadEncounterBattle,
          setMarchToast,
        });
        window.setTimeout(() => setMarchToast(null), 6000);
        return;
      }

      const fullPath =
        Array.isArray(res.data?.path) && res.data.path.length ? res.data.path : reqPath;
      const sa = Number(res.data?.stepsApplied);
      const stepsApplied = Number.isFinite(sa) ? sa : fullPath.length;
      /** 叠放大地图：`road/move` 的 `path` 已是世界行 gy，勿再按起点郡加偏移（汝南否则会 +40 越界，动画被跳过或瞬移）。单郡 40 行时 `y` 为郡内坐标，需加偏移对齐视口。 */
      const pathAlreadyWorldGy = rows > STRATEGIC_COUNTY_MAP_ROWS;
      const marchOff = pathAlreadyWorldGy ? 0 : stackWorldRowOffsetForJunId(playerMarchJunId);
      const fullPathWorld = fullPath.map((p) => ({
        x: Number(p?.x),
        y: Number(p?.y) + marchOff,
      }));
      const animPath = buildMarchAnimPath(onRoadAtStart, fullPathWorld, stepsApplied);

      if (animPath.length <= 1) {
        await refresh({ silent: true });
        void roadPresenceFetchRef.current?.();
        showRoadMarchMoveFinishToast({
          encounter,
          defenderAutoRetreats,
          onRoadEncounterBattle,
          setMarchToast,
        });
        window.setTimeout(() => setMarchToast(null), 6000);
        return;
      }

      setRoadMarchAnimation({
        path: animPath,
        stepIndex: 0,
        afterRefreshToast: { encounter, defenderAutoRetreats },
      });
    } catch (err) {
      exitStrategicMarchMode();
      setMarchToast({ type: 'error', message: err?.message || '网络错误' });
      window.setTimeout(() => setMarchToast(null), 8000);
    }
  }, [
    marchConfirm,
    playerId,
    countySeason,
    playerMarchJunId,
    rows,
    refresh,
    onRoadEncounterBattle,
    exitStrategicMarchMode,
  ]);

  const onStrategicRoadSelfUpdated = useCallback(() => refresh({ silent: true }), [refresh]);

  if (mapLoadError) {
    return (
      <div className={`flex flex-col min-h-0 h-full bg-stone-950 items-center justify-center gap-3 px-4 ${className}`}>
        <div className="text-center text-stone-400 text-sm">{mapLoadError}</div>
        <button
          type="button"
          className="rounded-lg border border-amber-700/50 bg-stone-900 px-4 py-2 text-sm text-amber-200 hover:bg-stone-800"
          onClick={() => window.location.reload()}
        >
          刷新页面
        </button>
      </div>
    );
  }

  if (!merged?.cells?.length) {
    return (
      <div className={`flex flex-col min-h-0 h-full bg-stone-950 items-center justify-center ${className}`}>
        <div className="text-stone-400 text-sm">大地图加载中…</div>
      </div>
    );
  }

  return (
    <div className={`flex h-full min-h-0 flex-col bg-stone-950 ${className}`}>
      {/* 州郡跳转：叠在战略格网上方 */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute left-2 top-2 z-30">
          <div className="pointer-events-auto">
            <ZhouJunMapJumpPanel
              variant="mapOverlay"
              locateSelfCell={locateSelfStrategicCell}
              progressSidebar={mapJumpProgressSidebar}
            />
          </div>
        </div>
        <WorldStrategicMapGrid
          cells={cells}
          seed={seed}
          roadCells={merged?.roadCells}
          roadConnectivity={merged?.roadConnectivity === '8' ? '8' : '4'}
          mapColumns={cols}
          mapRows={rows}
          tilePx={tilePx}
          setTilePx={setTilePx}
          minTilePx={WORLD_MAP_TILE_MIN}
          maxTilePx={WORLD_MAP_TILE_MAX}
          cityById={cityById}
          factionNameById={factionNameById}
          playerId={playerId}
          playerFactionId={playerFactionId}
          siegeLoading={siegeLoading}
          onStartSiegeForCity={onStartSiegeForCity}
          garrisonStatsByCityId={garrisonStatsByCityId}
          playerOnDuty={playerOnDuty}
          playerOnDutyCityId={playerOnDutyCityId}
          onOpenGarrisonForCity={onOpenGarrisonForCity}
          onToggleDutyForCity={onToggleDutyForCity}
          onDutyError={onDutyError}
          subsidiaryExploreEmbed={subsidiaryExploreEmbed}
          playerMainCityId={playerMainCityId}
          playerMainCityChangedAt={playerMainCityChangedAt}
          playerSilver={playerSilver}
          onSetMainCityRequest={onSetMainCityRequest}
          onSetMainCityError={onSetMainCityError}
          onOpenBarracksPost={onOpenBarracksPost}
          onOpenSanGongFu={onOpenSanGongFu}
          onWheelZoomSteps={onWheelZoomSteps}
          strategicCityLabelAllyFactionIds={strategicCityLabelAllyFactionIds}
          strategicCityLabelNonHostileFactionIds={strategicCityLabelNonHostileFactionIds}
          strategicFullScreenOverlayOpen={strategicFullScreenOverlayOpen}
          strategicMapEventHintSuppressed={strategicMapEventHintSuppressed}
          pendingMapEventHint={pendingMapEventHint}
          meta={null}
          strategicSelfPawn={strategicSelfPawn}
          strategicOtherPawns={strategicOtherPawns}
          strategicRoadLockedCells={strategicRoadLockedCells}
          strategicMarchMode={strategicMarchMode}
          strategicRoadMarchAnimating={!!roadMarchAnimation}
          onStrategicSelfMarchModeRequest={() => setStrategicMarchMode(true)}
          onStrategicRoadDoubleMarchToCell={openMarchConfirmForStrategicCell}
          onStrategicSelfMarchModeExit={exitStrategicMarchMode}
          onStrategicMarchCellPick={handleStrategicMarchCellPick}
          onStrategicRoadSelfUpdated={onStrategicRoadSelfUpdated}
          onStartBanditRaid={onStartBanditRaid}
          banditRaidStartBlockedReason={banditRaidStartBlockedReason}
          postBanditRaidRefreshKey={postBanditRaidRefreshKey}
          playerStandingPoiAnchorId={playerStandingPoiAnchorId}
        />
      </div>
      <StrategicMarchMoveConfirm
        open={!!marchConfirm}
        onClose={dismissMarchConfirm}
        onConfirm={submitMarchMove}
        loading={marchSubmitLoading}
        errorMessage={marchSubmitError}
        pathLength={marchConfirm?.path?.length ?? 0}
        preview={marchConfirm?.preview}
        encounterHint={marchConfirm?.encounterHint}
        poiTargetName={marchConfirm?.poiTargetName || null}
      />
      {marchToast ? (
        <div
          className={`pointer-events-none fixed bottom-20 left-1/2 z-[85] max-w-[min(92vw,24rem)] -translate-x-1/2 rounded-lg border px-3 py-2 text-center text-xs shadow-lg sm:text-sm ${
            marchToast.type === 'error'
              ? 'border-red-800 bg-red-950/95 text-red-100'
              : marchToast.type === 'success'
                ? 'border-emerald-800 bg-emerald-950/95 text-emerald-50'
                : 'border-amber-800 bg-stone-900/95 text-amber-50'
          }`}
        >
          {marchToast.message}
        </div>
      ) : null}
    </div>
  );
}
