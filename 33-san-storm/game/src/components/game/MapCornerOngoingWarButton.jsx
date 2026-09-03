/**
 * 大地图左上 · 单条进行中战事（32-4 §1.4）
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MAP_CORNER_ENTRY_ROW_CLASS_ZHOU_JUN,
  mapCornerEntryRowBoxStyle,
} from '@/components/game/mapCornerEntryUi';
import {
  buildMapCornerWarTooltip,
  formatMapCornerWarLabel,
} from '@/utils/mapCornerOngoingWars';
import {
  WAR_MORALE_ATTACKER_COLOR,
  WAR_MORALE_DEFENDER_COLOR,
  WarMoraleSideEdgeBar,
  shouldShowWarMoraleBar,
} from '@/components/game/WarMoraleRaceBar';

function prefersHoverUi() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

/**
 * @param {{ entry: object, onLocate?: () => void }} props
 */
export default function MapCornerOngoingWarButton({ entry, onLocate }) {
  const btnRef = useRef(null);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [anchor, setAnchor] = useState(/** @type {DOMRect | null} */ (null));
  const [, setTick] = useState(0);

  const open = hoverOpen || pinnedOpen;

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const syncAnchor = useCallback(() => {
    setAnchor(btnRef.current?.getBoundingClientRect?.() || null);
  }, []);

  useEffect(() => {
    if (!open) {
      setAnchor(null);
      return undefined;
    }
    syncAnchor();
    window.addEventListener('scroll', syncAnchor, true);
    window.addEventListener('resize', syncAnchor);
    return () => {
      window.removeEventListener('scroll', syncAnchor, true);
      window.removeEventListener('resize', syncAnchor);
    };
  }, [open, syncAnchor]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setHoverOpen(false);
        setPinnedOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const label = formatMapCornerWarLabel(entry.targetCityName, entry.targetCityId);
  const textClass = entry.isOffensive ? 'text-sky-400/95' : 'text-red-400/95';
  const tooltipText = buildMapCornerWarTooltip(entry);
  const showMoraleBar = shouldShowWarMoraleBar(
    entry.attackerWarMorale,
    entry.defenderWarMorale,
    entry.hasWarMoraleInit,
  );

  const handleClick = () => {
    if (typeof onLocate === 'function') onLocate();
    if (!prefersHoverUi()) {
      syncAnchor();
      setPinnedOpen((v) => !v);
    }
  };

  let panel = null;
  if (open && anchor && typeof document !== 'undefined') {
    const pad = 8;
    const panelW = Math.min(220, window.innerWidth - pad * 2);
    let left = anchor.right + 6;
    if (left + panelW > window.innerWidth - pad) {
      left = Math.max(pad, anchor.left - panelW - 6);
    }
    let top = anchor.top;
    top = Math.max(pad, Math.min(top, window.innerHeight - 120));

    panel = createPortal(
      <>
        {pinnedOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-[125] cursor-default bg-transparent"
            aria-label="关闭战事详情"
            onClick={() => setPinnedOpen(false)}
          />
        ) : null}
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[126] rounded-lg border border-amber-900/50 bg-stone-950/95 px-2.5 py-2 text-[10px] leading-snug text-stone-200 shadow-xl whitespace-pre-line"
          style={{ left, top, width: panelW }}
        >
          {tooltipText}
        </div>
      </>,
      document.body,
    );
  }

  const attMorale = Math.round(Number(entry.attackerWarMorale) || 0);
  const defMorale = Math.round(Number(entry.defenderWarMorale) || 0);

  return (
    <>
      {panel}
      <button
        ref={btnRef}
        type="button"
        style={mapCornerEntryRowBoxStyle}
        className={`${MAP_CORNER_ENTRY_ROW_CLASS_ZHOU_JUN} flex-col justify-center p-0 text-left ${textClass}`}
        aria-label={tooltipText.replace(/\n/g, ' ')}
        onMouseEnter={() => {
          if (!prefersHoverUi()) return;
          syncAnchor();
          setHoverOpen(true);
        }}
        onMouseLeave={() => {
          if (!prefersHoverUi()) return;
          setHoverOpen(false);
        }}
        onClick={handleClick}
      >
        {showMoraleBar ? (
          <WarMoraleSideEdgeBar
            value={attMorale}
            colorClass={WAR_MORALE_ATTACKER_COLOR}
            edge="top"
          />
        ) : null}
        <span
          className={`block w-full min-w-0 truncate text-center ${
            showMoraleBar ? 'flex flex-1 items-center justify-center px-0.5 text-[11px] leading-tight' : 'px-1 text-left'
          }`}
        >
          {label}
        </span>
        {showMoraleBar ? (
          <WarMoraleSideEdgeBar
            value={defMorale}
            colorClass={WAR_MORALE_DEFENDER_COLOR}
            edge="bottom"
          />
        ) : null}
      </button>
    </>
  );
}
