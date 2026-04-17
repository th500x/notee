import { useState, useCallback, useEffect, useMemo } from 'react';
import WorldStrategicMapGrid from './WorldStrategicMapGrid';
import ZhouJunMapJumpPanel from '@/components/game/ZhouJunMapJumpPanel';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { toCharCardData } from '@/utils/cardDataTransforms';
import {
  findStrategicCityAnchorForMainCity,
  strategicCityBlockCenterPx,
} from '@/utils/strategicMapCityAnchor';
import './WorldStrategicMap.css';
import {
  generateYingchuanCountyMergedSimulated,
  YINGCHUAN_COUNTY_MAP_COLS,
  YINGCHUAN_COUNTY_MAP_ROWS,
} from '@shared/utils/junCountyMapGenerator';
import { useStrategicCountyCityRuntime } from '@/hooks/useStrategicCountyCityRuntime';
import { API_CONFIG } from '@/constants';

/** 与管理员「生成地图」写出路径一致：Vite publicDir → 05-san-storm/public */
const MERGED_MAP_REL = 'data/worldmap/san_1_jun_yingchuan_merged.json';

/** 已装备部队卡：当前兵力合计 / 上限合计（与披挂口径一致） */
function sumEquippedTroopStrength(cards) {
  let current = 0;
  let max = 0;
  for (const c of cards || []) {
    if (c?.card_type !== 'troop' || !c?.is_equipped) continue;
    const cfgMax = Number(c.config?.maxTroops) || 0;
    const bonus = Number(c.bonus_max_troops) || 0;
    const cap = cfgMax + bonus;
    max += cap;
    const raw = c.current_troops;
    const cur = raw != null && raw !== '' ? Number(raw) : cap;
    current += Number.isFinite(cur) ? cur : cap;
  }
  return { current, max };
}

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
 * 游戏主界面大地图：颍川郡四象限合并 32×40 战略格网（缩放以滚轮 / 触控为主）。
 * 优先读取 `public/data/worldmap/san_1_jun_yingchuan_merged.json`（含 version，与后台生成一致）；
 * 缺失或无效时回退为 `generateYingchuanCountyMergedSimulated`（内存即时生成）。
 */
export default function WorldYingchuanMapSection({
  className = '',
  playerId = null,
  playerFactionId = null,
  siegeLoading = false,
  onStartSiegeForCity = null,
  garrisonStatsRefreshKey = 0,
  playerOnDuty = false,
  playerOnDutyCityId = null,
  onOpenGarrisonForCity = null,
  onToggleDutyForCity = null,
  onDutyError = null,
  subsidiaryExploreEmbed = null,
  playerMainCityId = null,
  playerMainCityChangedAt = null,
  playerSilver = null,
  onSetMainCityRequest = null,
  onSetMainCityError = null,
  onOpenBarracksPost = null,
  onOpenSanGongFu = null,
  /** 城名着色：盟友 `faction_id`（`Set` 或数组）；结盟/外交接入后由上层传入 */
  strategicCityLabelAllyFactionIds = null,
  /** 城名着色：非敌对 `faction_id` */
  strategicCityLabelNonHostileFactionIds = null,
  /** 大地图全屏浮层（三公府等）是否打开：`WorldMap` 注入，用于收起格上网格 tooltip */
  strategicFullScreenOverlayOpen = false,
}) {
  const [merged, setMerged] = useState(null);
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
          roadCells: Array.isArray(data.roadCells) ? data.roadCells : null,
          roadConnectivity: data.roadConnectivity === '8' ? '8' : '4',
        });
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
          roadCells: null,
          roadConnectivity: '4',
        });
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
  }, [playerId, garrisonStatsRefreshKey]);

  const cols = merged?.mapColumns ?? YINGCHUAN_COUNTY_MAP_COLS;
  const rows = merged?.mapRows ?? YINGCHUAN_COUNTY_MAP_ROWS;
  const cells = merged?.cells;
  const seed = merged?.seed;

  const countyJunId = merged?.junId || 'san_1_jun_yingchuan';
  const countySeason = merged?.season || 'san_1';
  /** 合并图主键为颍川郡，但象限 C 含汝南行政城点；需同时拉汝南 `cities` 才能合并 tooltip 运行时块。 */
  const cityRuntimeJunIds = useMemo(() => {
    if (countyJunId === 'san_1_jun_yingchuan') {
      return ['san_1_jun_yingchuan', 'san_1_jun_runan'];
    }
    return [countyJunId];
  }, [countyJunId]);
  const { cityById, factionNameById } = useStrategicCountyCityRuntime({
    junIds: cityRuntimeJunIds,
    season: countySeason,
    refreshKey: garrisonStatsRefreshKey,
  });

  const { player: ctxPlayer, cards: ctxCards, attributeBonusBySlot } = usePlayerContext();

  const [tilePx, setTilePx] = useState(() => computeDefaultTilePx());

  useEffect(() => {
    if (cols && rows) setTilePx(computeDefaultTilePx());
  }, [cols, rows]);

  const onWheelZoomSteps = useCallback((steps) => {
    if (steps === 0) return;
    setTilePx((p) => {
      const next = p + steps * 2;
      return Math.min(WORLD_MAP_TILE_MAX, Math.max(WORLD_MAP_TILE_MIN, next));
    });
  }, []);

  /** 首版：自身标记锚在 **主城** 块中心（`main_city_id`）；圆心 **角色名末字**；悬停圆见 **`[faction_name]character_name` + 兵力**（`pointer: coarse` 无 tooltip）。道路格待 `players.road_*`。 */
  const strategicSelfPawn = useMemo(() => {
    if (!playerMainCityId || !cells?.length) return null;
    const anchor = findStrategicCityAnchorForMainCity(cells, playerMainCityId);
    if (!anchor) return null;
    const { cx, cy } = strategicCityBlockCenterPx(anchor, tilePx);
    const characterCards = (ctxCards || []).filter((c) => c.card_type === 'character');
    const char1 = characterCards.find(
      (c) => c.equipped_by === 'character1' && c.is_equipped && c.equipped_slot === 'character',
    );
    const bonus = attributeBonusBySlot?.character1 || {};
    let portraitUrl = ctxPlayer?.avatar || null;
    if (char1) {
      const cd = toCharCardData(char1, bonus);
      if (cd.avatar) portraitUrl = cd.avatar;
    }
    const factionName = String(ctxPlayer?.faction_name || '').trim();
    const charName = String(ctxPlayer?.character_name || '').trim() || '…';
    const displayName = factionName ? `[${factionName}]${charName}` : charName;
    const nameSeq = Array.from(charName);
    const centerGlyph = nameSeq.length ? nameSeq[nameSeq.length - 1] : '…';
    const { current: troopsCurrent, max: troopsMax } = sumEquippedTroopStrength(ctxCards);
    return {
      cx,
      cy,
      portraitUrl,
      displayName,
      centerGlyph,
      troopsCurrent,
      troopsMax,
    };
  }, [playerMainCityId, cells, tilePx, ctxCards, ctxPlayer, attributeBonusBySlot]);

  if (!cells || seed == null) {
    return (
      <div className={`flex flex-col min-h-0 h-full bg-stone-950 items-center justify-center ${className}`}>
        <div className="text-stone-400 text-sm">大地图加载中…</div>
      </div>
    );
  }

  return (
    <div className={`flex h-full min-h-0 flex-col bg-stone-950 ${className}`}>
      {/* 州郡跳转：叠在战略格网上方 */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute left-2 top-2 z-30">
          <div className="pointer-events-auto">
            <ZhouJunMapJumpPanel variant="mapOverlay" />
          </div>
        </div>
        <WorldStrategicMapGrid
          cells={cells}
          seed={seed}
          roadCells={merged?.roadCells}
          roadConnectivity={merged?.roadConnectivity === '8' ? '8' : '4'}
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
          siegeLoading={siegeLoading}
          onStartSiegeForCity={onStartSiegeForCity}
          garrisonStatsByCityId={garrisonStatsByCityId}
          playerOnDuty={playerOnDuty}
          playerOnDutyCityId={playerOnDutyCityId}
          onOpenGarrisonForCity={onOpenGarrisonForCity}
          onToggleDutyForCity={onToggleDutyForCity}
          onDutyError={onDutyError}
          subsidiaryExploreEmbed={subsidiaryExploreEmbed}
          playerMainCityId={playerMainCityId}
          playerMainCityChangedAt={playerMainCityChangedAt}
          playerSilver={playerSilver}
          onSetMainCityRequest={onSetMainCityRequest}
          onSetMainCityError={onSetMainCityError}
          onOpenBarracksPost={onOpenBarracksPost}
          onOpenSanGongFu={onOpenSanGongFu}
          onWheelZoomSteps={onWheelZoomSteps}
          strategicCityLabelAllyFactionIds={strategicCityLabelAllyFactionIds}
          strategicCityLabelNonHostileFactionIds={strategicCityLabelNonHostileFactionIds}
          strategicFullScreenOverlayOpen={strategicFullScreenOverlayOpen}
          meta={null}
          strategicSelfPawn={strategicSelfPawn}
        />
      </div>
    </div>
  );
}
