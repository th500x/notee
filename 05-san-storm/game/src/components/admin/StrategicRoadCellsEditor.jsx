/**
 * 管理员：在已合并的 32×40 `cells` 上涂抹道路格；与 merged.json `roadCells` / `roadConnectivity` 对齐。
 */

import { useRef, useCallback, useMemo, useState, useLayoutEffect } from 'react';
import {
  buildStrategicRoadOverlayPathD,
  buildStrategicObjectFootprintBlockedSet,
  ROAD_CONNECTIVITY_4,
  ROAD_CONNECTIVITY_8,
} from '@shared/utils/strategicRoadOverlay.js';
import '@/components/world/WorldStrategicMap.css';

function cellPreviewClass(cell) {
  if (!cell) return 'bg-stone-800';
  if (cell.terrain === 'river' || cell.terrain === 'lake') return 'bg-sky-900/75';
  if (cell.terrain === 'ford') return 'bg-sky-700/50';
  if (cell.terrain === 'forest') return 'bg-emerald-900/55';
  if (cell.terrain === 'hill') return 'bg-amber-900/40';
  const b = String(cell.base || '');
  if (b.includes('wasteland')) return 'bg-stone-600/75';
  if (b.includes('grass')) return 'bg-green-800/45';
  return 'bg-lime-900/35';
}

/**
 * @param {object} props
 * @param {object[][]} props.cells
 * @param {number} props.mapColumns
 * @param {number} props.mapRows
 * @param {{ gx: number, gy: number }[]} props.roadCells
 * @param {(next: { gx: number, gy: number }[]) => void} props.onRoadCellsChange
 * @param {'4'|'8'} props.connectivity
 * @param {(c: '4'|'8') => void} props.onConnectivityChange
 * @param {number} [props.tilePx] 固定格边长（px）；不传则按容器宽高自动计算，尽量铺满横向并兼顾可视高度
 * @param {number} [props.maxTilePx] 自适应时的上限（默认 28）
 * @param {number} [props.minTilePx] 自适应时的下限（默认 8）
 */
export default function StrategicRoadCellsEditor({
  cells,
  mapColumns,
  mapRows,
  roadCells,
  onRoadCellsChange,
  connectivity,
  onConnectivityChange,
  tilePx: tilePxFixed,
  maxTilePx = 28,
  minTilePx = 8,
}) {
  const [paintMode, setPaintMode] = useState('paint');
  const paintingRef = useRef(false);
  const viewportRef = useRef(null);
  const [autoTilePx, setAutoTilePx] = useState(14);

  const fixedTile = typeof tilePxFixed === 'number' && tilePxFixed > 0;
  const tilePx = fixedTile ? tilePxFixed : autoTilePx;

  useLayoutEffect(() => {
    if (fixedTile) return undefined;
    const el = viewportRef.current;
    if (!el) return undefined;

    const compute = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w < 48) return;
      const pad = 8;
      const fromW = Math.floor((w - pad) / mapColumns);
      const fromH = h > 48 ? Math.floor((h - pad) / mapRows) : maxTilePx + 1;
      const next = Math.max(minTilePx, Math.min(maxTilePx, Math.min(fromW, fromH)));
      setAutoTilePx((prev) => (prev !== next ? next : prev));
    };

    compute();
    const ro = new ResizeObserver(() => compute());
    ro.observe(el);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [fixedTile, mapColumns, mapRows, maxTilePx, minTilePx, tilePxFixed]);

  const blocked = useMemo(
    () => buildStrategicObjectFootprintBlockedSet(cells, mapColumns, mapRows),
    [cells, mapColumns, mapRows],
  );

  const roadKeySet = useMemo(() => new Set(roadCells.map((c) => `${c.gx},${c.gy}`)), [roadCells]);

  const pathD = useMemo(() => {
    if (!roadCells?.length) return '';
    const conn = connectivity === ROAD_CONNECTIVITY_8 ? ROAD_CONNECTIVITY_8 : ROAD_CONNECTIVITY_4;
    return buildStrategicRoadOverlayPathD(roadCells, conn, mapColumns, mapRows);
  }, [roadCells, connectivity, mapColumns, mapRows]);

  const applyAt = useCallback(
    (gx, gy) => {
      const k = `${gx},${gy}`;
      if (blocked.has(k)) return;
      const next = new Set(roadKeySet);
      if (paintMode === 'paint') next.add(k);
      else next.delete(k);
      const arr = Array.from(next).map((s) => {
        const [x, y] = s.split(',').map(Number);
        return { gx: x, gy: y };
      });
      arr.sort((a, b) => a.gy - b.gy || a.gx - b.gx);
      onRoadCellsChange(arr);
    },
    [blocked, roadKeySet, paintMode, onRoadCellsChange],
  );

  const onCellPointerDown = useCallback(
    (e, gx, gy) => {
      if (e.button !== 0) return;
      e.preventDefault();
      paintingRef.current = true;
      applyAt(gx, gy);
    },
    [applyAt],
  );

  const onCellPointerEnter = useCallback(
    (e, gx, gy) => {
      if (!paintingRef.current) return;
      if ((e.buttons & 1) === 0) return;
      applyAt(gx, gy);
    },
    [applyAt],
  );

  const endPaint = useCallback(() => {
    paintingRef.current = false;
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-gray-600">涂抹工具：</span>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            name="road-paint-mode"
            checked={paintMode === 'paint'}
            onChange={() => setPaintMode('paint')}
          />
          画路
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            name="road-paint-mode"
            checked={paintMode === 'erase'}
            onChange={() => setPaintMode('erase')}
          />
          擦除
        </label>
        <span className="text-gray-400">|</span>
        <span className="text-gray-600">邻接（画线/寻路一致）：</span>
        <select
          className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
          value={connectivity === ROAD_CONNECTIVITY_8 ? ROAD_CONNECTIVITY_8 : ROAD_CONNECTIVITY_4}
          onChange={(e) =>
            onConnectivityChange(e.target.value === ROAD_CONNECTIVITY_8 ? ROAD_CONNECTIVITY_8 : ROAD_CONNECTIVITY_4)
          }
        >
          <option value={ROAD_CONNECTIVITY_4}>四连通（正交）</option>
          <option value={ROAD_CONNECTIVITY_8}>八连通（含对角）</option>
        </select>
        <span className="text-gray-500 text-xs">
          已选 {roadCells.length} 格 · 禁区为城/关/据点 2×2（不可涂）
          {!fixedTile ? ` · 格宽 ${tilePx}px（随窗口变化）` : ''}
        </span>
      </div>

      <div
        ref={viewportRef}
        className="w-full min-w-0 min-h-[min(52vh,420px)] max-h-[min(78vh,920px)] overflow-auto border border-gray-300 rounded-lg bg-stone-900 p-1 box-border"
        onPointerLeave={endPaint}
        onPointerUp={endPaint}
        onPointerCancel={endPaint}
      >
        <div
          className="relative mx-auto box-border align-top"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${mapColumns}, ${tilePx}px)`,
            gridTemplateRows: `repeat(${mapRows}, ${tilePx}px)`,
            gap: 0,
            background: '#0a0a14',
          }}
        >
          {cells.map((row, ri) =>
            row.map((cell, ci) => {
              const k = `${ci},${ri}`;
              const isBlocked = blocked.has(k);
              const isRoad = roadKeySet.has(k);
              return (
                <div
                  key={k}
                  role="presentation"
                  className={`box-border shrink-0 ${cellPreviewClass(cell)} ${
                    isBlocked ? 'ring-1 ring-red-900/50 cursor-not-allowed' : 'cursor-crosshair'
                  } ${isRoad && !isBlocked ? 'ring-1 ring-amber-400/55' : ''}`}
                  style={{ width: tilePx, height: tilePx }}
                  onPointerDown={(e) => !isBlocked && onCellPointerDown(e, ci, ri)}
                  onPointerEnter={(e) => !isBlocked && onCellPointerEnter(e, ci, ri)}
                  title={isBlocked ? `禁区 (${ci},${ri})` : `(${ci},${ri})`}
                />
              );
            }),
          )}
          {pathD ? (
            <svg
              className="pointer-events-none absolute left-0 top-0 z-[1]"
              style={{
                width: mapColumns * tilePx,
                height: mapRows * tilePx,
              }}
              viewBox={`0 0 ${mapColumns} ${mapRows}`}
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                className="ws-road-overlay__stroke ws-road-overlay__stroke--outer"
                d={pathD}
              />
              <path
                className="ws-road-overlay__stroke ws-road-overlay__stroke--inner"
                d={pathD}
              />
            </svg>
          ) : null}
        </div>
      </div>
    </div>
  );
}
