/**
 * 底栏「地图」Tab：S1 豫州战略缩略图（道路 + 城块立场色），与主界面大地图数据源一致。
 * 性能：单 SVG、`buildStrategicRoadOverlayPathD` 与城列表节流刷新（**60s**，与 **`useSilentProfilePoll`** 编组静默刷新同周期；页签隐藏时不增计数）。
 * 郡界：叠土黄线——**几何接缝**（颍川/汝南叠带左段 + **C3** 周界一笔）与**沿道路的跨行政邻边**合并；C3 = 大象限 C 内右下 8×10（gx24～31、gy30～39）。
 */

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { TabPageCloseButton, useGameTabLandscape } from '@/components/game/TabPageCloseAffordance';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { useStrategicCountyCityRuntime } from '@/hooks/useStrategicCountyCityRuntime';
import { useSan1StrategicMergedStack } from '@/hooks/useSan1StrategicMergedStack';
import {
  buildStrategicRoadOverlayPathD,
  buildStrategicRoadAdminJurisdictionBoundaryPathD,
} from '@shared/utils/strategicRoadOverlay.js';
import { collectStrategicCityFootprintsForMiniMap } from '@shared/utils/strategicMiniMapGeometry.js';
import {
  SAN_1_STRATEGIC_VERTICAL_STACK_JUN_ORDER,
  san1YuStrategicAdminJunIdAtWorldCell,
  buildSan1YuStrategicSeamGuidePathD,
} from '@shared/utils/strategicWorldMapStack.js';
import { playerRoadToWorldMapCell } from '@shared/utils/strategicGridCoordinates.js';
import StrategicMiniMapSvg from '@shared/components/world/StrategicMiniMapSvg.jsx';
import { buildStrategicMiniMapCityRects } from '@/utils/buildStrategicMiniMapCityRects';
import { computeStrategicMiniMapProximityHighlights } from '@/utils/computeStrategicMiniMapProximityHighlights';
import { API_CONFIG } from '@/constants';
import { fetchWithTimeout } from '@/services/httpClient';
import { garrisonAPI } from '@/services/garrisonApi';
import { buildWorldMapCityPanelProps, worldMapCityTitleFromRow } from '@/utils/worldMapCityPanelCopy';
import WorldMapCityCombatSummaryBlock from '@/components/world/WorldMapCityCombatSummaryBlock';
import WorldMapFactionStrip from '@/components/game/WorldMapFactionStrip';
import { playerAPI } from '@/services/playerApi';

/** 与 `useSilentProfilePoll` 默认周期一致（编组 Tab 等静默档案刷新） */
const CITY_POLL_MS = 60_000;

export default function WorldMapTab({ onClose }) {
  const isLandscape = useGameTabLandscape();
  const close = typeof onClose === 'function' ? onClose : () => {};
  const { player } = usePlayerContext();
  const playerFactionId = player?.factionId ?? null;
  const playerId = player?.playerId ?? null;

  const { status: stackStatus, merged, error: stackError } = useSan1StrategicMergedStack();
  const [cityRefreshKey, setCityRefreshKey] = useState(0);
  const [garrisonStatsByCityId, setGarrisonStatsByCityId] = useState({});
  const [factionWorldRows, setFactionWorldRows] = useState([]);
  const [factionWorldLoading, setFactionWorldLoading] = useState(true);
  const [factionWorldError, setFactionWorldError] = useState(null);
  /** 缩略图选中城：含指针位置供浮层定位；再点同城关闭。 */
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

  useEffect(() => {
    if (!playerId) {
      setFactionWorldRows([]);
      setFactionWorldLoading(false);
      setFactionWorldError(null);
      return undefined;
    }
    let cancelled = false;
    setFactionWorldLoading(true);
    playerAPI
      .getFactionWorldOverviews(playerId)
      .then((res) => {
        if (cancelled) return;
        if (!res?.success) {
          setFactionWorldRows([]);
          setFactionWorldError(res?.error || '势力数据加载失败');
          return;
        }
        setFactionWorldRows(res.data?.factions || []);
        setFactionWorldError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setFactionWorldRows([]);
        setFactionWorldError(e?.message || '势力数据加载失败');
      })
      .finally(() => {
        if (!cancelled) setFactionWorldLoading(false);
      });
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
    () =>
      buildStrategicMiniMapCityRects(footprints, cityById, playerFactionId, null, null),
    [footprints, cityById, playerFactionId],
  );

  const proximityHighlight = useMemo(
    () => computeStrategicMiniMapProximityHighlights(footprints, cityById, playerFactionId, null, null),
    [footprints, cityById, playerFactionId],
  );

  const selfMarker = useMemo(() => {
    if (!player || !merged?.cells?.length) return null;
    const junId = player.roadJunId;
    const lx = Number(player.roadPositionX);
    const ly = Number(player.roadPositionY);
    if (!junId || !Number.isFinite(lx) || !Number.isFinite(ly)) return null;
    const w = playerRoadToWorldMapCell(String(junId).trim(), lx, ly);
    if (!w) return null;
    const gx = w.gx;
    const gy = w.worldGy;
    if (gx < 0 || gy < 0 || gx >= mapColumns || gy >= mapRows) return null;
    return {
      cx: gx + 0.5,
      cy: gy + 0.5,
      fill: '#fde047',
      stroke: '#0c0a09',
    };
  }, [player, merged?.cells, mapColumns, mapRows]);

  const handleMiniCitySelect = useCallback((cityId, e) => {
    const id = String(cityId || '').trim();
    if (!id) return;
    const ne = e?.nativeEvent;
    const cx = ne instanceof MouseEvent ? ne.clientX : 0;
    const cy = ne instanceof MouseEvent ? ne.clientY : 0;
    const posOk = Number.isFinite(cx) && Number.isFinite(cy);
    setMiniPick((prev) => {
      if (prev?.cityId === id) return null;
      return posOk ? { cityId: id, x: cx, y: cy } : { cityId: id, x: 0, y: 0 };
    });
  }, []);

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
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [miniPick]);

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
    <div className="relative flex h-full min-h-0 flex-col bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900">
      {!isLandscape && (
        <div className="sticky top-0 z-10 flex shrink-0 items-center border-b border-amber-900/50 bg-stone-900/80">
          <div className="flex-1 px-3 py-2">
            <div className="text-sm font-semibold text-amber-100">战略一览</div>
            <div className="text-[11px] text-stone-400">
              左：战略缩略图 · 右：七势力概览（悬浮/点击看详情）
            </div>
          </div>
          <TabPageCloseButton onClose={close} variant="bar" />
        </div>
      )}
      {isLandscape && <TabPageCloseButton onClose={close} variant="corner" />}

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        {isLandscape && (
          <div className="shrink-0">
            <div className="text-sm font-semibold text-amber-100">战略一览</div>
            <div className="text-[11px] text-stone-400">
              道路与城块与主界面大地图同源；归属与势力约 1 分钟刷新（页签隐藏时不刷新）。
            </div>
          </div>
        )}

        {statusLine ? (
          <div className="shrink-0 rounded border border-amber-800/40 bg-stone-900/60 px-2 py-1.5 text-center text-xs text-amber-200/90">
            {statusLine}
          </div>
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-row gap-2">
          <div className="relative flex min-h-0 min-w-0 flex-[3] items-center justify-center rounded-lg border border-amber-900/35 bg-stone-950/80 p-1">
            {stackStatus === 'ready' && merged?.cells?.length ? (
              <StrategicMiniMapSvg
                className="h-full w-full max-h-full max-w-full"
                mapColumns={mapColumns}
                mapRows={mapRows}
                roadPathD={roadPathD}
                roadAdminBoundaryPathD={roadAdminBoundaryPathD}
                cityRects={cityRects}
                selfMarker={selfMarker}
                selectedCityId={miniPick?.cityId ?? null}
                onCitySelect={handleMiniCitySelect}
                proximityHighlight={proximityHighlight}
                aria-label="豫州战略缩略图"
              />
            ) : stackStatus === 'error' ? (
              <div className="px-4 text-center text-sm text-red-300/95">
                {stackError || '无法加载合并地图'}
              </div>
            ) : (
              <div className="text-sm text-stone-400">加载中…</div>
            )}

            {miniPick && miniPanelProps ? (
              <div
                ref={miniTooltipRef}
                className="pointer-events-auto fixed z-[80] max-w-[min(92vw,280px)] rounded-md border border-stone-600/90 bg-black/82 px-3 py-2.5 text-left shadow-xl backdrop-blur-[2px]"
                style={{
                  left: Math.min(
                    Math.max(8, miniPick.x + 10),
                    typeof window !== 'undefined'
                      ? Math.max(8, window.innerWidth - 292)
                      : miniPick.x + 10,
                  ),
                  top: Math.min(
                    Math.max(8, miniPick.y + 8),
                    typeof window !== 'undefined'
                      ? Math.max(8, window.innerHeight - 220)
                      : miniPick.y + 8,
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
          </div>

          <div className="flex min-h-0 min-w-0 flex-[2] flex-col overflow-y-auto rounded-lg border border-amber-900/35 bg-stone-950/50 p-2">
            <WorldMapFactionStrip
              factions={factionWorldRows}
              loading={factionWorldLoading}
              error={factionWorldError}
              isLandscape={isLandscape}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
