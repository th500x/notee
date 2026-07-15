/**
 * 攻城「势力战况」独立浮层：与主城池 tooltip 分离，锚定在主框右侧，高度随内容。
 * 单独 portal 到 body，不包裹、不改动 WorldMapCityInfoBlock 的 DOM。
 */
import { useEffect, useLayoutEffect, useMemo, useState, memo } from 'react';
import { createPortal } from 'react-dom';
import { API_CONFIG } from '@/constants';
import { fetchWithTimeout } from '@/services/httpClient';
import { WORLD_MAP_DEFAULT_FACTION_LABELS } from '@/utils/worldMapCityPanelCopy';

const GAP_PX = 8;
const Z_FLOAT = 10051;

const FACTION_COLORS = {
  san_1_faction_1001: '#ef4444',
  san_1_faction_2001: '#3b82f6',
  san_1_faction_3001: '#22c55e',
  san_1_faction_4001: '#a855f7',
  san_1_faction_5001: '#f97316',
  san_1_faction_6001: '#eab308',
  san_1_faction_7001: '#78716c',
};

function readTouchLikePointerMedia() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(hover: none)').matches || window.matchMedia('(pointer: coarse)').matches
  );
}

function StrategicSiegeWarFloatingPanel({
  anchorRef,
  /** 主 tooltip 指针/位置变化时用于触发重算锚点 */
  tooltipPos,
  cityId,
  factionDisplayMap = {},
  enabled,
  tooltipClickMode,
  clearLeaveTooltipTimer,
  scheduleLeaveFromTile,
}) {
  const [warData, setWarData] = useState(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  /** 竖屏/设备模拟常为 coarse 或 hover:none；此时若仍 pointer-events:auto 会挡住格上网格点击（典型：阳翟 2×2 被浮层盖住） */
  const [touchLikePointer, setTouchLikePointer] = useState(readTouchLikePointerMedia);

  useEffect(() => {
    const apply = () => setTouchLikePointer(readTouchLikePointerMedia());
    apply();
    if (typeof window === 'undefined') return undefined;
    const mqHover = window.matchMedia('(hover: none)');
    const mqPointer = window.matchMedia('(pointer: coarse)');
    if (typeof mqHover.addEventListener === 'function') {
      mqHover.addEventListener('change', apply);
      mqPointer.addEventListener('change', apply);
      return () => {
        mqHover.removeEventListener('change', apply);
        mqPointer.removeEventListener('change', apply);
      };
    }
    mqHover.addListener(apply);
    mqPointer.addListener(apply);
    return () => {
      mqHover.removeListener(apply);
      mqPointer.removeListener(apply);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !cityId) {
      setWarData(null);
      return undefined;
    }
    let cancelled = false;
    fetchWithTimeout(`${API_CONFIG.BASE_URL}/cities/${encodeURIComponent(cityId)}/active-war`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled || !res?.success) return;
        setWarData(res.data);
      })
      .catch(() => {
        if (!cancelled) setWarData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, cityId]);

  const entries = useMemo(() => {
    const fk = warData?.faction_kills;
    if (!fk || typeof fk !== 'object') return null;
    const list = Object.entries(fk)
      .map(([fid, kills]) => ({
        factionId: fid,
        kills: Number(kills) || 0,
        label: factionDisplayMap[fid] || WORLD_MAP_DEFAULT_FACTION_LABELS[fid] || '未知',
      }))
      .filter((e) => e.kills > 0)
      .sort((a, b) => b.kills - a.kills);
    return list.length ? list : null;
  }, [warData, factionDisplayMap]);

  useLayoutEffect(() => {
    if (!enabled || !cityId || !entries?.length) return undefined;

    const update = () => {
      const el = anchorRef?.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({ left: r.right + GAP_PX, top: r.top });
    };

    update();
    const raf = requestAnimationFrame(update);
    const el = anchorRef?.current;
    let ro;
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(el);
    }
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [enabled, cityId, entries, anchorRef, tooltipPos?.x, tooltipPos?.y]);

  if (!enabled || !cityId || !entries?.length) return null;

  const passThroughPointerEvents = tooltipClickMode || touchLikePointer;
  const node = (
    <div
      className="strategic-siege-war-float rounded-lg border border-stone-500/90 px-3 py-2 text-stone-200 text-sm"
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        zIndex: Z_FLOAT,
        width: 'max-content',
        minWidth: '10rem',
        maxWidth: 'min(14rem, 92vw)',
        background: 'rgba(15, 15, 25, 0.96)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.55)',
        pointerEvents: passThroughPointerEvents ? 'none' : 'auto',
      }}
      onMouseEnter={passThroughPointerEvents ? undefined : clearLeaveTooltipTimer}
      onMouseLeave={passThroughPointerEvents ? undefined : scheduleLeaveFromTile}
    >
      <div className="text-amber-200 text-xs font-bold mb-1">⚔️ 势力战况</div>
      {entries.map((e, i) => (
        <div key={e.factionId || i} className="flex items-center justify-between gap-3 text-xs py-0.5">
          <span style={{ color: FACTION_COLORS[e.factionId] || '#ccc' }}>
            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} {e.label || '未知'}
          </span>
          <span className="text-amber-400 font-bold">{e.kills}</span>
        </div>
      ))}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(node, document.body) : null;
}

export default memo(StrategicSiegeWarFloatingPanel);
