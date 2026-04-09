import { useState, useLayoutEffect, useEffect, useRef } from 'react';
import { tooltipTransformForContent } from './battleConstants';

const PAD = 10;

/**
 * 战场 tile/部队 tooltip：贴近视口边缘时改为整屏居中展示，避免侧向空间不足时 max-width
 * 把块压成窄条、文字严重折行难以阅读。
 */
export function useTileTooltipClamp(tooltipContent, tooltipPos) {
  const tooltipRef = useRef(null);
  const [useCenter, setUseCenter] = useState(false);

  useEffect(() => {
    if (!tooltipContent) setUseCenter(false);
  }, [tooltipContent]);

  useLayoutEffect(() => {
    if (!tooltipContent || useCenter) return;
    const el = tooltipRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const overflows =
      r.left < PAD ||
      r.right > vw - PAD ||
      r.top < PAD ||
      r.bottom > vh - PAD;
    if (overflows) setUseCenter(true);
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
