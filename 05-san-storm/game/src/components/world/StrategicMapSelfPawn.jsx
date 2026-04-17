/**
 * 战略大地图：玩家自身占位。圆形内为角色名末字；键鼠悬停圆形时显示全名与兵力 tooltip。
 * `(pointer: coarse)` 不展示 tooltip。圆形命中区 `pointer-events: auto`，其余不挡格点击。
 */

import { useState, useCallback, useSyncExternalStore } from 'react';

const BASE = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : '/';

function subscribePointerCoarse(cb) {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia('(pointer: coarse)');
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

function getPointerCoarseSnapshot() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

function getPointerCoarseServerSnapshot() {
  return false;
}

function resolvePortraitSrc(portraitUrl) {
  if (!portraitUrl || typeof portraitUrl !== 'string') return null;
  const u = portraitUrl.trim();
  if (!u) return null;
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) return u;
  return `${BASE}${u.replace(/^\//, '')}`;
}

/**
 * @param {object} props
 * @param {number} props.cx
 * @param {number} props.cy
 * @param {string|null|undefined} props.portraitUrl
 * @param {string} props.displayName - `[势力]角色名`，用于 tooltip
 * @param {string} props.centerGlyph - 角色名末字（图标正中）
 * @param {number} props.troopsCurrent
 * @param {number} props.troopsMax
 */
export default function StrategicMapSelfPawn({
  cx,
  cy,
  portraitUrl,
  displayName,
  centerGlyph,
  troopsCurrent,
  troopsMax,
}) {
  const coarsePointer = useSyncExternalStore(
    subscribePointerCoarse,
    getPointerCoarseSnapshot,
    getPointerCoarseServerSnapshot,
  );
  const [hover, setHover] = useState(false);
  const src = resolvePortraitSrc(portraitUrl);
  const label = (displayName && String(displayName).trim()) || '…';
  const g = (centerGlyph && String(centerGlyph).trim()) || '';
  const seq = Array.from(g);
  const glyph = seq.length ? seq[seq.length - 1] : '…';
  const showTroops = Number.isFinite(troopsCurrent) && Number.isFinite(troopsMax);
  const troopText = showTroops ? `${Math.max(0, Math.round(troopsCurrent))}/${Math.max(0, Math.round(troopsMax))}` : null;
  const showTooltip = hover && !coarsePointer;

  const onEnter = useCallback(() => setHover(true), []);
  const onLeave = useCallback(() => setHover(false), []);

  return (
    <div
      className="ws-map-self-pawn"
      style={{ left: `${cx}px`, top: `${cy}px` }}
      aria-hidden
    >
      <div
        className="ws-map-self-pawn__hit"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <div className="ws-map-self-pawn__avatar">
          {src ? (
            <img className="ws-map-self-pawn__img" src={src} alt="" draggable={false} />
          ) : (
            <div className="ws-map-self-pawn__img ws-map-self-pawn__img--fallback" />
          )}
          <span className="ws-map-self-pawn__center-glyph">{glyph}</span>
        </div>
        {showTooltip ? (
          <div className="ws-map-self-pawn__tooltip">
            <div className="ws-map-self-pawn__tooltip-name">{label}</div>
            {troopText ? <div className="ws-map-self-pawn__tooltip-troops">{troopText}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
