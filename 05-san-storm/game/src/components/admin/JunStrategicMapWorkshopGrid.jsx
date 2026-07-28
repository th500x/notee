/**
 * 郡战略图工坊格网：Meowa 预览底图 + 语义叠层（城 2×2 / 战场入口 / 道路）
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  buildStrategicRoadOverlayPathD,
  buildStrategicRoadPaintBlockedLayers,
  ROAD_CONNECTIVITY_4,
  ROAD_CONNECTIVITY_8,
} from '@shared/utils/strategicRoadOverlay.js';
import '@/components/world/WorldStrategicMap.css';

/**
 * @param {object} props
 * @param {object[][]} props.cells 已投影城/战场后的语义格
 * @param {number} props.mapColumns
 * @param {number} props.mapRows
 * @param {string|null} props.previewUrl
 * @param {'city'|'battlefield'|'road'} props.editMode
 * @param {{ gx: number, gy: number }[]} props.roadCells
 * @param {'4'|'8'} props.connectivity
 * @param {(gx: number, gy: number) => void} props.onCellClick
 * @param {(gx: number, gy: number) => void} [props.onCellPaint]
 * @param {(gx: number, gy: number) => void} [props.onCellHover]
 * @param {() => void} [props.onCellHoverEnd]
 * @param {{ gx: number, gy: number }|null} [props.ghostAnchor] 城点选预览左上角
 */
export default function JunStrategicMapWorkshopGrid({
  cells,
  mapColumns,
  mapRows,
  previewUrl,
  editMode,
  roadCells,
  connectivity,
  onCellClick,
  onCellPaint,
  onCellHover,
  onCellHoverEnd,
  ghostAnchor = null,
}) {
  const paintingRef = useRef(false);
  const viewportRef = useRef(null);
  const [tilePx, setTilePx] = useState(18);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const compute = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w < 48) return;
      const pad = 8;
      const fromW = Math.floor((w - pad) / mapColumns);
      const fromH = h > 48 ? Math.floor((h - pad) / mapRows) : 28;
      setTilePx(Math.max(10, Math.min(28, Math.min(fromW, fromH))));
    };
    compute();
    const ro = new ResizeObserver(() => compute());
    ro.observe(el);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [mapColumns, mapRows]);

  const roadKeySet = useMemo(
    () => new Set((roadCells || []).map((c) => `${c.gx},${c.gy}`)),
    [roadCells],
  );

  const blockedLayers = useMemo(
    () => buildStrategicRoadPaintBlockedLayers(cells, mapColumns, mapRows),
    [cells, mapColumns, mapRows],
  );

  const pathD = useMemo(() => {
    if (!roadCells?.length) return '';
    const conn = connectivity === ROAD_CONNECTIVITY_8 ? ROAD_CONNECTIVITY_8 : ROAD_CONNECTIVITY_4;
    return buildStrategicRoadOverlayPathD(roadCells, conn, mapColumns, mapRows);
  }, [roadCells, connectivity, mapColumns, mapRows]);

  const ghostKeys = useMemo(() => {
    if (!ghostAnchor || editMode !== 'city') return new Set();
    const set = new Set();
    for (let dy = 0; dy < 2; dy += 1) {
      for (let dx = 0; dx < 2; dx += 1) {
        set.add(`${ghostAnchor.gx + dx},${ghostAnchor.gy + dy}`);
      }
    }
    return set;
  }, [ghostAnchor, editMode]);

  const handleDown = useCallback(
    (e, gx, gy) => {
      if (e.button !== 0) return;
      e.preventDefault();
      if (editMode === 'road') {
        paintingRef.current = true;
        onCellPaint?.(gx, gy);
        return;
      }
      onCellClick(gx, gy);
    },
    [editMode, onCellClick, onCellPaint],
  );

  const handleEnter = useCallback(
    (e, gx, gy) => {
      onCellHover?.(gx, gy);
      if (editMode !== 'road' || !paintingRef.current) return;
      if ((e.buttons & 1) === 0) return;
      onCellPaint?.(gx, gy);
    },
    [editMode, onCellPaint, onCellHover],
  );

  const endPaint = useCallback(() => {
    paintingRef.current = false;
  }, []);

  const widthPx = mapColumns * tilePx;
  const heightPx = mapRows * tilePx;

  return (
    <div
      ref={viewportRef}
      className="w-full min-w-0 min-h-[min(56vh,480px)] max-h-[min(82vh,960px)] overflow-auto border border-gray-300 rounded-lg bg-stone-900 p-1 box-border"
      onPointerLeave={() => {
        endPaint();
        onCellHoverEnd?.();
      }}
      onPointerUp={endPaint}
      onPointerCancel={endPaint}
    >
      <div className="relative mx-auto" style={{ width: widthPx, height: heightPx }}>
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Meowa 郡草图预览"
            className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none opacity-90"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 bg-stone-800" />
        )}
        <div
          className="absolute inset-0 grid"
          style={{
            gridTemplateColumns: `repeat(${mapColumns}, ${tilePx}px)`,
            gridTemplateRows: `repeat(${mapRows}, ${tilePx}px)`,
          }}
        >
          {cells.map((row, ri) =>
            row.map((cell, ci) => {
              const k = `${ci},${ri}`;
              const isRoad = roadKeySet.has(k);
              const isCity = Boolean(cell?.cityId);
              const isBf = Boolean(cell?.battlefieldId) || cell?.object === 'jun_battlefield';
              const isWater = cell?.terrain === 'lake' || cell?.terrain === 'river';
              const isGhost = ghostKeys.has(k);
              const roadBlocked = editMode === 'road' && blockedLayers.combined.has(k);
              let ring = 'ring-1 ring-black/20';
              if (isGhost) ring = 'ring-2 ring-sky-300 bg-sky-400/35';
              else if (isCity) ring = 'ring-2 ring-amber-400/90 bg-amber-500/25';
              else if (isBf) ring = 'ring-2 ring-fuchsia-400/90 bg-fuchsia-500/30';
              else if (isRoad) ring = 'ring-1 ring-yellow-300/70 bg-yellow-400/15';
              else if (isWater) ring = 'ring-1 ring-cyan-700/40 bg-cyan-900/20';
              if (roadBlocked) ring += ' cursor-not-allowed';
              else ring += ' cursor-crosshair';

              return (
                <div
                  key={k}
                  role="presentation"
                  className={`box-border ${ring}`}
                  style={{ width: tilePx, height: tilePx }}
                  title={`(${ci},${ri})${cell?.cityName ? ` ${cell.cityName}` : ''}${
                    isBf ? ' 战场入口' : ''
                  }${isWater ? ' 水域' : ''}`}
                  onPointerDown={(e) => !roadBlocked && handleDown(e, ci, ri)}
                  onPointerEnter={(e) => !roadBlocked && handleEnter(e, ci, ri)}
                />
              );
            }),
          )}
        </div>
        {pathD ? (
          <svg
            className="pointer-events-none absolute left-0 top-0 z-[1]"
            style={{ width: widthPx, height: heightPx }}
            viewBox={`0 0 ${mapColumns} ${mapRows}`}
            preserveAspectRatio="none"
            aria-hidden
          >
            <path className="ws-road-overlay__stroke ws-road-overlay__stroke--outer" d={pathD} />
            <path className="ws-road-overlay__stroke ws-road-overlay__stroke--inner" d={pathD} />
          </svg>
        ) : null}
      </div>
      <p className="text-xs text-gray-400 mt-1 px-1">格宽 {tilePx}px · 琥珀=城/关 · 品红=战场入口 · 黄线=道路</p>
    </div>
  );
}
