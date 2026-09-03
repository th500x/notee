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

  const tierOrder = ['city_major', 'city_medium', 'city_small', 'city_gate'];
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
 * **大地图进度条**：**州下拉**独占首行；**郡与匪寨**并排（有匪寨时栈外宽 **`MAP_CORNER_ZHOU_JUN_PAIR_ROW_W_PX`**）；其下为 **本人定位钮**（文案=角色名，原「我在哪」）；再下为进行中战事条。**已移除**「探索 x/x」钮。匪寨次数用 **`ZhouJunStatCaption`** 小号数字。
 *
 * @param {{
 *   variant?: 'toolbar' | 'mapOverlay';
 *   locateSelfCell?: () => { gx: number; gy: number } | null;
 *   locateSelfLabel?: string | null — 定位钮文案（角色名）；缺省「我」
 *   progressSidebar?: null | {
 *     banditByJunId: Record<string, { label: string; title?: string; requestLocate: () => string | null }>;
 *     ongoingWars?: Array<{ entry: object; requestLocate: () => string | null }>;
 *   };
 *   playableJunIds?: string[] | null — 大地图已正式生成的郡；传入时隐藏未就绪郡（如仅预设的汝南）
 * }} [props]
 */
export default function ZhouJunMapJumpPanel({
  variant = 'toolbar',
  locateSelfCell = null,
  locateSelfLabel = null,
  progressSidebar = null,
  playableJunIds = null,
}) {
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

  const playableJunIdSet = useMemo(() => {
    if (!Array.isArray(playableJunIds) || !playableJunIds.length) return null;
    return new Set(playableJunIds.map((id) => String(id).trim()).filter(Boolean));
  }, [playableJunIds]);

  const junsInZhou = useMemo(() => {
    if (!zhouId) return [];
    return junRows.filter((j) => {
      if (String(j.zhouId) !== String(zhouId)) return false;
      if (!playableJunIdSet) return true;
      return playableJunIdSet.has(String(j.junId));
    });
  }, [junRows, zhouId, playableJunIdSet]);

  const showJunBanditPairRows = useMemo(() => {
    if (variant !== 'mapOverlay' || !progressSidebar?.banditByJunId) return false;
    return junsInZhou.some((j) => progressSidebar.banditByJunId[String(j.junId)]);
  }, [variant, progressSidebar, junsInZhou]);

  const showLocateSelf = typeof locateSelfCell === 'function';
  const locateLabel =
    (locateSelfLabel != null && String(locateSelfLabel).trim()) || '我';
  /** 郡+匪寨双列时栈外宽 136px；定位钮在郡下方单列 66px */
  const stackWide = showJunBanditPairRows;
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

  /** 州下拉：有郡+匪寨双列时撑满栈宽；否则 66px 单列 */
  const zhouSelectOuterStyle = useMemo(() => {
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
  }, [showJunBanditPairRows]);

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
            style={zhouSelectOuterStyle}
            className="relative z-0 box-border flex min-w-0 items-stretch overflow-hidden rounded-lg border border-amber-700/40 bg-black/80 hover:bg-black/70 self-start"
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

          {showLocateSelf ? (
            <button
              type="button"
              disabled={jumpBusy}
              onClick={handleLocateSelf}
              title={`定位至本人（${locateLabel}）`}
              style={mapCornerEntryRowBoxStyle}
              className={`${MAP_CORNER_ENTRY_ROW_CLASS_ZHOU_JUN} self-start justify-start text-left text-stone-100 disabled:opacity-60`}
            >
              <span className="block w-full min-w-0 truncate text-left">{locateLabel}</span>
            </button>
          ) : null}

          {progressSidebar ? (
            <>
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
