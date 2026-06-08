import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import WorldStrategicMapGrid from './WorldStrategicMapGrid';
import ZhouJunMapJumpPanel from '@/components/game/ZhouJunMapJumpPanel';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { useMapHudVisibility } from '@/contexts/MapHudVisibilityContext';
import { toCharCardData } from '@/utils/cardDataTransforms';
import {
  resolveStrategicRecordedStandpointPx,
  resolveStrategicRecordedStandpointCell,
  strategicRoadCellCenterPx,
  strategicStandpointErrorMessage,
  STRATEGIC_STANDPOINT_ERROR,
  isStrategicStandpointPoiDepsPending,
} from '@/utils/strategicMapCityAnchor';
import { resolveMapDisplayEffect } from '@/utils/mapDisplayEffect';
import { resolveStrategicTileCityCover, resolveStrategicTilePvpCampCover } from '@/utils/strategicMapTileContext';
import {
  cityDbPosToWorldStrategicCell,
  collectBanditAnchorCellsByJunFromWorldGrid,
  findNearestFactionMajorMediumCityStrategicCell,
  pickBanditProgressLocateTarget,
  scrollToCityById,
} from '@/utils/strategicMapProgressLocate';
import './WorldStrategicMap.css';
import { YINGCHUAN_COUNTY_MAP_COLS, YINGCHUAN_COUNTY_MAP_ROWS } from '@shared/utils/junCountyMapGenerator';
import { getPhase1BanditPoiIdsForJun } from '@shared/utils/strategicBanditPlaceholderPhase1.js';
import { useStrategicCountyCityRuntime } from '@/hooks/useStrategicCountyCityRuntime';
import { useSiegeQuota } from '@/hooks/useSiegeQuota';
import { useStrategicJunBanditRaidQuotas } from '@/hooks/useStrategicJunBanditRaidQuotas';
import { API_CONFIG } from '@/constants';
import { fetchWithTimeout } from '@/services/httpClient';
import { useStrategicMapNavigation } from '@/contexts/StrategicMapNavigationContext';
import { playerAPI } from '@/services/playerApi';
import { createRoadClientRequestId } from '@/utils/roadClientRequestId';
import { warAPI } from '@/services/warApi';
import { buildMapCornerOngoingWarEntries } from '@/utils/mapCornerOngoingWars';
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
  resolvePvpBaseCampWarIdAtMergedCell,
} from '@shared/utils/strategicMarchPoi.js';
import { readStrategicCellAnchorId } from '@shared/utils/strategicCellAnchorId.js';
import {
  findActiveRoadEncounterLockOnCell,
  isPlayerRoadEncounterParticipant,
} from '@shared/utils/roadEncounterLockPassage.js';
import StrategicMarchMoveConfirm from './StrategicMarchMoveConfirm';
import { buildStrategicRoadStackStripForFocal, roadCellStackKey } from '@/utils/strategicRoadStackStrip';
import {
  SAN_1_STRATEGIC_VERTICAL_STACK_JUN_ORDER,
  STRATEGIC_COUNTY_MAP_ROWS,
} from '@shared/utils/strategicWorldMapStack.js';
import {
  roadMovePathForMarchAnimation,
  appendPoiSnapToMarchAnimPath,
  playerRoadToWorldMapCell,
  playerRoadJunSliceFromWorldGy,
} from '@shared/utils/strategicGridCoordinates.js';
import {
  loadSan1StrategicMergedStackFromPublic,
  normalizeMergedMapSeed,
} from '@shared/utils/san1StrategicMergedPublicLoader.js';

/**
 * PVE `wars` + PVP `wars_pvp` 合并为大地图「攻城」滚屏目标：同一 `targetCityId` 只保留一条，**PVP 优先**；
 * 再按创建时间升序。
 * @param {Array<{ targetCityId?: string, createdAt?: string, pvpWarId?: string, targetCityName?: string|null }>} pvpWars
 * @param {Array<{ targetCityId?: string, createdAt?: string, warId?: string, targetCityName?: string|null }>} pveWars
 */
function buildOngoingSiegeLocateTargets(pvpWars, pveWars) {
  const byCity = new Map();
  for (const w of pvpWars || []) {
    const cid = String(w?.targetCityId ?? '').trim();
    if (!cid) continue;
    const t = Date.parse(w.createdAt || '') || 0;
    byCity.set(cid, {
      kind: 'pvp',
      targetCityId: cid,
      targetCityName: w.targetCityName ?? null,
      sortKey: t,
      pvpWarId: w.pvpWarId,
    });
  }
  for (const w of pveWars || []) {
    const cid = String(w?.targetCityId ?? '').trim();
    if (!cid) continue;
    if (byCity.has(cid)) continue;
    const t = Date.parse(w.createdAt || '') || 0;
    byCity.set(cid, {
      kind: 'pve',
      targetCityId: cid,
      targetCityName: w.targetCityName ?? null,
      sortKey: t,
      warId: w.warId,
    });
  }
  return Array.from(byCity.values()).sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    return String(a.targetCityId).localeCompare(String(b.targetCityId));
  });
}

/** 道路移动成功后跳跳棋逐格回放（31-6 §6）；纯前端、不额外请求 */
const MARCH_ANIM_MS_PER_STEP = 150;

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
  const characterCards = (ctxCards || []).filter((c) => c.cardType === 'character');
  const char1 = characterCards.find(
    (c) => c.equippedBy === 'character1' && c.isEquipped && c.equippedSlot === 'character',
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
    if (c?.cardType !== 'troop' || !c?.isEquipped) continue;
    const cfgMax = Number(c.config?.maxTroops) || 0;
    const bonus = Number(c.bonusMaxTroops) || 0;
    const cap = cfgMax + bonus;
    max += cap;
    const raw = c.currentTroops;
    const cur = raw != null && raw !== '' ? Number(raw) : cap;
    current += Number.isFinite(cur) ? cur : cap;
  }
  return { current, max };
}

/**
 * 本人路点格：与 `road-presence` 对齐的 camelCase 档案字段。
 * 合并图 `cells` 常先于档案就绪：`player == null` 时勿调用 `resolveStrategicRecordedStandpointPx`，否则会 NaN→误报「坐标无效」。
 * @returns {{ hasPlayer: boolean, rx: number, ry: number, junId: string|null }}
 */
function readSelfPlayerRoadGrid(player) {
  if (!player || typeof player !== 'object') {
    return { hasPlayer: false, rx: NaN, ry: NaN, junId: null };
  }
  const rawX = player.roadPositionX;
  const rawY = player.roadPositionY;
  const rx = Number(rawX);
  const ry = Number(rawY);
  const jid = player.roadJunId;
  const junId = jid != null && String(jid).trim() ? String(jid).trim() : null;
  return { hasPlayer: true, rx, ry, junId };
}

/** `GET road/self` 与档案合并，供行军预览/提交与服务端 `players` 行一致 */
function mergeMarchPlayerFromRoadSelf(ctxPlayer, roadSelfData) {
  if (!ctxPlayer) return null;
  if (!roadSelfData || typeof roadSelfData !== 'object') return ctxPlayer;
  return {
    ...ctxPlayer,
    roadJunId: roadSelfData.roadJunId ?? ctxPlayer.roadJunId,
    roadPositionX: roadSelfData.roadPositionX ?? ctxPlayer.roadPositionX,
    roadPositionY: roadSelfData.roadPositionY ?? ctxPlayer.roadPositionY,
  };
}

function roadStandSnapshotKey(player) {
  const j = String(player?.roadJunId ?? '').trim();
  const x = Number(player?.roadPositionX);
  const y = Number(player?.roadPositionY);
  if (!j || !Number.isFinite(x) || !Number.isFinite(y)) return '';
  return `${j}|${x}|${y}`;
}

/** 与战术图 BattleMap.css：`--tile: 48px`；窄屏 `(100vw - 61px) / 8` */
export const WORLD_MAP_TILE_MIN = 12;
/** 滚轮/捏合放大硬顶（防异常视口算出过大格） */
export const WORLD_MAP_TILE_ABSOLUTE_CAP = 128;
/** 与战术图 BattleMap.css 窄屏分界一致：`w <= 520` */
export const WORLD_MAP_NARROW_VIEWPORT_MAX = 520;
/** 竖屏默认 `--ws-tile` 下限：地图可宽于视口，换更大格点与 pawn 可点区域 */
export const WORLD_MAP_NARROW_DEFAULT_TILE_FLOOR = 16;

/**
 * 视口宽度下铺满地图列数（含格间 1px gap）所需单格边长。
 * 豫州双郡叠放时高度仍须滚动，上限只按宽度算，避免 1920 屏两侧留黑边。
 */
export function computeMaxTilePx(mapColumns) {
  if (typeof window === 'undefined') return 56;
  const cols = Math.max(1, Number(mapColumns) || 32);
  const availW = Math.max(280, window.innerWidth - 16);
  const byWidth = Math.floor((availW - (cols - 1)) / cols);
  return Math.min(
    WORLD_MAP_TILE_ABSOLUTE_CAP,
    Math.max(WORLD_MAP_TILE_MIN + 1, byWidth),
  );
}

/**
 * 默认单格边长：对齐战斗地图瓦片视觉（可读性优先，允许滚动查看全图）。
 * 窄屏（`w <= WORLD_MAP_NARROW_VIEWPORT_MAX`）默认不低于 `WORLD_MAP_NARROW_DEFAULT_TILE_FLOOR`，
 * 即使宽于视口也接受横向滚动，避免 12～14px 格导致 pawn/城格难点。
 */
function computeDefaultTilePx(mapColumns) {
  if (typeof window === 'undefined') return 48;
  const w = window.innerWidth;
  const availW = Math.max(280, w - 16);
  const battleRef =
    w > WORLD_MAP_NARROW_VIEWPORT_MAX
      ? 48
      : Math.min(48, Math.max(26, Math.floor((availW - 61) / 8)));
  const maxPx = computeMaxTilePx(mapColumns);
  let px = Math.min(maxPx, Math.max(22, battleRef));
  if (w <= WORLD_MAP_NARROW_VIEWPORT_MAX) {
    px = Math.max(WORLD_MAP_NARROW_DEFAULT_TILE_FLOOR, px);
  }
  return px;
}

/**
 * 游戏主界面战略大地图：S1 豫州颍川 + 汝南垂直拼接为单视口（`shared/utils/strategicWorldMapStack`），与 `*_merged.json` 及 `road_jun_id` 郡内坐标对齐。
 */
export default function StrategicWorldMapSection({
  className = '',
  /** 由 `WorldMap` 注入：`{ current: () => void }`，用于守方道路坐标被服务端改写后立即 bump `road-presence` */
  bumpStrategicRoadPresenceRef = null,
  /** `WorldMap` 注入：跳跳棋回放中 true，避免 `getRoadSelf` 中途 refresh 触发立足点误修弹窗 */
  onRoadMarchAnimatingChange = null,
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
  /** 守方在大本营格发起攻打（与 `WorldMap` 战场入口一致） */
  onStartPvpBaseCampSiege = null,
}) {
  const [merged, setMerged] = useState(null);
  const [mapLoadError, setMapLoadError] = useState(null);
  const [garrisonStatsByCityId, setGarrisonStatsByCityId] = useState({});
  /**
   * 郡内他人道路 presence（仅在线 + 锁格），与 31-6 §9.2 / 02 §2.1.2（3）一致。
   * 轮询粒度与现网拉城列表同量级；窗口未聚焦时不轮询以省服。
   */
  const [roadPresence, setRoadPresence] = useState(null);
  /** 供行军成功后立即拉取郡内他人路点（与轮询互补） */
  const roadPresenceFetchRef = useRef(() => Promise.resolve());
  const { player: ctxPlayer, cards: ctxCards, attributeBonusBySlot, refresh, exploreQuota } = usePlayerContext();
  const { mapHudButtonsVisible } = useMapHudVisibility();
  /** 行军模式：与 31-6 §8 一致 */
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
    onRoadMarchAnimatingChange?.(!!roadMarchAnimation);
  }, [roadMarchAnimation, onRoadMarchAnimatingChange]);

  useEffect(() => {
    let cancelled = false;
    setMerged(null);
    setMapLoadError(null);
    const baseUrl = `${import.meta.env.BASE_URL}`;
    loadSan1StrategicMergedStackFromPublic({ baseUrl })
      .then((stack) => {
        if (cancelled) return;
        if (!stack.ok) {
          setMapLoadError(stack.error || '大地图拼接失败');
          return;
        }
        setMerged({
          cells: stack.cells,
          seed: stack.seed,
          version: stack.version,
          mapColumns: stack.mapColumns,
          mapRows: stack.mapRows,
          junId: stack.junId,
          season: stack.season,
          roadCells: stack.roadCells,
          roadConnectivity: stack.roadConnectivity,
        });
      })
      .catch((e) => {
        if (!cancelled) setMapLoadError(e?.message || '大地图加载失败');
      });
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

  const [pvpBaseCamps, setPvpBaseCamps] = useState([]);
  const [pvpBaseCampsLoadState, setPvpBaseCampsLoadState] = useState('loading');
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await warAPI.listWars({ status: 'active', limit: 100 });
        if (cancelled) return;
        if (!r?.success) {
          setPvpBaseCampsLoadState('error');
          return;
        }
        const list = Array.isArray(r.wars) ? r.wars : Array.isArray(r.data) ? r.data : [];
        const camps = list
          .map((w) => {
            if (!w?.baseCamp?.cells?.length) return null;
            const bc = { ...w.baseCamp };
            return {
              ...bc,
              pvpWarId: w.pvpWarId,
              status: w.status,
              attackerFactionId: w.attackerFactionId,
              defenderFactionId: w.defenderFactionId,
              attackerFactionName: w.attackerFactionName,
              defenderFactionName: w.defenderFactionName,
              targetCityId: w.targetCityId ?? w.target_city_id,
              targetCityName: w.targetCityName,
              warName: w.warName,
              sideStats: w.sideStats,
              npcAlive: w.baseCamp.npcAlive,
              npcTotal: w.baseCamp.npcTotal,
            };
          })
          .filter(Boolean);
        setPvpBaseCamps(camps);
        setPvpBaseCampsLoadState('ok');
      } catch {
        if (!cancelled) {
          setPvpBaseCamps([]);
          setPvpBaseCampsLoadState('error');
        }
      }
    };
    void tick();
    const t = setInterval(tick, 12_000);
    const onVis = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const countySeason = merged?.season || 'san_1';
  const cityRuntimeJunIds = useMemo(() => [...SAN_1_STRATEGIC_VERTICAL_STACK_JUN_ORDER], []);
  const playerMarchJunId = useMemo(
    () =>
      String(ctxPlayer?.roadJunId ?? 'san_1_jun_yingchuan').trim() ||
      'san_1_jun_yingchuan',
    [ctxPlayer?.roadJunId],
  );
  const { cityById, factionNameById, loadState: cityLoadState } = useStrategicCountyCityRuntime({
    junIds: cityRuntimeJunIds,
    season: countySeason,
    refreshKey: garrisonStatsRefreshKey,
  });

  const standpointPoiDepsPending = useMemo(
    () =>
      isStrategicStandpointPoiDepsPending({
        cells,
        cityLoadState,
        pvpBaseCampsLoadState,
      }),
    [cells, cityLoadState, pvpBaseCampsLoadState],
  );

  /** `baseCamp` 缺 `junId` 时坐标换算会错位；城表就绪后须补写 `junId`（见 `strategicGridCoordinates`）。 */
  useEffect(() => {
    if (!cityById || typeof cityById !== 'object') return;
    setPvpBaseCamps((prev) => {
      if (!prev.length) return prev;
      let changed = false;
      const next = prev.map((c) => {
        if (String(c.junId ?? c.jun_id ?? '').trim()) return c;
        const tid = String(c.targetCityId ?? '').trim();
        if (!tid) return c;
        const crow = cityById[tid];
        const jfrom = crow?.jun_id ?? crow?.junId;
        if (!jfrom) return c;
        changed = true;
        return { ...c, junId: String(jfrom).trim() };
      });
      return changed ? next : prev;
    });
  }, [cityById]);

  const countyCityRows = useMemo(() => Object.values(cityById || {}), [cityById]);

  /**
   * PVE `wars`（本人参与且 active）+ 本势力 `wars_pvp`（pending/active），按目标城去重（同城 PVP 优先），
   * 再按创建时间升序；「攻城」钮循环滚屏至 `targetCityId`。
   */
  const [ongoingPvpWarsList, setOngoingPvpWarsList] = useState([]);
  const [ongoingPveWarsList, setOngoingPveWarsList] = useState([]);
  const [ongoingSiegeLocateTargets, setOngoingSiegeLocateTargets] = useState([]);
  const siegeWarCycleIndexRef = useRef(0);

  useEffect(() => {
    if (!playerFactionId && !playerId) {
      setOngoingPvpWarsList([]);
      setOngoingPveWarsList([]);
      setOngoingSiegeLocateTargets([]);
      return undefined;
    }
    let cancelled = false;
    const season = countySeason;
    const load = async () => {
      try {
        const pvpPromise =
          playerFactionId != null && String(playerFactionId).trim() !== ''
            ? warAPI
                .listWars({
                  factionId: String(playerFactionId),
                  status: ['pending', 'active'],
                  season,
                  limit: 50,
                })
                .then((res) =>
                  res.success && Array.isArray(res.wars)
                    ? [...res.wars].sort((a, b) => {
                        const ta = Date.parse(a.createdAt || '') || 0;
                        const tb = Date.parse(b.createdAt || '') || 0;
                        if (ta !== tb) return ta - tb;
                        return String(a.pvpWarId || '').localeCompare(String(b.pvpWarId || ''));
                      })
                    : [],
                )
                .catch(() => [])
            : Promise.resolve([]);

        const pvePromise =
          playerId != null &&
          String(playerId).trim() !== '' &&
          playerFactionId != null &&
          String(playerFactionId).trim() !== ''
            ? playerAPI
                .getActivePveSiegeWarsMap(String(playerId), String(playerFactionId), season)
                .then((res) =>
                  res?.success && Array.isArray(res.wars)
                    ? [...res.wars].sort((a, b) => {
                        const ta = Date.parse(a.createdAt || '') || 0;
                        const tb = Date.parse(b.createdAt || '') || 0;
                        if (ta !== tb) return ta - tb;
                        return String(a.warId || '').localeCompare(String(b.warId || ''));
                      })
                    : [],
                )
                .catch(() => [])
            : Promise.resolve([]);

        const [pvpSorted, pveSorted] = await Promise.all([pvpPromise, pvePromise]);
        if (cancelled) return;
        setOngoingPvpWarsList(pvpSorted);
        setOngoingPveWarsList(pveSorted);
        setOngoingSiegeLocateTargets(buildOngoingSiegeLocateTargets(pvpSorted, pveSorted));
      } catch {
        if (!cancelled) {
          setOngoingPvpWarsList([]);
          setOngoingPveWarsList([]);
          setOngoingSiegeLocateTargets([]);
        }
      }
    };
    void load();
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void load();
    }, 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [playerFactionId, playerId, countySeason]);

  const ongoingSiegeLocateSig = useMemo(
    () =>
      ongoingSiegeLocateTargets
        .map((t) => `${t.kind}:${t.kind === 'pvp' ? t.pvpWarId || '' : t.warId || ''}:${t.targetCityId}`)
        .join('|'),
    [ongoingSiegeLocateTargets],
  );
  useEffect(() => {
    siegeWarCycleIndexRef.current = 0;
  }, [ongoingSiegeLocateSig]);

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

  const [tilePx, setTilePx] = useState(() => computeDefaultTilePx(cols));
  const [maxTilePx, setMaxTilePx] = useState(() => computeMaxTilePx(cols));

  useEffect(() => {
    const syncTileBounds = () => {
      const nextMax = computeMaxTilePx(cols);
      setMaxTilePx(nextMax);
      setTilePx((p) => Math.min(nextMax, Math.max(WORLD_MAP_TILE_MIN, p)));
    };
    syncTileBounds();
    window.addEventListener('resize', syncTileBounds);
    return () => window.removeEventListener('resize', syncTileBounds);
  }, [cols]);

  useEffect(() => {
    if (cols && rows) setTilePx(computeDefaultTilePx(cols));
  }, [cols, rows]);

  const onWheelZoomSteps = useCallback((steps) => {
    if (steps === 0) return;
    setTilePx((p) => {
      const next = p + steps * 2;
      return Math.min(maxTilePx, Math.max(WORLD_MAP_TILE_MIN, next));
    });
  }, [maxTilePx]);

  /**
   * 自身标记立点（31-6 §9.1）：`resolveStrategicRecordedStandpointPx`（道路格心 / 离路城寨块心 / 攻方大本营）。
   * 不再回退主城；解析失败时 `standpointError` 非空，由 effect 弹 Toast。
   */
  const strategicSelfPawn = useMemo(() => {
    if (!cells?.length) return null;

    const selfRoad = readSelfPlayerRoadGrid(ctxPlayer);
    const anim = roadMarchAnimation;
    const animHasPath = !!(anim?.path?.length);
    if (!selfRoad.hasPlayer && !animHasPath) return null;

    let cx = null;
    let cy = null;
    let useRoad = false;
    let fromMarchAnim = false;
    let standpointError = null;
    if (animHasPath) {
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
      if (!selfRoad.hasPlayer) return null;
      const { rx: prx, ry: pry, junId: selfJun } = selfRoad;
      if (!Number.isFinite(prx) || !Number.isFinite(pry)) return null;
      const worldCell = selfJun ? playerRoadToWorldMapCell(selfJun, prx, pry) : null;
      const worldRy = worldCell ? worldCell.worldGy : pry;
      const stand = resolveStrategicRecordedStandpointPx({
        cells,
        roadCells: merged?.roadCells,
        mapColumns: cols,
        mapRows: rows,
        countyJunId: playerMarchJunId,
        tilePx,
        playerRoadJunId: selfJun,
        roadX: prx,
        roadY: worldRy,
        citiesInCountyRows: countyCityRows,
        pvpBaseCamps,
      });
      standpointError = stand.standpointError || null;
      if (
        standpointPoiDepsPending &&
        standpointError === STRATEGIC_STANDPOINT_ERROR.UNRESOLVED_OFF_ROAD
      ) {
        return null;
      }
      if (stand.cx == null || stand.cy == null) {
        if (standpointPoiDepsPending && standpointError) return null;
        return { standpointError };
      }
      cx = stand.cx;
      cy = stand.cy;
      useRoad = stand.onRoadCell;
    }

    const portraitUrl = resolveSelfMapPortraitUrl(ctxPlayer, ctxCards, attributeBonusBySlot);
    const factionName = String(ctxPlayer?.factionName || '').trim();
    const charName = String(ctxPlayer?.characterName || '').trim() || '…';
    const displayName = factionName ? `[${factionName}]${charName}` : charName;
    const nameSeq = Array.from(charName);
    const centerGlyph = nameSeq.length ? nameSeq[nameSeq.length - 1] : '…';
    const { current: troopsCurrent, max: troopsMax } = sumEquippedTroopStrength(ctxCards);
    const displayEffect = resolveMapDisplayEffect(ctxCards);
    const focalRx = selfRoad.hasPlayer && Number.isFinite(selfRoad.rx) ? selfRoad.rx : NaN;
    const focalRy = selfRoad.hasPlayer && Number.isFinite(selfRoad.ry) ? selfRoad.ry : NaN;
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
      roadIntercept: ctxPlayer?.roadIntercept ? 1 : 0,
      pawnPlayerId: playerId || null,
      playerSilver: Number.isFinite(Number(ctxPlayer?.silver)) ? Number(ctxPlayer.silver) : null,
      onRoad: useRoad,
      stackStripPeers: strip.stripPeers,
      stackStripEllipsis: strip.showEllipsis,
      displayEffect,
      standpointError,
    };
  }, [
    playerId,
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
    pvpBaseCamps,
    standpointPoiDepsPending,
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
    const selfRoad = readSelfPlayerRoadGrid(ctxPlayer);
    if (!selfRoad.hasPlayer) return null;
    const { rx: prx, ry: pry, junId: selfJun } = selfRoad;
    if (!Number.isFinite(prx) || !Number.isFinite(pry)) return null;
    const worldCell = selfJun ? playerRoadToWorldMapCell(selfJun, prx, pry) : null;
    const worldRy = worldCell ? worldCell.worldGy : pry;
    const r = resolveStrategicRecordedStandpointCell({
      cells,
      roadCells: merged?.roadCells,
      mapColumns: cols,
      mapRows: rows,
      countyJunId: playerMarchJunId,
      playerRoadJunId: selfJun,
      roadX: prx,
      roadY: worldRy,
      citiesInCountyRows: countyCityRows,
      pvpBaseCamps,
    });
    if (!r || r.error || !Number.isFinite(r.gx) || !Number.isFinite(r.gy)) return null;
    return { gx: r.gx, gy: r.gy };
  }, [
    cells,
    roadMarchAnimation,
    merged?.roadCells,
    cols,
    rows,
    playerMarchJunId,
    ctxPlayer,
    countyCityRows,
    pvpBaseCamps,
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
          pvpBaseCamps,
        );
      }
    }
    const selfRoad = readSelfPlayerRoadGrid(ctxPlayer);
    if (!selfRoad.hasPlayer) return '';
    const { rx: prx, ry: pry, junId: selfJun } = selfRoad;
    const worldCell = selfJun ? playerRoadToWorldMapCell(selfJun, prx, pry) : null;
    const worldRy = worldCell ? worldCell.worldGy : pry;
    if (!Number.isFinite(prx) || !Number.isFinite(worldRy)) return '';
    return resolveMergedStandpointStrategicPoiAnchorId(
      cells,
      merged?.roadCells,
      cols,
      rows,
      prx,
      worldRy,
      countyCityRows,
      pvpBaseCamps,
    );
  }, [
    cells,
    merged?.roadCells,
    cols,
    rows,
    countyCityRows,
    pvpBaseCamps,
    roadMarchAnimation,
    ctxPlayer,
  ]);

  const playerStandingPvpWarId = useMemo(() => {
    if (!cells?.length || !pvpBaseCamps.length) return '';
    const anim = roadMarchAnimation;
    let gx;
    let gy;
    if (anim?.path?.length) {
      const i = Math.min(anim.stepIndex, anim.path.length - 1);
      const cell = anim.path[i];
      gx = Number(cell?.x);
      gy = Number(cell?.y);
    } else {
      const selfRoad = readSelfPlayerRoadGrid(ctxPlayer);
      if (!selfRoad.hasPlayer) return '';
      gx = selfRoad.rx;
      const pry = selfRoad.ry;
      const worldCell =
        selfRoad.junId && Number.isFinite(gx) && Number.isFinite(pry)
          ? playerRoadToWorldMapCell(selfRoad.junId, gx, pry)
          : null;
      const worldRy = worldCell ? worldCell.worldGy : pry;
      gy = worldRy;
    }
    if (!Number.isFinite(gx) || !Number.isFinite(gy)) return '';
    const cov = resolveStrategicTilePvpCampCover(Math.trunc(gy), Math.trunc(gx), pvpBaseCamps, cells);
    return cov?.pvpWarId ? String(cov.pvpWarId).trim() : '';
  }, [
    cells,
    pvpBaseCamps,
    roadMarchAnimation,
    ctxPlayer,
  ]);

  /** 首次进入大地图：视口滚至本人锚点（道路格或离路 POI）；无静默主城回退 */
  const didInitialViewportScrollRef = useRef(false);
  const lastStandpointErrorToastRef = useRef('');
  useEffect(() => {
    if (standpointPoiDepsPending) return;
    const err = strategicSelfPawn?.standpointError;
    if (!err) {
      lastStandpointErrorToastRef.current = '';
      return;
    }
    if (lastStandpointErrorToastRef.current === err) return;
    lastStandpointErrorToastRef.current = err;
    setMarchToast({ type: 'error', message: strategicStandpointErrorMessage(err) });
    window.setTimeout(() => setMarchToast(null), 12000);
  }, [strategicSelfPawn?.standpointError, standpointPoiDepsPending]);

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

  /** 郡条「匪寨」定位：同郡连续点击在稳定序各寨间循环（`pickBanditProgressLocateTarget`） */
  const banditProgressLastPoiByJunRef = useRef(/** @type {Record<string, string>} */ ({}));

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

  /** 行军逐格回放：视口居中跟随本人 pawn（31-6 §6） */
  useEffect(() => {
    const anim = roadMarchAnimation;
    if (!anim?.path?.length) return;
    const i = Math.min(anim.stepIndex, anim.path.length - 1);
    const cell = anim.path[i];
    const gx = Number(cell?.x);
    const gy = Number(cell?.y);
    if (!Number.isFinite(gx) || !Number.isFinite(gy)) return;
    scrollStrategicCellNow(gx, gy);
  }, [roadMarchAnimation, scrollStrategicCellNow]);

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
      const jid = String(junId || '').trim();
      const lastPoi = banditProgressLastPoiByJunRef.current[jid] ?? null;
      const cell = pickBanditProgressLocateTarget(banditAnchorCellsByJun, jid, ref, lastPoi);
      if (!cell) return '本郡未找到匪寨锚点';
      banditProgressLastPoiByJunRef.current[jid] = cell.banditPoiId;
      scrollStrategicCellNow(cell.gx, cell.gy);
      return null;
    },
    [strategicNav, locateSelfStrategicCell, banditAnchorCellsByJun, scrollStrategicCellNow],
  );

  const requestSiegeProgressLocate = useCallback(() => {
    if (!strategicNav?.scrollToStrategicCell) return '地图未就绪';
    const wars = ongoingSiegeLocateTargets;
    if (!wars.length) return '暂无进行中的攻城目标（PVE wars 或本势力 PVP wars_pvp）';
    const n = wars.length;
    const idx = siegeWarCycleIndexRef.current % n;
    const war = wars[idx];
    siegeWarCycleIndexRef.current = idx + 1;
    const cityId = war?.targetCityId != null ? String(war.targetCityId).trim() : '';
    if (!cityId) return '战事缺少目标城';
    const row =
      countyCityRows.find((c) => String(c.city_id ?? c.cityId ?? c.id ?? '').trim() === cityId) || null;
    if (!row) return `目标城未在本地城表（${cityId}）`;
    const cell = cityDbPosToWorldStrategicCell(row);
    if (!cell) return `${war.targetCityName || '目标城'} 缺少战略坐标`;
    const ok = scrollStrategicCellNow(cell.gx, cell.gy);
    return ok ? null : '地图未就绪';
  }, [strategicNav, ongoingSiegeLocateTargets, countyCityRows, scrollStrategicCellNow]);

  const ongoingWarEntries = useMemo(() => {
    const pveWithFaction = (ongoingPveWarsList || []).map((w) => ({
      ...w,
      attackerFactionName: w.attackerFactionName || ctxPlayer?.factionName || null,
    }));
    return buildMapCornerOngoingWarEntries({
      pvpWars: ongoingPvpWarsList,
      pveWars: pveWithFaction,
      playerFactionId,
    });
  }, [ongoingPvpWarsList, ongoingPveWarsList, playerFactionId, ctxPlayer?.factionName]);

  const scrollToWarTargetCity = useCallback(
    (targetCityId) => {
      const cityId = String(targetCityId || '').trim();
      if (!cityId || !strategicNav?.scrollToStrategicCell) return;
      const row =
        countyCityRows.find((c) => String(c.city_id ?? c.cityId ?? c.id ?? '').trim() === cityId) || null;
      if (!row) return;
      const cell = cityDbPosToWorldStrategicCell(row);
      if (cell) scrollStrategicCellNow(cell.gx, cell.gy);
    },
    [strategicNav, countyCityRows, scrollStrategicCellNow],
  );

  useEffect(() => {
    const cityId = strategicNav?.peekPendingScrollToCityId?.();
    if (!cityId) return;
    const ok = scrollToCityById(cityId, {
      cities: countyCityRows,
      nav: strategicNav,
      scrollNow: scrollStrategicCellNow,
    });
    if (ok) strategicNav?.clearPendingScrollToCityId?.();
  }, [strategicNav, countyCityRows, cells, scrollStrategicCellNow]);

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
        title: '定位本郡匪寨：首次为距本人最近；再次点击在本郡各寨间循环切换',
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
        title: ongoingSiegeLocateTargets.length
          ? `定位攻城目标城（${ongoingSiegeLocateTargets.length} 处，同城 PVP 优先）：按创建时间从早到晚循环点击`
          : '暂无进行中的攻城目标（PVE wars 或本势力 PVP wars_pvp）',
        disabled: ongoingSiegeLocateTargets.length === 0,
        requestLocate: requestSiegeProgressLocate,
      },
      banditByJunId,
      ongoingWars: ongoingWarEntries.map((entry) => ({
        entry,
        requestLocate: () => {
          scrollToWarTargetCity(entry.targetCityId);
          return null;
        },
      })),
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
    ongoingSiegeLocateTargets.length,
    ongoingWarEntries,
    scrollToWarTargetCity,
  ]);

  /**
   * 郡内「他人」道路 pawn（仅在线；服务端已按 `playerActivity` 5 分钟窗过滤并隐去敏感资源）。
   * 在未接入他人兵力与将领头像前，只展示：势力名 + 角色名 + 圆心末字；与自身 pawn 共用同一组件。
   */
  const strategicOtherPawns = useMemo(() => {
    if (!Array.isArray(roadPresence?.others) || !roadPresence.others.length) return [];
    const selfRoad = readSelfPlayerRoadGrid(ctxPlayer);
    const selfRx = selfRoad.hasPlayer ? selfRoad.rx : NaN;
    const selfRy = selfRoad.hasPlayer ? selfRoad.ry : NaN;
    const selfPortraitUrl = resolveSelfMapPortraitUrl(ctxPlayer, ctxCards, attributeBonusBySlot);
    const selfCharName = String(ctxPlayer?.characterName || '').trim() || '…';
    const selfFactionName = String(ctxPlayer?.factionName || '').trim();
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
        const worldCellOther = playerRoadToWorldMapCell(otherJun, rx, ry);
        const worldRyOther = worldCellOther ? worldCellOther.worldGy : ry;
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
          citiesInCountyRows: countyCityRows,
          pvpBaseCamps,
        });
        const { cx, cy } =
          pos.cx != null && pos.cy != null
            ? pos
            : strategicRoadCellCenterPx(rx, worldRyOther, tilePx);
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
          displayEffect: other.mapDisplayEffect || null,
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
    pvpBaseCamps,
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
        onRoadMarchAnimatingChange?.(false);
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
  }, [roadMarchAnimation, refresh, onRoadEncounterBattle, onRoadMarchAnimatingChange]);

  /** 打开沿路移动确认（道路双击与行军点选共用；不依赖是否已点过叠层「行军」） */
  const openMarchConfirmForStrategicCell = useCallback(
    async (gx, gy) => {
      if (roadMarchAnimation) return;
      if (!playerId || !ctxPlayer) return;
      if (!merged?.roadCells?.length) {
        setMarchToast({ type: 'error', message: '当前地图暂无道路数据' });
        return;
      }
      const clickSlice = playerRoadJunSliceFromWorldGy(gy);
      if (!clickSlice) {
        setMarchToast({ type: 'error', message: '目标格坐标无效' });
        return;
      }
      setMarchSubmitError('');
      let marchPlayer = ctxPlayer;
      try {
        const rs = await playerAPI.getRoadSelf(playerId);
        if (rs?.success && rs.data) {
          marchPlayer = mergeMarchPlayerFromRoadSelf(ctxPlayer, rs.data) || ctxPlayer;
        }
      } catch (_) {
        /* 预览退化为档案路点 */
      }
      const marchJunId =
        String(marchPlayer?.roadJunId ?? playerMarchJunId).trim() || playerMarchJunId;
      const roadStandSnapshot = roadStandSnapshotKey(marchPlayer);
      const useWorldStackMarch = rows > STRATEGIC_COUNTY_MAP_ROWS;

      const cell = cells[gy]?.[gx];
      const here = `${gx},${gy}`;
      /**
       * 与匪寨同链：城 cover → `readStrategicCellAnchorId` + `collectStrategicPoiFootprint`（含 PVP：`pvpBaseCamps` + `resolvePvpBaseCampWarIdAtMergedCell` 补格上无 `pvpWarId` 的 footprint）。
       */
      let marchTargetPoiId = null;
      const cityCover = resolveStrategicTileCityCover(cells, gy, gx);
      const cityAnchorFromCover = readStrategicCellAnchorId(cityCover?.anchorCell);
      if (cityAnchorFromCover) {
        marchTargetPoiId = String(cityAnchorFromCover);
      } else {
        const wIdFoot =
          pvpBaseCamps?.length > 0
            ? resolvePvpBaseCampWarIdAtMergedCell(gy, gx, pvpBaseCamps, cols, rows)
            : '';
        const cid = String(readStrategicCellAnchorId(cell) || wIdFoot || '').trim();
        if (cid) {
          const rowHint = cityById?.[cid];
          const fpMeta = rowHint
            ? buildStrategicPoiFootprintFromDbCityRow(rowHint, cols, rows, cells)
            : collectStrategicPoiFootprint(cells, cid, cols, rows, pvpBaseCamps);
          if (fpMeta?.keys?.has(here)) marchTargetPoiId = cid;
        }
      }

      let pathRes = null;
      if (marchTargetPoiId) {
        const row = cityById?.[marchTargetPoiId];
        const pvpCampSlice =
          pvpBaseCamps?.length > 0
            ? pvpBaseCamps.find((w) => String(w.pvpWarId || '') === String(marchTargetPoiId)) || null
            : null;
        const gate = canPlayerMarchToPoiCity({
          cityRow: row,
          targetPoiId: marchTargetPoiId,
          playerFactionId: marchPlayer?.factionId,
          pvpCampAttackerFactionId:
            pvpCampSlice && String(pvpCampSlice.pvpWarId || '') === String(marchTargetPoiId)
              ? pvpCampSlice.attackerFactionId
              : null,
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
          countyJunId: marchJunId,
          player: marchPlayer,
          targetPoiId: marchTargetPoiId,
          targetCityDbRow: row ?? null,
          citiesInCountyRows: countyCityRows,
          useWorldStackRoadCoords: useWorldStackMarch,
          pvpCampBaseCamp:
            pvpCampSlice && String(pvpCampSlice.pvpWarId || '') === String(marchTargetPoiId)
              ? {
                  cells: pvpCampSlice.cells,
                  junId: pvpCampSlice.junId,
                  anchorOx: pvpCampSlice.anchorOx,
                  anchorOy: pvpCampSlice.anchorOy,
                  orientation: pvpCampSlice.orientation,
                }
              : null,
          pvpBaseCamps,
        });
      } else {
        pathRes = buildMarchPath({
          cells,
          roadCells: merged.roadCells,
          mapColumns: cols,
          mapRows: rows,
          countyJunId: marchJunId,
          player: marchPlayer,
          targetGx: gx,
          targetGy: gy,
          citiesInCountyRows: countyCityRows,
          useWorldStackRoadCoords: useWorldStackMarch,
          pvpBaseCamps,
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
        player: marchPlayer,
      });
      if (!preview.steps && !pathRes.targetPoiId) {
        setMarchToast({ type: 'info', message: '目标与当前立点相同，无需移动' });
        return;
      }
      const others = Array.isArray(roadPresence?.others) ? roadPresence.others : [];
      const last = pathRes.path[pathRes.path.length - 1];
      const lastLoc = playerRoadJunSliceFromWorldGy(last.y);
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
          marchPlayer.factionId != null &&
          occ.factionId != null &&
          String(marchPlayer.factionId) === String(occ.factionId);
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
      let poiTargetName = '';
      if (tid && cityById?.[tid]) {
        poiTargetName = String(cityById[tid].city_name || cityById[tid].cityName || '').trim();
      } else if (tid && pvpBaseCamps?.length) {
        const wc = pvpBaseCamps.find((w) => String(w.pvpWarId || '') === String(tid));
        if (wc) {
          poiTargetName =
            (wc.targetCityName != null && String(wc.targetCityName).trim()) ||
            (wc.warName != null && String(wc.warName).trim()) ||
            '攻方大本营';
        }
      }
      setMarchConfirm({
        path: pathRes.path,
        onRoadAtStart: pathRes.onRoadAtStart,
        preview,
        encounterHint,
        targetPoiId: tid,
        poiTargetName: poiTargetName || null,
        clientRequestId: createRoadClientRequestId('move'),
        roadStandSnapshot,
        marchJunId,
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
      pvpBaseCamps,
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
      let submitJunId = String(marchConfirm.marchJunId ?? playerMarchJunId).trim() || playerMarchJunId;
      const expectedStandSnap = String(marchConfirm.roadStandSnapshot || '').trim();
      try {
        const rs = await playerAPI.getRoadSelf(playerId);
        if (!rs?.success || !rs.data) {
          setMarchSubmitError('无法核实当前路点，请稍后重试');
          setMarchSubmitLoading(false);
          return;
        }
        const marchPlayer = mergeMarchPlayerFromRoadSelf(ctxPlayer, rs.data);
        const serverSnap = roadStandSnapshotKey(marchPlayer);
        if (expectedStandSnap && serverSnap && serverSnap !== expectedStandSnap) {
          exitStrategicMarchMode();
          await refresh({ silent: true });
          setMarchToast({
            type: 'error',
            message: '路点档案已变更，请重新选择行军目标。',
          });
          window.setTimeout(() => setMarchToast(null), 8000);
          return;
        }
        const j = String(marchPlayer?.roadJunId ?? '').trim();
        if (j) submitJunId = j;
      } catch (_) {
        setMarchSubmitError('无法核实当前路点，请稍后重试');
        setMarchSubmitLoading(false);
        return;
      }
      const clientRequestId =
        marchConfirm.clientRequestId || createRoadClientRequestId('move');
      const body = {
        season: countySeason,
        junId: submitJunId,
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

      onRoadMarchAnimatingChange?.(true);

      const onRoadAtStart = marchConfirm.onRoadAtStart;
      const reqPath = marchConfirm.path;
      const confirmedTargetPoiId = marchConfirm.targetPoiId || null;
      const confirmedMarchJunId = submitJunId;
      const encounter = res.data?.encounter || null;
      const defenderAutoRetreats = res.data?.defenderAutoRetreats;

      setMarchConfirm(null);
      setStrategicMarchMode(false);
      setMarchSubmitLoading(false);

      if (res.data?.idempotent) {
        onRoadMarchAnimatingChange?.(false);
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
      const fullPathWorld = roadMovePathForMarchAnimation(fullPath, rows);
      let animPath = buildMarchAnimPath(onRoadAtStart, fullPathWorld, stepsApplied);
      const poiAnchor = res.data?.poiAnchor;
      const destJun =
        res.data?.roadJunId != null
          ? String(res.data.roadJunId).trim()
          : String(confirmedTargetPoiId ? confirmedMarchJunId : '').trim();
      if (
        poiAnchor &&
        confirmedTargetPoiId &&
        stepsApplied >= fullPath.length &&
        destJun
      ) {
        animPath = appendPoiSnapToMarchAnimPath(animPath, poiAnchor, destJun);
      }

      if (animPath.length <= 1) {
        onRoadMarchAnimatingChange?.(false);
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
      onRoadMarchAnimatingChange?.(false);
      exitStrategicMarchMode();
      setMarchToast({ type: 'error', message: err?.message || '网络错误' });
      window.setTimeout(() => setMarchToast(null), 8000);
    }
  }, [
    marchConfirm,
    playerId,
    countySeason,
    onRoadMarchAnimatingChange,
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
        {mapHudButtonsVisible ? (
          <div className="pointer-events-none absolute left-2 top-2 z-30">
            <div className="pointer-events-auto">
              <ZhouJunMapJumpPanel
                variant="mapOverlay"
                locateSelfCell={locateSelfStrategicCell}
                progressSidebar={mapJumpProgressSidebar}
              />
            </div>
          </div>
        ) : null}
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
          maxTilePx={maxTilePx}
          cityById={cityById}
          factionNameById={factionNameById}
          playerId={playerId}
          playerFactionId={playerFactionId}
          siegeLoading={siegeLoading}
          onStartSiegeForCity={onStartSiegeForCity}
          garrisonStatsByCityId={garrisonStatsByCityId}
          garrisonStatsRefreshKey={garrisonStatsRefreshKey}
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
          playerStandingPvpWarId={playerStandingPvpWarId}
          pvpBaseCamps={pvpBaseCamps}
          onStartPvpBaseCampSiege={onStartPvpBaseCampSiege}
        />
      </div>
      <StrategicMarchMoveConfirm
        open={!!marchConfirm}
        onClose={dismissMarchConfirm}
        onConfirm={submitMarchMove}
        loading={marchSubmitLoading}
        errorMessage={marchSubmitError}
        pathLength={marchConfirm?.path?.length ?? 0}
        billableRoadSteps={marchConfirm?.preview?.steps ?? 0}
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
