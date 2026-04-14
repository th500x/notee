import { useState, useLayoutEffect, useEffect, useRef } from 'react';
import { tooltipTransformForContent } from './battleConstants';

const PAD = 10;

/** 与 BattleMap.css `.tile-tooltip--world-map-city` 固定宽高一致 */
const WORLD_MAP_CITY_TOOLTIP_MAX_W = 295;
const WORLD_MAP_CITY_TOOLTIP_VW_FRAC = 1;
const EST_WORLD_MAP_CITY_TOOLTIP_H = 395;
/**
 * 战场 tile/部队 tooltip：贴近视口边缘时改为整屏居中展示，避免侧向空间不足时 max-width
 * 把块压成窄条、文字严重折行难以阅读。
 *
 * 大地图单城（worldMapCity）块更高更宽，仅靠首帧 getBoundingClientRect 可能晚一拍；对指针 x 做
 * 「半幅包络」预判，与测量 + rAF 复测一起，和小型/大型地图共用同一套「溢出则居中」策略。
 */
export function useTileTooltipClamp(tooltipContent, tooltipPos) {
  const tooltipRef = useRef(null);
  const [useCenter, setUseCenter] = useState(false);

  useEffect(() => {
    if (!tooltipContent) setUseCenter(false);
  }, [tooltipContent]);

  useLayoutEffect(() => {
    if (!tooltipContent || useCenter) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const worldMapCityWouldOverflowProactive = () => {
      if (tooltipContent?.type !== 'worldMapCity') return false;
      const maxW = Math.min(WORLD_MAP_CITY_TOOLTIP_MAX_W, vw * WORLD_MAP_CITY_TOOLTIP_VW_FRAC);
      const half = maxW / 2;
      const x = tooltipPos.x;
      const y = tooltipPos.y;
      const overflowX = x + half > vw - PAD || x - half < PAD;
      // 浮层在指针上方展开，贴顶时整框易超出视口上沿
      const overflowY = y - EST_WORLD_MAP_CITY_TOOLTIP_H < PAD;
      return overflowX || overflowY;
    };

    const measureOverflow = () => {
      const el = tooltipRef.current;
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const overflows =
        r.left < PAD ||
        r.right > vw - PAD ||
        r.top < PAD ||
        r.bottom > vh - PAD;
      if (overflows) {
        setUseCenter(true);
        return true;
      }
      return false;
    };

    if (worldMapCityWouldOverflowProactive()) {
      setUseCenter(true);
      return undefined;
    }

    measureOverflow();
    const id = requestAnimationFrame(() => {
      measureOverflow();
    });
    const el = tooltipRef.current;
    let ro;
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        measureOverflow();
      });
      ro.observe(el);
    }
    return () => {
      cancelAnimationFrame(id);
      if (ro) ro.disconnect();
    };
  }, [tooltipContent, tooltipPos, useCenter]);

  const tooltipStyle = !tooltipContent
    ? { display: 'none' }
    : useCenter
      ? {
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'block',
        }
      : {
          position: 'fixed',
          left: tooltipPos.x,
          top: tooltipPos.y,
          transform: tooltipTransformForContent(tooltipContent),
          display: 'block',
        };

  return { tooltipRef, tooltipStyle };
}
