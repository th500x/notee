/**
 * 战略缩略图：单 SVG、viewBox 与大地图格坐标一致（性能优先，无 per-tile DOM）。
 * 仅 props 驱动，不依赖 PlayerContext（可测 / 可文档化）。
 */

import { memo } from 'react';

/**
 * @typedef {{ cityId: string, x: number, y: number, w: number, h: number, fill: string, stroke?: string, cityType?: string|null }} StrategicMiniMapCityRect
 */

const TIER_STAR_FILL = '#fde047';
const TIER_STAR_STROKE = 'rgba(28,25,23,0.82)';

function tierStarFontSize(r) {
  return Math.max(0.5, Math.min(r.w, r.h) * 0.52);
}

function tierStarText(key, x, y, fs) {
  const sw = Math.max(0.04, fs * 0.1);
  return (
    <text
      key={key}
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fill={TIER_STAR_FILL}
      stroke={TIER_STAR_STROKE}
      strokeWidth={sw}
      paintOrder="stroke fill"
      fontSize={fs}
      fontWeight="700"
      fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
      style={{ pointerEvents: 'none' }}
    >
      ★
    </text>
  );
}

/** 中城 1 星 · 大城 2 星（城块中心，便于区分级别） */
function cityTierStars(r) {
  const ct = r.cityType;
  if (ct !== 'city_medium' && ct !== 'city_major') return null;
  const fs = tierStarFontSize(r);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  if (ct === 'city_medium') {
    return tierStarText(`tier-star-${r.cityId}`, cx, cy, fs);
  }
  const gap = fs * 0.5;
  return (
    <g key={`tier-stars-${r.cityId}`} style={{ pointerEvents: 'none' }}>
      {tierStarText(`tier-star-${r.cityId}-0`, cx - gap / 2, cy, fs)}
      {tierStarText(`tier-star-${r.cityId}-1`, cx + gap / 2, cy, fs)}
    </g>
  );
}

function findCityRect(cityRects, cityId) {
  if (cityId == null || cityId === '') return null;
  return cityRects.find((c) => String(c.cityId) === String(cityId)) ?? null;
}

/** 最近 3 敌对 / 最近 3 中立：双层描边环 + 缓慢脉冲（无中心文字） */
function proximityHighlightRing(cityRects, cityId, kind, layer) {
  const r = findCityRect(cityRects, cityId);
  if (!r) return null;
  const hostile = kind === 'hostile';
  const pulseDur = '2.8s';
  if (layer === 'under') {
    const stroke = hostile ? 'rgb(248,113,113)' : 'rgb(125,211,252)';
    const pad = 0.32;
    return (
      <rect
        key={`ph-soft-${kind}-${cityId}`}
        x={r.x - pad}
        y={r.y - pad}
        width={r.w + pad * 2}
        height={r.h + pad * 2}
        rx={0.34}
        ry={0.34}
        fill="none"
        stroke={stroke}
        strokeOpacity={0.22}
        strokeWidth={0.48}
        style={{ pointerEvents: 'none' }}
      >
        <animate
          attributeName="stroke-opacity"
          values="0.1;0.42;0.1"
          dur={pulseDur}
          repeatCount="indefinite"
        />
      </rect>
    );
  }
  const stroke = hostile ? 'rgb(252,165,165)' : 'rgb(147,197,253)';
  const pad = 0.1;
  return (
    <rect
      key={`ph-hard-${kind}-${cityId}`}
      x={r.x - pad}
      y={r.y - pad}
      width={r.w + pad * 2}
      height={r.h + pad * 2}
      rx={0.26}
      ry={0.26}
      fill="none"
      stroke={stroke}
      strokeOpacity={0.55}
      strokeWidth={0.12}
      style={{ pointerEvents: 'none' }}
    >
      <animate
        attributeName="stroke-opacity"
        values="0.35;1;0.35"
        dur={pulseDur}
        repeatCount="indefinite"
      />
      <animate
        attributeName="stroke-width"
        values="0.1;0.28;0.1"
        dur={pulseDur}
        repeatCount="indefinite"
      />
    </rect>
  );
}

/**
 * 跨行政郡道路叠线 path `d`（如 S1 郡界土黄色），与 `roadPathD` 同坐标系；可选空串。
 *
 * @param {{
 *   mapColumns: number,
 *   mapRows: number,
 *   roadPathD: string,
 *   roadAdminBoundaryPathD?: string,
 *   cityRects: StrategicMiniMapCityRect[],
 *   selfMarker?: { cx: number, cy: number, fill?: string, stroke?: string } | null,
 *   selectedCityId?: string | null,
 *   onCitySelect?: (cityId: string, event: { nativeEvent: unknown }) => void,
 *   proximityHighlight?: { hostileCityIds?: string[], neutralCityIds?: string[] } | null,
 *   className?: string,
 *   'aria-label'?: string,
 * }} props
 */
function StrategicMiniMapSvg({
  mapColumns,
  mapRows,
  roadPathD,
  roadAdminBoundaryPathD = '',
  cityRects,
  selfMarker = null,
  selectedCityId = null,
  onCitySelect = null,
  proximityHighlight = null,
  className = '',
  'aria-label': ariaLabel = '战略缩略图',
}) {
  const W = Math.max(1, Number(mapColumns) || 1);
  const H = Math.max(1, Number(mapRows) || 1);
  const d = typeof roadPathD === 'string' ? roadPathD : '';
  const dAdmin = typeof roadAdminBoundaryPathD === 'string' ? roadAdminBoundaryPathD : '';

  const hostileHighlightIds = Array.isArray(proximityHighlight?.hostileCityIds)
    ? proximityHighlight.hostileCityIds.filter((id) => id != null && String(id).trim() !== '')
    : [];
  const neutralHighlightIds = Array.isArray(proximityHighlight?.neutralCityIds)
    ? proximityHighlight.neutralCityIds.filter((id) => id != null && String(id).trim() !== '')
    : [];

  return (
    <svg
      className={className}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={ariaLabel}
      shapeRendering="optimizeSpeed"
    >
      <rect x={0} y={0} width={W} height={H} fill="#1c1917" />
      {d ? (
        <path
          d={d}
          fill="none"
          stroke="rgba(148,163,184,0.55)"
          strokeWidth={0.35}
          strokeLinecap="square"
        />
      ) : null}
      {dAdmin ? (
        <path
          d={dAdmin}
          fill="none"
          stroke="rgba(218, 170, 85, 0.98)"
          strokeWidth={0.95}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {hostileHighlightIds.map((cityId) =>
        proximityHighlightRing(cityRects, cityId, 'hostile', 'under'),
      )}
      {neutralHighlightIds.map((cityId) =>
        proximityHighlightRing(cityRects, cityId, 'neutral', 'under'),
      )}
      {cityRects.map((r) => {
        const sel = selectedCityId != null && String(selectedCityId) === String(r.cityId);
        return (
          <rect
            key={r.cityId}
            data-strategic-mini-city={String(r.cityId)}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            rx={0.22}
            ry={0.22}
            fill={r.fill}
            stroke={sel ? 'rgba(250,204,21,0.95)' : r.stroke ?? 'rgba(15,23,42,0.65)'}
            strokeWidth={sel ? 0.22 : 0.08}
            className={onCitySelect ? 'cursor-pointer' : undefined}
            style={onCitySelect ? { pointerEvents: 'auto' } : undefined}
            onClick={
              onCitySelect
                ? (e) => {
                    e.stopPropagation();
                    onCitySelect(String(r.cityId), e);
                  }
                : undefined
            }
          />
        );
      })}
      {hostileHighlightIds.map((cityId) =>
        proximityHighlightRing(cityRects, cityId, 'hostile', 'over'),
      )}
      {neutralHighlightIds.map((cityId) =>
        proximityHighlightRing(cityRects, cityId, 'neutral', 'over'),
      )}
      {cityRects.map((r) => cityTierStars(r))}
      {selfMarker &&
      Number.isFinite(selfMarker.cx) &&
      Number.isFinite(selfMarker.cy) ? (
        <circle
          cx={selfMarker.cx}
          cy={selfMarker.cy}
          r={0.42}
          fill={selfMarker.fill ?? '#fde047'}
          stroke={selfMarker.stroke ?? '#0c0a09'}
          strokeWidth={0.1}
        />
      ) : null}
    </svg>
  );
}

export default memo(StrategicMiniMapSvg);
