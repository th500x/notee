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
import './WorldStrategicMap.css';
import {
  generateYingchuanCountyMergedSimulated,
  YINGCHUAN_COUNTY_MAP_COLS,
  YINGCHUAN_COUNTY_MAP_ROWS,
} from '@shared/utils/junCountyMapGenerator';
import { useStrategicCountyCityRuntime } from '@/hooks/useStrategicCountyCityRuntime';
import { API_CONFIG } from '@/constants';
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
  buildHostileOccupiedRoadKeysFromPlayersRows,
} from '@shared/utils/strategicMarchPoi.js';
import StrategicMarchMoveConfirm from './StrategicMarchMoveConfirm';
import { buildStrategicRoadStackStripForFocal, roadCellStackKey } from '@/utils/strategicRoadStackStrip';

/** 与管理员「生成地图」写出路径一致：Vite publicDir → 05-san-storm/public */
const MERGED_MAP_REL = 'data/worldmap/san_1_jun_yingchuan_merged.json';

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
 * 游戏主界面大地图：颍川郡四象限合并 32×40 战略格网（缩放以滚轮 / 触控为主）。
 * 优先读取 `public/data/worldmap/san_1_jun_yingchuan_merged.json`（含 version，与后台生成一致）；
 * 缺失或无效时回退为 `generateYingchuanCountyMergedSimulated`（内存即时生成）。
 */
export default function WorldYingchuanMapSection({
  className = '',
  playerId = null,
  playerFactionId = null,
  siegeLoading = false,
  onStartSiegeForCity = null,
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
  /** 探索结算后指引文案（`event_hint`）；锚在本人路点漫画对白框 */
  pendingMapEventHint = null,
  /** 向 `useEventSystem` 提交战略格网上下文，用于 `exploreLocationId` 与城 footprint 对齐（教程链 `{city_medium}` 等） */
  onExploreAnchorGridContext = null,
}) {
  const [merged, setMerged] = useState(null);
  const [garrisonStatsByCityId, setGarrisonStatsByCityId] = useState({});
  /**
   * 郡内他人道路 presence（仅在线 + 锁格），与 31-6 §12.2 / 02 §2.1.2（3）一致。
   * 轮询粒度与现网拉城列表同量级；窗口未聚焦时不轮询以省服。
   */
  const [roadPresence, setRoadPresence] = useState(null);
  /** 供行军成功后立即拉取郡内他人路点（与轮询互补） */
  const roadPresenceFetchRef = useRef(() => Promise.resolve());
  const { player: ctxPlayer, cards: ctxCards, attributeBonusBySlot, refresh } = usePlayerContext();
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
   * @type {null | { path: Array<{x:number,y:number}>, stepIndex: number, afterRefreshToast: { encounter: object|null } }}
   */
  const [roadMarchAnimation, setRoadMarchAnimation] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const url = `${import.meta.env.BASE_URL}${MERGED_MAP_REL}`;
    (async () => {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data || !Array.isArray(data.cells)) throw new Error('invalid merged');
        if (cancelled) return;
        setMerged({
          cells: data.cells,
          seed: normalizeMergedMapSeed(data),
          version: data.version,
          mapColumns: data.mapColumns ?? YINGCHUAN_COUNTY_MAP_COLS,
          mapRows: data.mapRows ?? YINGCHUAN_COUNTY_MAP_ROWS,
          junId: data.junId,
          season: data.season,
          roadCells: Array.isArray(data.roadCells) ? data.roadCells : null,
          roadConnectivity: data.roadConnectivity === '8' ? '8' : '4',
        });
      } catch {
        if (cancelled) return;
        const fb = generateYingchuanCountyMergedSimulated({});
        setMerged({
          cells: fb.cells,
          seed: fb.seed,
          version: null,
          mapColumns: fb.mapColumns ?? YINGCHUAN_COUNTY_MAP_COLS,
          mapRows: fb.mapRows ?? YINGCHUAN_COUNTY_MAP_ROWS,
          junId: 'san_1_jun_yingchuan',
          season: 'san_1',
          roadCells: null,
          roadConnectivity: '4',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!playerId) {
      setGarrisonStatsByCityId({});
      return undefined;
    }
    let cancelled = false;
    fetch(`${API_CONFIG.BASE_URL}/garrisons/stats/cities`)
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
    if (!playerId || !merged?.junId || !merged?.season) {
      setRoadPresence(null);
      return undefined;
    }
    let cancelled = false;
    const fetchPresence = async () => {
      try {
        const url = `${API_CONFIG.BASE_URL}/cities/road-presence?season=${encodeURIComponent(merged.season)}&junId=${encodeURIComponent(merged.junId)}&playerId=${encodeURIComponent(playerId)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled || !json?.success) return;
        setRoadPresence(json.data || null);
      } catch {
        /* 读接口失败静默重试（下一轮 tick） */
      }
    };
    roadPresenceFetchRef.current = fetchPresence;
    fetchPresence();
    // 5s：他人路点依赖本接口；原 30s 易导致「A 已走、B 仍见旧格 / 寻路仍绕旧阻」
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      fetchPresence();
    }, 5000);
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

  const cols = merged?.mapColumns ?? YINGCHUAN_COUNTY_MAP_COLS;
  const rows = merged?.mapRows ?? YINGCHUAN_COUNTY_MAP_ROWS;
  const cells = merged?.cells;
  const seed = merged ? normalizeMergedMapSeed(merged) : 0;

  const countyJunId = merged?.junId || 'san_1_jun_yingchuan';
  const countySeason = merged?.season || 'san_1';
  /** 合并图主键为颍川郡，但象限 C 含汝南行政城点；需同时拉汝南 `cities` 才能合并 tooltip 运行时块。 */
  const cityRuntimeJunIds = useMemo(() => {
    if (countyJunId === 'san_1_jun_yingchuan') {
      return ['san_1_jun_yingchuan', 'san_1_jun_runan'];
    }
    return [countyJunId];
  }, [countyJunId]);
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

  const strategicNav = useStrategicMapNavigation();

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
      const stand = resolveStrategicRecordedStandpointPx({
        cells,
        roadCells: merged?.roadCells,
        mapColumns: cols,
        mapRows: rows,
        countyJunId,
        tilePx,
        playerRoadJunId: ctxPlayer?.road_jun_id,
        roadX: ctxPlayer?.road_position_x,
        roadY: ctxPlayer?.road_position_y,
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
    const focalJun = String(ctxPlayer?.road_jun_id || '');
    const focalRx = Number(ctxPlayer?.road_position_x);
    const focalRy = Number(ctxPlayer?.road_position_y);
    const strip = buildStrategicRoadStackStripForFocal({
      countyJunId,
      focalPlayerId: playerId,
      focalJunId: focalJun,
      focalRx,
      focalRy,
      selfPlayerId: playerId,
      selfJunId: focalJun,
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
    countyJunId,
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
    return resolveStrategicRecordedStandpointCell({
      cells,
      roadCells: merged?.roadCells,
      mapColumns: cols,
      mapRows: rows,
      countyJunId,
      playerRoadJunId: ctxPlayer?.road_jun_id,
      roadX: ctxPlayer?.road_position_x,
      roadY: ctxPlayer?.road_position_y,
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
    countyJunId,
    ctxPlayer?.road_jun_id,
    ctxPlayer?.road_position_x,
    ctxPlayer?.road_position_y,
    playerMainCityId,
    countyCityRows,
    mainCityRowFromApi,
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

  /**
   * 郡内「他人」道路 pawn（仅在线；服务端已按 `playerActivity` 5 分钟窗过滤并隐去敏感资源）。
   * 在未接入他人兵力与将领头像前，只展示：势力名 + 角色名 + 圆心末字；与自身 pawn 共用同一组件。
   */
  const strategicOtherPawns = useMemo(() => {
    if (!Array.isArray(roadPresence?.others) || !roadPresence.others.length) return [];
    const selfJun = String(ctxPlayer?.road_jun_id || '');
    const selfRx = Number(ctxPlayer?.road_position_x);
    const selfRy = Number(ctxPlayer?.road_position_y);
    const selfPortraitUrl = resolveSelfMapPortraitUrl(ctxPlayer, ctxCards, attributeBonusBySlot);
    const selfCharName = String(ctxPlayer?.character_name || '').trim() || '…';
    const selfFactionName = String(ctxPlayer?.faction_name || '').trim();
    const selfDisplayName = selfFactionName ? `[${selfFactionName}]${selfCharName}` : selfCharName;
    const selfStackKey = roadCellStackKey(selfJun, selfRx, selfRy);
    return roadPresence.others
      .map((other) => {
        const rx = Number(other.roadPositionX);
        const ry = Number(other.roadPositionY);
        if (!Number.isFinite(rx) || !Number.isFinite(ry)) return null;
        const otherJun = String(other.roadJunId ?? other.road_jun_id ?? countyJunId).trim();
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
        const pos = resolveStrategicRecordedStandpointPx({
          cells,
          roadCells: merged?.roadCells,
          mapColumns: cols,
          mapRows: rows,
          countyJunId,
          tilePx,
          playerRoadJunId: countyJunId,
          roadX: rx,
          roadY: ry,
          mainCityId: null,
        });
        const { cx, cy } =
          pos.cx != null && pos.cy != null ? pos : strategicRoadCellCenterPx(rx, ry, tilePx);
        const charName = String(other.characterName || '').trim() || '…';
        const factionName = String(other.factionName || '').trim();
        const displayName = factionName ? `[${factionName}]${charName}` : charName;
        const nameSeq = Array.from(charName);
        const strip = buildStrategicRoadStackStripForFocal({
          countyJunId,
          focalPlayerId: String(other.playerId),
          focalJunId: countyJunId,
          focalRx: rx,
          focalRy: ry,
          selfPlayerId: playerId,
          selfJunId: selfJun,
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
    countyJunId,
    ctxPlayer,
    ctxCards,
    attributeBonusBySlot,
    playerId,
  ]);

  const strategicRoadLockedCells = useMemo(
    () => (Array.isArray(roadPresence?.lockedCells) ? roadPresence.lockedCells : []),
    [roadPresence],
  );

  /** 沿路 BFS 绕行：敌对玩家所占道路格不可途经（与 `moveAlongRoad` POI 重算一致） */
  const marchHostileOccupiedKeys = useMemo(
    () => buildHostileOccupiedRoadKeysFromPlayersRows(ctxPlayer?.faction_id, roadPresence?.others),
    [ctxPlayer?.faction_id, roadPresence?.others],
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
        const enc = afterRefreshToast?.encounter;
        if (enc?.encounterId) {
          setMarchToast({
            type: 'info',
            message: `已触发道路遭遇：${enc.encounterId}。请完成战斗后走战后解锁（resolve-encounter）。`,
          });
        } else {
          setMarchToast({ type: 'success', message: '移动已完成' });
        }
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
  }, [roadMarchAnimation, refresh]);

  const handleStrategicMarchCellPick = useCallback(
    (gx, gy) => {
      if (roadMarchAnimation) return;
      if (!strategicMarchMode || !playerId || !ctxPlayer) return;
      if (!merged?.roadCells?.length) {
        setMarchToast({ type: 'error', message: '当前地图暂无道路数据' });
        return;
      }
      setMarchSubmitError('');
      const cell = cells[gy]?.[gx];
      const cover = resolveStrategicTileCityCover(cells, gy, gx);
      let poiCityId = null;
      if (cover?.anchorCell?.cityId) poiCityId = String(cover.anchorCell.cityId);
      else if (cell?.cityId) {
        const cid = String(cell.cityId);
        const rowHint = cityById?.[cid];
        const fpMeta = rowHint
          ? buildStrategicPoiFootprintFromDbCityRow(rowHint, cols, rows, cells)
          : collectStrategicPoiFootprint(cells, cid, cols, rows);
        if (fpMeta?.keys?.has(`${gx},${gy}`)) poiCityId = cid;
      }

      let pathRes = null;
      const marchMainRow = playerMainCityId ? cityById?.[playerMainCityId] : null;
      if (poiCityId) {
        const row = cityById?.[poiCityId];
        const gate = canPlayerMarchToPoiCity({
          cityRow: row,
          cityId: poiCityId,
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
          countyJunId,
          player: ctxPlayer,
          targetCityId: poiCityId,
          targetCityDbRow: row ?? null,
          mainCityDbRow: marchMainRow ?? null,
          citiesInCountyRows: countyCityRows,
          hostileOccupiedRoadKeys: marchHostileOccupiedKeys,
        });
      } else {
        pathRes = buildMarchPath({
          cells,
          roadCells: merged.roadCells,
          mapColumns: cols,
          mapRows: rows,
          countyJunId,
          player: ctxPlayer,
          targetGx: gx,
          targetGy: gy,
          mainCityDbRow: marchMainRow ?? null,
          citiesInCountyRows: countyCityRows,
          hostileOccupiedRoadKeys: marchHostileOccupiedKeys,
        });
      }
      if (!pathRes.ok) {
        setMarchToast({ type: 'error', message: pathRes.error });
        return;
      }
      // 道路开战（来战）开启时：禁止预览穿过 road_encounters 锁格；休战下允许途经（仅仍不可与敌对叠格落子，见下方 occ 校验）
      if (Number(ctxPlayer?.road_intercept) === 1) {
        const locked = Array.isArray(roadPresence?.lockedCells) ? roadPresence.lockedCells : [];
        for (const step of pathRes.path) {
          if (locked.some((L) => Number(L.positionX) === step.x && Number(L.positionY) === step.y)) {
            setMarchToast({ type: 'error', message: '路径经过交战锁格，无法通行' });
            return;
          }
        }
      }
      const preview = estimateMarchFoodCost({
        path: pathRes.path,
        onRoadAtStart: pathRes.onRoadAtStart,
        player: ctxPlayer,
      });
      if (!preview.steps) {
        setMarchToast({ type: 'info', message: '目标与当前立点相同，无需移动' });
        return;
      }
      const others = Array.isArray(roadPresence?.others) ? roadPresence.others : [];
      const last = pathRes.path[pathRes.path.length - 1];
      const occ = others.find(
        (o) => Number(o.roadPositionX) === last.x && Number(o.roadPositionY) === last.y,
      );
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
      const tid = pathRes.targetCityId || null;
      const targetCityName =
        tid && cityById?.[tid]
          ? String(cityById[tid].city_name || cityById[tid].cityName || '').trim()
          : '';
      setMarchConfirm({
        path: pathRes.path,
        onRoadAtStart: pathRes.onRoadAtStart,
        preview,
        encounterHint,
        targetCityId: tid,
        targetCityName: targetCityName || null,
      });
    },
    [
      roadMarchAnimation,
      strategicMarchMode,
      playerId,
      ctxPlayer,
      merged,
      cells,
      cols,
      rows,
      countyJunId,
      roadPresence,
      cityById,
      countyCityRows,
      playerMainCityId,
      marchHostileOccupiedKeys,
    ],
  );

  const closeMarchConfirm = useCallback(() => {
    if (marchSubmitLoading) return;
    setMarchConfirm(null);
    setMarchSubmitError('');
  }, [marchSubmitLoading]);

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
        junId: countyJunId,
        path: marchConfirm.path,
        clientRequestId,
        confirmFoodCost: true,
      };
      if (marchConfirm.targetCityId) body.targetCityId = marchConfirm.targetCityId;
      const res = await playerAPI.roadMove(playerId, body);
      if (!res?.success) {
        setMarchSubmitError(res?.error || res?.message || '移动失败');
        setMarchSubmitLoading(false);
        return;
      }

      const onRoadAtStart = marchConfirm.onRoadAtStart;
      const reqPath = marchConfirm.path;
      const encounter = res.data?.encounter || null;

      setMarchConfirm(null);
      setStrategicMarchMode(false);
      setMarchSubmitLoading(false);

      if (res.data?.idempotent) {
        await refresh({ silent: true });
        void roadPresenceFetchRef.current?.();
        if (encounter?.encounterId) {
          setMarchToast({
            type: 'info',
            message: `已触发道路遭遇：${encounter.encounterId}。请完成战斗后走战后解锁（resolve-encounter）。`,
          });
        } else {
          setMarchToast({ type: 'success', message: '移动已完成' });
        }
        window.setTimeout(() => setMarchToast(null), 6000);
        return;
      }

      const fullPath =
        Array.isArray(res.data?.path) && res.data.path.length ? res.data.path : reqPath;
      const sa = Number(res.data?.stepsApplied);
      const stepsApplied = Number.isFinite(sa) ? sa : fullPath.length;
      const animPath = buildMarchAnimPath(onRoadAtStart, fullPath, stepsApplied);

      if (animPath.length <= 1) {
        await refresh({ silent: true });
        void roadPresenceFetchRef.current?.();
        if (encounter?.encounterId) {
          setMarchToast({
            type: 'info',
            message: `已触发道路遭遇：${encounter.encounterId}。请完成战斗后走战后解锁（resolve-encounter）。`,
          });
        } else {
          setMarchToast({ type: 'success', message: '移动已完成' });
        }
        window.setTimeout(() => setMarchToast(null), 6000);
        return;
      }

      setRoadMarchAnimation({
        path: animPath,
        stepIndex: 0,
        afterRefreshToast: { encounter },
      });
    } catch (err) {
      setMarchSubmitError(err?.message || '网络错误');
      setMarchSubmitLoading(false);
    }
  }, [marchConfirm, playerId, countySeason, countyJunId, refresh]);

  const onStrategicRoadSelfUpdated = useCallback(() => refresh({ silent: true }), [refresh]);

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
            <ZhouJunMapJumpPanel variant="mapOverlay" locateSelfCell={locateSelfStrategicCell} />
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
          pendingMapEventHint={pendingMapEventHint}
          meta={null}
          strategicSelfPawn={strategicSelfPawn}
          strategicOtherPawns={strategicOtherPawns}
          strategicRoadLockedCells={strategicRoadLockedCells}
          strategicMarchMode={strategicMarchMode}
          strategicRoadMarchAnimating={!!roadMarchAnimation}
          onStrategicSelfMarchModeRequest={() => setStrategicMarchMode(true)}
          onStrategicSelfMarchModeExit={exitStrategicMarchMode}
          onStrategicMarchCellPick={handleStrategicMarchCellPick}
          onStrategicRoadSelfUpdated={onStrategicRoadSelfUpdated}
        />
      </div>
      {strategicMarchMode ? (
        <div className="pointer-events-none flex shrink-0 justify-center border-t border-amber-900/40 bg-stone-900/95 px-2 py-1.5">
          <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 text-center text-[11px] leading-snug text-amber-100/95 sm:text-xs">
            <span>
              已进入行军模式：请点击<strong>道路格</strong>或<strong>本势力城池 / 匪寨</strong>为目标，确认粮草后提交移动。
            </span>
            <button
              type="button"
              className="rounded border border-stone-500 bg-stone-700 px-2 py-0.5 text-[11px] font-semibold text-stone-100 touch-manipulation sm:text-xs"
              onClick={exitStrategicMarchMode}
            >
              取消
            </button>
          </div>
        </div>
      ) : null}
      <StrategicMarchMoveConfirm
        open={!!marchConfirm}
        onClose={closeMarchConfirm}
        onConfirm={submitMarchMove}
        loading={marchSubmitLoading}
        errorMessage={marchSubmitError}
        pathLength={marchConfirm?.path?.length ?? 0}
        preview={marchConfirm?.preview}
        encounterHint={marchConfirm?.encounterHint}
        poiTargetName={marchConfirm?.targetCityName || null}
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
