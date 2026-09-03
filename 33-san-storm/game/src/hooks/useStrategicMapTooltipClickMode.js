import { useState, useEffect } from 'react';

/**
 * 战略大地图：tooltip 用「点击格子」展开/收起，避免依赖 hover。
 *
 * - **精细指针 + 可悬停**（典型键鼠）：点击模式（原设计：避免 hover 时难点编组）。
 * - **粗指针**（手机/平板触控）：**同样用点击**。若用 mouseenter 打开，全屏浮层关掉后浏览器往往
 *   不会再次对同一格派发 mouseenter，表现为「关三公府/驻军所后阳翟要点别格一下才恢复」。
 * - 仅 **fine 指针且 (hover: none)**（如部分触摸屏笔记本）仍走非点击路径，由外层兜底。
 */
function readStrategicTooltipClickMode() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(pointer: coarse)').matches) return true;
  return window.matchMedia('(pointer: fine) and (hover: hover)').matches;
}

export function useStrategicMapTooltipClickMode() {
  const [clickMode, setClickMode] = useState(readStrategicTooltipClickMode);

  useEffect(() => {
    const mqFineHover = window.matchMedia('(pointer: fine) and (hover: hover)');
    const mqCoarse = window.matchMedia('(pointer: coarse)');
    const apply = () => setClickMode(readStrategicTooltipClickMode());
    apply();
    if (typeof mqFineHover.addEventListener === 'function') {
      mqFineHover.addEventListener('change', apply);
      mqCoarse.addEventListener('change', apply);
      return () => {
        mqFineHover.removeEventListener('change', apply);
        mqCoarse.removeEventListener('change', apply);
      };
    }
    mqFineHover.addListener(apply);
    mqCoarse.addListener(apply);
    return () => {
      mqFineHover.removeListener(apply);
      mqCoarse.removeListener(apply);
    };
  }, []);

  return clickMode;
}
