import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import WorldStrategicMapTile from './WorldStrategicMapTile';
import { buildCampaignCellTooltipInfo } from '@/components/battle/battleConstants';
import { appendStrategicCityRuntimeToTooltipInfo } from '@/utils/strategicMapTooltipRuntime';
import { resolveStrategicTileCityCover } from '@/utils/strategicMapTileContext';
import { useTileTooltipClamp } from '@/components/battle/useTileTooltipClamp';
import TileTooltipContent from '@/components/battle/TileTooltipContent';
import '@/components/battle/BattleMap.css';
import './WorldStrategicMap.css';

const WS_QUAD_CLASS = {
  A: 'ws-quad-frame ws-quad-a',
  B: 'ws-quad-frame ws-quad-b',
  C: 'ws-quad-frame ws-quad-c',
  D: 'ws-quad-frame ws-quad-d',
};

/**
 * 战略层郡大地图格网（如颍川 32×40）。
 * 与 `CampaignMapGrid` 分离：无战役部署、无部队层、无战斗引擎。
 * Tooltip：`buildCampaignCellTooltipInfo(cell)` 为静态层；若传入 `cityById` + `factionNameById`，
 * 对有 `cityId` 的格按 `cities` 表合并运行时文案（与 `/api/cities` 一致，snake_case）。
 */
export default function WorldStrategicMapGrid({
  cells,
  seed,
  mapColumns = 32,
  mapRows = 40,
  title = null,
  meta = null,
  /** 单格像素边长 */
  tilePx = 20,
  /** 与父组件 setState 同步，供双指捏合缩放 */
  setTilePx = null,
  minTilePx = 12,
  maxTilePx = 56,
  /** 滚轮缩放步进回调（正=放大）；不传则仅用 +/- 按钮与捏合 */
  onWheelZoomSteps = null,
  /** `city_id` → `cities` 行（来自 GET /api/cities?season&junId） */
  cityById = null,
  /** `faction_id` → 势力显示名（来自 shared factions.json） */
  factionNameById = null,
}) {
  const [tooltipContent, setTooltipContent] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
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

  const hoverDataRef = useRef({ cells, cityById, factionNameById });
  hoverDataRef.current = { cells, cityById, factionNameById };

  // 滚轮：缩放（与战斗图习惯一致）；平移靠拖拽或滚动条
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

  // 双指捏合缩放（手机）
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

  const onPointerDownPan = useCallback((e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const w = wrapRef.current;
    if (!w) return;
    panRef.current = {
      x: e.clientX,
      y: e.clientY,
      sl: w.scrollLeft,
      st: w.scrollTop,
      pid: e.pointerId,
    };
    setDraggingPan(true);
    try {
      w.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const onPointerMovePan = useCallback((e) => {
    const p = panRef.current;
    const w = wrapRef.current;
    if (!p || !w) return;
    if (e.pointerType === 'mouse' && (e.buttons & 1) === 0) {
      endPan(e);
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    w.scrollLeft = p.sl - dx;
    w.scrollTop = p.st - dy;
  }, [endPan]);

  const handleHover = useCallback((e) => {
    const y = Number(e.currentTarget.dataset.strategicY);
    const x = Number(e.currentTarget.dataset.strategicX);
    if (Number.isNaN(y) || Number.isNaN(x)) return;
    const cell = hoverDataRef.current.cells[y]?.[x];
    const { cityById: cb, factionNameById: fb } = hoverDataRef.current;
    const cover = resolveStrategicTileCityCover(hoverDataRef.current.cells, y, x);
    const tooltipCell = cover?.anchorCell ?? cell;
    let info = tooltipCell ? buildCampaignCellTooltipInfo(tooltipCell) : null;
    if (tooltipCell?.cityId && cb && info) {
      const row = cb[tooltipCell.cityId];
      // row 缺失时 append 原样返回静态层；有 row 时合并归属/状态等
      info = appendStrategicCityRuntimeToTooltipInfo(info, tooltipCell, row, fb || {});
    }
    if (!info) {
      setTooltipContent(null);
      return;
    }
    setTooltipContent({ type: 'tile', info });
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleLeave = useCallback(() => {
    setTooltipContent(null);
  }, []);

  const handleWrapperMove = useCallback((e) => {
    setTooltipPos((prev) => {
      if (prev.x === e.clientX && prev.y === e.clientY) return prev;
      return { x: e.clientX, y: e.clientY };
    });
  }, []);

  const county = mapColumns > 16 || mapRows > 20;

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
          onMouseMove={handleWrapperMove}
          onMouseLeave={() => {
            handleLeave();
          }}
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
                    return (
                      <WorldStrategicMapTile
                        key={`${ri}-${ci}`}
                        cell={cell}
                        seed={seed}
                        gridY={ri}
                        gridX={ci}
                        strategicCover={cover}
                        cityRow={cityRow}
                        onHover={handleHover}
                        onLeave={handleLeave}
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
              className="tile-tooltip tile-tooltip--portal"
              ref={tooltipRef}
              style={tooltipStyle}
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
