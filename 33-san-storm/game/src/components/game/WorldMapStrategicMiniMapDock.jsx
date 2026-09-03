/**
 * 大地图右侧坞：战略缩略图（上）+ 三势力概览（下，三王/汉室/黄巾）。
 * 展开后缩略图可拖视口框，与左侧大地图滚动对应。
 */

import { useCallback, useEffect, useState } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { useStrategicMapNavigation } from '@/contexts/StrategicMapNavigationContext';
import FactionWarStrategicMiniMapSection from '@/components/game/FactionWarStrategicMiniMapSection';
import WorldMapFactionStrip from '@/components/game/WorldMapFactionStrip';
import { playerAPI } from '@/services/playerApi';

const LS_KEY = 'wm_strategic_minimap_collapsed';
const FACTION_POLL_MS = 60_000;

export default function WorldMapStrategicMiniMapDock() {
  const { player } = usePlayerContext();
  const strategicNav = useStrategicMapNavigation();
  const playerFactionId = player?.factionId ?? null;
  const playerId = player?.playerId ?? null;
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(LS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [selectedCityId, setSelectedCityId] = useState(null);
  const [viewportRect, setViewportRect] = useState(null);
  const [factionWorldRows, setFactionWorldRows] = useState([]);
  const [factionWorldLoading, setFactionWorldLoading] = useState(true);
  const [factionWorldError, setFactionWorldError] = useState(null);
  const [factionRefreshKey, setFactionRefreshKey] = useState(0);

  const toggleCollapse = useCallback((val) => {
    setCollapsed(val);
    try {
      localStorage.setItem(LS_KEY, val ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const handleCitySelect = useCallback((cityId) => {
    setSelectedCityId(cityId || null);
  }, []);

  const refreshViewport = useCallback(() => {
    const v = strategicNav?.getStrategicViewport?.();
    if (!v) {
      setViewportRect(null);
      return;
    }
    setViewportRect({ x: v.gx, y: v.gy, w: v.gw, h: v.gh });
  }, [strategicNav]);

  useEffect(() => {
    if (collapsed) return undefined;
    refreshViewport();
    return strategicNav?.subscribeStrategicViewport?.(refreshViewport);
  }, [collapsed, strategicNav, refreshViewport]);

  useEffect(() => {
    if (collapsed) return undefined;
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      setFactionRefreshKey((k) => k + 1);
    };
    const id = window.setInterval(tick, FACTION_POLL_MS);
    return () => window.clearInterval(id);
  }, [collapsed]);

  useEffect(() => {
    if (collapsed || !playerId) {
      if (!playerId) {
        setFactionWorldRows([]);
        setFactionWorldLoading(false);
        setFactionWorldError(null);
      }
      return undefined;
    }
    let cancelled = false;
    setFactionWorldLoading(true);
    playerAPI
      .getFactionWorldOverviews(playerId)
      .then((res) => {
        if (cancelled) return;
        if (res?.success) {
          setFactionWorldRows(res.data?.factions || []);
          setFactionWorldError(null);
        } else {
          setFactionWorldRows([]);
          setFactionWorldError(res?.error || '势力概览加载失败');
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setFactionWorldRows([]);
        setFactionWorldError(e?.message || '势力概览加载失败');
      })
      .finally(() => {
        if (!cancelled) setFactionWorldLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [collapsed, playerId, factionRefreshKey]);

  const handleViewportTopLeftChange = useCallback(
    (gx, gy) => {
      strategicNav?.setStrategicViewportTopLeft?.(gx, gy);
      refreshViewport();
    },
    [strategicNav, refreshViewport],
  );

  if (collapsed) {
    return (
      <div className="pointer-events-auto flex h-full w-9 shrink-0 flex-col border-l border-amber-900/40 bg-black/55 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => toggleCollapse(false)}
          className="flex w-full shrink-0 flex-col items-center justify-center gap-0.5 border-b border-amber-900/35 px-0.5 py-1.5 text-center text-[10px] leading-tight text-amber-400/80 transition-colors hover:text-amber-200"
          title="展开战略缩略图与势力"
        >
          <span>▼</span>
          <span>展开</span>
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto flex h-full w-[min(48vw,200px)] shrink-0 flex-col border-l border-amber-900/40 bg-black/65 backdrop-blur-sm">
      <div className="flex shrink-0 items-center justify-between gap-1 border-b border-amber-900/35 px-1.5 py-1">
        <span className="truncate text-[10px] font-medium text-amber-200/90">战略缩略</span>
        <button
          type="button"
          onClick={() => toggleCollapse(true)}
          className="flex-shrink-0 text-[10px] text-amber-400/70 transition-colors hover:text-amber-200"
        >
          ▲ 收起
        </button>
      </div>

      {/* 缩略图占剩余高度；势力区按内容收紧（约 3～4 势力） */}
      <div className="min-h-0 flex-1 overflow-hidden p-1">
        <FactionWarStrategicMiniMapSection
          playerFactionId={playerFactionId}
          player={player}
          selectedCityId={selectedCityId}
          onCitySelect={handleCitySelect}
          onMiniMapTooltipDismiss={() => setSelectedCityId(null)}
          className="h-full min-h-0"
          frameClassName="relative mx-auto h-full w-full min-h-0 max-h-none aspect-auto overflow-hidden rounded-md border border-amber-900/35 bg-stone-950/80 p-0.5"
          viewportRect={viewportRect}
          onViewportTopLeftChange={handleViewportTopLeftChange}
        />
      </div>

      <div className="max-h-[min(28vh,200px)] shrink-0 overflow-y-auto border-t border-amber-900/35 p-1.5">
        <WorldMapFactionStrip
          factions={factionWorldRows}
          loading={factionWorldLoading}
          error={factionWorldError}
          isLandscape={false}
          compact
        />
      </div>
    </div>
  );
}
