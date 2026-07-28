/**
 * 郡战略图工坊（31-1 · P2）：选郡 → 城 2×2 / 战场多格 / 道路 → 整体保存
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import { useAdminToast } from '@/components/admin/useAdminToast';
import JunStrategicMapWorkshopGrid from '@/components/admin/JunStrategicMapWorkshopGrid';
import {
  fetchJunWorkshopCatalog,
  fetchJunWorkshop,
  junWorkshopPreviewUrl,
  postSaveJunWorkshop,
} from '@/components/admin/worldMapAdminApi';
import {
  applyCityFootprints,
  applyBattlefieldEntries,
} from '@shared/utils/meowaToJunMerged.js';
import {
  ROAD_CONNECTIVITY_4,
  ROAD_CONNECTIVITY_8,
} from '@shared/utils/strategicRoadOverlay.js';

const CITY_OBJECTS = new Set(['city_small', 'city_medium', 'city_major', 'city_gate']);

function cloneBaseCells(cells) {
  return (cells || []).map((row) =>
    (row || []).map((c) => {
      const next = { ...c };
      if (
        next.cityId ||
        next.battlefieldId ||
        next.object === 'jun_battlefield' ||
        CITY_OBJECTS.has(next.object)
      ) {
        delete next.cityId;
        delete next.cityName;
        delete next.battlefieldId;
        if (CITY_OBJECTS.has(next.object) || next.object === 'jun_battlefield') {
          next.object = null;
        }
      }
      return next;
    }),
  );
}

function projectInteractiveCells(baseCells, cities, battlefield) {
  const cells = cloneBaseCells(baseCells);
  const placed = (cities || []).filter(
    (c) => Number.isInteger(c.anchorGx) && Number.isInteger(c.anchorGy),
  );
  applyCityFootprints(cells, placed);
  applyBattlefieldEntries(cells, battlefield);
  return cells;
}

function canPlaceCity2x2(cells, gx, gy, selfCityId) {
  const rows = cells?.length || 0;
  const cols = cells?.[0]?.length || 0;
  for (let dy = 0; dy < 2; dy += 1) {
    for (let dx = 0; dx < 2; dx += 1) {
      const x = gx + dx;
      const y = gy + dy;
      if (y < 0 || x < 0 || y >= rows || x >= cols) {
        return `2×2 越界（锚点 ${gx},${gy}）`;
      }
      const cell = cells[y][x];
      if (cell.terrain === 'lake' || cell.terrain === 'river') {
        return `与水域重叠 (${x},${y})`;
      }
      if (cell.cityId && cell.cityId !== selfCityId) {
        return `与城 ${cell.cityName || cell.cityId} 重叠`;
      }
      if (cell.battlefieldId) {
        return `与战场入口重叠 (${x},${y})`;
      }
    }
  }
  return null;
}

export default function JunStrategicMapWorkshop() {
  const { isLoggedIn, loading: adminLoading } = useAdmin();
  const { showToast, Toast } = useAdminToast();

  const [catalog, setCatalog] = useState([]);
  const [junId, setJunId] = useState('san_1_jun_yingchuan');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bundleMeta, setBundleMeta] = useState(null);
  const [baseCells, setBaseCells] = useState(null);
  const [mapColumns, setMapColumns] = useState(16);
  const [mapRows, setMapRows] = useState(40);
  const [cities, setCities] = useState([]);
  const [battlefield, setBattlefield] = useState(null);
  const [roadCells, setRoadCells] = useState([]);
  const [connectivity, setConnectivity] = useState(ROAD_CONNECTIVITY_4);
  const [editMode, setEditMode] = useState('city');
  const [selectedCityId, setSelectedCityId] = useState(null);
  const [roadPaintMode, setRoadPaintMode] = useState('paint');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [hoverCell, setHoverCell] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchJunWorkshopCatalog()
      .then((res) => {
        if (cancelled) return;
        if (res?.success && Array.isArray(res.data)) {
          setCatalog(res.data);
          if (res.data.length && !res.data.some((j) => j.junId === junId)) {
            setJunId(res.data[0].junId);
          }
        }
      })
      .catch(() => {
        if (!cancelled) showToast('读取工坊目录失败', 'error');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅挂载拉目录
  }, []);

  const loadBundle = useCallback(async () => {
    if (!junId) return;
    setLoading(true);
    try {
      const res = await fetchJunWorkshop(junId);
      if (!res?.success || !res.data) {
        showToast(res?.error || '加载失败', 'error');
        return;
      }
      const data = res.data;
      setBundleMeta(data);
      setBaseCells(data.merged.cells);
      setMapColumns(Number(data.merged.mapColumns));
      setMapRows(Number(data.merged.mapRows));
      setCities(data.slots.cities || []);
      setBattlefield(data.slots.battlefield || null);
      setRoadCells(Array.isArray(data.merged.roadCells) ? data.merged.roadCells : []);
      setConnectivity(
        data.merged.roadConnectivity === ROAD_CONNECTIVITY_8
          ? ROAD_CONNECTIVITY_8
          : ROAD_CONNECTIVITY_4,
      );
      setSelectedCityId(data.slots.cities?.[0]?.cityId || null);
      setPreviewUrl(data.meowa?.hasPreview ? junWorkshopPreviewUrl(junId) : null);
      showToast(`已加载 ${data.slots.displayName || junId}`, 'success');
    } catch (e) {
      showToast(e.message || '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [junId, showToast]);

  const projectedCells = useMemo(() => {
    if (!baseCells) return null;
    try {
      return projectInteractiveCells(baseCells, cities, battlefield);
    } catch {
      return cloneBaseCells(baseCells);
    }
  }, [baseCells, cities, battlefield]);

  const placementCheckCells = useMemo(() => {
    if (!baseCells || !selectedCityId) return projectedCells;
    try {
      const others = cities.filter((c) => c.cityId !== selectedCityId);
      return projectInteractiveCells(baseCells, others, battlefield);
    } catch {
      return projectedCells;
    }
  }, [baseCells, cities, battlefield, selectedCityId, projectedCells]);

  const ghostAnchor = useMemo(() => {
    if (editMode !== 'city' || !hoverCell || !selectedCityId || !placementCheckCells) return null;
    const err = canPlaceCity2x2(placementCheckCells, hoverCell.gx, hoverCell.gy, selectedCityId);
    if (err) return null;
    return hoverCell;
  }, [editMode, hoverCell, selectedCityId, placementCheckCells]);

  const handleCellClick = useCallback(
    (gx, gy) => {
      if (!projectedCells) return;
      if (editMode === 'city') {
        if (!selectedCityId) {
          showToast('请先在左侧选中一座城/关', 'error');
          return;
        }
        const err = canPlaceCity2x2(placementCheckCells, gx, gy, selectedCityId);
        if (err) {
          showToast(err, 'error');
          return;
        }
        setCities((prev) =>
          prev.map((c) =>
            c.cityId === selectedCityId ? { ...c, anchorGx: gx, anchorGy: gy } : c,
          ),
        );
        return;
      }
      if (editMode === 'battlefield') {
        setBattlefield((prev) => {
          if (!prev) return prev;
          const key = `${gx},${gy}`;
          const list = Array.isArray(prev.entryCells) ? [...prev.entryCells] : [];
          const idx = list.findIndex((p) => `${p.gx},${p.gy}` === key);
          if (idx >= 0) list.splice(idx, 1);
          else {
            const cell = projectedCells[gy]?.[gx];
            if (cell?.cityId) {
              showToast('战场入口不能压在城/关上', 'error');
              return prev;
            }
            list.push({ gx, gy });
            list.sort((a, b) => a.gy - b.gy || a.gx - b.gx);
          }
          return { ...prev, entryCells: list };
        });
      }
    },
    [editMode, selectedCityId, projectedCells, placementCheckCells, showToast],
  );

  const handleRoadPaint = useCallback(
    (gx, gy) => {
      const k = `${gx},${gy}`;
      setRoadCells((prev) => {
        const set = new Set(prev.map((c) => `${c.gx},${c.gy}`));
        if (roadPaintMode === 'paint') set.add(k);
        else set.delete(k);
        return Array.from(set)
          .map((s) => {
            const [x, y] = s.split(',').map(Number);
            return { gx: x, gy: y };
          })
          .sort((a, b) => a.gy - b.gy || a.gx - b.gx);
      });
    },
    [roadPaintMode],
  );

  const clearSelectedCity = () => {
    if (!selectedCityId) return;
    setCities((prev) =>
      prev.map((c) =>
        c.cityId === selectedCityId ? { ...c, anchorGx: null, anchorGy: null } : c,
      ),
    );
  };

  const clearBattlefield = () => {
    setBattlefield((prev) => (prev ? { ...prev, entryCells: [] } : prev));
  };

  const handleSave = async () => {
    if (!junId || !battlefield) return;
    setSaving(true);
    try {
      const res = await postSaveJunWorkshop({
        junId,
        cities: cities.map((c) => ({
          cityId: c.cityId,
          anchorGx: c.anchorGx,
          anchorGy: c.anchorGy,
        })),
        battlefield: { entryCells: battlefield.entryCells || [] },
        roadCells,
        roadConnectivity: connectivity,
      });
      if (!res?.success) {
        showToast(res?.error || '保存失败', 'error');
        return;
      }
      const d = res.data;
      const warn =
        Array.isArray(d.warnings) && d.warnings.length
          ? `（${d.warnings.length} 条未填坐标警告）`
          : '';
      showToast(
        `已保存：道路 ${d.roadCellCount} 格，城坐标入库 ${d.citiesDb?.updated ?? 0}${warn}`,
        'success',
      );
      await loadBundle();
    } catch (e) {
      showToast(e.message || '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (adminLoading) {
    return <div className="p-8 text-center text-gray-500">加载中…</div>;
  }
  if (!isLoggedIn) {
    return (
      <div className="p-8 text-center text-gray-600">
        请先以管理员身份进入（首页切换开发环境或登录）。
      </div>
    );
  }

  const placedCount = cities.filter((c) => c.anchorGx != null && c.anchorGy != null).length;
  const entryCount = battlefield?.entryCells?.length || 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <Toast />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">郡战略图工坊</h1>
          <p className="text-sm text-gray-600 mt-1">
            Meowa 草图 + 槽位点选城/战场 + 道路笔刷 → 写入 merged 与城坐标（31-1 P2）
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-gray-700">
            郡{' '}
            <select
              className="border border-gray-300 rounded px-2 py-1.5 bg-white"
              value={junId}
              onChange={(e) => setJunId(e.target.value)}
            >
              {(catalog.length ? catalog : [{ junId, displayName: junId }]).map((j) => (
                <option key={j.junId} value={j.junId}>
                  {j.displayName || j.junId}
                  {j.mapColumns ? ` (${j.mapColumns}×${j.mapRows})` : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="px-3 py-1.5 rounded bg-sky-600 text-white text-sm hover:bg-sky-700 disabled:opacity-50"
            onClick={loadBundle}
            disabled={loading}
          >
            {loading ? '加载中…' : '加载草图与槽位'}
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
            onClick={handleSave}
            disabled={saving || !baseCells}
          >
            {saving ? '保存中…' : '整体保存'}
          </button>
        </div>
      </div>

      {!baseCells ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
          选择郡后点击「加载草图与槽位」。需已完成 P0 本地化与 P1 转换。
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          <aside className="space-y-3">
            <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">编辑模式</p>
              {[
                ['city', '城 / 关（2×2）'],
                ['battlefield', '战场入口（多格）'],
                ['road', '道路笔刷'],
              ].map(([id, label]) => (
                <label key={id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="workshop-mode"
                    checked={editMode === id}
                    onChange={() => setEditMode(id)}
                  />
                  {label}
                </label>
              ))}
            </div>

            {editMode === 'city' && (
              <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-800">
                    城槽 {placedCount}/{cities.length}
                  </p>
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline"
                    onClick={clearSelectedCity}
                  >
                    清除选中坐标
                  </button>
                </div>
                <ul className="space-y-1 max-h-72 overflow-auto">
                  {cities.map((c) => {
                    const placed = c.anchorGx != null && c.anchorGy != null;
                    return (
                      <li key={c.cityId}>
                        <button
                          type="button"
                          className={`w-full text-left text-sm px-2 py-1.5 rounded border ${
                            selectedCityId === c.cityId
                              ? 'border-sky-500 bg-sky-50'
                              : 'border-transparent hover:bg-gray-50'
                          }`}
                          onClick={() => setSelectedCityId(c.cityId)}
                        >
                          <span className="font-medium">{c.name}</span>
                          <span className="text-gray-400 text-xs ml-1">{c.kind}</span>
                          <div className="text-xs text-gray-500">
                            {placed ? `(${c.anchorGx},${c.anchorGy})` : '未点选'}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-xs text-gray-500">点格落下左上角，自动占 2×2。</p>
              </div>
            )}

            {editMode === 'battlefield' && battlefield && (
              <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-800">
                    {battlefield.displayName || '郡战场'} · {entryCount} 入口格
                  </p>
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline"
                    onClick={clearBattlefield}
                  >
                    清空入口
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  点击切换入口格（非 2×2）。中空区域不必点满。
                </p>
                <p className="text-xs text-gray-400 break-all">{battlefield.battlefieldId}</p>
              </div>
            )}

            {editMode === 'road' && (
              <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2 text-sm">
                <p className="font-medium text-gray-800">道路 · {roadCells.length} 格</p>
                <div className="flex gap-3">
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      checked={roadPaintMode === 'paint'}
                      onChange={() => setRoadPaintMode('paint')}
                    />
                    画路
                  </label>
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      checked={roadPaintMode === 'erase'}
                      onChange={() => setRoadPaintMode('erase')}
                    />
                    擦除
                  </label>
                </div>
                <label className="block text-xs text-gray-600">
                  邻接{' '}
                  <select
                    className="border rounded px-1 py-0.5"
                    value={connectivity}
                    onChange={(e) =>
                      setConnectivity(
                        e.target.value === ROAD_CONNECTIVITY_8
                          ? ROAD_CONNECTIVITY_8
                          : ROAD_CONNECTIVITY_4,
                      )
                    }
                  >
                    <option value={ROAD_CONNECTIVITY_4}>四连通</option>
                    <option value={ROAD_CONNECTIVITY_8}>八连通</option>
                  </select>
                </label>
                <p className="text-xs text-gray-500">不可涂在城/关 2×2 上；可叠战场入口。</p>
              </div>
            )}

            {bundleMeta?.warnings?.length ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-900 space-y-0.5">
                {bundleMeta.warnings.slice(0, 6).map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </div>
            ) : null}
          </aside>

          <div>
            {projectedCells ? (
              <JunStrategicMapWorkshopGrid
                cells={projectedCells}
                mapColumns={mapColumns}
                mapRows={mapRows}
                previewUrl={previewUrl}
                editMode={editMode}
                roadCells={roadCells}
                connectivity={connectivity}
                onCellClick={handleCellClick}
                onCellPaint={handleRoadPaint}
                onCellHover={(gx, gy) => setHoverCell({ gx, gy })}
                onCellHoverEnd={() => setHoverCell(null)}
                ghostAnchor={ghostAnchor}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
