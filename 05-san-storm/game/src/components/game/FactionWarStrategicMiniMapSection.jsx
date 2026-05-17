/**
 * 三公府 · 势力战事抽屉内嵌：与底栏「地图」Tab 同源的战略缩略图（道路 + 郡界 + 城块色）。
 * 选城浮层与 `WorldMapTab` 同源（城况摘要 + 编组在岗数）。点文档空白可关浮层；若传入 `deferParentClearWithinSelector`，在该宿主内的点击只关浮层、不把父级选中清空（供「战事谏言」等同区按钮）。
 */

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useStrategicCountyCityRuntime } from '@/hooks/useStrategicCountyCityRuntime';
import { useSan1StrategicMergedStack } from '@/hooks/useSan1StrategicMergedStack';
import {
  buildStrategicRoadOverlayPathD,
  buildStrategicRoadAdminJurisdictionBoundaryPathD,
} from '@shared/utils/strategicRoadOverlay.js';
import { collectStrategicCityFootprintsForMiniMap } from '@shared/utils/strategicMiniMapGeometry.js';
import {
  SAN_1_STRATEGIC_VERTICAL_STACK_JUN_ORDER,
  stackWorldGyFromLocalJunRow,
  san1YuStrategicAdminJunIdAtWorldCell,
  buildSan1YuStrategicSeamGuidePathD,
} from '@shared/utils/strategicWorldMapStack.js';
import StrategicMiniMapSvg from '@shared/components/world/StrategicMiniMapSvg.jsx';
import { buildStrategicMiniMapCityRects } from '@/utils/buildStrategicMiniMapCityRects';
import { computeStrategicMiniMapProximityHighlights } from '@/utils/computeStrategicMiniMapProximityHighlights';
import { API_CONFIG } from '@/constants';
import { fetchWithTimeout } from '@/services/httpClient';
import { garrisonAPI } from '@/services/garrisonApi';
import { buildWorldMapCityPanelProps, worldMapCityTitleFromRow } from '@/utils/worldMapCityPanelCopy';
import WorldMapCityCombatSummaryBlock from '@/components/world/WorldMapCityCombatSummaryBlock';

const CITY_POLL_MS = 60_000;

/**
 * @param {{
 *   playerFactionId: string|null,
 *   player: object|null,
 *   selectedCityId: string|null,
 *   onCitySelect: (cityId: string, event: { nativeEvent: unknown }) => void,
 *   onMiniMapTooltipDismiss?: () => void,
 *   deferParentClearWithinSelector?: string|null,
 *   className?: string,
 * }} props
 */
export default function FactionWarStrategicMiniMapSection({
  playerFactionId,
  player,
  selectedCityId,
  onCitySelect,
  onMiniMapTooltipDismiss,
  deferParentClearWithinSelector = null,
  className = '',
}) {
  const playerId = player?.player_id ?? player?.playerId ?? null;
  const { status: stackStatus, merged, error: stackError } = useSan1StrategicMergedStack();
  const [cityRefreshKey, setCityRefreshKey] = useState(0);
  const [garrisonStatsByCityId, setGarrisonStatsByCityId] = useState({});
  const [miniPick, setMiniPick] = useState(null);
  const [miniOnDutyCount, setMiniOnDutyCount] = useState(null);
  const miniTooltipRef = useRef(null);

  const bumpCityRefresh = useCallback(() => {
    setCityRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      bumpCityRefresh();
    };
    const id = window.setInterval(tick, CITY_POLL_MS);
    return () => window.clearInterval(id);
  }, [bumpCityRefresh]);

  useEffect(() => {
    if (!playerId) {
      setGarrisonStatsByCityId({});
      return undefined;
    }
    let cancelled = false;
    fetchWithTimeout(`${API_CONFIG.BASE_URL}/garrisons/stats/cities`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled || !res?.success) return;
        const m = {};
        for (const s of res.stats || []) {
          if (s?.city_id) m[s.city_id] = s;
        }
        setGarrisonStatsByCityId(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [playerId, cityRefreshKey]);

  const season = merged?.season || 'san_1';
  const { cityById, factionNameById, loadState: cityLoadState } = useStrategicCountyCityRuntime({
    junIds: SAN_1_STRATEGIC_VERTICAL_STACK_JUN_ORDER,
    season,
    refreshKey: cityRefreshKey,
  });

  const mapColumns = merged?.mapColumns ?? 32;
  const mapRows = merged?.mapRows ?? 40;

  const roadPathD = useMemo(() => {
    if (!merged?.cells?.length) return '';
    return buildStrategicRoadOverlayPathD(
      merged.roadCells,
      merged.roadConnectivity === '8' ? '8' : '4',
      mapColumns,
      mapRows,
    );
  }, [merged, mapColumns, mapRows]);

  const roadAdminBoundaryPathD = useMemo(() => {
    if (!merged?.cells?.length) return '';
    const dRoad = buildStrategicRoadAdminJurisdictionBoundaryPathD(
      merged.roadCells,
      merged.roadConnectivity === '8' ? '8' : '4',
      mapColumns,
      mapRows,
      san1YuStrategicAdminJunIdAtWorldCell,
    );
    const dSeam = buildSan1YuStrategicSeamGuidePathD(mapColumns, mapRows);
    return [dRoad, dSeam].filter(Boolean).join(' ');
  }, [merged, mapColumns, mapRows]);

  const footprints = useMemo(
    () => collectStrategicCityFootprintsForMiniMap(merged?.cells, mapColumns, mapRows),
    [merged?.cells, mapColumns, mapRows],
  );

  const cityRects = useMemo(
    () => buildStrategicMiniMapCityRects(footprints, cityById, playerFactionId, null, null),
    [footprints, cityById, playerFactionId],
  );

  const proximityHighlight = useMemo(
    () => computeStrategicMiniMapProximityHighlights(footprints, cityById, playerFactionId, null, null),
    [footprints, cityById, playerFactionId],
  );

  const selfMarker = useMemo(() => {
    if (!player || !merged?.cells?.length) return null;
    const junId = player.road_jun_id ?? player.roadJunId;
    const lx = Number(player.road_position_x ?? player.roadPositionX);
    const ly = Number(player.road_position_y ?? player.roadPositionY);
    if (!junId || !Number.isFinite(lx) || !Number.isFinite(ly)) return null;
    const wy = stackWorldGyFromLocalJunRow(String(junId).trim(), ly);
    if (!Number.isFinite(wy)) return null;
    const gx = Math.trunc(lx);
    const gy = Math.trunc(wy);
    if (gx < 0 || gy < 0 || gx >= mapColumns || gy >= mapRows) return null;
    return {
      cx: gx + 0.5,
      cy: gy + 0.5,
      fill: '#fde047',
      stroke: '#0c0a09',
    };
  }, [player, merged?.cells, mapColumns, mapRows]);

  const handleMiniCityClick = useCallback(
    (cityId, e) => {
      const id = String(cityId || '').trim();
      if (!id || typeof onCitySelect !== 'function') return;
      const ne = e?.nativeEvent;
      const cx = ne instanceof MouseEvent ? ne.clientX : 0;
      const cy = ne instanceof MouseEvent ? ne.clientY : 0;
      const posOk = Number.isFinite(cx) && Number.isFinite(cy);
      const willDeselect = String(selectedCityId || '').trim() === id;
      onCitySelect(cityId, e);
      if (willDeselect) {
        setMiniPick(null);
        setMiniOnDutyCount(null);
      } else {
        setMiniPick(posOk ? { cityId: id, x: cx, y: cy } : { cityId: id, x: 0, y: 0 });
      }
    },
    [onCitySelect, selectedCityId],
  );

  useEffect(() => {
    setMiniOnDutyCount(null);
    const cid = miniPick?.cityId;
    if (!cid) return undefined;
    const row = cityById[cid];
    const probe = buildWorldMapCityPanelProps(row, {
      factionNameById,
      playerFactionId,
      playerId,
      siegeQuota: null,
      siegeLoading: false,
      garrisonSlotCount: null,
      onDutyCount: null,
      cityById,
    });
    if (probe.isBanditStronghold || !probe.cityId) return undefined;
    let cancelled = false;
    garrisonAPI.getOnDutyCount(probe.cityId).then((res) => {
      if (cancelled) return;
      const duty = res?.success ? Number(res.count) : null;
      setMiniOnDutyCount(Number.isFinite(duty) ? duty : null);
    });
    return () => {
      cancelled = true;
    };
  }, [miniPick?.cityId, cityById, factionNameById, playerFactionId, playerId]);

  useEffect(() => {
    if (!miniPick) return undefined;
    const onDocMouseDown = (ev) => {
      const t = ev.target;
      if (!(t instanceof Element)) return;
      if (miniTooltipRef.current?.contains(t)) return;
      if (t.closest('[data-strategic-mini-city]')) return;
      setMiniPick(null);
      setMiniOnDutyCount(null);
      const sel = typeof deferParentClearWithinSelector === 'string' ? deferParentClearWithinSelector.trim() : '';
      if (sel && t.closest(sel)) {
        return;
      }
      onMiniMapTooltipDismiss?.();
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [miniPick, onMiniMapTooltipDismiss, deferParentClearWithinSelector]);

  const miniPanelProps = useMemo(() => {
    const cid = miniPick?.cityId;
    if (!cid) return null;
    const row = cityById[cid];
    const slotRaw = garrisonStatsByCityId[cid]?.slot_count;
    const slotNum = slotRaw != null ? Number(slotRaw) : null;
    return buildWorldMapCityPanelProps(row, {
      factionNameById,
      playerFactionId,
      playerId,
      siegeQuota: null,
      siegeLoading: false,
      garrisonSlotCount: Number.isFinite(slotNum) ? slotNum : null,
      onDutyCount: miniOnDutyCount,
      cityById,
    });
  }, [
    miniPick?.cityId,
    cityById,
    factionNameById,
    playerFactionId,
    playerId,
    garrisonStatsByCityId,
    miniOnDutyCount,
  ]);

  const statusLine =
    stackStatus === 'loading'
      ? '正在加载地图数据…'
      : stackStatus === 'error'
        ? stackError || '地图加载失败'
        : cityLoadState === 'loading'
          ? '正在同步城池归属…'
          : cityLoadState === 'error'
            ? '城池数据暂不可用（缩略图仅道路）'
            : null;

  return (
    <div className={`flex min-h-0 min-w-0 flex-col gap-1.5 ${className}`}>
      {statusLine ? (
        <div className="shrink-0 rounded border border-amber-800/40 bg-stone-900/60 px-2 py-1 text-center text-[10px] text-amber-200/90">
          {statusLine}
        </div>
      ) : null}
      <div className="relative flex min-h-[140px] w-full flex-1 items-center justify-center rounded-lg border border-amber-900/35 bg-stone-950/80 p-1 sm:min-h-[180px]">
        {stackStatus === 'ready' && merged?.cells?.length ? (
          <>
            <StrategicMiniMapSvg
              className="h-full w-full max-h-[min(40vh,360px)] max-w-full"
              mapColumns={mapColumns}
              mapRows={mapRows}
              roadPathD={roadPathD}
              roadAdminBoundaryPathD={roadAdminBoundaryPathD}
              cityRects={cityRects}
              selfMarker={selfMarker}
              selectedCityId={selectedCityId}
              onCitySelect={handleMiniCityClick}
              proximityHighlight={proximityHighlight}
              aria-label="豫州战略缩略图"
            />
            {miniPick && miniPanelProps ? (
              <div
                ref={miniTooltipRef}
                className="pointer-events-auto fixed z-[200] max-w-[min(92vw,280px)] rounded-md border border-stone-600/90 bg-black/82 px-3 py-2.5 text-left shadow-xl backdrop-blur-[2px]"
                style={{
                  left: Math.min(
                    Math.max(8, miniPick.x + 10),
                    typeof window !== 'undefined' ? Math.max(8, window.innerWidth - 292) : miniPick.x + 10,
                  ),
                  top: Math.min(
                    Math.max(8, miniPick.y + 8),
                    typeof window !== 'undefined' ? Math.max(8, window.innerHeight - 220) : miniPick.y + 8,
                  ),
                }}
              >
                <div className="border-b border-stone-600/80 pb-1.5 text-sm font-semibold text-stone-100">
                  {miniPanelProps.cityTitle || worldMapCityTitleFromRow(cityById[miniPick.cityId])}
                </div>
                {!cityById[miniPick.cityId] ? (
                  <div className="pt-2 text-xs text-amber-200/90">
                    暂无该点城池档案（归属同步中或 ID 不一致）。
                  </div>
                ) : (
                  <WorldMapCityCombatSummaryBlock
                    withTopRule={false}
                    className="mt-0"
                    pvpAttackerBaseCampStrategic={false}
                    onDutyCount={miniPanelProps.onDutyCount}
                    garrisonSlotCount={miniPanelProps.garrisonSlotCount}
                    garrisonCap={miniPanelProps.garrisonCap}
                    npcAlive={miniPanelProps.npcAlive}
                    npcTotal={miniPanelProps.npcTotal}
                    cityDefenseCoefficient={miniPanelProps.cityDefenseCoefficient}
                  />
                )}
              </div>
            ) : null}
          </>
        ) : stackStatus === 'error' ? (
          <div className="px-3 text-center text-xs text-red-300/95">{stackError || '无法加载合并地图'}</div>
        ) : (
          <div className="text-xs text-stone-400">加载中…</div>
        )}
      </div>
    </div>
  );
}
