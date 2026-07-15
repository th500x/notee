import { useEffect, useState } from 'react';

/** 矮视口（高度 ≤780px）时口谕/排行/聊天改到州郡条第三列，避免左下被底栏裁切 */
export const MAP_CORNER_COMPACT_MAX_HEIGHT_PX = 780;

export function useMapCornerCompactViewport() {
  const [compact, setCompact] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-height: ${MAP_CORNER_COMPACT_MAX_HEIGHT_PX}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia(`(max-height: ${MAP_CORNER_COMPACT_MAX_HEIGHT_PX}px)`);
    const onChange = () => setCompact(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return compact;
}
