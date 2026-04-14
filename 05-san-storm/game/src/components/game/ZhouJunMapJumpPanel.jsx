import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadSharedData } from '@/services/dataService';
import { API_CONFIG } from '@/constants';
import { useStrategicMapNavigation } from '@/contexts/StrategicMapNavigationContext';

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

function pickJunFocusCity(cities) {
  if (!Array.isArray(cities) || !cities.length) return null;
  const majors = cities.filter((c) => c.city_type === 'city_major');
  if (majors.length) {
    majors.sort((a, b) => String(a.city_name || '').localeCompare(String(b.city_name || ''), 'zh-Hans-CN'));
    return majors[0];
  }
  const mediums = cities.filter((c) => c.city_type === 'city_medium');
  if (mediums.length) {
    mediums.sort((a, b) => String(a.city_name || '').localeCompare(String(b.city_name || ''), 'zh-Hans-CN'));
    return mediums[0];
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

/**
 * 大地图左上：州下拉 + 所选州下属郡列表；点郡将视口滚到该郡优先大城、否则中城的战略格锚点。
 * 样式对齐左下角「排行 / 聊天」入口条。
 */
export default function ZhouJunMapJumpPanel() {
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
      if (!jun?.junId) return;
      setJumpBusy(true);
      setJumpHint(null);
      try {
        const qs = new URLSearchParams({ season, junId: String(jun.junId) });
        const res = await fetch(`${API_CONFIG.BASE_URL}/cities?${qs}`);
        const data = await res.json();
        const cities = data?.success && Array.isArray(data.cities) ? data.cities : [];
        const focus = pickJunFocusCity(cities);
        const { gx, gy } = readGridPos(focus);
        if (gx == null || gy == null) {
          setJumpHint('未找到该郡大城/中城坐标');
          return;
        }
        nav.scrollToStrategicCell(gx, gy);
        setJumpHint(null);
      } catch {
        setJumpHint('城点数据请求失败');
      } finally {
        setJumpBusy(false);
      }
    },
    [nav, season],
  );

  /**
   * 与 `StandingRankingsPanel` / `CommPanel` 收起态入口一致：
   * `px-3 py-2 bg-black/80 rounded-lg border border-amber-700/40 text-xs font-medium …`
   * 不设固定大宽度，由内容决定宽度（与「🏆 排行」「💬 聊天」同量级）。
   */
  const btnBase =
    'box-border px-3 py-2 bg-black/80 rounded-lg border border-amber-700/40 text-xs font-medium hover:bg-black/70 transition-colors';

  return (
    <div className="inline-flex flex-col gap-1.5 self-start w-max min-w-0 max-w-[5.5rem]">
      {loadErr ? (
        <div className={`${btnBase} text-amber-600/90`}>{loadErr}</div>
      ) : (
        <>
          <label className="sr-only" htmlFor="zhou-jun-map-zhou-select">
            选择州
          </label>
          {/* 收窄 select 用 overflow；避免写在外层以免裁切命中区 */}
          <div className="min-w-0 max-w-full overflow-hidden relative z-0 shrink-0">
            <select
              id="zhou-jun-map-zhou-select"
              value={zhouId}
              onChange={(e) => setZhouId(e.target.value)}
              disabled={!zhouRows.length}
              title={selectedZhou?.zhouName || ''}
              className={`${btnBase} w-full min-w-0 max-w-full cursor-pointer text-amber-300 pr-7 appearance-none bg-[length:0.75rem] bg-[right_0.35rem_center] bg-no-repeat`}
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
            /* mt：与 GamePage 顶栏浮层里活动排行横条（z-40、整行可点）垂直错开，避免首条郡被挡住 */
            <div className="flex flex-col gap-1 min-w-0 w-full relative z-10 mt-4">
              {junsInZhou.map((j) => (
                <button
                  key={j.junId}
                  type="button"
                  disabled={jumpBusy}
                  onClick={() => handleJunClick(j)}
                  title={j.junName || j.junId}
                  className={`${btnBase} w-full min-w-0 text-left text-stone-100 truncate disabled:opacity-60`}
                >
                  {j.junName || j.junId}
                </button>
              ))}
            </div>
          ) : null}

          {jumpHint ? <div className="text-[10px] text-amber-600/90 px-0.5">{jumpHint}</div> : null}
        </>
      )}
    </div>
  );
}
