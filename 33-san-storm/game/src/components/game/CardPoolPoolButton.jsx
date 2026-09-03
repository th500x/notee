/**
 * 卡池入口单键（将领 / 部队）及同系样式的其它入口（如三公府·封赏·俸禄占位）。
 *
 * 原位于大地图顶栏 `CardPoolEntry` 内；顶栏入口已迁至 **三公府 → 互动 → 封赏**，本组件为唯一按钮壳实现。
 * 外层若需不挡地图点击，由父级包 `pointer-events-none`，本按钮根节点须 `pointer-events-auto`（见 `SanGongFuFengShangPanel`）。
 *
 * Tooltip 经 portal + fixed 定位，避免在 overflow 容器内撑出滚动条导致 flex 换行突变（封赏 4+2→3+3）。
 */

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

const LONG_PRESS_MS = 400;
const TOOLTIP_TEXT =
  '正式赛季根据势力城市发展度决定卡池质量/次数（概率），本次测试阶段固定卡池质量/次数（概率）';
const TOOLTIP_W = 224;
const TOOLTIP_GAP = 8;
const VIEW_PAD = 8;

function clampTooltipPos(btnRect, tipHeight) {
  let left = btnRect.left + btnRect.width / 2 - TOOLTIP_W / 2;
  left = Math.max(VIEW_PAD, Math.min(left, window.innerWidth - TOOLTIP_W - VIEW_PAD));
  let top = btnRect.bottom + TOOLTIP_GAP;
  if (tipHeight > 0 && top + tipHeight > window.innerHeight - VIEW_PAD) {
    top = Math.max(VIEW_PAD, btnRect.top - tipHeight - TOOLTIP_GAP);
  }
  return { left, top };
}

export function CardPoolPoolButton({
  icon,
  label,
  /** 与 `dailyLimit` 组成「剩余/上限」；若传入 `subLabel` 则整行改为展示该文案（如俸禄占位） */
  remaining,
  dailyLimit,
  subLabel,
  onClick,
  tooltip,
  drawerOpen = false,
  disabled = false,
}) {
  const [showTip, setShowTip] = useState(false);
  const [tipPos, setTipPos] = useState(null);
  const btnRef = useRef(null);
  const tipRef = useRef(null);
  const longTimer = useRef(null);
  const isLong = useRef(false);

  const tipText = tooltip || TOOLTIP_TEXT;

  const repositionTip = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const tipH = tipRef.current?.offsetHeight ?? 0;
    setTipPos(clampTooltipPos(rect, tipH));
  }, []);

  useEffect(() => {
    if (drawerOpen) setShowTip(false);
  }, [drawerOpen]);

  useLayoutEffect(() => {
    if (!showTip) {
      setTipPos(null);
      return undefined;
    }
    repositionTip();
    const raf = requestAnimationFrame(repositionTip);
    const onReflow = () => repositionTip();
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [showTip, tipText, repositionTip]);

  const onTouchStart = useCallback(() => {
    isLong.current = false;
    longTimer.current = setTimeout(() => {
      isLong.current = true;
      setShowTip(true);
    }, LONG_PRESS_MS);
  }, []);
  const onTouchEnd = useCallback((e) => {
    clearTimeout(longTimer.current);
    if (isLong.current) {
      setShowTip(false);
      e.preventDefault();
    }
  }, []);
  const onTouchMove = useCallback(() => {
    clearTimeout(longTimer.current);
  }, []);

  const tipNode =
    showTip && tipPos
      ? createPortal(
          <div
            ref={tipRef}
            role="tooltip"
            style={{ position: 'fixed', left: tipPos.left, top: tipPos.top, width: TOOLTIP_W, zIndex: 9999 }}
            className="pointer-events-none rounded-lg border border-amber-700/30 bg-black/85 px-3 py-2 text-[10px] leading-relaxed text-amber-100/90 shadow-lg backdrop-blur-sm"
          >
            {tipText}
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      className="relative shrink-0 pointer-events-auto"
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
    >
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`relative h-[72px] w-[100px] shrink-0 overflow-hidden rounded-xl border-2 border-amber-400/70 bg-gradient-to-br from-amber-900/90 via-yellow-800/80 to-amber-900/90 shadow-lg shadow-amber-500/30 transition-[border-color,box-shadow,transform] hover:border-amber-300 hover:shadow-amber-400/50 active:scale-95 ${
          disabled ? 'opacity-55 cursor-not-allowed' : ''
        }`}
      >
        <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-amber-300/20 to-transparent" />
        <div className="relative flex h-full flex-col items-center justify-center">
          <span className="text-2xl">{icon}</span>
          <span className="mt-0.5 text-[10px] font-bold text-amber-200">{label}</span>
          <span className="text-[9px] text-amber-400/70">
            {subLabel != null && subLabel !== '' ? subLabel : `${remaining}/${dailyLimit}`}
          </span>
        </div>
      </button>
      {tipNode}
    </div>
  );
}
