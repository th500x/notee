import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import WorldStrategicMapTile from './WorldStrategicMapTile';
import { buildCampaignCellTooltipInfo } from '@/components/battle/battleConstants';
import {
  buildWorldMapCityPanelProps,
  parentCityIdsWithSubsidiaryExplore,
  worldMapCityIsPlayerSameFaction,
  worldMapCityTypeAllowsMainCitySet,
} from '@/utils/worldMapCityPanelCopy';
import { garrisonAPI } from '@/services/garrisonApi';
import { resolveStrategicTileCityCover } from '@/utils/strategicMapTileContext';
import { useTileTooltipClamp } from '@/components/battle/useTileTooltipClamp';
import TileTooltipContent from '@/components/battle/TileTooltipContent';
import { useStrategicMapTooltipClickMode } from '@/hooks/useStrategicMapTooltipClickMode';
import '@/components/battle/BattleMap.css';
import './WorldStrategicMap.css';

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
 * @param {object} row - cities 行
 * @param {string} anchorCityId - 锚点格 cityId
 * @param {object} hd - hoverDataRef.current
 * @param {number|null} onDutyCount
 */
function buildStrategicWorldMapCityTooltip(row, anchorCityId, hd, onDutyCount) {
  const fb = hd.factionNameById || {};
  const statsMap = hd.garrisonStatsByCityId || {};
  const slotRaw = statsMap[anchorCityId]?.slot_count;
  const slotNum = slotRaw != null ? Number(slotRaw) : null;

  const base = buildWorldMapCityPanelProps(row, {
    factionNameById: fb,
    playerFactionId: hd.playerFactionId,
    playerId: hd.playerId,
    siegeQuota: hd.siegeQuota,
    siegeLoading: false,
    garrisonSlotCount: Number.isFinite(slotNum) ? slotNum : null,
    onDutyCount,
    cityById: hd.cityById,
  });

  const isOwn =
    !!hd.playerFactionId &&
    worldMapCityIsPlayerSameFaction(row, hd.playerFactionId);
  const canAct = !!(isOwn && hd.playerId && anchorCityId);
  const hasSubsidiaryTabs = !!(base.subsidiaryExplore?.wilderness || base.subsidiaryExplore?.market);
  /** 城备/城况等分段需可点击，与无附属荒郊/集市时一致 */
  const hasCityInfoTabs = !base.syncErrorMessage;
  const canSetMainCity =
    canAct &&
    worldMapCityTypeAllowsMainCitySet(row) &&
    typeof hd.onSetMainCityRequest === 'function';

  return {
    type: 'worldMapCity',
    interactive: canAct || hasSubsidiaryTabs || hasCityInfoTabs || canSetMainCity,
    ...base,
    cityId: anchorCityId,
    showOwnCityActions: canAct,
    playerOnDutyForThisCity: !!(hd.playerOnDuty && hd.playerOnDutyCityId === anchorCityId),
    onOpenGarrison:
      canAct && typeof hd.onOpenGarrisonForCity === 'function'
        ? () => {
            hd.onOpenGarrisonForCity(anchorCityId, base.cityBaseName);
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
    onSubsidiaryExploreRequest:
      typeof hd.onSubsidiaryExploreRequest === 'function'
        ? hd.onSubsidiaryExploreRequest
        : undefined,
    ...(canSetMainCity
      ? {
          mainCityId: hd.playerMainCityId ?? null,
          mainCityChangedAt: hd.playerMainCityChangedAt ?? null,
          playerSilver: hd.playerSilver ?? null,
          onSetMainCityRequest: hd.onSetMainCityRequest,
          onSetMainCityError: hd.onSetMainCityError,
        }
      : {}),
    /** 战略地图：外框 295×395px 写死（BattleMap.css） */
    uniformStrategicPanel: true,
  };
}

/**
 * 战略层郡大地图格网（如颍川 32×40）。
 * 与 `CampaignMapGrid` 分离：无战役部署、无部队层、无战斗引擎。
 * Tooltip：有 `cityId` 且在 `cityById` 中有对应行时，与 WorldMap 底栏新野块同款（含己方驻地编组 / 披挂）。
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
  siegeQuota = null,
  garrisonStatsByCityId = null,
  playerOnDuty = false,
  playerOnDutyCityId = null,
  onOpenGarrisonForCity = null,
  onToggleDutyForCity = null,
  onDutyError = null,
  onSubsidiaryExploreRequest = null,
  playerMainCityId = null,
  playerMainCityChangedAt = null,
  playerSilver = null,
  onSetMainCityRequest = null,
  onSetMainCityError = null,
}) {
  const tooltipClickMode = useStrategicMapTooltipClickMode();
  const [tooltipContent, setTooltipContent] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const tooltipContentRef = useRef(null);
  tooltipContentRef.current = tooltipContent;
  const lastTooltipAnchorKeyRef = useRef(null);
  const { tooltipRef, tooltipStyle } = useTileTooltipClamp(tooltipContent, tooltipPos);
  const wrapRef = useRef(null);
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
  const strategicCityTooltipMetaRef = useRef({ cityId: null, onDutyCount: null });

  const clearLeaveTooltipTimer = useCallback(() => {
    if (leaveTooltipTimerRef.current != null) {
      clearTimeout(leaveTooltipTimerRef.current);
      leaveTooltipTimerRef.current = null;
    }
  }, []);

  const dismissTooltip = useCallback(() => {
    hoverGenRef.current += 1;
    lastTooltipAnchorKeyRef.current = null;
    strategicCityTooltipMetaRef.current = { cityId: null, onDutyCount: null };
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
    siegeQuota,
    garrisonStatsByCityId,
    playerOnDuty,
    playerOnDutyCityId,
    onOpenGarrisonForCity,
    onToggleDutyForCity,
    onDutyError,
    onSubsidiaryExploreRequest,
    closeStrategicCityTooltip: closeTooltipNow,
    playerMainCityId,
    playerMainCityChangedAt,
    playerSilver,
    onSetMainCityRequest,
    onSetMainCityError,
  };

  const scheduleLeaveFromTile = useCallback(() => {
    const ms = tooltipInteractiveRef.current ? 220 : 80;
    scheduleTooltipHide(ms);
  }, [scheduleTooltipHide]);

  const scheduleLeaveFromWrap = useCallback(() => {
    const ms = tooltipInteractiveRef.current ? 260 : 0;
    scheduleTooltipHide(ms);
  }, [scheduleTooltipHide]);

  useEffect(() => () => clearLeaveTooltipTimer(), [clearLeaveTooltipTimer]);

  useEffect(() => {
    const m = strategicCityTooltipMetaRef.current;
    if (!m.cityId) return;
    const tc = tooltipContentRef.current;
    if (!tc || tc.type !== 'worldMapCity') return;
    const hd = hoverDataRef.current;
    const row = hd.cityById?.[m.cityId];
    if (!row) return;
    const duty = Number.isFinite(m.onDutyCount) ? m.onDutyCount : null;
    setTooltipContent(buildStrategicWorldMapCityTooltip(row, m.cityId, hd, duty));
  }, [playerMainCityId, playerMainCityChangedAt, playerSilver]);

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
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest('.ws-map-tile')) return;
      if (t.closest('.tile-tooltip')) return;
      closeTooltipNow();
    },
    [tooltipClickMode, closeTooltipNow],
  );

  const handleOpenTooltipFromTileEvent = useCallback((e) => {
    clearLeaveTooltipTimer();
    const y = Number(e.currentTarget.dataset.strategicY);
    const x = Number(e.currentTarget.dataset.strategicX);
    if (Number.isNaN(y) || Number.isNaN(x)) return;
    const cell = hoverDataRef.current.cells[y]?.[x];
    const hd = hoverDataRef.current;
    const { cityById: cb } = hd;
    const cover = resolveStrategicTileCityCover(hoverDataRef.current.cells, y, x);
    const tooltipCell = cover?.anchorCell ?? cell;
    const cityId = tooltipCell?.cityId;
    const row = cityId && cb ? cb[cityId] : null;
    const anchorY = cover?.anchorR ?? y;
    const anchorX = cover?.anchorC ?? x;
    const anchorKey = cityId ? `city:${cityId}` : `cell:${anchorY},${anchorX}`;

    if (tooltipClickMode && tooltipContentRef.current) {
      if (lastTooltipAnchorKeyRef.current === anchorKey) {
        closeTooltipNow();
        return;
      }
    }

    lastTooltipAnchorKeyRef.current = anchorKey;

    if (tooltipCell && cityId && row) {
      const g = ++hoverGenRef.current;

      strategicCityTooltipMetaRef.current = { cityId, onDutyCount: null };
      setTooltipContent(buildStrategicWorldMapCityTooltip(row, cityId, hd, null));
      setTooltipPos({ x: e.clientX, y: e.clientY });

      garrisonAPI.getOnDutyCount(cityId).then((res) => {
        if (g !== hoverGenRef.current) return;
        const duty = res.success ? Number(res.count) : null;
        const hd2 = hoverDataRef.current;
        strategicCityTooltipMetaRef.current = {
          cityId,
          onDutyCount: Number.isFinite(duty) ? duty : null,
        };
        setTooltipContent(
          buildStrategicWorldMapCityTooltip(
            row,
            cityId,
            hd2,
            Number.isFinite(duty) ? duty : null,
          ),
        );
      });
      return;
    }

    if (tooltipCell && cityId && !row) {
      strategicCityTooltipMetaRef.current = { cityId: null, onDutyCount: null };
      const nameBase = tooltipCell.cityName || cityId;
      const titleStr = String(nameBase).endsWith('城') ? nameBase : `${nameBase}城`;
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
      strategicCityTooltipMetaRef.current = { cityId: null, onDutyCount: null };
      setTooltipContent(null);
      return;
    }
    strategicCityTooltipMetaRef.current = { cityId: null, onDutyCount: null };
    setTooltipContent({ type: 'tile', info });
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, [clearLeaveTooltipTimer, tooltipClickMode, closeTooltipNow]);

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
                    const anchorId = cover?.anchorCell?.cityId;
                    const cityRow = anchorId && cityById ? cityById[anchorId] : null;
                    const subsidiaryHubGlow =
                      !!anchorId && !!subsidiaryParentIds && subsidiaryParentIds.has(String(anchorId));
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
                        tooltipPointerMode={tooltipClickMode ? 'click' : 'hover'}
                        onHover={handleOpenTooltipFromTileEvent}
                        onLeave={tooltipClickMode ? undefined : scheduleLeaveFromTile}
                        onTooltipClick={handleOpenTooltipFromTileEvent}
                      />
                    );
                  }),
                )}
              </div>
              <div className="ws-quad-overlay" aria-hidden>
                {['A', 'B', 'C', 'D'].map((q) => (
                  <div key={q} className={WS_QUAD_CLASS[q]} title={`大象限 ${q}`} />
                ))}
              </div>
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
              onMouseLeave={tooltipClickMode ? undefined : closeTooltipNow}
            >
              <TileTooltipContent content={tooltipContent} />
            </div>,
            document.body,
          )}
        </div>
      </div>
    </div>
  );
}
