/**
 * 战役地图（管理员）：按 preset 随机 seed 预览，满意后可下载带 seed 的 preset JSON 以固化到仓库。
 */

import { useMemo, useState, useEffect } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import {
  generateCampaignMapSimulated,
  getCampaignPresetById,
  CAMPAIGN_PRESET_IDS,
  randomCampaignMapSeed,
} from '@shared/utils/campaignMapGenerator';
import { API_CONFIG } from '@/constants';
import { fetchWithTimeout } from '@/services/httpClient';
import CampaignMapGrid from '@/components/campaign/CampaignMapGrid';
import { useAdminToast } from '@/components/admin/useAdminToast';

export default function CampaignMapGeneratorManager() {
  const { isLoggedIn, loading: adminLoading } = useAdmin();
  const { showToast, Toast } = useAdminToast();
  const [campaignId, setCampaignId] = useState(() => CAMPAIGN_PRESET_IDS[0] || '');
  const [seed, setSeed] = useState(null);
  /** 可选：手动输入整数 seed，留空则「随机生成」时用随机 seed */
  const [seedInput, setSeedInput] = useState('');
  const [apiOk, setApiOk] = useState(null);
  const [apiError, setApiError] = useState('');

  const preset = useMemo(() => (campaignId ? getCampaignPresetById(campaignId) : null), [campaignId]);

  const result = useMemo(() => {
    if (!preset || seed == null) return null;
    return generateCampaignMapSimulated(preset, { seed });
  }, [preset, seed]);

  useEffect(() => {
    setSeed(null);
    setSeedInput('');
  }, [campaignId, preset]);

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    const base = API_CONFIG.BASE_URL.replace(/\/$/, '');
    fetchWithTimeout(`${base}/campaign/presets/${campaignId}`)
      .then((r) => {
        if (cancelled) return null;
        if (!r.ok) {
          setApiOk(false);
          setApiError(`HTTP ${r.status}`);
          return null;
        }
        return r.json();
      })
      .then((j) => {
        if (cancelled || j == null) return;
        if (j.success && j.preset?.campaign_id === campaignId) setApiOk(true);
        else setApiOk(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setApiOk(false);
          setApiError(e.message || 'fetch failed');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const handleGenerate = () => {
    if (!preset) {
      showToast('未找到该战役 preset', 'error');
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
    delete out.battle_tactical_quad;
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${campaignId}.preset.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已下载 preset JSON，可将文件覆盖 shared/data/campaign/ 下同名文件以固化');
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

  return (
    <>
      <Toast />
      <div className="max-w-6xl mx-auto space-y-8 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">战役地图</h1>
            <p className="text-sm text-gray-600 mt-1">
              选择战役 preset → 生成预览（可填 seed 复现）→ 确认后下载 JSON 固化到{' '}
              <code className="bg-gray-100 px-1 rounded text-xs">shared/data/campaign/</code>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[280px] flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">战役（preset 模板）</label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
              >
                {CAMPAIGN_PRESET_IDS.length === 0 && <option value="">暂无预设</option>}
                {CAMPAIGN_PRESET_IDS.map((id) => (
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
                （Seed 留空并再次「生成预览」可换随机图；或填上式数字以复现）
              </span>
            </p>
          )}

          <p className="text-xs text-gray-600 leading-relaxed">
            后端校验：
            {apiOk === true && (
              <span className="text-emerald-700 ml-1">GET /api/campaign/presets/{campaignId} 已对齐</span>
            )}
            {apiOk === false && (
              <span className="text-amber-700 ml-1">API 不可用（{apiError || 'offline'}），仅本地 preset</span>
            )}
            {apiOk === null && campaignId && <span className="text-gray-500 ml-1">校验中…</span>}
          </p>
        </div>

        {seed == null && (
          <div className="rounded-md bg-gray-50 border border-gray-200 px-4 py-6 text-sm text-gray-600 text-center">
            请选择战役并点击「生成预览」查看地图；可填写 Seed 复现某张图；满意后使用「固化」下载带当前 seed 的 preset 文件。
          </div>
        )}

        {result && (
          <>
            <div className="flex flex-wrap gap-4 text-xs text-gray-700">
              <span>
                格内素材：<code className="bg-gray-100 px-1">public/assets/san_1_map/</code>；部队缩略图{' '}
                <code className="bg-gray-100 px-1">public/assets/san_1_battle/</code> 五档子目录
              </span>
              <span className="text-gray-500">虚线框：象限 A/B/C/D</span>
            </div>

            <CampaignMapGrid
              cells={result.cells}
              seed={result.seed}
              meta={
                <>
                  与小型战斗地图相同素材路径；未放入 PNG 时底板/地形回退为纯色块。
                  <br />
                  <span className="text-gray-500">详见 docs/tools/campaign/CAMPAIGN_MAP.md</span>
                </>
              }
            />

            <p className="text-xs text-gray-500">
              塔/栅/军营与 NPC 仅落在象限内最大可通行陆块；本象限每边最多 3 支部队标记；展开数量来自 preset 中{' '}
              <code className="bg-gray-100 px-1">san_1_troop_*:N</code>。
            </p>
          </>
        )}
      </div>
    </>
  );
}
