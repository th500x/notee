import { useState, useCallback, useLayoutEffect, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * 大地图 `event_hint`：优先锚在玩家路点（与 `StrategicMapSelfPawn` 同 `cx/cy`）；若无坐标则锚在地图滚动区上沿居中。
 * 展开时点任意处收束为「指引」按钮，再点「指引」展开。
 *
 * portal 在 `document.body` 上须用 **z ≥ 10090**：低于 `GamePage` 全屏壳 `z-[100]` 会被整块主界面盖住；
 * 须高于 `AncientModal` 的 `z-[10080]`，否则关奖励后仍看不见。
 *
 * @param {number|null|undefined} cx - 格网内像素；与 `cy` 同时有效时使用锚点 DOM
 * @param {number|null|undefined} cy
 * @param {boolean} [visible=true] - 为 false 时不渲染锚点与 portal（如本人路点操作条打开时），**保持组件挂载**以保留收束/展开状态
 */
export default function StrategicMapEventHintBubble({
  cx,
  cy,
  hintText,
  mapWrapRef,
  visible = true,
}) {
  const anchorRef = useRef(null);
  const [anchorRect, setAnchorRect] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const hasPawnAnchor =
    Number.isFinite(cx) && Number.isFinite(cy);

  useEffect(() => {
    setCollapsed(false);
  }, [hintText]);

  const measure = useCallback(() => {
    const el = anchorRef.current;
    if (hasPawnAnchor && el && typeof el.getBoundingClientRect === 'function') {
      setAnchorRect(el.getBoundingClientRect());
      return;
    }
    const wrap = mapWrapRef?.current;
    if (wrap && typeof wrap.getBoundingClientRect === 'function') {
      const r = wrap.getBoundingClientRect();
      const topY = r.top + Math.min(80, Math.max(40, r.height * 0.08));
      const midX = r.left + r.width / 2;
      setAnchorRect({
        left: midX - 0.5,
        right: midX + 0.5,
        top: topY,
        bottom: topY + 1,
        width: 1,
        height: 1,
      });
      return;
    }
    if (typeof window !== 'undefined') {
      const midX = window.innerWidth / 2;
      const topY = Math.min(160, Math.max(72, window.innerHeight * 0.18));
      setAnchorRect({
        left: midX - 0.5,
        right: midX + 0.5,
        top: topY,
        bottom: topY + 1,
        width: 1,
        height: 1,
      });
    }
  }, [hasPawnAnchor, cx, cy, mapWrapRef]);

  useLayoutEffect(() => {
    if (!visible) return undefined;
    measure();
    const raf = requestAnimationFrame(() => measure());
    return () => cancelAnimationFrame(raf);
  }, [measure, collapsed, hintText, hasPawnAnchor, cx, cy, visible]);

  useEffect(() => {
    if (!hintText || !visible || typeof window === 'undefined') return undefined;
    const wrap = mapWrapRef?.current;
    const onScrollOrResize = () => measure();
    wrap?.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      wrap?.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [hintText, visible, mapWrapRef, measure]);

  if (!hintText) return null;
  if (!visible) return null;

  const anchor = hasPawnAnchor ? (
    <div
      ref={anchorRef}
      className="ws-map-event-hint__anchor"
      style={{
        position: 'absolute',
        left: `${cx}px`,
        top: `${cy}px`,
        transform: 'translate(-50%, -50%)',
        width: 1,
        height: 1,
        pointerEvents: 'none',
        zIndex: 6,
      }}
      aria-hidden
    />
  ) : null;

  // 首帧 mapWrap/路点锚尚未就绪时 measure 也会写入视口兜底 rect，避免 portal 整块不渲染
  const portal =
    typeof document !== 'undefined' && anchorRect
      ? createPortal(
          <>
            {!collapsed ? (
              <>
                <button
                  type="button"
                  className="ws-map-event-hint__backdrop fixed inset-0 z-[10090] cursor-default bg-transparent"
                  aria-label="收合指引"
                  onClick={() => setCollapsed(true)}
                />
                <div
                  className="fixed z-[10091] w-[min(60vw,10rem)] cursor-default"
                  style={{
                    left: Math.min(
                      window.innerWidth - 12,
                      Math.max(12, anchorRect.left + anchorRect.width / 2),
                    ),
                    top: anchorRect.bottom + 10,
                    transform: 'translateX(-50%)',
                  }}
                  role="presentation"
                  onClick={() => setCollapsed(true)}
                >
                  <div
                    className="ws-map-event-hint__bubble relative rounded-xl border-2 border-amber-200/90 bg-stone-900/96 px-3 py-2.5 text-left shadow-[0_8px_28px_rgba(0,0,0,0.55)]"
                    role="dialog"
                    aria-label="事件指引"
                  >
                    <div className="ws-map-event-hint__pointer" aria-hidden />
                    <p className="text-[13px] leading-snug text-amber-50 sm:text-sm">{hintText}</p>
                    <div
                      className="mt-2 flex justify-end gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="rounded border border-stone-500/80 bg-stone-800/90 px-2 py-1 text-[11px] text-stone-200 hover:bg-stone-700"
                        onClick={() => setCollapsed(true)}
                      >
                        知道了
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="ws-map-event-hint__pill fixed z-[10091] rounded-full border border-amber-400/75 bg-amber-950/92 px-2 py-0.5 text-[10px] font-medium leading-tight text-amber-100/95 shadow hover:bg-amber-900/95 sm:text-[11px] sm:px-2.5 sm:py-1"
                style={{
                  left: Math.min(
                    window.innerWidth - 12,
                    Math.max(12, anchorRect.left + anchorRect.width / 2),
                  ),
                  top: anchorRect.bottom + 20,
                  transform: 'translateX(-50%)',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setCollapsed(false);
                }}
              >
                指引
              </button>
            )}
          </>,
          document.body,
        )
      : null;

  return (
    <>
      {anchor}
      {portal}
    </>
  );
}
