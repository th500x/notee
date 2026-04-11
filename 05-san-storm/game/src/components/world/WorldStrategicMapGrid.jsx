import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import WorldStrategicMapTile from './WorldStrategicMapTile';
import { buildCampaignCellTooltipInfo } from '@/components/battle/battleConstants';
import { appendStrategicCityRuntimeToTooltipInfo } from '@/utils/strategicMapTooltipRuntime';
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
  /** Ctrl/⌘ + 滚轮缩放时的步进回调（正=放大） */
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
  const [draggingPan, setDraggingPan] = useState(false);
  const panRef = useRef(null);

  const hoverDataRef = useRef({ cells, cityById, factionNameById });
  hoverDataRef.current = { cells, cityById, factionNameById };

  // 滚轮：默认平移地图（阻止冒泡到 GamePage main），Ctrl/⌘+滚轮缩放
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      const zoomFn = zoomRef.current;
      if ((e.ctrlKey || e.metaKey) && typeof zoomFn === 'function') {
        e.preventDefault();
        e.stopPropagation();
        const steps = e.deltaY > 0 ? -1 : 1;
        zoomFn(steps);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      el.scrollLeft += e.deltaX;
      el.scrollTop += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
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
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    w.scrollLeft = p.sl - dx;
    w.scrollTop = p.st - dy;
  }, []);

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

  const handleHover = useCallback((e) => {
    const y = Number(e.currentTarget.dataset.strategicY);
    const x = Number(e.currentTarget.dataset.strategicX);
    if (Number.isNaN(y) || Number.isNaN(x)) return;
    const cell = hoverDataRef.current.cells[y]?.[x];
    const { cityById: cb, factionNameById: fb } = hoverDataRef.current;
    let info = cell ? buildCampaignCellTooltipInfo(cell) : null;
    if (cell?.cityId && cb && info) {
      const row = cb[cell.cityId];
      // row 缺失时 append 原样返回静态层；有 row 时合并归属/状态等
      info = appendStrategicCityRuntimeToTooltipInfo(info, cell, row, fb || {});
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
                  row.map((cell, ci) => (
                    <WorldStrategicMapTile
                      key={`${ri}-${ci}`}
                      cell={cell}
                      seed={seed}
                      gridY={ri}
                      gridX={ci}
                      onHover={handleHover}
                      onLeave={handleLeave}
                    />
                  )),
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
