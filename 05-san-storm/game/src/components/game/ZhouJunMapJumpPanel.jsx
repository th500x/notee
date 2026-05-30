import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadSharedData } from '@/services/dataService';
import { API_CONFIG } from '@/constants';
import { fetchWithTimeout } from '@/services/httpClient';
import { useStrategicMapNavigation } from '@/contexts/StrategicMapNavigationContext';
import {
  MAP_CORNER_ENTRY_H_PX,
  MAP_CORNER_ENTRY_ROW_CLASS_ZHOU_JUN,
  MAP_CORNER_ZHOU_JUN_PAIR_ROW_W_PX,
  mapCornerEntryHintRowStyle,
  mapCornerEntryRowBoxStyle,
  mapCornerEntryStackOuterStyle,
  mapCornerZhouJunStackWideOuterStyle,
} from '@/components/game/mapCornerEntryUi';
import MapCornerOngoingWarButton from '@/components/game/MapCornerOngoingWarButton';
import { playerRoadToWorldMapCell } from '@shared/utils/strategicGridCoordinates.js';

/**
 * 「主词 + 空格 + 数字/省略」拆分：后半为次数或省略号时单独小号渲染（方案 2，不改 66px 栅格）。
 * @returns {{ head: string, tail: string | null }}
 */
function splitZhouJunStatLabel(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return { head: '', tail: null };
  const re = /^(.+?)\s+([\d./]+|[…]|\.{2,3})$/u;
  const m = s.match(re);
  if (!m) return { head: s, tail: null };
  return { head: m[1], tail: m[2] };
}

function ZhouJunStatCaption({ text }) {
  const { head, tail } = splitZhouJunStatLabel(text);
  return (
    <span className="flex w-full min-w-0 items-baseline justify-start gap-0.5 overflow-hidden text-left">
      <span className="min-w-0 shrink truncate">{head}</span>
      {tail != null ? (
        <span className="shrink-0 text-[9px] font-medium tabular-nums leading-none text-stone-200/95">
          {tail}
        </span>
      ) : null}
    </span>
  );
}

function sortBySortOrderThenName(rows, nameKey) {
  return [...(rows || [])].sort((a, b) => {
    const ao = Number(a.sortOrder);
    const bo = Number(b.sortOrder);
    if (Number.isFinite(ao) && Number.isFinite(bo) && ao !== bo) return ao - bo;
    if (Number.isFinite(ao) && !Number.isFinite(bo)) return -1;
    if (!Number.isFinite(ao) && Number.isFinite(bo)) return 1;
    return String(a[nameKey] || '').localeCompare(String(b[nameKey] || ''), 'zh-Hans-CN');
  });
}

function cityTypeOf(c) {
  if (!c || typeof c !== 'object') return '';
  return String(c.city_type ?? c.cityType ?? '').trim();
}

/** 郡内跳转：优先用数据库 `position_x` / `position_y`（API snake_case 或 camelCase）；按大城→中城→小城→关→据点依次取「已有坐标」的第一座。 */
function pickJunFocusCity(cities) {
  if (!Array.isArray(cities) || !cities.length) return null;
  const byName = (a, b) =>
    String(a.city_name ?? a.cityName ?? '').localeCompare(String(b.city_name ?? b.cityName ?? ''), 'zh-Hans-CN');

  function firstWithDbGridPos(list) {
    const sorted = [...list].sort(byName);
    for (const c of sorted) {
      const { gx, gy } = readGridPos(c);
      if (gx != null && gy != null) return c;
    }
    return null;
  }

  const tierOrder = ['city_major', 'city_medium', 'city_small', 'gate', 'fort'];
  for (const t of tierOrder) {
    const subset = cities.filter((c) => cityTypeOf(c) === t);
    const hit = firstWithDbGridPos(subset);
    if (hit) return hit;
  }
  const anyWithPos = firstWithDbGridPos(cities);
  if (anyWithPos) return anyWithPos;

  for (const t of ['city_major', 'city_medium']) {
    const subset = cities.filter((c) => cityTypeOf(c) === t);
    if (subset.length) return [...subset].sort(byName)[0];
  }
  return null;
}

function readGridPos(city) {
  if (!city || typeof city !== 'object') return { gx: null, gy: null };
  const gx = city.position_x ?? city.positionX;
  const gy = city.position_y ?? city.positionY;
  const nx = Number(gx);
  const ny = Number(gy);
  return {
    gx: Number.isFinite(nx) ? nx : null,
    gy: Number.isFinite(ny) ? ny : null,
  };
}

function focusCityId(city) {
  if (!city || typeof city !== 'object') return null;
  const raw = city.cityId ?? city.city_id ?? city.id;
  return raw != null && String(raw).trim() !== '' ? String(raw) : null;
}

/**
 * 大地图：州下拉 + 所选州下属郡列表；点郡将视口滚到该郡在库中有 position_x/y 的战略格（大→中→小→关→据点），缺省再走 merged 格网 resolve。
 * `variant="mapOverlay"`：叠在战略格网上（`StrategicWorldMapSection` 内 absolute），与左下角口谕/排行/聊天同为「浮在地图上」的交互层。
 *
 * **大地图进度条**：**州下拉**与 **「我在哪」** 同一行、**各 66×36**、间距与郡行一致（`gap-1`）；有「我在哪」时栈外宽与 **郡+匪寨** 同为 **`MAP_CORNER_ZHOU_JUN_PAIR_ROW_W_PX`**。**郡与匪寨** 仍 `items-stretch` 并排；**探索 / 攻城** 单列 66px（`self-start`）。**探索 / 教程 / 攻城 / 匪寨** 次数用 **`ZhouJunStatCaption`** 小号数字。**攻城**：**`攻城 x/x`** 与 **PVE `wars` / PVP `wars_pvp` 共用** `player_events` 次数；无 **可定位的进行中目标**（本人参与的 active **PVE wars** 或本势力 **wars_pvp** `pending`/`active`，同城 **PVP 优先**）时整钮禁用；有可点，按创建时间升序循环滚屏（见 **31-1 §〇**）。
 *
 * @param {{
 *   variant?: 'toolbar' | 'mapOverlay';
 *   locateSelfCell?: () => { gx: number; gy: number } | null;
 *   progressSidebar?: null | {
 *     explore: { label: string; title?: string; disabled?: boolean; requestLocate: () => string | null };
 *     siege: { label: string; title?: string; disabled?: boolean; requestLocate: () => string | null };
 *     banditByJunId: Record<string, { label: string; title?: string; requestLocate: () => string | null }>;
 *     ongoingWars?: Array<{ entry: object; requestLocate: () => string | null }>;
 *   };
 * }} [props]
 */
export default function ZhouJunMapJumpPanel({ variant = 'toolbar', locateSelfCell = null, progressSidebar = null }) {
  const nav = useStrategicMapNavigation();
  const [zhouRows, setZhouRows] = useState([]);
  const [junRows, setJunRows] = useState([]);
  const [loadErr, setLoadErr] = useState(null);
  const [zhouId, setZhouId] = useState('');
  const [jumpBusy, setJumpBusy] = useState(false);
  const [jumpHint, setJumpHint] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [zData, jData] = await Promise.all([loadSharedData('config_zhou'), loadSharedData('config_jun')]);
        if (cancelled) return;
        const zhouList = sortBySortOrderThenName(
          (zData?.zhou || []).filter((z) => z && (z.enabled === undefined || Number(z.enabled) === 1)),
          'zhouName',
        );
        const junList = sortBySortOrderThenName(
          (jData?.jun || []).filter((j) => j && (j.enabled === undefined || Number(j.enabled) === 1)),
          'junName',
        );
        setZhouRows(zhouList);
        setJunRows(junList);
        setZhouId((prev) => prev || (zhouList[0]?.zhouId != null ? String(zhouList[0].zhouId) : ''));
        setLoadErr(null);
      } catch (e) {
        if (!cancelled) setLoadErr('州郡配置加载失败');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedZhou = useMemo(
    () => zhouRows.find((z) => String(z.zhouId) === String(zhouId)) || null,
    [zhouRows, zhouId],
  );

  const junsInZhou = useMemo(() => {
    if (!zhouId) return [];
    return junRows.filter((j) => String(j.zhouId) === String(zhouId));
  }, [junRows, zhouId]);

  const showJunBanditPairRows = useMemo(() => {
    if (variant !== 'mapOverlay' || !progressSidebar?.banditByJunId) return false;
    return junsInZhou.some((j) => progressSidebar.banditByJunId[String(j.junId)]);
  }, [variant, progressSidebar, junsInZhou]);

  const showLocateSelf = typeof locateSelfCell === 'function';
  /** 州+「我在哪」双格或郡+匪寨双列：栈外宽 136px，与 `mapCornerZhouJunStackWideOuterStyle` 一致 */
  const stackWide = showJunBanditPairRows || showLocateSelf;
  const stackOuterStyle = stackWide ? mapCornerZhouJunStackWideOuterStyle : mapCornerEntryStackOuterStyle;

  const hintRowStyle = useMemo(
    () =>
      stackWide
        ? {
            ...mapCornerEntryHintRowStyle,
            width: MAP_CORNER_ZHOU_JUN_PAIR_ROW_W_PX,
            minWidth: MAP_CORNER_ZHOU_JUN_PAIR_ROW_W_PX,
            maxWidth: MAP_CORNER_ZHOU_JUN_PAIR_ROW_W_PX,
          }
        : mapCornerEntryHintRowStyle,
    [stackWide],
  );

  const season = selectedZhou?.season || zhouRows[0]?.season || 'san_1';

  const handleJunClick = useCallback(
    async (jun) => {
      if (!nav?.scrollToStrategicCell) {
        setJumpHint('地图未就绪');
        return;
      }
      const resolveAnchor = nav.resolveStrategicAnchorForCityId;
      if (!jun?.junId) return;
      setJumpBusy(true);
      setJumpHint(null);
      try {
        const qs = new URLSearchParams({ season, junId: String(jun.junId) });
        const res = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/cities?${qs}`);
        const data = await res.json();
        const cities = data?.success && Array.isArray(data.cities) ? data.cities : [];
        const focus = pickJunFocusCity(cities);
        let { gx, gy } = readGridPos(focus);
        if ((gx == null || gy == null) && typeof resolveAnchor === 'function') {
          const cid = focusCityId(focus);
          if (cid) {
            const anchor = resolveAnchor(cid);
            if (anchor && Number.isFinite(anchor.gx) && Number.isFinite(anchor.gy)) {
              gx = anchor.gx;
              gy = anchor.gy;
            }
          }
        }
        if (gx == null || gy == null) {
          setJumpHint('未找到该郡城市的战略坐标（库中 position_x/y）');
          return;
        }
        const w = playerRoadToWorldMapCell(String(jun.junId), gx, gy);
        if (!w) {
          setJumpHint('未找到该郡城市的战略坐标（库中 position_x/y）');
          return;
        }
        const worldGy = w.worldGy;
        if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setJumpHint(null);
        queueMicrotask(() => {
          requestAnimationFrame(() => {
            nav.scrollToStrategicCell(gx, worldGy);
          });
        });
      } catch {
        setJumpHint('城点数据请求失败');
      } finally {
        setJumpBusy(false);
      }
    },
    [nav, season],
  );

  const handleLocateSelf = useCallback(() => {
    if (!nav?.scrollToStrategicCell) {
      setJumpHint('地图未就绪');
      return;
    }
    const cell = typeof locateSelfCell === 'function' ? locateSelfCell() : null;
    if (!cell || !Number.isFinite(cell.gx) || !Number.isFinite(cell.gy)) {
      setJumpHint('暂无位置（请确认已设主城或在当前郡道路上）');
      return;
    }
    setJumpHint(null);
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        nav.scrollToStrategicCell(cell.gx, cell.gy);
      });
    });
  }, [nav, locateSelfCell]);

  const runProgressLocate = useCallback((req) => {
    if (typeof req !== 'function') return;
    const err = req();
    if (err) setJumpHint(err);
    else setJumpHint(null);
  }, []);

  const selectInBoxClass =
    'h-full min-h-0 w-full min-w-0 max-w-full flex-1 border-0 bg-transparent py-0 pl-1 pr-6 text-xs font-medium text-amber-300 outline-none appearance-none cursor-pointer truncate bg-[length:0.75rem] bg-[right_0.25rem_center] bg-no-repeat disabled:opacity-60';

  /** 州下拉独占一行（无「我在哪」且非双列郡时）撑满 66；否则州格固定 66，与郡钮同宽 */
  const zhouSelectOuterStyle = useMemo(() => {
    if (showLocateSelf) {
      return {
        ...mapCornerEntryRowBoxStyle,
        flex: '0 0 auto',
      };
    }
    if (showJunBanditPairRows) {
      return {
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
        flex: '1 1 0%',
        height: MAP_CORNER_ENTRY_H_PX,
        minHeight: MAP_CORNER_ENTRY_H_PX,
        maxHeight: MAP_CORNER_ENTRY_H_PX,
        boxSizing: 'border-box',
      };
    }
    return mapCornerEntryRowBoxStyle;
  }, [showJunBanditPairRows, showLocateSelf]);

  return (
    <div
      className="flex flex-col gap-1.5 self-start shrink-0 overflow-hidden"
      style={stackOuterStyle}
    >
      {loadErr ? (
        <div
          style={mapCornerEntryRowBoxStyle}
          className={`${MAP_CORNER_ENTRY_ROW_CLASS_ZHOU_JUN} self-start justify-start text-amber-600/90`}
        >
          <span className="block w-full min-w-0 truncate text-left">{loadErr}</span>
        </div>
      ) : (
        <>
          <label className="sr-only" htmlFor="zhou-jun-map-zhou-select">
            选择州
          </label>
          <div
            className={`box-border flex w-full min-w-0 shrink-0 items-stretch ${showLocateSelf ? 'flex-row gap-1' : ''}`}
            style={
              showLocateSelf
                ? {
                    width: MAP_CORNER_ZHOU_JUN_PAIR_ROW_W_PX,
                    minWidth: MAP_CORNER_ZHOU_JUN_PAIR_ROW_W_PX,
                    maxWidth: MAP_CORNER_ZHOU_JUN_PAIR_ROW_W_PX,
                  }
                : undefined
            }
          >
            <div
              style={zhouSelectOuterStyle}
              className="relative z-0 box-border flex min-w-0 items-stretch overflow-hidden rounded-lg border border-amber-700/40 bg-black/80 hover:bg-black/70"
            >
              <select
                id="zhou-jun-map-zhou-select"
                value={zhouId}
                onChange={(e) => setZhouId(e.target.value)}
                disabled={!zhouRows.length}
                title={selectedZhou?.zhouName || ''}
                className={selectInBoxClass}
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23fcd34d' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                }}
              >
                {zhouRows.map((z) => (
                  <option key={z.zhouId} value={z.zhouId}>
                    {z.zhouName || z.zhouId}
                  </option>
                ))}
              </select>
            </div>
            {showLocateSelf ? (
              <button
                type="button"
                disabled={jumpBusy}
                onClick={handleLocateSelf}
                title="将地图视口滚到本人标记所在格"
                style={mapCornerEntryRowBoxStyle}
                className={`${MAP_CORNER_ENTRY_ROW_CLASS_ZHOU_JUN} shrink-0 justify-start text-left text-stone-100 disabled:opacity-60`}
              >
                <span className="block w-full min-w-0 truncate text-left">我在哪</span>
              </button>
            ) : null}
          </div>

          {zhouId && junsInZhou.length > 0 ? (
            <div
              className={`relative z-10 flex min-w-0 w-full flex-col gap-1 ${variant === 'mapOverlay' ? '' : 'mt-6'}`}
            >
              {junsInZhou.map((j) => {
                const bandit =
                  showJunBanditPairRows && progressSidebar
                    ? progressSidebar.banditByJunId[String(j.junId)]
                    : null;
                if (showJunBanditPairRows) {
                  return (
                    <div
                      key={j.junId}
                      className="flex w-full min-w-0 flex-row items-stretch gap-1"
                    >
                      <button
                        type="button"
                        disabled={jumpBusy}
                        onClick={() => handleJunClick(j)}
                        title={j.junName || j.junId}
                        style={mapCornerEntryRowBoxStyle}
                        className={`${MAP_CORNER_ENTRY_ROW_CLASS_ZHOU_JUN} shrink-0 justify-start text-left text-stone-100 disabled:opacity-60`}
                      >
                        <span className="block w-full min-w-0 truncate text-left">{j.junName || j.junId}</span>
                      </button>
                      {bandit ? (
                        <button
                          type="button"
                          disabled={jumpBusy}
                          onClick={() => runProgressLocate(bandit.requestLocate)}
                          title={bandit.title || bandit.label}
                          style={mapCornerEntryRowBoxStyle}
                          className={`${MAP_CORNER_ENTRY_ROW_CLASS_ZHOU_JUN} shrink-0 justify-start text-left text-stone-100 disabled:opacity-60`}
                        >
                          <ZhouJunStatCaption text={bandit.label} />
                        </button>
                      ) : (
                        <div
                          className="shrink-0"
                          style={mapCornerEntryRowBoxStyle}
                          aria-hidden
                        />
                      )}
                    </div>
                  );
                }
                return (
                  <button
                    key={j.junId}
                    type="button"
                    disabled={jumpBusy}
                    onClick={() => handleJunClick(j)}
                    title={j.junName || j.junId}
                    style={mapCornerEntryRowBoxStyle}
                    className={`${MAP_CORNER_ENTRY_ROW_CLASS_ZHOU_JUN} justify-start text-left text-stone-100 disabled:opacity-60`}
                  >
                    <span className="block w-full min-w-0 truncate text-left">{j.junName || j.junId}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {progressSidebar ? (
            <>
              <button
                type="button"
                disabled={jumpBusy || !!progressSidebar.explore?.disabled}
                onClick={() => runProgressLocate(progressSidebar.explore?.requestLocate)}
                title={progressSidebar.explore?.title || progressSidebar.explore?.label}
                style={mapCornerEntryRowBoxStyle}
                className={`${MAP_CORNER_ENTRY_ROW_CLASS_ZHOU_JUN} self-start justify-start text-left text-stone-100 disabled:opacity-60`}
              >
                <ZhouJunStatCaption text={progressSidebar.explore?.label} />
              </button>
              <button
                type="button"
                disabled={jumpBusy || !!progressSidebar.siege?.disabled}
                onClick={() => runProgressLocate(progressSidebar.siege?.requestLocate)}
                title={progressSidebar.siege?.title || progressSidebar.siege?.label}
                style={mapCornerEntryRowBoxStyle}
                className={`${MAP_CORNER_ENTRY_ROW_CLASS_ZHOU_JUN} self-start justify-start text-left text-stone-100 disabled:opacity-60`}
              >
                <ZhouJunStatCaption text={progressSidebar.siege?.label} />
              </button>
              {(progressSidebar.ongoingWars || []).map(({ entry, requestLocate }) => (
                <MapCornerOngoingWarButton
                  key={entry.id}
                  entry={entry}
                  onLocate={() => runProgressLocate(requestLocate)}
                />
              ))}
            </>
          ) : null}

          {jumpHint ? (
            <div
              style={hintRowStyle}
              className="flex max-w-full shrink-0 items-center self-start overflow-hidden px-0.5 text-[10px] leading-none text-amber-600/90"
            >
              <span className="min-w-0 truncate" title={jumpHint}>
                {jumpHint}
              </span>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
