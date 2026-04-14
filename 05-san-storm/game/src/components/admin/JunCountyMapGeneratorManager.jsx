/**
 * 三国地图 / 郡大象限（管理员）：结构与战役地图管理页一致 — preset + Seed → 生成预览 → 下载 JSON。
 * 生成逻辑见 @shared/utils/junCountyMapGenerator
 */

import { useMemo, useState, useEffect } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import {
  generateJunCountyMajorQuadSimulated,
  getJunQuadPresetById,
  JUN_QUAD_PRESET_IDS,
  randomCampaignMapSeed,
} from '@shared/utils/junCountyMapGenerator';
import CampaignMapGrid from '@/components/campaign/CampaignMapGrid';
import { useAdminToast } from '@/components/admin/useAdminToast';
import {
  fetchGeoOptions,
  fetchJunPresetStatus,
  postCoordinatesToDb,
  postBoundariesToDb,
  postGenerateMergedMap,
  postSaveMergedRoadCells,
  postBatchNpcGarrison,
} from '@/components/admin/worldMapAdminApi';
import StrategicRoadCellsEditor from '@/components/admin/StrategicRoadCellsEditor';
import {
  normalizeRoadCellList,
  ROAD_CONNECTIVITY_4,
} from '@shared/utils/strategicRoadOverlay.js';

/** 批量 NPC 守军：与 cityService NPC_TROOP_COUNT_* 的 city_type 键一致 */
const NPC_BATCH_CITY_TYPES = [
  { key: 'city_small', label: '小城 city_small' },
  { key: 'city_medium', label: '中城 city_medium' },
  { key: 'city_major', label: '大城 city_major' },
  { key: 'gate', label: '关隘 gate' },
  { key: 'fort', label: '据点 fort' },
];

/** 兼容 camelCase / snake_case，避免 MySQL 驱动或代理改写字段后下拉无选项、受控 value 失效 */
function normalizeGeoOptions(raw) {
  const zhouIn = Array.isArray(raw?.zhou) ? raw.zhou : [];
  const junIn = Array.isArray(raw?.jun) ? raw.jun : [];
  const zhou = zhouIn
    .map((row) => {
      const id = String(row.zhouId ?? row.zhou_id ?? '').trim();
      return {
        zhouId: id,
        zhouName: row.zhouName ?? row.zhou_name ?? id,
        season: row.season,
      };
    })
    .filter((z) => z.zhouId);
  const jun = junIn
    .map((row) => {
      const id = String(row.junId ?? row.jun_id ?? '').trim();
      const zid = String(row.zhouId ?? row.zhou_id ?? '').trim();
      return {
        junId: id,
        junName: row.junName ?? row.jun_name ?? id,
        zhouId: zid,
        season: row.season,
      };
    })
    .filter((j) => j.junId);
  return { zhou, jun };
}

/**
 * @param {{ embedded?: boolean }} props - embedded：嵌在大地图源层内时不改布局，仅由外层提供关闭条
 */
export default function JunCountyMapGeneratorManager({ embedded = false }) {
  const { isLoggedIn, loading: adminLoading } = useAdmin();
  const { showToast, Toast } = useAdminToast();
  const [junQuadId, setJunQuadId] = useState(() => JUN_QUAD_PRESET_IDS[0] || '');
  const [seed, setSeed] = useState(null);
  const [seedInput, setSeedInput] = useState('');
  const [randomizeCityPositions, setRandomizeCityPositions] = useState(false);

  /** 全国州 / 郡 + 入库（真实 API）；勿长期保持 null，否则 select 无 option、表现为空白且无法选 */
  const [geoOptions, setGeoOptions] = useState(() => ({ zhou: [], jun: [] }));
  const [geoLoading, setGeoLoading] = useState(true);
  const [geoLoadError, setGeoLoadError] = useState(null);
  const [zhouId, setZhouId] = useState('');
  const [selectedJunId, setSelectedJunId] = useState('');
  const [presetGate, setPresetGate] = useState(null);
  const [boundariesJson, setBoundariesJson] = useState('[]');
  const [busyCoords, setBusyCoords] = useState(false);
  const [busyBounds, setBusyBounds] = useState(false);
  const [busyMerge, setBusyMerge] = useState(false);
  /** 颍川 merged 快照：供道路格涂抹编辑 */
  const [roadEdit, setRoadEdit] = useState(null);
  const [busyRoadSave, setBusyRoadSave] = useState(false);

  /** 郡内批量 NPC：与攻城逻辑一致 — 势力方 = faction_id 非空且 status=owned；NPC 方 = 其余 */
  const [npcOwnershipMode, setNpcOwnershipMode] = useState('player_owned');
  const [npcCountInputs, setNpcCountInputs] = useState(() =>
    Object.fromEntries(NPC_BATCH_CITY_TYPES.map(({ key }) => [key, ''])),
  );
  const [busyNpcBatch, setBusyNpcBatch] = useState(false);

  const preset = useMemo(() => (junQuadId ? getJunQuadPresetById(junQuadId) : null), [junQuadId]);

  const junOptions = useMemo(() => {
    if (!geoOptions?.jun?.length) return [];
    if (!zhouId) return geoOptions.jun;
    return geoOptions.jun.filter((j) => j.zhouId === zhouId);
  }, [geoOptions, zhouId]);

  useEffect(() => {
    let cancelled = false;
    setGeoLoading(true);
    setGeoLoadError(null);
    (async () => {
      try {
        const res = await fetchGeoOptions();
        if (cancelled) return;
        if (res.success && res.data) {
          const normalized = normalizeGeoOptions(res.data);
          setGeoOptions(normalized);
          const firstZ = normalized.zhou[0]?.zhouId;
          if (firstZ) setZhouId(firstZ);
          if (normalized.zhou.length === 0) {
            setGeoLoadError('config_zhou 无数据，请确认已执行州郡迁移并导入数据');
          }
        } else {
          setGeoOptions({ zhou: [], jun: [] });
          setGeoLoadError(
            typeof res.error === 'string' ? res.error : '州郡列表加载失败（请确认后端与接口）',
          );
        }
      } catch (e) {
        if (!cancelled) {
          setGeoOptions({ zhou: [], jun: [] });
          setGeoLoadError(e?.message || '无法连接后端（请确认 05-san-storm 后端已启动，默认端口 3005）');
        }
      } finally {
        if (!cancelled) setGeoLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!junOptions.length) {
      setSelectedJunId('');
      setPresetGate(null);
      return;
    }
    if (!selectedJunId || !junOptions.some((j) => j.junId === selectedJunId)) {
      setSelectedJunId(junOptions[0].junId);
    }
  }, [junOptions, selectedJunId]);

  useEffect(() => {
    if (!selectedJunId) {
      setPresetGate(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchJunPresetStatus(selectedJunId);
        if (!cancelled && res.success && res.data) setPresetGate(res.data);
      } catch {
        if (!cancelled) setPresetGate({ complete: false, missing: ['请求失败'] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedJunId]);

  const result = useMemo(() => {
    if (!preset || seed == null) return null;
    return generateJunCountyMajorQuadSimulated(preset, { seed, randomizeCityPositions });
  }, [preset, seed, randomizeCityPositions]);

  useEffect(() => {
    setSeed(null);
    setSeedInput('');
  }, [junQuadId, preset]);

  const handleGenerate = () => {
    if (!preset) {
      showToast('未找到该郡象限 preset', 'error');
      return;
    }
    const trimmed = seedInput.trim();
    if (trimmed !== '') {
      const n = Number(trimmed);
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        showToast('Seed 须为整数（可负），或留空随机', 'error');
        return;
      }
      setSeed(n);
      return;
    }
    setSeed(randomCampaignMapSeed());
  };

  const handleDownloadPreset = () => {
    if (!preset || seed == null) {
      showToast('请先生成预览', 'info');
      return;
    }
    const out = { ...preset, seed };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${junQuadId}.preset.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已下载 preset JSON，可将文件覆盖 shared/data/worldmap/ 以固化');
  };

  const handleCoordinatesToDb = async () => {
    if (!selectedJunId || !presetGate?.complete) return;
    setBusyCoords(true);
    try {
      const res = await postCoordinatesToDb(selectedJunId);
      if (res.success) {
        const n = res.data?.updated ?? 0;
        showToast(`坐标入库：更新 ${n} 条 cities.position_x/y`, 'success');
        const miss = res.data?.skippedNotInDb;
        if (Array.isArray(miss) && miss.length) {
          showToast(
            `以下 city_id 在 DB 中无行（请先 city 种子）：${miss.slice(0, 8).join(', ')}${miss.length > 8 ? '…' : ''}`,
            'info',
          );
        }
      } else {
        showToast(res.error || '失败', 'error');
      }
    } finally {
      setBusyCoords(false);
    }
  };

  const handleBoundariesToDb = async () => {
    if (!selectedJunId) return;
    const jun = geoOptions?.jun?.find((j) => j.junId === selectedJunId);
    const season = jun?.season || 'san_1';
    let edges;
    try {
      edges = JSON.parse(boundariesJson);
    } catch {
      showToast('邻接边 JSON 无法解析（需为数组）', 'error');
      return;
    }
    if (!Array.isArray(edges)) {
      showToast('邻接边须为 JSON 数组', 'error');
      return;
    }
    setBusyBounds(true);
    try {
      const res = await postBoundariesToDb(season, edges);
      if (res.success) {
        showToast(`边界入库：写入/更新 ${res.data?.inserted ?? 0} 条 config_jun_node`, 'success');
      } else {
        showToast(res.error || '失败', 'error');
      }
    } finally {
      setBusyBounds(false);
    }
  };

  const handleGenerateMergedMap = async () => {
    if (selectedJunId !== 'san_1_jun_yingchuan' || !presetGate?.complete) return;
    setBusyMerge(true);
    try {
      const res = await postGenerateMergedMap(selectedJunId, seed);
      if (res.success) {
        showToast(
          `已生成合并大地图 version=${res.data?.version} → 游戏读取 ${res.data?.path}（请刷新主界面大地图）`,
          'success',
        );
      } else {
        showToast(res.error || '失败', 'error');
      }
    } finally {
      setBusyMerge(false);
    }
  };

  const handleLoadMergedForRoadEdit = async () => {
    if (selectedJunId !== 'san_1_jun_yingchuan') {
      showToast('当前仅颍川郡支持道路编辑', 'info');
      return;
    }
    try {
      const url = `${import.meta.env.BASE_URL}data/worldmap/san_1_jun_yingchuan_merged.json`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data || !Array.isArray(data.cells)) throw new Error('无效合并图');
      setRoadEdit({
        cells: data.cells,
        mapColumns: data.mapColumns ?? 32,
        mapRows: data.mapRows ?? 40,
        roadCells: normalizeRoadCellList(data.roadCells),
        roadConnectivity: data.roadConnectivity === '8' ? '8' : ROAD_CONNECTIVITY_4,
      });
      showToast('已加载合并地图，可编辑道路格', 'success');
    } catch (e) {
      showToast(e?.message || '加载失败（请先在上方生成合并地图）', 'error');
    }
  };

  const handleBatchNpcGarrison = async () => {
    if (!selectedJunId) {
      showToast('请先选择郡', 'error');
      return;
    }
    const counts = {};
    for (const { key } of NPC_BATCH_CITY_TYPES) {
      const v = String(npcCountInputs[key] ?? '').trim();
      if (v !== '') counts[key] = v;
    }
    if (Object.keys(counts).length === 0) {
      showToast('请至少填写一种城市类型的守军支数（正整数，最大 2000）', 'error');
      return;
    }
    const jun = geoOptions?.jun?.find((j) => j.junId === selectedJunId);
    const season = jun?.season;
    setBusyNpcBatch(true);
    try {
      const res = await postBatchNpcGarrison(selectedJunId, npcOwnershipMode, counts, season);
      if (!res.success) {
        showToast(res.error || '批量生成失败', 'error');
        return;
      }
      const d = res.data || {};
      const u = d.updated ?? 0;
      const m = d.matchedTotal ?? 0;
      const sk = Array.isArray(d.skipped) ? d.skipped.length : 0;
      const fl = Array.isArray(d.failures) ? d.failures.length : 0;
      const totalJun = d.citiesInJun;
      const ownedJun = d.ownedCountInJun;
      const statExtra =
        totalJun != null
          ? `（郡内 cities 共 ${totalJun}，其中占城 ${ownedJun ?? '—'}）`
          : '';
      showToast(
        `已生成 ${u} 城（本模式匹配 ${m}；跳过 ${sk}；失败 ${fl}）${statExtra}`,
        fl > 0 ? 'error' : 'success',
      );
      if (typeof d.hint === 'string' && d.hint) {
        showToast(d.hint, 'info');
      }
      if (sk > 0) {
        showToast('跳过：该城 city_type 未填写对应支数', 'info');
      }
      if (fl > 0 && d.failures[0]) {
        showToast(`${d.failures[0].cityId}: ${d.failures[0].error}`, 'error');
      }
    } catch (e) {
      showToast(e?.message || '无法连接后端', 'error');
    } finally {
      setBusyNpcBatch(false);
    }
  };

  const handleSaveRoadCells = async () => {
    if (!roadEdit || selectedJunId !== 'san_1_jun_yingchuan') return;
    setBusyRoadSave(true);
    try {
      const res = await postSaveMergedRoadCells(
        selectedJunId,
        roadEdit.roadCells,
        roadEdit.roadConnectivity,
      );
      if (res.success) {
        showToast(
          `道路已写入 merged.json · version=${res.data?.version} · ${res.data?.roadCellCount ?? 0} 格`,
          'success',
        );
      } else {
        showToast(res.error || '保存失败', 'error');
      }
    } finally {
      setBusyRoadSave(false);
    }
  };

  if (adminLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center space-y-3">
          <p className="text-gray-800">此页面需要管理员权限。</p>
          <p className="text-sm text-gray-600">请在游戏首页通过管理员入口登录后再访问。</p>
          <a href={`${import.meta.env.BASE_URL}`} className="text-blue-600 hover:underline inline-block">
            返回游戏首页
          </a>
        </div>
      </div>
    );
  }

  const outerClass = embedded ? 'pb-8' : '';

  return (
    <>
      <Toast />
      <div className={`max-w-6xl mx-auto space-y-8 p-4 ${outerClass}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">三国地图</h1>
            <p className="text-sm text-gray-600 mt-1">
              郡大象限 preset → 生成预览（可填 seed 复现）→ 确认后下载 JSON 固化到{' '}
              <code className="bg-gray-100 px-1 rounded text-xs">shared/data/worldmap/</code>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[280px] flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">郡象限（preset 模板）</label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={junQuadId}
                onChange={(e) => setJunQuadId(e.target.value)}
              >
                {JUN_QUAD_PRESET_IDS.length === 0 && <option value="">暂无预设</option>}
                {JUN_QUAD_PRESET_IDS.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Seed（可选，整数）
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="留空 = 随机"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer pb-2">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={randomizeCityPositions}
                onChange={(e) => setRandomizeCityPositions(e.target.checked)}
              />
              城点在本块内随机
            </label>
            <button
              type="button"
              disabled={!preset}
              onClick={handleGenerate}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              生成预览
            </button>
            <button
              type="button"
              disabled={!preset || seed == null}
              onClick={handleDownloadPreset}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
            >
              固化（下载 preset JSON）
            </button>
          </div>

          {seed != null && (
            <p className="text-sm text-gray-700">
              当前 seed：{' '}
              <code className="bg-gray-100 px-2 py-0.5 rounded text-base font-mono">{seed}</code>
              <span className="text-gray-500 ml-2">
                （留空并再次「生成预览」可换随机图；勾选「城点随机」将按可通行格重投城位）
              </span>
            </p>
          )}

          <p className="text-xs text-gray-600 leading-relaxed">
            数据来源：
            <span className="text-sky-800 ml-1">
              郡地图 preset 由前端从 <code className="bg-gray-100 px-1">shared/data/worldmap/</code> 打包载入，无独立 GET
              API（与战役 preset 不同）。
            </span>
          </p>
        </div>

        <div className="relative z-10 bg-white rounded-lg shadow p-6 space-y-4 border border-slate-200">
          <h2 className="text-lg font-semibold text-gray-900">州 / 郡与数据库（M2）</h2>
          <p className="text-sm text-gray-600">
            选项来自 MySQL <code className="bg-gray-100 px-1">config_zhou</code> /{' '}
            <code className="bg-gray-100 px-1">config_jun</code>。若某郡四象限 preset 文件齐全（
            <code className="bg-gray-100 px-1 text-xs">{'{jun_id}_quad_A～D.preset.json'}</code>
            ），方可执行入库与生成（颍川郡已对齐）。
          </p>
          {geoLoadError && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {geoLoadError}
            </p>
          )}
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">州</label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
                value={geoLoading ? '' : zhouId}
                onChange={(e) => setZhouId(e.target.value)}
                disabled={geoLoading || !(geoOptions.zhou?.length > 0)}
              >
                {geoLoading ? (
                  <option value="">加载中…</option>
                ) : (geoOptions.zhou || []).length === 0 ? (
                  <option value="">无州数据</option>
                ) : (
                  (geoOptions.zhou || []).map((z) => (
                    <option key={z.zhouId} value={z.zhouId}>
                      {z.zhouName || z.zhouId}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="min-w-[220px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">郡</label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
                value={geoLoading ? '' : selectedJunId}
                onChange={(e) => setSelectedJunId(e.target.value)}
                disabled={geoLoading || junOptions.length === 0}
              >
                {geoLoading ? (
                  <option value="">加载中…</option>
                ) : junOptions.length === 0 ? (
                  <option value="">暂无郡（请先选有郡的州）</option>
                ) : (
                  junOptions.map((j) => (
                    <option key={j.junId} value={j.junId}>
                      {j.junName || j.junId}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
          {presetGate && (
            <p className={`text-sm ${presetGate.complete ? 'text-emerald-700' : 'text-amber-800'}`}>
              {presetGate.complete
                ? `四象限 preset 已就绪，可对「${selectedJunId}」执行入库 / 生成。`
                : `缺少文件：${(presetGate.missing || []).join(', ') || '未知'}`}
            </p>
          )}

          <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50/60">
            <h3 className="text-sm font-semibold text-gray-900">郡内 NPC 守军（批量）</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              使用上方<strong>州 / 郡</strong>当前选项。按城市归属分两档批量调用{' '}
              <code className="bg-white px-1 rounded border border-slate-200 text-[11px]">generateNpcGarrison</code> 与
              脚本 <code className="bg-white px-1 rounded border border-slate-200 text-[11px]">troopCountOverride</code>（支数
              1～2000）。仅对<strong>已填写支数</strong>的城市类型生效；某城类型未填则跳过该城。
            </p>
            <p className="text-xs text-amber-900/90 bg-amber-50 border border-amber-200/80 rounded px-2 py-1.5 leading-relaxed">
              <strong>「势力方」匹配规则</strong>：与攻城/NPC 补满一致 —{' '}
              <code className="bg-white/90 px-1 text-[11px]">faction_id</code> 非空且{' '}
              <code className="bg-white/90 px-1 text-[11px]">status = owned</code>。有叙事归属的城在导入脚本里会写成{' '}
              <code className="bg-white/90 px-1 text-[11px]">owned</code>；若库仍是旧数据（有势力却为 neutral），请在 backend 重跑{' '}
              <code className="bg-white/90 px-1 text-[11px]">node database/import-city-geo-data.js</code>，或暂用「归属 NPC 方」。
            </p>
            <div className="flex flex-wrap gap-6 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="npcOwnership"
                  checked={npcOwnershipMode === 'player_owned'}
                  onChange={() => setNpcOwnershipMode('player_owned')}
                  className="border-gray-400"
                />
                <span>归属势力方（占城：faction 非空且 status=owned）</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="npcOwnership"
                  checked={npcOwnershipMode === 'npc_side'}
                  onChange={() => setNpcOwnershipMode('npc_side')}
                  className="border-gray-400"
                />
                <span>归属 NPC 方（非上述占城态：中立等）</span>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {NPC_BATCH_CITY_TYPES.map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="留空 = 不处理该类型"
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                    value={npcCountInputs[key]}
                    onChange={(e) =>
                      setNpcCountInputs((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={!selectedJunId || busyNpcBatch}
              onClick={handleBatchNpcGarrison}
              className="px-4 py-2 bg-rose-700 text-white rounded-md hover:bg-rose-800 disabled:opacity-50 text-sm"
            >
              {busyNpcBatch ? '批量生成中…' : '按郡批量生成 NPC 守军'}
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!selectedJunId || !presetGate?.complete || busyCoords}
              onClick={handleCoordinatesToDb}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 text-sm"
            >
              {busyCoords ? '坐标入库…' : '坐标入库'}
            </button>
            <button
              type="button"
              disabled={!selectedJunId || busyBounds}
              onClick={handleBoundariesToDb}
              className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 text-sm"
            >
              {busyBounds ? '边界入库…' : '边界入库'}
            </button>
            <button
              type="button"
              disabled={
                selectedJunId !== 'san_1_jun_yingchuan' || !presetGate?.complete || busyMerge
              }
              onClick={handleGenerateMergedMap}
              className="px-4 py-2 bg-violet-700 text-white rounded-md hover:bg-violet-800 disabled:opacity-50 text-sm"
              title={
                selectedJunId !== 'san_1_jun_yingchuan'
                  ? '当前仅颍川郡 san_1_jun_yingchuan 支持服务端合并写出'
                  : ''
              }
            >
              {busyMerge ? '生成地图…' : '生成地图'}
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              邻接边 JSON（config_jun_node）— 二维数组，如{' '}
              <code className="bg-gray-100 px-1 text-xs">[[&quot;san_1_jun_a&quot;,&quot;san_1_jun_b&quot;]]</code>
            </label>
            <textarea
              className="w-full min-h-[72px] border border-gray-300 rounded-md px-3 py-2 text-xs font-mono"
              value={boundariesJson}
              onChange={(e) => setBoundariesJson(e.target.value)}
              spellCheck={false}
            />
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            <strong>生成地图</strong> 写入{' '}
            <code className="bg-gray-100 px-1">public/data/worldmap/san_1_jun_yingchuan_merged.json</code>（与主界面大地图
            读取路径一致），并带 <code className="bg-gray-100 px-1">version</code>。原先无该文件时，主界面用内存即时生成；生成后优先读此文件。
          </p>
          <p className="text-xs text-amber-900/90 leading-relaxed mt-1.5 border border-amber-200/80 bg-amber-50/80 rounded px-2 py-1.5">
            若在本机用命令行跑{' '}
            <code className="bg-white/80 px-1 text-[11px]">node scripts/worldmap-merge-yingchuan.mjs --out …</code> 写同一文件，大改或不确定时请先<strong>备份</strong>该
            JSON；脚本会尽量保留已有 <code className="bg-white/80 px-1 text-[11px]">roadCells</code>，但 <code className="bg-white/80 px-1 text-[11px]">--out</code>{' '}
            指错路径或目标里已无道路时仍会丢层。优先用本页按钮走服务端合并更稳妥。
          </p>

          <div className="border-t border-slate-200 pt-4 mt-2 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">道路层（颍川合并图）</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              以 <strong>道路格集合</strong> <code className="bg-gray-100 px-1">roadCells</code> 为准（郡内{' '}
              <code className="bg-gray-100 px-1">gx, gy</code>）；寻路与叠线均用同一套{' '}
              <code className="bg-gray-100 px-1">roadConnectivity</code>（四连通 / 八连通）。重新「生成地图」会<strong>保留</strong>已有{' '}
              <code className="bg-gray-100 px-1">roadCells</code>；若新城/改城导致路与禁区重叠，请在本页擦除或改线后再保存（保存时服务端会拒绝压在城/关/据点占位上的格）。
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={selectedJunId !== 'san_1_jun_yingchuan'}
                onClick={handleLoadMergedForRoadEdit}
                className="px-3 py-1.5 bg-slate-700 text-white rounded-md hover:bg-slate-800 disabled:opacity-50 text-sm"
                title={
                  selectedJunId !== 'san_1_jun_yingchuan'
                    ? '仅颍川郡'
                    : '从 public 读取合并 JSON'
                }
              >
                加载合并图（道路编辑）
              </button>
              <button
                type="button"
                disabled={!roadEdit || busyRoadSave}
                onClick={handleSaveRoadCells}
                className="px-3 py-1.5 bg-teal-700 text-white rounded-md hover:bg-teal-800 disabled:opacity-50 text-sm"
              >
                {busyRoadSave ? '保存中…' : '保存道路到服务器'}
              </button>
              <button
                type="button"
                disabled={!roadEdit}
                onClick={() => setRoadEdit(null)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                关闭编辑器
              </button>
              <button
                type="button"
                disabled={!roadEdit}
                onClick={() =>
                  setRoadEdit((prev) =>
                    prev ? { ...prev, roadCells: [], roadConnectivity: ROAD_CONNECTIVITY_4 } : null,
                  )
                }
                className="px-3 py-1.5 border border-amber-300 text-amber-900 rounded-md text-sm hover:bg-amber-50 disabled:opacity-50"
              >
                清空道路格
              </button>
            </div>
            {roadEdit && (
              <div className="w-full min-w-0">
                <StrategicRoadCellsEditor
                  cells={roadEdit.cells}
                  mapColumns={roadEdit.mapColumns}
                  mapRows={roadEdit.mapRows}
                  roadCells={roadEdit.roadCells}
                  onRoadCellsChange={(next) => setRoadEdit((prev) => (prev ? { ...prev, roadCells: next } : null))}
                  connectivity={roadEdit.roadConnectivity}
                  onConnectivityChange={(c) =>
                    setRoadEdit((prev) => (prev ? { ...prev, roadConnectivity: c } : null))
                  }
                />
              </div>
            )}
          </div>
        </div>

        {seed == null && (
          <div className="rounded-md bg-gray-50 border border-gray-200 px-4 py-6 text-sm text-gray-600 text-center">
            请选择 preset 并点击「生成预览」查看地图；可填写 Seed 复现某张底板；城点可与叙事稿坐标一致或勾选「本块内随机」。
          </div>
        )}

        {result && (
          <>
            <div className="flex flex-wrap gap-4 text-xs text-gray-700">
              <span>
                格内素材：<code className="bg-gray-100 px-1">public/assets/san_1_map/</code>；城点{' '}
                <code className="bg-gray-100 px-1">tile_3_object/city_*_01.png</code>（small / medium / major）；关隘{' '}
                <code className="bg-gray-100 px-1">city_gate_01.png</code>；据点{' '}
                <code className="bg-gray-100 px-1">city_fort_01_empty.png</code> /{' '}
                <code className="bg-gray-100 px-1">city_fort_01_built.png</code>（见 31-5 §10）
              </span>
              <span className="text-gray-500">虚线框：战役象限 A/B/C/D（对应郡内 A1/A2/A4/A3）</span>
            </div>

            <CampaignMapGrid
              cells={result.cells}
              seed={result.seed}
              title="三国地图 · 郡大象限（16×20）"
              meta={
                <>
                  底板生成与战役地图相同管线（<code className="bg-gray-100 px-1">generateCampaignMapSimulated</code>
                  ）；城点由 <code className="bg-gray-100 px-1">strategic_cities</code> 叠加，预设据点由{' '}
                  <code className="bg-gray-100 px-1">strategic_forts</code> 叠加（<code className="bg-gray-100 px-1">object=fort</code>
                  ，坐标固定、不受「城点随机」影响）。
                  <br />
                  <span className="text-gray-500">详见 docs/tools/map、31-5-WORLD_MAP_GENERATION.md（§九 管线、§十 fort）</span>
                </>
              }
              showStaticNpcUnits={false}
            />

            <p className="text-xs text-gray-500">
              无战役 NPC；悬停格可查看 gx/gy 与城点 / 据点 <code className="bg-gray-100 px-1">fort_id</code>（与郡 quad 叙事稿、
              <code className="bg-gray-100 px-1">cities_fort_slots_template.csv</code> 对齐）。
            </p>
          </>
        )}
      </div>
    </>
  );
}
