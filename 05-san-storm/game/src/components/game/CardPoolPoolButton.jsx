/**
 * 卡池入口单键（将领 / 部队）及同系样式的其它入口（如三公府·封赏·俸禄占位）。
 *
 * 原位于大地图顶栏 `CardPoolEntry` 内；顶栏入口已迁至 **三公府 → 互动 → 封赏**，本组件为唯一按钮壳实现。
 * 外层若需不挡地图点击，由父级包 `pointer-events-none`，本按钮根节点须 `pointer-events-auto`（见 `SanGongFuFengShangPanel`）。
 */

import { useState, useRef, useCallback, useEffect } from 'react';

const LONG_PRESS_MS = 400;
const TOOLTIP_TEXT =
  '正式赛季根据势力城市发展度决定卡池质量/次数（概率），本次测试阶段固定卡池质量/次数（概率）';

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
  const longTimer = useRef(null);
  const isLong = useRef(false);

  useEffect(() => {
    if (drawerOpen) setShowTip(false);
  }, [drawerOpen]);

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

  const tipText = tooltip || TOOLTIP_TEXT;

  return (
    <div
      className="relative pointer-events-auto"
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`relative h-[72px] w-[100px] overflow-hidden rounded-xl border-2 border-amber-400/70 bg-gradient-to-br from-amber-900/90 via-yellow-800/80 to-amber-900/90 shadow-lg shadow-amber-500/30 transition-all hover:border-amber-300 hover:shadow-amber-400/50 active:scale-95 ${
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

      {showTip && (
        <div
          className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-56 -translate-x-1/2 rounded-lg border border-amber-700/30 bg-black/85 px-3 py-2 text-[10px] leading-relaxed text-amber-100/90 shadow-lg backdrop-blur-sm"
        >
          {tipText}
        </div>
      )}
    </div>
  );
}
