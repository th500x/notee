/**
 * 全屏子 Tab（编组 / 势力 / 主城 / 地图等）右上角关闭：与 LineupTab 一致。
 * - 竖屏：顶栏右侧 ✕（`variant="bar"`）
 * - 横屏（宽≥768 且 宽>高）：内容区绝对定位右上角 ✕（`variant="corner"`）
 */

import { useState, useEffect } from 'react';

export function useGameTabLandscape() {
  const [isLandscape, setIsLandscape] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.innerWidth >= 768 &&
      window.innerWidth > window.innerHeight,
  );
  useEffect(() => {
    const onResize = () => {
      setIsLandscape(window.innerWidth >= 768 && window.innerWidth > window.innerHeight);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isLandscape;
}

/**
 * @param {() => void} onClose
 * @param {'bar' | 'corner'} variant
 */
export function TabPageCloseButton({ onClose, variant }) {
  if (variant === 'corner') {
    return (
      <button
        type="button"
        onClick={onClose}
        className="absolute top-1 right-2 z-20 text-stone-500 hover:text-white transition-colors px-2 py-1"
        aria-label="关闭"
      >
        ✕
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClose}
      className="flex-shrink-0 px-3 py-3 text-stone-500 hover:text-white transition-colors"
      aria-label="关闭"
    >
      ✕
    </button>
  );
}
