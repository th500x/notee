/**
 * san_1 三势力缩略块（三王 / 汉室 / 黄巾）+ 势力信息 tooltip（大地图右侧坞；32-1）
 * 战役中心入口已迁至顶栏，本组件不再默认挂战役卡（仍可选 `onOpenCampaignCenter`）。
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import FactionInfoPanel from '@/components/game/faction/FactionInfoPanel';
import WorldMapCampaignCenterThumb from '@/components/game/WorldMapCampaignCenterThumb';
import {
  getFactionRepresentativeColor,
  getStrategicFactionLogoUrl,
  hexToRgba,
} from '@/utils/strategicMapFactionColors';

function prefersHoverUi() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

/** @param {object|null|undefined} overview */
export function monarchDisplayNameFromOverview(overview) {
  const junzhu = overview?.officeHolders?.find((o) => o.positionId === 'san_1_position_junzhu');
  return junzhu?.characterName || overview?.factionName || '—';
}

/**
 * @param {{ factionId: string, overview: object, active: boolean, onHoverStart: () => void, onHoverEnd: () => void, onTogglePin: () => void }} props
 */
function WorldMapFactionThumb({
  factionId,
  overview,
  active,
  onHoverStart,
  onHoverEnd,
  onTogglePin,
  compact = false,
}) {
  const btnRef = useRef(null);
  const color = getFactionRepresentativeColor(factionId) || '#78716c';
  const logoUrl = getStrategicFactionLogoUrl(factionId);
  const monarch = monarchDisplayNameFromOverview(overview);
  const cityCount = Number(overview?.cityCount) || 0;
  const bgTint = hexToRgba(color, 0.12) || 'rgba(120,113,108,0.12)';

  return (
    <button
      ref={btnRef}
      type="button"
      data-world-map-faction-thumb={factionId}
      className={`flex flex-col items-center justify-center rounded-lg border-2 text-center transition-colors ${
        compact
          ? 'min-h-[3.5rem] gap-0.5 px-1 py-1'
          : 'min-h-[4.25rem] gap-1 px-2 py-2'
      } ${active ? 'ring-1 ring-amber-400/50' : 'hover:bg-stone-900/40'}`}
      style={{
        borderColor: color,
        backgroundColor: bgTint,
      }}
      onMouseEnter={() => {
        if (!prefersHoverUi()) return;
        onHoverStart();
      }}
      onMouseLeave={() => {
        if (!prefersHoverUi()) return;
        onHoverEnd();
      }}
      onClick={() => {
        if (!prefersHoverUi()) onTogglePin();
      }}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className={`${compact ? 'h-5 w-5' : 'h-7 w-7'} shrink-0 object-contain opacity-95`}
          draggable={false}
        />
      ) : null}
      <span
        className={`w-full truncate font-semibold leading-tight text-stone-100 ${
          compact ? 'text-[10px]' : 'text-xs'
        }`}
      >
        {monarch}
      </span>
      <span className={`${compact ? 'text-[9px]' : 'text-[10px]'} tabular-nums text-stone-400`}>
        {cityCount} 城
      </span>
    </button>
  );
}

/**
 * @param {{
 *   factions: Array<{ factionId: string, overview: object }>,
 *   loading?: boolean,
 *   error?: string|null,
 *   isLandscape?: boolean,
 *   onOpenCampaignCenter?: () => void,
 *   campaignNotifyDot?: boolean,
 *   compact?: boolean,
 * }} props
 */
export default function WorldMapFactionStrip({
  factions,
  loading,
  error,
  isLandscape = false,
  onOpenCampaignCenter,
  campaignNotifyDot = false,
  compact = false,
}) {
  const [hoverId, setHoverId] = useState(/** @type {string|null} */ (null));
  const [pinnedId, setPinnedId] = useState(/** @type {string|null} */ (null));
  const [anchor, setAnchor] = useState(/** @type {DOMRect | null} */ (null));
  const tooltipRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [tooltipPos, setTooltipPos] = useState(
    /** @type {{ left: number, top: number, width: number } | null} */ (null),
  );

  const openId = hoverId || pinnedId;
  const openEntry = factions.find((f) => f.factionId === openId) || null;

  const syncAnchor = useCallback(() => {
    if (!openId || typeof document === 'undefined') {
      setAnchor(null);
      return;
    }
    const el = document.querySelector(`[data-world-map-faction-thumb="${openId}"]`);
    setAnchor(el?.getBoundingClientRect?.() || null);
  }, [openId]);

  useEffect(() => {
    if (!openId) {
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
  }, [openId, syncAnchor]);

  useEffect(() => {
    if (!openId) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setHoverId(null);
        setPinnedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId]);

  useLayoutEffect(() => {
    if (!openId || !anchor || !tooltipRef.current) {
      setTooltipPos(null);
      return;
    }
    const pad = 8;
    const panelW = Math.min(300, window.innerWidth - pad * 2);
    let left = anchor.right + 8;
    if (left + panelW > window.innerWidth - pad) {
      left = Math.max(pad, anchor.left - panelW - 8);
    }
    let top = anchor.top;
    const h = tooltipRef.current.offsetHeight;
    if (top + h > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - h - pad);
    }
    if (top < pad) top = pad;
    setTooltipPos({ left, top, width: panelW });
  }, [openId, anchor, openEntry?.overview]);

  const gridClass = isLandscape ? 'grid-cols-2 xl:grid-cols-3' : 'grid-cols-2';

  let tooltipPanel = null;
  if (openEntry && anchor && typeof document !== 'undefined') {
    const pad = 8;
    const panelW = Math.min(300, window.innerWidth - pad * 2);
    let draftLeft = anchor.right + 8;
    if (draftLeft + panelW > window.innerWidth - pad) {
      draftLeft = Math.max(pad, anchor.left - panelW - 8);
    }
    const draftTop = Math.max(pad, anchor.top);
    const pos = tooltipPos ?? { left: draftLeft, top: draftTop, width: panelW };

    tooltipPanel = createPortal(
      <>
        {pinnedId ? (
          <button
            type="button"
            className="fixed inset-0 z-[125] cursor-default bg-black/35"
            aria-label="关闭势力详情"
            onClick={() => setPinnedId(null)}
          />
        ) : null}
        <div
          ref={tooltipRef}
          role="tooltip"
          className="pointer-events-auto fixed z-[126] rounded-lg border border-amber-800/70 bg-stone-950 p-3 shadow-2xl ring-1 ring-stone-800/90"
          style={{ left: pos.left, top: pos.top, width: pos.width }}
          onMouseEnter={() => {
            if (!prefersHoverUi() || !openId) return;
            setHoverId(openId);
          }}
          onMouseLeave={() => {
            if (!prefersHoverUi()) return;
            setHoverId(null);
          }}
        >
          <div className="mb-2 border-b border-amber-900/35 pb-1.5 text-[11px] font-semibold text-amber-300/95">
            {monarchDisplayNameFromOverview(openEntry.overview)}
            <span className="ml-1.5 font-normal text-stone-500">
              · {Number(openEntry.overview?.cityCount) || 0} 城
            </span>
          </div>
          <FactionInfoPanel
            overview={openEntry.overview}
            loading={false}
            error={null}
            showDailyActivityRanking={false}
            showReserveBalanceRow={false}
          />
        </div>
      </>,
      document.body,
    );
  }

  return (
    <>
      {tooltipPanel}
      <div className="flex min-h-0 flex-col gap-2">
        <div className="shrink-0 text-[11px] font-semibold text-amber-500/90">势力</div>
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-6 text-stone-500">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          </div>
        ) : error ? (
          <p className="text-xs text-red-400/90">{error}</p>
        ) : (
          <>
            <div className={`grid ${gridClass} auto-rows-fr gap-2`}>
              {factions.map(({ factionId, overview }) => (
                <WorldMapFactionThumb
                  key={factionId}
                  factionId={factionId}
                  overview={overview}
                  active={openId === factionId}
                  compact={compact}
                  onHoverStart={() => {
                    setHoverId(factionId);
                    setPinnedId(null);
                  }}
                  onHoverEnd={() => setHoverId(null)}
                  onTogglePin={() => {
                    setHoverId(null);
                    setPinnedId((prev) => (prev === factionId ? null : factionId));
                  }}
                />
              ))}
            </div>
            {typeof onOpenCampaignCenter === 'function' ? (
              <>
                <div
                  className="shrink-0 border-t-2 border-amber-800/55"
                  role="separator"
                  aria-hidden
                />
                <div className={`grid ${gridClass} gap-2 pt-0.5`}>
                  <WorldMapCampaignCenterThumb
                    onOpen={onOpenCampaignCenter}
                    showNotifyDot={campaignNotifyDot}
                  />
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
