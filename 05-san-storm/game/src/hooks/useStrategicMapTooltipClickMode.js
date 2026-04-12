import { useState, useEffect } from 'react';

/**
 * 横屏 PC（精细指针 + 可悬停）：战略大地图 tooltip 用点击展开，避免 hover 时难点编组/披挂。
 * 触控/无 hover 能力设备保持悬停逻辑。
 */
export function useStrategicMapTooltipClickMode() {
  const [clickMode, setClickMode] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(pointer: fine) and (hover: hover)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(pointer: fine) and (hover: hover)');
    const apply = () => setClickMode(mq.matches);
    apply();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
    mq.addListener(apply);
    return () => mq.removeListener(apply);
  }, []);

  return clickMode;
}
