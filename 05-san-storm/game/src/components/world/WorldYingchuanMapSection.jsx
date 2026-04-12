import { useState, useCallback, useEffect, useMemo } from 'react';
import WorldStrategicMapGrid from './WorldStrategicMapGrid';
import {
  generateYingchuanCountyMergedSimulated,
  YINGCHUAN_COUNTY_MAP_COLS,
  YINGCHUAN_COUNTY_MAP_ROWS,
} from '@shared/utils/junCountyMapGenerator';
import { useStrategicCountyCityRuntime } from '@/hooks/useStrategicCountyCityRuntime';
import { API_CONFIG } from '@/constants';

/** 与管理员「生成地图」写出路径一致：Vite publicDir → 05-san-storm/public */
const MERGED_MAP_REL = 'data/worldmap/san_1_jun_yingchuan_merged.json';

/** 与战术图 BattleMap.css：`--tile: 48px`；窄屏 `(100vw - 61px) / 8` */
export const WORLD_MAP_TILE_MIN = 12;
export const WORLD_MAP_TILE_MAX = 56;

/**
 * 默认单格边长：对齐战斗地图瓦片视觉（可读性优先，允许滚动查看全图）。
 */
function computeDefaultTilePx() {
  if (typeof window === 'undefined') return 48;
  const w = window.innerWidth;
  const availW = Math.max(280, w - 16);
  const battleRef =
    w >= 521 ? 48 : Math.min(48, Math.max(26, Math.floor((availW - 61) / 8)));
  return Math.min(WORLD_MAP_TILE_MAX, Math.max(22, battleRef));
}

/**
 * 游戏主界面大地图：颍川郡四象限合并 32×40 + 缩放工具条。
 * 优先读取 `public/data/worldmap/san_1_jun_yingchuan_merged.json`（含 version，与后台生成一致）；
 * 缺失或无效时回退为 `generateYingchuanCountyMergedSimulated`（内存即时生成）。
 */
export default function WorldYingchuanMapSection({
  className = '',
  playerId = null,
  playerFactionId = null,
  siegeQuota = null,
  playerOnDuty = false,
  playerOnDutyCityId = null,
  onOpenGarrisonForCity = null,
  onToggleDutyForCity = null,
  onDutyError = null,
  onSubsidiaryExploreRequest = null,
  playerMainCityId = null,
  playerMainCityChangedAt = null,
  playerSilver = null,
  onSetMainCityRequest = null,
  onSetMainCityError = null,
}) {
  const [merged, setMerged] = useState(null);
  const [mapSource, setMapSource] = useState('loading');
  const [garrisonStatsByCityId, setGarrisonStatsByCityId] = useState({});

  useEffect(() => {
    let cancelled = false;
    const url = `${import.meta.env.BASE_URL}${MERGED_MAP_REL}`;
    (async () => {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data || !Array.isArray(data.cells)) throw new Error('invalid merged');
        if (cancelled) return;
        setMerged({
          cells: data.cells,
          seed: data.seed,
          version: data.version,
          mapColumns: data.mapColumns ?? YINGCHUAN_COUNTY_MAP_COLS,
          mapRows: data.mapRows ?? YINGCHUAN_COUNTY_MAP_ROWS,
          junId: data.junId,
          season: data.season,
        });
        setMapSource('file');
      } catch {
        if (cancelled) return;
        const fb = generateYingchuanCountyMergedSimulated({});
        setMerged({
          cells: fb.cells,
          seed: fb.seed,
          version: null,
          mapColumns: fb.mapColumns ?? YINGCHUAN_COUNTY_MAP_COLS,
          mapRows: fb.mapRows ?? YINGCHUAN_COUNTY_MAP_ROWS,
          junId: 'san_1_jun_yingchuan',
          season: 'san_1',
        });
        setMapSource('fallback');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!playerId) {
      setGarrisonStatsByCityId({});
      return undefined;
    }
    let cancelled = false;
    fetch(`${API_CONFIG.BASE_URL}/garrisons/stats/cities`)
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
  }, [playerId]);

  const cols = merged?.mapColumns ?? YINGCHUAN_COUNTY_MAP_COLS;
  const rows = merged?.mapRows ?? YINGCHUAN_COUNTY_MAP_ROWS;
  const cells = merged?.cells;
  const seed = merged?.seed;
  const version = merged?.version;

  const countyJunId = merged?.junId || 'san_1_jun_yingchuan';
  const countySeason = merged?.season || 'san_1';
  /** 合并图主键为颍川郡，但象限 C 含汝南行政城点；需同时拉汝南 `cities` 才能合并 tooltip 运行时块。 */
  const cityRuntimeJunIds = useMemo(() => {
    if (countyJunId === 'san_1_jun_yingchuan') {
      return ['san_1_jun_yingchuan', 'san_1_jun_runan'];
    }
    return [countyJunId];
  }, [countyJunId]);
  const { cityById, factionNameById, loadState: cityRuntimeState } = useStrategicCountyCityRuntime({
    junIds: cityRuntimeJunIds,
    season: countySeason,
  });

  const [tilePx, setTilePx] = useState(() => computeDefaultTilePx());

  useEffect(() => {
    if (cols && rows) setTilePx(computeDefaultTilePx());
  }, [cols, rows]);

  const zoomIn = useCallback(
    () => setTilePx((p) => Math.min(WORLD_MAP_TILE_MAX, p + 2)),
    [],
  );
  const zoomOut = useCallback(
    () => setTilePx((p) => Math.max(WORLD_MAP_TILE_MIN, p - 2)),
    [],
  );
  const onWheelZoomSteps = useCallback((steps) => {
    if (steps === 0) return;
    setTilePx((p) => {
      const next = p + steps * 2;
      return Math.min(WORLD_MAP_TILE_MAX, Math.max(WORLD_MAP_TILE_MIN, next));
    });
  }, []);

  if (!cells || seed == null) {
    return (
      <div className={`flex flex-col min-h-0 h-full bg-stone-950 items-center justify-center ${className}`}>
        <div className="text-stone-400 text-sm">大地图加载中…</div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col min-h-0 h-full bg-stone-950 ${className}`}>
      <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 bg-stone-900/95 border-b border-stone-700 text-xs text-stone-300 shrink-0 z-20">
        <span className="font-semibold text-amber-200/90">颍川郡</span>
        <span className="text-stone-500">
          {cols}×{rows}
        </span>
        <button
          type="button"
          onClick={zoomOut}
          className="px-2 py-0.5 rounded bg-stone-800 border border-stone-600 text-stone-200 hover:bg-stone-700"
        >
          −
        </button>
        <button
          type="button"
          onClick={zoomIn}
          className="px-2 py-0.5 rounded bg-stone-800 border border-stone-600 text-stone-200 hover:bg-stone-700"
        >
          +
        </button>
        <span className="text-stone-500 font-mono tabular-nums">{tilePx}px</span>
        {version != null && (
          <span className="text-emerald-600/90 font-mono text-[10px]" title="与 public 合并 JSON 内 version 一致">
            v{version}
          </span>
        )}
        {mapSource === 'fallback' && (
          <span className="text-amber-600/90 text-[10px]" title="未找到合并快照，使用内存生成">
            内存生成
          </span>
        )}
        {cityRuntimeState === 'ok' && (
          <span className="text-sky-500/90 text-[10px]" title="城市 tooltip 已合并服务器 cities 数据">
            城况已同步
          </span>
        )}
        {cityRuntimeState === 'error' && (
          <span className="text-stone-500 text-[10px]" title="无法拉取城市列表，tooltip 仅为地图静态层">
            城况未同步
          </span>
        )}
        <span className="text-stone-600 font-mono text-[10px] ml-auto hidden sm:inline">seed {seed}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <WorldStrategicMapGrid
          cells={cells}
          seed={seed}
          mapColumns={cols}
          mapRows={rows}
          tilePx={tilePx}
          setTilePx={setTilePx}
          minTilePx={WORLD_MAP_TILE_MIN}
          maxTilePx={WORLD_MAP_TILE_MAX}
          cityById={cityById}
          factionNameById={factionNameById}
          playerId={playerId}
          playerFactionId={playerFactionId}
          siegeQuota={siegeQuota}
          garrisonStatsByCityId={garrisonStatsByCityId}
          playerOnDuty={playerOnDuty}
          playerOnDutyCityId={playerOnDutyCityId}
          onOpenGarrisonForCity={onOpenGarrisonForCity}
          onToggleDutyForCity={onToggleDutyForCity}
          onDutyError={onDutyError}
          onSubsidiaryExploreRequest={onSubsidiaryExploreRequest}
          playerMainCityId={playerMainCityId}
          playerMainCityChangedAt={playerMainCityChangedAt}
          playerSilver={playerSilver}
          onSetMainCityRequest={onSetMainCityRequest}
          onSetMainCityError={onSetMainCityError}
          onWheelZoomSteps={onWheelZoomSteps}
          meta={
            <span className="text-stone-500">
              滚轮缩放 · 鼠标拖拽平移 · 双指捏合缩放（触控）· 悬停格子查看说明
            </span>
          }
        />
      </div>
    </div>
  );
}
