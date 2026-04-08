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

  const preset = useMemo(() => (junQuadId ? getJunQuadPresetById(junQuadId) : null), [junQuadId]);

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
                <code className="bg-gray-100 px-1">tile_3_object/city_*_01.png</code>
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
                  ）；城点由 <code className="bg-gray-100 px-1">strategic_cities</code> 叠加。
                  <br />
                  <span className="text-gray-500">详见 docs/tools/map 与 31-5-WORLD_MAP_GENERATION.md</span>
                </>
              }
              showStaticNpcUnits={false}
            />

            <p className="text-xs text-gray-500">
              无战役 NPC；悬停格可查看 gx/gy 与城点配置 ID（与郡叙事稿 / CSV 对齐）。
            </p>
          </>
        )}
      </div>
    </>
  );
}
