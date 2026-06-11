/**
 * 大地图左上 · 探索/教程进度钮（32-4 §1.5）
 * 有 `event_hint` 时红环脉动；点击展开指引 tooltip（不再使用格上网格「指引」浮层）。
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MAP_CORNER_ENTRY_ROW_CLASS_ZHOU_JUN,
  mapCornerEntryRowBoxStyle,
} from '@/components/game/mapCornerEntryUi';
import MapCornerEntryGoldGlow from '@/components/game/MapCornerEntryGoldGlow';
import '@/components/battle/BattleMap.css';

/**
 * @param {{
 *   children: import('react').ReactNode,
 *   jumpBusy?: boolean,
 *   disabledLocate?: boolean,
 *   eventHint?: string | null,
 *   onLocate?: () => void,
 *   titleWhenNoHint?: string,
 * }} props
 */
export default function MapCornerExploreProgressButton({
  children,
  jumpBusy = false,
  disabledLocate = false,
  eventHint = null,
  onLocate,
  titleWhenNoHint = '',
}) {
  const btnRef = useRef(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [anchor, setAnchor] = useState(/** @type {DOMRect | null} */ (null));

  const hintText = eventHint && String(eventHint).trim() ? String(eventHint).trim() : '';
  const showGlow = !!hintText;

  useEffect(() => {
    setHintOpen(false);
  }, [hintText]);

  const syncAnchor = useCallback(() => {
    setAnchor(btnRef.current?.getBoundingClientRect?.() || null);
  }, []);

  useLayoutEffect(() => {
    if (!hintOpen) {
      setAnchor(null);
      return undefined;
    }
    syncAnchor();
    const raf = requestAnimationFrame(() => syncAnchor());
    window.addEventListener('scroll', syncAnchor, true);
    window.addEventListener('resize', syncAnchor);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', syncAnchor, true);
      window.removeEventListener('resize', syncAnchor);
    };
  }, [hintOpen, syncAnchor]);

  useEffect(() => {
    if (!hintOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setHintOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hintOpen]);

  const handleClick = () => {
    if (showGlow) {
      syncAnchor();
      setHintOpen((v) => !v);
      return;
    }
    if (!jumpBusy && !disabledLocate && typeof onLocate === 'function') onLocate();
  };

  const disabled = jumpBusy || (disabledLocate && !showGlow);

  let panel = null;
  if (hintOpen && anchor && hintText && typeof document !== 'undefined') {
    const pad = 8;
    const panelW = Math.min(280, window.innerWidth - pad * 2);
    let left = anchor.right + 6;
    if (left + panelW > window.innerWidth - pad) {
      left = Math.max(pad, anchor.left - panelW - 6);
    }
    let top = anchor.top;
    top = Math.max(pad, Math.min(top, window.innerHeight - pad - 48));

    panel = createPortal(
      <>
        <button
          type="button"
          className="fixed inset-0 z-[10040] cursor-default bg-transparent"
          aria-label="关闭指引"
          onClick={() => setHintOpen(false)}
        />
        <div
          role="tooltip"
          aria-label="事件指引"
          className="tile-tooltip tile-tooltip--portal tile-tooltip--interactive fixed z-[10041]"
          style={{ left, top, width: panelW, maxWidth: panelW }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="tt-name">指引</div>
          <div className="tt-attrs" style={{ color: '#e7e5e4', whiteSpace: 'pre-line' }}>
            {hintText}
          </div>
        </div>
      </>,
      document.body,
    );
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={handleClick}
        title={showGlow ? undefined : titleWhenNoHint}
        style={mapCornerEntryRowBoxStyle}
        className={`${MAP_CORNER_ENTRY_ROW_CLASS_ZHOU_JUN} self-start justify-start text-left text-stone-100 disabled:opacity-60${
          showGlow ? ' map-corner-entry-gold-glow map-corner-entry-gold-glow--in-flow' : ''
        }`}
      >
        {showGlow ? <MapCornerEntryGoldGlow /> : null}
        <span
          className={
            showGlow
              ? 'map-corner-entry-gold-glow__content flex w-full min-w-0'
              : 'flex w-full min-w-0'
          }
        >
          {children}
        </span>
      </button>
      {panel}
    </>
  );
}
