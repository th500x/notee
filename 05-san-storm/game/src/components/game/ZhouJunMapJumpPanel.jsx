import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadSharedData } from '@/services/dataService';
import { API_CONFIG } from '@/constants';
import { useStrategicMapNavigation } from '@/contexts/StrategicMapNavigationContext';
import {
  MAP_CORNER_ENTRY_ROW_CLASS,
  mapCornerEntryHintRowStyle,
  mapCornerEntryRowBoxStyle,
  mapCornerEntryStackOuterStyle,
} from '@/components/game/mapCornerEntryUi';

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
 * `variant="mapOverlay"`：叠在战略格网上（`WorldYingchuanMapSection` 内 absolute），与左下角排行/聊天同为「浮在地图上」的交互层。
 * 样式对齐左下角「排行 / 聊天」入口条（`mapCornerEntryUi`）。
 *
 * @param {{ variant?: 'toolbar' | 'mapOverlay' }} [props]
 */
export default function ZhouJunMapJumpPanel({ variant = 'toolbar' }) {
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
        const res = await fetch(`${API_CONFIG.BASE_URL}/cities?${qs}`);
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
        // 避免按钮 focus 触发外层 main 的 scrollIntoView，与地图内滚动抢一帧
        if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setJumpHint(null);
        // 等当前 tick 里 setState（如 jumpBusy）提交后再滚，减少与外层滚动/锚定的竞态
        queueMicrotask(() => {
          requestAnimationFrame(() => {
            nav.scrollToStrategicCell(gx, gy);
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

  const selectInBoxClass =
    'h-full min-h-0 w-full min-w-0 max-w-full flex-1 border-0 bg-transparent py-0 pl-2 pr-7 text-xs font-medium text-amber-300 outline-none appearance-none cursor-pointer truncate bg-[length:0.75rem] bg-[right_0.35rem_center] bg-no-repeat disabled:opacity-60';

  return (
    <div
      className="flex flex-col gap-1.5 self-start shrink-0 overflow-hidden"
      style={mapCornerEntryStackOuterStyle}
    >
      {loadErr ? (
        <div
          style={mapCornerEntryRowBoxStyle}
          className={`${MAP_CORNER_ENTRY_ROW_CLASS} justify-start text-amber-600/90`}
        >
          <span className="block w-full min-w-0 truncate text-left">{loadErr}</span>
        </div>
      ) : (
        <>
          <label className="sr-only" htmlFor="zhou-jun-map-zhou-select">
            选择州
          </label>
          <div
            style={mapCornerEntryRowBoxStyle}
            className="relative z-0 box-border flex shrink-0 items-stretch overflow-hidden rounded-lg border border-amber-700/40 bg-black/80 hover:bg-black/70"
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
              className={`relative z-10 flex min-w-0 max-w-full flex-col gap-1 ${variant === 'mapOverlay' ? '' : 'mt-6'}`}
            >
              {junsInZhou.map((j) => (
                <button
                  key={j.junId}
                  type="button"
                  disabled={jumpBusy}
                  onClick={() => handleJunClick(j)}
                  title={j.junName || j.junId}
                  style={mapCornerEntryRowBoxStyle}
                  className={`${MAP_CORNER_ENTRY_ROW_CLASS} justify-start text-left text-stone-100 disabled:opacity-60`}
                >
                  <span className="block w-full min-w-0 truncate text-left">{j.junName || j.junId}</span>
                </button>
              ))}
            </div>
          ) : null}

          {jumpHint ? (
            <div
              style={mapCornerEntryHintRowStyle}
              className="flex max-w-full shrink-0 items-center overflow-hidden px-0.5 text-[10px] leading-none text-amber-600/90"
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
