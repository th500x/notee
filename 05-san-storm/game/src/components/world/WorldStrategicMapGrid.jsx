import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import WorldStrategicMapTile from './WorldStrategicMapTile';
import { buildCampaignCellTooltipInfo } from '@/components/battle/battleConstants';
import {
  WORLD_MAP_DEFAULT_FACTION_LABELS,
  buildWorldMapCityPanelProps,
  parentCityIdsWithSubsidiaryExplore,
  worldMapCityIsPlayerSameFaction,
  worldMapCityTypeAllowsMainCitySet,
} from '@/utils/worldMapCityPanelCopy';
import { garrisonAPI } from '@/services/garrisonApi';
import {
  resolveStrategicTileCityCover,
  STRATEGIC_MAP_FOOTPRINT_VISUAL_SELECTOR,
} from '@/utils/strategicMapTileContext';
import { useTileTooltipClamp } from '@/components/battle/useTileTooltipClamp';
import TileTooltipContent from '@/components/battle/TileTooltipContent';
import StrategicSiegeWarFloatingPanel from '@/components/world/StrategicSiegeWarFloatingPanel';
import { useStrategicMapTooltipClickMode } from '@/hooks/useStrategicMapTooltipClickMode';
import { useStrategicMapNavigation } from '@/contexts/StrategicMapNavigationContext';
import {
  buildStrategicRoadOverlayPathD,
  ROAD_CONNECTIVITY_4,
} from '@shared/utils/strategicRoadOverlay.js';
import { isBanditMapObjectId } from '@shared/utils/smallMapEnemyRoster';
import { readStrategicCellAnchorId } from '@shared/utils/strategicCellAnchorId.js';
import '@/components/battle/BattleMap.css';
import './WorldStrategicMap.css';
import { PHASE } from '@/components/event/EventConstants';
import { strategicExploreReopenBridge } from '@/utils/strategicExploreReopenBridge.js';
import { primeStrategicCityWildernessMarketTab } from './WorldMapCityInfoBlock.jsx';
import StrategicMapSelfPawn from './StrategicMapSelfPawn';
import StrategicMapEventHintBubble from './StrategicMapEventHintBubble';

const WS_QUAD_CLASS = {
  A: 'ws-quad-frame ws-quad-a',
  B: 'ws-quad-frame ws-quad-b',
  C: 'ws-quad-frame ws-quad-c',
  D: 'ws-quad-frame ws-quad-d',
};

/** PC 点击出 tooltip 时：按下先不抢 capture，平移需超过此距离再开始，避免「点格子」被当成拖拽 */
const WS_PAN_MOUSE_DRAG_THRESHOLD_PX = 5;
const WS_PAN_MOUSE_DRAG_THRESHOLD_SQ = WS_PAN_MOUSE_DRAG_THRESHOLD_PX * WS_PAN_MOUSE_DRAG_THRESHOLD_PX;

/**
 * 合并图有匪寨 **`banditPoiId`**，但郡城表 `cityById` 无该行时：用格上文案拼最小行，避免误走「城况未同步」。
 * @param {string} banditPoiId
 * @param {{ cityName?: string, city_name?: string, name?: string }|null|undefined} hintCell
 */
function syntheticBanditProgressRowFromAnchorCell(banditPoiId, hintCell) {
  const tid = String(banditPoiId || '').trim();
  const nameRaw =
    (hintCell && (hintCell.cityName || hintCell.city_name || hintCell.name)) || tid;
  const name = String(nameRaw).trim() || tid;
  return {
    banditPoiId: tid,
    bandit_poi_id: tid,
    city_name: name,
    cityName: name,
    city_type: 'bandit_camp',
    cityType: 'bandit_camp',
  };
}

/**
 * @param {object} row - cities 行或匪寨合成行
 * @param {string} anchorKey - 城池：`cityId`；匪寨：**`banditPoiId`**
 * @param {object} hd - hoverDataRef.current
 * @param {number|null} onDutyCount
 */
function buildStrategicWorldMapCityTooltip(row, anchorKey, hd, onDutyCount) {
  const fb = hd.factionNameById || {};
  const statsMap = hd.garrisonStatsByCityId || {};
  const slotRaw = statsMap[anchorKey]?.slot_count;
  const slotNum = slotRaw != null ? Number(slotRaw) : null;

  const base = buildWorldMapCityPanelProps(row, {
    factionNameById: fb,
    playerFactionId: hd.playerFactionId,
    playerId: hd.playerId,
    siegeQuota: null,
    siegeLoading: hd.siegeLoading === true,
    garrisonSlotCount: Number.isFinite(slotNum) ? slotNum : null,
    onDutyCount,
    cityById: hd.cityById,
  });

  const isOwn =
    !!hd.playerFactionId &&
    worldMapCityIsPlayerSameFaction(row, hd.playerFactionId);
  const canAct = !!(isOwn && hd.playerId && anchorKey && !base.isBanditStronghold);
  const hasSubsidiaryTabs = !!(base.subsidiaryExplore?.wilderness || base.subsidiaryExplore?.market);
  /** 城备/城况等分段需可点击，与无附属荒郊/集市时一致 */
  const hasCityInfoTabs = !base.syncErrorMessage;
  const canSetMainCity =
    canAct &&
    worldMapCityTypeAllowsMainCitySet(row) &&
    typeof hd.onSetMainCityRequest === 'function';

  const canSiegeThis =
    !base.isBanditStronghold &&
    !isOwn &&
    !!hd.playerId &&
    typeof hd.onStartSiegeForCity === 'function';

  return {
    type: 'worldMapCity',
    interactive: canAct || hasSubsidiaryTabs || hasCityInfoTabs || canSetMainCity || canSiegeThis,
    ...base,
    cityId: base.isBanditStronghold ? null : anchorKey,
    banditPoiId: base.isBanditStronghold ? base.banditPoiId ?? anchorKey : base.banditPoiId ?? null,
    factionDisplayMap: { ...WORLD_MAP_DEFAULT_FACTION_LABELS, ...fb },
    onStartSiege:
      canSiegeThis
        ? () => {
            hd.onStartSiegeForCity(anchorKey, row);
            hd.closeStrategicCityTooltip?.();
          }
        : undefined,
    showOwnCityActions: canAct,
    playerOnDutyForThisCity: !!(
      hd.playerOnDuty &&
      !base.isBanditStronghold &&
      hd.playerOnDutyCityId === anchorKey
    ),
    onOpenGarrison:
      canAct && typeof hd.onOpenGarrisonForCity === 'function'
        ? () => {
            hd.onOpenGarrisonForCity(anchorKey, base.cityBaseName);
            hd.closeStrategicCityTooltip?.();
          }
        : undefined,
    onToggleDutyRequest:
      canAct && typeof hd.onToggleDutyForCity === 'function'
        ? hd.onToggleDutyForCity
        : undefined,
    onDutyError: typeof hd.onDutyError === 'function' ? hd.onDutyError : undefined,
    onAfterOwnCityAction:
      canAct && typeof hd.closeStrategicCityTooltip === 'function'
        ? hd.closeStrategicCityTooltip
        : undefined,
    subsidiaryExploreEmbed: hd.subsidiaryExploreEmbed ?? null,
    closeStrategicCityTooltip:
      typeof hd.closeStrategicCityTooltip === 'function' ? hd.closeStrategicCityTooltip : undefined,
    ...(canSetMainCity
      ? {
          mainCityId: hd.playerMainCityId ?? null,
          mainCityChangedAt: hd.playerMainCityChangedAt ?? null,
          playerSilver: hd.playerSilver ?? null,
          onSetMainCityRequest: hd.onSetMainCityRequest,
          onSetMainCityError: hd.onSetMainCityError,
          onOpenBarracksPost:
            typeof hd.onOpenBarracksPost === 'function'
              ? () => {
                  hd.onOpenBarracksPost(anchorKey, base.cityBaseName);
                  hd.closeStrategicCityTooltip?.();
                }
              : undefined,
          onOpenSanGongFu:
            typeof hd.onOpenSanGongFu === 'function'
              ? () => {
                  hd.onOpenSanGongFu(anchorKey, base.cityBaseName);
                  hd.closeStrategicCityTooltip?.();
                }
              : undefined,
        }
      : {}),
    /** 战略地图：外框 295×395px 写死（BattleMap.css） */
    uniformStrategicPanel: true,
    onStartBanditRaid:
      base.isBanditStronghold && typeof hd.onStartBanditRaid === 'function'
        ? (payload) => {
            hd.onStartBanditRaid(payload);
            hd.closeStrategicCityTooltip?.();
          }
        : undefined,
    banditRaidStartBlockedReason:
      base.isBanditStronghold && typeof hd.banditRaidStartBlockedReason === 'string'
        ? hd.banditRaidStartBlockedReason
        : null,
    postBanditRaidRefreshKey:
      base.isBanditStronghold && Number.isFinite(Number(hd.postBanditRaidRefreshKey))
        ? Number(hd.postBanditRaidRefreshKey)
        : 0,
  };
}

/**
 * 战略层郡大地图格网（单郡 32×40；多郡垂直叠放时可为 32×80 等）。
 * 与 `CampaignMapGrid` 分离：无战役部署、无部队层、无战斗引擎。
 * Tooltip：城池有 **`cityId`** 且在 `cityById` 有行时，与 `WorldMapCityInfoBlock` 同款（驻地编组 / 披挂 / 攻城等）。
 * 匪寨用格上 **`banditPoiId`**（`readStrategicCellAnchorId`）；可无表行：合成最小行走匪寨专用面板。
 */
export default function WorldStrategicMapGrid({
  cells,
  seed,
  mapColumns = 32,
  mapRows = 40,
  title = null,
  meta = null,
  tilePx = 20,
  setTilePx = null,
  minTilePx = 12,
  maxTilePx = 56,
  onWheelZoomSteps = null,
  cityById = null,
  factionNameById = null,
  playerId = null,
  playerFactionId = null,
  siegeLoading = false,
  onStartSiegeForCity = null,
  garrisonStatsByCityId = null,
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
  /** 郡内道路格（merged.json）；仅展示，寻路以同数据为准 */
  roadCells = null,
  /** `'4'` 四连通 | `'8'` 八连通（画线邻接与此一致） */
  roadConnectivity = ROAD_CONNECTIVITY_4,
  /** 城名标签：显式盟友 `faction_id`（结盟接入后由上层传入） */
  strategicCityLabelAllyFactionIds = null,
  /** 城名标签：显式非敌对 `faction_id` */
  strategicCityLabelNonHostileFactionIds = null,
  /**
   * 全屏浮层（三公府 / 驻地编组 / 军营）打开或刚关闭时：强制收起 portal 城池 tooltip。
   * 避免 `tile-tooltip--interactive`（高 z、pointer-events:auto）在触屏上继续吃掉阳翟 2×2 的首笔触摸。
   */
  strategicFullScreenOverlayOpen = false,
  /** 攻城/探索战斗等：`WorldMap` 为 true 时不显示 event_hint portal */
  strategicMapEventHintSuppressed = false,
  /** 玩家自身标记（主城块中心；见 31-6）：`cx, cy, portraitUrl, displayName, centerGlyph, troopsCurrent, troopsMax` */
  strategicSelfPawn = null,
  /** 郡内在线他人道路 pawn 列表（31-6 §12.2、02 §2.1.2（3））；`road-presence` 结果 */
  strategicOtherPawns = null,
  /** 郡内 road_encounters 锁格列表（status IN ('pending','fighting')）；用于高亮与落点禁区提示 */
  strategicRoadLockedCells = null,
  /** 战略行军模式（本人叠层「行军」入口；道路选点 / road/move 接续开发） */
  strategicMarchMode = false,
  /** `road/move` 成功后跳跳棋逐格回放中：禁行军格点选与再次进入行军 */
  strategicRoadMarchAnimating = false,
  onStrategicSelfMarchModeRequest = null,
  onStrategicSelfMarchModeExit = null,
  /** 行军模式下点击道路格 `(gridX, gridY)`（与 `data-strategic-x/y` 一致） */
  onStrategicMarchCellPick = null,
  /** 道路开战模式切换成功后刷新档案（`road_intercept` / 银两） */
  onStrategicRoadSelfUpdated = null,
  /** 探索结算后大地图指引文案（`event_hint`）；漫画对白框锚在本人路点 */
  pendingMapEventHint = null,
  /** 匪寨爬塔：扣次成功后由上层打开 `BattleArena`（payload 含 smallMapPveLoot / enemySlotRarities） */
  onStartBanditRaid = null,
  /** 与攻城相同的战略门闸文案；有值时 tooltip 内攻打按钮旁展示 */
  banditRaidStartBlockedReason = null,
  postBanditRaidRefreshKey = 0,
}) {
  const strategicNav = useStrategicMapNavigation();
  const tooltipClickMode = useStrategicMapTooltipClickMode();
  const [tooltipContent, setTooltipContent] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const tooltipContentRef = useRef(null);
  tooltipContentRef.current = tooltipContent;
  const lastTooltipAnchorKeyRef = useRef(null);
  const { tooltipRef, tooltipStyle } = useTileTooltipClamp(tooltipContent, tooltipPos);
  const wrapRef = useRef(null);
  /** 本人路点「行军/关闭/来战」操作条打开时隐藏 event_hint portal，避免与 z-[10091] 叠层冲突 */
  const [strategicSelfPawnOverlayOpen, setStrategicSelfPawnOverlayOpen] = useState(false);
  const zoomRef = useRef(onWheelZoomSteps);
  zoomRef.current = onWheelZoomSteps;
  const tilePxRef = useRef(tilePx);
  tilePxRef.current = tilePx;
  const minTileRef = useRef(minTilePx);
  minTileRef.current = minTilePx;
  const maxTileRef = useRef(maxTilePx);
  maxTileRef.current = maxTilePx;
  const [draggingPan, setDraggingPan] = useState(false);
  const panRef = useRef(null);

  const hoverGenRef = useRef(0);
  const leaveTooltipTimerRef = useRef(null);
  const tooltipInteractiveRef = useRef(false);
  tooltipInteractiveRef.current = !!tooltipContent?.interactive;

  const hoverDataRef = useRef({});
  /** 战略城池 tooltip 打开时记录锚点，便于 profile 刷新后重建内容（否则 mainCityId 等仍是快照） */
  const strategicCityTooltipMetaRef = useRef({ cityId: null, banditPoiId: null, onDutyCount: null });

  /**
   * 探索结算关弹窗后，浏览器常把同一指针的后续 click 落在底下的战略格上；在「点击模式」下会触发
   * `handleWrapClickCapture` 关层，或命中「同城再点关层」分支。用内嵌的 `subsidiaryExploreEmbed.phase`
   * 在 REWARD→RETURNING、RETURNING→IDLE 后短窗内禁止这两种误关。
   */
  const explorePhaseSyncRef = useRef(subsidiaryExploreEmbed?.phase);
  const suppressStrategicCityClickDismissUntilRef = useRef(0);

  const clearLeaveTooltipTimer = useCallback(() => {
    if (leaveTooltipTimerRef.current != null) {
      clearTimeout(leaveTooltipTimerRef.current);
      leaveTooltipTimerRef.current = null;
    }
  }, []);

  const dismissTooltip = useCallback(() => {
    hoverGenRef.current += 1;
    lastTooltipAnchorKeyRef.current = null;
    strategicCityTooltipMetaRef.current = { cityId: null, banditPoiId: null, onDutyCount: null };
    setTooltipContent(null);
  }, []);

  const scheduleTooltipHide = useCallback(
    (delayMs) => {
      clearLeaveTooltipTimer();
      if (delayMs <= 0) {
        dismissTooltip();
        return;
      }
      leaveTooltipTimerRef.current = setTimeout(() => {
        leaveTooltipTimerRef.current = null;
        dismissTooltip();
      }, delayMs);
    },
    [clearLeaveTooltipTimer, dismissTooltip],
  );

  const closeTooltipNow = useCallback(() => {
    clearLeaveTooltipTimer();
    dismissTooltip();
  }, [clearLeaveTooltipTimer, dismissTooltip]);

  hoverDataRef.current = {
    cells,
    cityById,
    factionNameById,
    playerId,
    playerFactionId,
    siegeLoading,
    onStartSiegeForCity,
    garrisonStatsByCityId,
    playerOnDuty,
    playerOnDutyCityId,
    onOpenGarrisonForCity,
    onToggleDutyForCity,
    onDutyError,
    subsidiaryExploreEmbed,
    closeStrategicCityTooltip: closeTooltipNow,
    playerMainCityId,
    playerMainCityChangedAt,
    playerSilver,
    onSetMainCityRequest,
    onSetMainCityError,
    onOpenBarracksPost,
    onOpenSanGongFu,
    onStartBanditRaid,
    banditRaidStartBlockedReason,
    postBanditRaidRefreshKey,
  };

  const scheduleLeaveFromTile = useCallback(() => {
    const ms = tooltipInteractiveRef.current ? 220 : 80;
    scheduleTooltipHide(ms);
  }, [scheduleTooltipHide]);

  /**
   * 战略格「城池」浮层（荒郊/集市连点探索）：禁止仅靠「指针离开瓦片 / 离开 portal / 离开地图滚动区」
   * 触发延时关层。否则探索结束底栏重现、Clamp 重算位置、瓦片与 portal 间移动等都会产生 mouseleave，
   * 约 80～260ms 后误关浮层，玩家误以为被踢回「纯大地图」。
   */
  const scheduleLeaveFromTileIfAllowed = useCallback(() => {
    const tc = tooltipContentRef.current;
    if (tc?.type === 'worldMapCity' && tc?.uniformStrategicPanel && tc?.interactive) return;
    scheduleLeaveFromTile();
  }, [scheduleLeaveFromTile]);

  const scheduleLeaveFromWrap = useCallback(() => {
    const tc = tooltipContentRef.current;
    if (tc?.type === 'worldMapCity' && tc?.uniformStrategicPanel && tc?.interactive) return;
    const ms = tooltipInteractiveRef.current ? 260 : 0;
    scheduleTooltipHide(ms);
  }, [scheduleTooltipHide]);

  useEffect(() => () => clearLeaveTooltipTimer(), [clearLeaveTooltipTimer]);

  const prevStrategicOverlayRef = useRef(false);
  useEffect(() => {
    const on = !!strategicFullScreenOverlayOpen;
    const was = prevStrategicOverlayRef.current;
    prevStrategicOverlayRef.current = on;
    if (on) {
      closeTooltipNow();
      return;
    }
    if (was) closeTooltipNow();
  }, [strategicFullScreenOverlayOpen, closeTooltipNow]);

  useEffect(() => {
    const m = strategicCityTooltipMetaRef.current;
    if (!m.cityId && !m.banditPoiId) return;
    const tc = tooltipContentRef.current;
    if (!tc || tc.type !== 'worldMapCity') return;
    const hd = hoverDataRef.current;
    const duty = Number.isFinite(m.onDutyCount) ? m.onDutyCount : null;
    if (m.cityId) {
      const row = hd.cityById?.[m.cityId];
      if (row) {
        setTooltipContent(buildStrategicWorldMapCityTooltip(row, m.cityId, hd, duty));
      }
      return;
    }
    if (m.banditPoiId && isBanditMapObjectId(m.banditPoiId)) {
      const hint = { cityName: tc.cityTitle, city_name: tc.cityTitle };
      const synth = syntheticBanditProgressRowFromAnchorCell(m.banditPoiId, hint);
      setTooltipContent(buildStrategicWorldMapCityTooltip(synth, m.banditPoiId, hd, duty));
    }
  }, [
    cityById,
    playerMainCityId,
    playerMainCityChangedAt,
    playerSilver,
    playerOnDuty,
    playerOnDutyCityId,
    subsidiaryExploreEmbed,
    garrisonStatsByCityId,
    siegeLoading,
    onOpenBarracksPost,
    onOpenSanGongFu,
    onStartBanditRaid,
    banditRaidStartBlockedReason,
    postBanditRaidRefreshKey,
  ]);

  useEffect(() => {
    if (!strategicNav?.registerResolveStrategicAnchorForCityId) return undefined;
    const resolveStrategicAnchorForCityId = (cityId) => {
      const id = String(cityId || '').trim();
      if (!id || !cells?.length) return null;
      for (let ri = 0; ri < cells.length; ri++) {
        const row = cells[ri];
        if (!row) continue;
        for (let ci = 0; ci < row.length; ci++) {
          const cell = row[ci];
          if (cell && readStrategicCellAnchorId(cell) === id) {
            return { gx: ci, gy: ri };
          }
        }
      }
      return null;
    };
    return strategicNav.registerResolveStrategicAnchorForCityId(resolveStrategicAnchorForCityId);
  }, [strategicNav, cells]);

  useEffect(() => {
    if (!strategicNav?.registerScrollToStrategicCell) return undefined;
    /**
     * 将 .ws-map-wrap 滚到以 (gx,gy) 为左上锚点的格（含 2×2 城块中心）。
     * 优先用瓦片 DOM + getBoundingClientRect，避免格网 gap:1px、flex 居中内层与纯公式不一致导致「闪一下又回弹」。
     */
    const scrollToStrategicCell = (gx, gy) => {
      const applyScroll = () => {
        const w = wrapRef.current;
        if (!w) return;
        let cx = Number(gx);
        let cy = Number(gy);
        if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;
        cx = Math.max(0, Math.min(cx, mapColumns - 1));
        cy = Math.max(0, Math.min(cy, mapRows - 1));

        const vw = w.clientWidth;
        const vh = w.clientHeight;
        const maxSl = Math.max(0, w.scrollWidth - vw);
        const maxSt = Math.max(0, w.scrollHeight - vh);

        const tile = w.querySelector(
          `.ws-map-grid .ws-map-tile[data-strategic-x="${cx}"][data-strategic-y="${cy}"]`,
        );
        if (tile instanceof HTMLElement) {
          const wr = w.getBoundingClientRect();
          const spanEl =
            tile.querySelector(STRATEGIC_MAP_FOOTPRINT_VISUAL_SELECTOR) ||
            tile.querySelector('.ws-object-span-2, .ws-object-span-2x1, .ws-object-span-1x2');
          const tr =
            spanEl instanceof HTMLElement ? spanEl.getBoundingClientRect() : tile.getBoundingClientRect();
          const tileCenterX = tr.left + tr.width / 2 - wr.left + w.scrollLeft;
          const tileCenterY = tr.top + tr.height / 2 - wr.top + w.scrollTop;
          w.scrollLeft = Math.max(0, Math.min(tileCenterX - vw / 2, maxSl));
          w.scrollTop = Math.max(0, Math.min(tileCenterY - vh / 2, maxSt));
          return;
        }

        const t = tilePxRef.current;
        const gap = 1;
        const cellStride = t + gap;
        const centerX = cx * cellStride + (2 * t + gap) / 2;
        const centerY = cy * cellStride + (2 * t + gap) / 2;
        w.scrollLeft = Math.max(0, Math.min(centerX - vw / 2, maxSl));
        w.scrollTop = Math.max(0, Math.min(centerY - vh / 2, maxSt));
      };

      applyScroll();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          applyScroll();
          setTimeout(applyScroll, 0);
        });
      });
    };
    return strategicNav.registerScrollToStrategicCell(scrollToStrategicCell);
  }, [strategicNav, mapColumns, mapRows]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      const zoomFn = zoomRef.current;
      if (typeof zoomFn !== 'function') return;
      e.preventDefault();
      e.stopPropagation();
      const steps = e.deltaY > 0 ? -1 : 1;
      zoomFn(steps);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof setTilePx !== 'function') return undefined;
    let pinch0 = null;
    const clamp = (v) =>
      Math.min(maxTileRef.current, Math.max(minTileRef.current, Math.round(v)));

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinch0 = { d0: Math.max(1, Math.hypot(dx, dy)), tile0: tilePxRef.current };
      }
    };
    const onTouchMove = (e) => {
      if (e.touches.length !== 2 || !pinch0) return;
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.hypot(dx, dy);
      const next = pinch0.tile0 * (d / pinch0.d0);
      setTilePx(clamp(next));
    };
    const endPinch = (e) => {
      if (e.touches.length < 2) pinch0 = null;
    };
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', endPinch);
    el.addEventListener('touchcancel', endPinch);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', endPinch);
      el.removeEventListener('touchcancel', endPinch);
    };
  }, [setTilePx]);

  const endPan = useCallback((e) => {
    const p = panRef.current;
    const w = wrapRef.current;
    const pid = e?.pointerId ?? p?.pid;
    if (p && w && pid != null) {
      try {
        w.releasePointerCapture(pid);
      } catch {
        /* ignore */
      }
    }
    panRef.current = null;
    setDraggingPan(false);
  }, []);

  const onPointerDownPan = useCallback(
    (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      const w = wrapRef.current;
      if (!w) return;
      const deferDrag = tooltipClickMode;
      panRef.current = {
        x: e.clientX,
        y: e.clientY,
        sl: w.scrollLeft,
        st: w.scrollTop,
        pid: e.pointerId,
        dragActive: !deferDrag,
      };
      if (!deferDrag) {
        setDraggingPan(true);
        try {
          w.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    },
    [tooltipClickMode],
  );

  const onPointerMovePan = useCallback(
    (e) => {
      const p = panRef.current;
      const w = wrapRef.current;
      if (!p || !w) return;
      if (e.pointerType === 'mouse' && (e.buttons & 1) === 0) {
        endPan(e);
        return;
      }
      if (!p.dragActive) {
        const mdx = e.clientX - p.x;
        const mdy = e.clientY - p.y;
        if (mdx * mdx + mdy * mdy < WS_PAN_MOUSE_DRAG_THRESHOLD_SQ) return;
        p.dragActive = true;
        p.sl = w.scrollLeft;
        p.st = w.scrollTop;
        p.x = e.clientX;
        p.y = e.clientY;
        setDraggingPan(true);
        try {
          w.setPointerCapture(p.pid);
        } catch {
          /* ignore */
        }
      }
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      w.scrollLeft = p.sl - dx;
      w.scrollTop = p.st - dy;
    },
    [endPan],
  );

  const handleWrapClickCapture = useCallback(
    (e) => {
      if (!tooltipClickMode) return;
      if (!tooltipContentRef.current) return;
      if (Date.now() < suppressStrategicCityClickDismissUntilRef.current) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest('.ws-map-tile')) return;
      if (t.closest('.tile-tooltip')) return;
      closeTooltipNow();
    },
    [tooltipClickMode, closeTooltipNow],
  );

  const handleOpenTooltipFromTileEvent = useCallback((e) => {
    if (
      strategicMarchMode &&
      !strategicRoadMarchAnimating &&
      typeof onStrategicMarchCellPick === 'function' &&
      e?.type === 'click'
    ) {
      clearLeaveTooltipTimer();
      const y = Number(e.currentTarget.dataset.strategicY);
      const x = Number(e.currentTarget.dataset.strategicX);
      if (!Number.isNaN(y) && !Number.isNaN(x)) {
        onStrategicMarchCellPick(x, y);
      }
      return;
    }

    clearLeaveTooltipTimer();
    // 与 `dismissTooltip` 成对：`tooltipContent` 已空时锚点也必须清空，否则「同锚点再点关闭」仍可能用旧 ref
    // 误判（典型：关三公府/驻军所后先点阳翟无效，点过其它格再点阳翟才恢复）。
    if (!tooltipContentRef.current) {
      lastTooltipAnchorKeyRef.current = null;
    }
    const y = Number(e.currentTarget.dataset.strategicY);
    const x = Number(e.currentTarget.dataset.strategicX);
    if (Number.isNaN(y) || Number.isNaN(x)) return;
    const cell = hoverDataRef.current.cells[y]?.[x];
    const hd = hoverDataRef.current;
    const { cityById: cb } = hd;
    const cover = resolveStrategicTileCityCover(hoverDataRef.current.cells, y, x);
    const tooltipCell = cover?.anchorCell ?? cell;
    const anchorId = readStrategicCellAnchorId(tooltipCell);
    const banditPoiId = anchorId && isBanditMapObjectId(anchorId) ? anchorId : null;
    const siegeCityId = banditPoiId ? null : anchorId || null;
    const row = siegeCityId && cb ? cb[siegeCityId] : null;
    const anchorY = cover?.anchorR ?? y;
    const anchorX = cover?.anchorC ?? x;
    const anchorKey = banditPoiId
      ? `bandit:${banditPoiId}`
      : siegeCityId
        ? `city:${siegeCityId}`
        : `cell:${anchorY},${anchorX}`;

    const tc = tooltipContentRef.current;
    const sameCityTooltip =
      !!siegeCityId && tc?.cityId != null && String(tc.cityId) === String(siegeCityId);
    const sameBanditTooltip =
      !!banditPoiId && tc?.banditPoiId != null && String(tc.banditPoiId) === String(banditPoiId);
    // 用当前浮层上的城池 `cityId` 或匪寨 **`banditPoiId`** 判断同锚点再点关闭。
    if (
      tooltipClickMode &&
      tc &&
      tc.type === 'worldMapCity' &&
      tc.interactive &&
      (sameCityTooltip || sameBanditTooltip)
    ) {
      if (Date.now() < suppressStrategicCityClickDismissUntilRef.current) {
        return;
      }
      closeTooltipNow();
      return;
    }

    lastTooltipAnchorKeyRef.current = anchorKey;

    if (tooltipCell && siegeCityId && row) {
      const g = ++hoverGenRef.current;

      strategicCityTooltipMetaRef.current = { cityId: siegeCityId, banditPoiId: null, onDutyCount: null };
      setTooltipContent(buildStrategicWorldMapCityTooltip(row, siegeCityId, hd, null));
      setTooltipPos({ x: e.clientX, y: e.clientY });

      garrisonAPI.getOnDutyCount(siegeCityId).then((res) => {
        if (g !== hoverGenRef.current) return;
        const duty = res.success ? Number(res.count) : null;
        const hd2 = hoverDataRef.current;
        strategicCityTooltipMetaRef.current = {
          cityId: siegeCityId,
          banditPoiId: null,
          onDutyCount: Number.isFinite(duty) ? duty : null,
        };
        setTooltipContent(
          buildStrategicWorldMapCityTooltip(
            row,
            siegeCityId,
            hd2,
            Number.isFinite(duty) ? duty : null,
          ),
        );
      });
      return;
    }

    if (tooltipCell && banditPoiId && !row) {
      strategicCityTooltipMetaRef.current = { cityId: null, banditPoiId, onDutyCount: null };
      const synth = syntheticBanditProgressRowFromAnchorCell(banditPoiId, tooltipCell);
      setTooltipContent(buildStrategicWorldMapCityTooltip(synth, banditPoiId, hd, null));
      setTooltipPos({ x: e.clientX, y: e.clientY });
      return;
    }

    if (tooltipCell && siegeCityId && !row) {
      strategicCityTooltipMetaRef.current = { cityId: null, banditPoiId: null, onDutyCount: null };
      const nameBase = tooltipCell.cityName || siegeCityId;
      const titleStr =
        isBanditMapObjectId(siegeCityId) || isBanditMapObjectId(nameBase)
          ? String(nameBase)
          : String(nameBase).endsWith('城')
            ? nameBase
            : `${nameBase}城`;
      setTooltipContent({
        type: 'worldMapCity',
        interactive: false,
        cityTitle: titleStr,
        syncErrorMessage: '城池数据尚未同步，请稍后重试（城况接口）',
      });
      setTooltipPos({ x: e.clientX, y: e.clientY });
      return;
    }

    const info = tooltipCell ? buildCampaignCellTooltipInfo(tooltipCell) : null;
    if (!info) {
      lastTooltipAnchorKeyRef.current = null;
      strategicCityTooltipMetaRef.current = { cityId: null, banditPoiId: null, onDutyCount: null };
      setTooltipContent(null);
      return;
    }
    strategicCityTooltipMetaRef.current = { cityId: null, banditPoiId: null, onDutyCount: null };
    setTooltipContent({ type: 'tile', info });
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, [
    strategicMarchMode,
    strategicRoadMarchAnimating,
    onStrategicMarchCellPick,
    clearLeaveTooltipTimer,
    tooltipClickMode,
    closeTooltipNow,
  ]);

  /** 荒郊/集市结算后：不依赖「抑制误点」，主动重建同城战略城池 portal（与瓦片点击路径一致） */
  const reopenStrategicCityTooltipAfterSubsidiaryExplore = useCallback((anchorCityId, subKind) => {
    primeStrategicCityWildernessMarketTab(anchorCityId, subKind);
    clearLeaveTooltipTimer();
    const hd = hoverDataRef.current;
    const row = hd.cityById?.[anchorCityId];
    if (!row) return;
    const pos = strategicNav?.resolveStrategicAnchorForCityId?.(anchorCityId);
    const w = wrapRef.current;
    let px = 0;
    let py = 0;
    if (pos && w) {
      const tile = w.querySelector(
        `.ws-map-grid .ws-map-tile[data-strategic-x="${pos.gx}"][data-strategic-y="${pos.gy}"]`,
      );
      if (tile instanceof HTMLElement) {
        const spanEl =
          tile.querySelector(STRATEGIC_MAP_FOOTPRINT_VISUAL_SELECTOR) ||
          tile.querySelector('.ws-object-span-2, .ws-object-span-2x1, .ws-object-span-1x2');
        const tr =
          spanEl instanceof HTMLElement ? spanEl.getBoundingClientRect() : tile.getBoundingClientRect();
        px = tr.left + tr.width / 2;
        py = tr.top + tr.height / 2;
      }
    }
    if ((!px && !py) || (px === 0 && py === 0)) {
      if (w) {
        const wr = w.getBoundingClientRect();
        px = wr.left + wr.width / 2;
        py = wr.top + Math.min(160, wr.height * 0.35);
      }
    }
    const g = ++hoverGenRef.current;
    lastTooltipAnchorKeyRef.current = `city:${anchorCityId}`;
    strategicCityTooltipMetaRef.current = { cityId: anchorCityId, banditPoiId: null, onDutyCount: null };
    setTooltipContent(buildStrategicWorldMapCityTooltip(row, anchorCityId, hd, null));
    setTooltipPos({ x: px, y: py });

    garrisonAPI.getOnDutyCount(anchorCityId).then((res) => {
      if (g !== hoverGenRef.current) return;
      const duty = res.success ? Number(res.count) : null;
      const hd2 = hoverDataRef.current;
      const row2 = hd2.cityById?.[anchorCityId];
      if (!row2) return;
      strategicCityTooltipMetaRef.current = {
        cityId: anchorCityId,
        banditPoiId: null,
        onDutyCount: Number.isFinite(duty) ? duty : null,
      };
      setTooltipContent(
        buildStrategicWorldMapCityTooltip(
          row2,
          anchorCityId,
          hd2,
          Number.isFinite(duty) ? duty : null,
        ),
      );
    });
  }, [clearLeaveTooltipTimer, strategicNav]);

  useEffect(() => {
    const p = subsidiaryExploreEmbed?.phase;
    const prev = explorePhaseSyncRef.current;
    explorePhaseSyncRef.current = p;
    if (prev === PHASE.REWARD && p === PHASE.RETURNING) {
      suppressStrategicCityClickDismissUntilRef.current = Math.max(
        suppressStrategicCityClickDismissUntilRef.current,
        Date.now() + 900,
      );
    } else if (prev === PHASE.RETURNING && p === PHASE.IDLE) {
      suppressStrategicCityClickDismissUntilRef.current = Math.max(
        suppressStrategicCityClickDismissUntilRef.current,
        Date.now() + 650,
      );
      const cid = strategicExploreReopenBridge.lastAnchorCityId;
      const kind = strategicExploreReopenBridge.lastSubsidiaryKind;
      strategicExploreReopenBridge.clear();
      if (cid && (kind === 'wilderness' || kind === 'market')) {
        let raf = 0;
        raf = requestAnimationFrame(() => {
          reopenStrategicCityTooltipAfterSubsidiaryExplore(cid, kind);
        });
        return () => cancelAnimationFrame(raf);
      }
    }
    return undefined;
  }, [subsidiaryExploreEmbed?.phase, reopenStrategicCityTooltipAfterSubsidiaryExplore]);

  const handleWrapperMove = useCallback((e) => {
    if (tooltipClickMode) return;
    setTooltipPos((prev) => {
      if (prev.x === e.clientX && prev.y === e.clientY) return prev;
      return { x: e.clientX, y: e.clientY };
    });
  }, [tooltipClickMode]);

  const county = mapColumns > 16 || mapRows > 20;

  const subsidiaryParentIds = useMemo(
    () => parentCityIdsWithSubsidiaryExplore(cityById),
    [cityById],
  );

  const roadOverlayPathD = useMemo(() => {
    if (!roadCells?.length) return '';
    const conn = roadConnectivity === '8' ? '8' : ROAD_CONNECTIVITY_4;
    return buildStrategicRoadOverlayPathD(roadCells, conn, mapColumns, mapRows);
  }, [roadCells, roadConnectivity, mapColumns, mapRows]);

  return (
    <div
      className={`ws-map-card ${county ? 'ws-map-card--county flex-1 min-h-0 flex flex-col h-full' : ''}`}
      style={{
        ['--ws-tile']: `${tilePx}px`,
        ['--ws-cols']: mapColumns,
        ['--ws-rows']: mapRows,
      }}
    >
      <div className={`ws-map-aligned-stack ${county ? 'flex-1 min-h-0 flex flex-col h-full' : ''}`}>
        {title ? <div className="ws-map-title">{title}</div> : null}
        {meta ? <div className="ws-map-meta">{meta}</div> : null}
        <div
          ref={wrapRef}
          className={`ws-map-wrap${draggingPan ? ' ws-map-wrap--dragging' : ''}`}
          onClickCapture={handleWrapClickCapture}
          onMouseMove={handleWrapperMove}
          onMouseLeave={tooltipClickMode ? undefined : scheduleLeaveFromWrap}
          onPointerDown={onPointerDownPan}
          onPointerMove={onPointerMovePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
        >
          <div className="ws-map-scrollport-inner">
            <div className="ws-map-shell" style={{ position: 'relative' }}>
              <div className="ws-map-grid">
                {cells.map((row, ri) =>
                  row.map((cell, ci) => {
                    const cover = resolveStrategicTileCityCover(cells, ri, ci);
                    const anchorId = readStrategicCellAnchorId(cover?.anchorCell) || null;
                    const cityRow = anchorId && cityById ? cityById[anchorId] : null;
                    const subsidiaryHubGlow =
                      !!anchorId && !!subsidiaryParentIds && subsidiaryParentIds.has(String(anchorId));
                    const q = subsidiaryExploreEmbed?.quota;
                    const exploreRemainBadge =
                      subsidiaryHubGlow &&
                      !!cover &&
                      ri === cover.anchorR &&
                      ci === cover.anchorC + 1 &&
                      !!q?.loaded &&
                      !subsidiaryExploreEmbed?.isTutorial &&
                      (Number(q.remaining) || 0) > 0;
                    return (
                      <WorldStrategicMapTile
                        key={`${ri}-${ci}`}
                        cell={cell}
                        seed={seed}
                        gridY={ri}
                        gridX={ci}
                        strategicCover={cover}
                        cityRow={cityRow}
                        subsidiaryHubGlow={subsidiaryHubGlow}
                        exploreRemainBadge={exploreRemainBadge}
                        playerFactionId={playerFactionId}
                        strategicCityLabelAllyFactionIds={strategicCityLabelAllyFactionIds}
                        strategicCityLabelNonHostileFactionIds={strategicCityLabelNonHostileFactionIds}
                        tooltipPointerMode={tooltipClickMode ? 'click' : 'hover'}
                        onHover={handleOpenTooltipFromTileEvent}
                        onLeave={tooltipClickMode ? undefined : scheduleLeaveFromTileIfAllowed}
                        onTooltipClick={handleOpenTooltipFromTileEvent}
                        strategicMarchMode={!!strategicMarchMode && !strategicRoadMarchAnimating}
                        onStrategicMarchCellPick={onStrategicMarchCellPick}
                      />
                    );
                  }),
                )}
              </div>
              {roadOverlayPathD ? (
                <svg
                  className="ws-road-overlay"
                  viewBox={`0 0 ${mapColumns} ${mapRows}`}
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path
                    className="ws-road-overlay__stroke ws-road-overlay__stroke--outer"
                    d={roadOverlayPathD}
                  />
                  <path
                    className="ws-road-overlay__stroke ws-road-overlay__stroke--inner"
                    d={roadOverlayPathD}
                  />
                </svg>
              ) : null}
              {mapRows === 40 ? (
                <div className="ws-quad-overlay" aria-hidden>
                  {['A', 'B', 'C', 'D'].map((q) => (
                    <div key={q} className={WS_QUAD_CLASS[q]} title={`大象限 ${q}`} />
                  ))}
                </div>
              ) : null}
              {strategicSelfPawn &&
              Number.isFinite(strategicSelfPawn.cx) &&
              Number.isFinite(strategicSelfPawn.cy) ? (
                <StrategicMapSelfPawn
                  cx={strategicSelfPawn.cx}
                  cy={strategicSelfPawn.cy}
                  portraitUrl={strategicSelfPawn.portraitUrl}
                  displayName={strategicSelfPawn.displayName}
                  centerGlyph={strategicSelfPawn.centerGlyph}
                  troopsCurrent={strategicSelfPawn.troopsCurrent}
                  troopsMax={strategicSelfPawn.troopsMax}
                  stackStripPeers={strategicSelfPawn.stackStripPeers}
                  stackStripEllipsis={!!strategicSelfPawn.stackStripEllipsis}
                  marchModeActive={!!strategicMarchMode && !strategicRoadMarchAnimating}
                  onEnterMarchMode={
                    strategicRoadMarchAnimating ? undefined : onStrategicSelfMarchModeRequest || undefined
                  }
                  onExitMarchMode={onStrategicSelfMarchModeExit || undefined}
                  roadIntercept={strategicSelfPawn.roadIntercept ? 1 : 0}
                  interceptPlayerId={strategicSelfPawn.pawnPlayerId || null}
                  interceptSilver={strategicSelfPawn.playerSilver}
                  onRoadSelfUpdated={onStrategicRoadSelfUpdated || undefined}
                  onSelfPawnOverlayOpenChange={setStrategicSelfPawnOverlayOpen}
                />
              ) : null}
              {pendingMapEventHint ? (
                <StrategicMapEventHintBubble
                  cx={
                    strategicSelfPawn &&
                    Number.isFinite(strategicSelfPawn.cx) &&
                    Number.isFinite(strategicSelfPawn.cy)
                      ? strategicSelfPawn.cx
                      : null
                  }
                  cy={
                    strategicSelfPawn &&
                    Number.isFinite(strategicSelfPawn.cx) &&
                    Number.isFinite(strategicSelfPawn.cy)
                      ? strategicSelfPawn.cy
                      : null
                  }
                  hintText={pendingMapEventHint}
                  mapWrapRef={wrapRef}
                  visible={
                    !strategicSelfPawnOverlayOpen &&
                    !strategicFullScreenOverlayOpen &&
                    !strategicMapEventHintSuppressed
                  }
                />
              ) : null}
              {Array.isArray(strategicOtherPawns)
                ? strategicOtherPawns
                    .filter((p) => p && Number.isFinite(p.cx) && Number.isFinite(p.cy))
                    .map((p) => (
                      <StrategicMapSelfPawn
                        key={`other-${p.playerId}`}
                        cx={p.cx}
                        cy={p.cy}
                        portraitUrl={p.portraitUrl}
                        displayName={p.displayName}
                        centerGlyph={p.centerGlyph}
                        stackStripPeers={p.stackStripPeers}
                        stackStripEllipsis={!!p.stackStripEllipsis}
                        roadIntercept={p.roadIntercept ? 1 : 0}
                      />
                    ))
                : null}
            </div>
          </div>
          {tooltipContent && typeof document !== 'undefined' && createPortal(
            <div
              className={`tile-tooltip tile-tooltip--portal${
                tooltipContent?.type === 'worldMapCity' ? ' tile-tooltip--world-map-city' : ''
              }${tooltipContent?.interactive ? ' tile-tooltip--interactive' : ''}`}
              ref={tooltipRef}
              style={tooltipStyle}
              onMouseEnter={tooltipClickMode ? undefined : clearLeaveTooltipTimer}
              onMouseLeave={
                tooltipClickMode
                  ? undefined
                  : tooltipContent?.uniformStrategicPanel
                    ? undefined
                    : closeTooltipNow
              }
            >
              <TileTooltipContent content={tooltipContent} />
            </div>,
            document.body,
          )}
          {tooltipContent &&
            typeof document !== 'undefined' &&
            tooltipContent.type === 'worldMapCity' &&
            tooltipContent.uniformStrategicPanel &&
            tooltipContent.cityId &&
            !tooltipContent.isBanditStronghold && (
              <StrategicSiegeWarFloatingPanel
                anchorRef={tooltipRef}
                tooltipPos={tooltipPos}
                cityId={tooltipContent.cityId}
                factionDisplayMap={tooltipContent.factionDisplayMap}
                enabled
                tooltipClickMode={tooltipClickMode}
                clearLeaveTooltipTimer={clearLeaveTooltipTimer}
                scheduleLeaveFromTile={scheduleLeaveFromTileIfAllowed}
              />
            )}
        </div>
      </div>
    </div>
  );
}
