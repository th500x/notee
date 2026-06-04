/**
 * PvP 对决地图（管理员）：按 rule_profile 模板 + seed 预览 8×10，满意后下载 preset JSON。
 */

import { useMemo, useState, useEffect } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import {
  RULE_PROFILE_IDS,
  buildTemplatePreset,
  getPvpDuelRuleTemplate,
  PVP_DUEL_GENERATOR_VERSION,
} from '@shared/utils/pvpDuelMapRuleTemplates';
import {
  generatePvpDuelMap,
  randomDuelMapSeed,
} from '@shared/utils/pvpDuelMapGenerator';
import { DUEL_MAP_PRESET_IDS } from '@shared/utils/pvpDuelMapCatalog';
import BattleMap from '@/components/battle/BattleMap';
import { useAdminToast } from '@/components/admin/useAdminToast';
import '@/components/battle/BattleMap.css';

export default function PvpDuelMapGeneratorManager() {
  const { isLoggedIn, loading: adminLoading } = useAdmin();
  const { showToast, Toast } = useAdminToast();
  const [ruleProfile, setRuleProfile] = useState(() => RULE_PROFILE_IDS[0] || 'balanced');
  const [duelMapIdInput, setDuelMapIdInput] = useState('');
  const [seed, setSeed] = useState(null);
  const [seedInput, setSeedInput] = useState('');

  const templatePreset = useMemo(
    () => (ruleProfile ? buildTemplatePreset(ruleProfile) : null),
    [ruleProfile],
  );

  const profileMeta = useMemo(
    () => (ruleProfile ? getPvpDuelRuleTemplate(ruleProfile) : null),
    [ruleProfile],
  );

  const mapResult = useMemo(() => {
    if (!templatePreset || seed == null) return null;
    return generatePvpDuelMap(templatePreset, { seed });
  }, [templatePreset, seed]);

  useEffect(() => {
    setSeed(null);
    setSeedInput('');
  }, [ruleProfile]);

  const handleGenerate = () => {
    if (!templatePreset) {
      showToast('未找到该 rule_profile 模板', 'error');
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
    setSeed(randomDuelMapSeed());
  };

  const handleDownloadPreset = () => {
    if (!templatePreset || seed == null) {
      showToast('请先生成预览', 'info');
      return;
    }
    const duelMapId = duelMapIdInput.trim() || `san_1_duel_${ruleProfile}_${seed}`;
    const out = {
      duel_map_id: duelMapId,
      rule_profile: ruleProfile,
      generator_version: PVP_DUEL_GENERATOR_VERSION,
      seed,
      base: { ...templatePreset.base },
      rules: JSON.parse(JSON.stringify(templatePreset.rules)),
      canonical: { ...templatePreset.canonical },
      notes: `管理员页 seed=${seed} 固化；非镜像随机。`,
    };
    const blob = new Blob([JSON.stringify(out, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${duelMapId}.preset.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(
      '已下载 preset JSON，请放入 shared/data/pvp-duel/ 并在 pvpDuelMapCatalog.js 登记 id',
      'success',
    );
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
            <h1 className="text-2xl font-bold text-gray-900">对决地图</h1>
            <p className="text-sm text-gray-600 mt-1">
              选择 rule_profile → 8×10 预览（可填 seed）→ 下载 JSON 固化到{' '}
              <code className="bg-gray-100 px-1 rounded text-xs">shared/data/pvp-duel/</code>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              规则与工程规范见 docs/tools/map/PVP_DUEL_MAP_RULES.md。已登记固化图：{' '}
              {DUEL_MAP_PRESET_IDS.length ? DUEL_MAP_PRESET_IDS.join(', ') : '（无）'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[220px] flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">rule_profile</label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={ruleProfile}
                onChange={(e) => setRuleProfile(e.target.value)}
              >
                {RULE_PROFILE_IDS.map((id) => (
                  <option key={id} value={id}>
                    {getPvpDuelRuleTemplate(id)?.label || id} ({id})
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[240px] flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                duel_map_id（固化文件名，可选）
              </label>
              <input
                type="text"
                placeholder="留空则按 profile+seed 自动生成"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
                value={duelMapIdInput}
                onChange={(e) => setDuelMapIdInput(e.target.value)}
              />
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
              disabled={!templatePreset}
              onClick={handleGenerate}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              生成预览
            </button>
            <button
              type="button"
              disabled={!templatePreset || seed == null}
              onClick={handleDownloadPreset}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
            >
              固化（下载 preset JSON）
            </button>
          </div>

          {profileMeta && (
            <p className="text-xs text-gray-600">
              模板复杂度：<code className="bg-gray-100 px-1">{profileMeta.base?.forceComplexity || '—'}</code>
              {' · '}
              禁 chest/trap · 分侧独立随机（非镜像）
            </p>
          )}

          {seed != null && (
            <p className="text-sm text-gray-700">
              当前 seed：{' '}
              <code className="bg-gray-100 px-2 py-0.5 rounded text-base font-mono">{seed}</code>
            </p>
          )}
        </div>

        {seed == null && (
          <div className="rounded-md bg-gray-50 border border-gray-200 px-4 py-6 text-sm text-gray-600 text-center">
            请选择 rule_profile 并点击「生成预览」；满意后填写 duel_map_id（可选）并下载 JSON。
          </div>
        )}

        {mapResult && (
          <div className="bg-[#12121e] rounded-lg border border-gray-700 p-4 overflow-x-auto">
            <p className="text-xs text-[#999] mb-3">
              复杂度 {mapResult.meta?.complexity} · 交战非平原 {mapResult.meta?.combatNonPlain} · 障碍{' '}
              {mapResult.meta?.obstacleCount} · 底色 {mapResult.variants?.bgTheme}
            </p>
            <BattleMap
              mapResult={mapResult}
              mapLabel={`${profileMeta?.label || ruleProfile} · seed ${seed}`}
              battleTroops={[]}
              showTroops={false}
              isBattle={false}
              highlightPlayerDeployZone
              autoBattle
            />
            <p className="text-xs text-gray-500 mt-3">
              北三行 deployA（攻）· 南三行 deployB（守）· 中间 combat。列 0、7 默认禁放障碍。
            </p>
          </div>
        )}
      </div>
    </>
  );
}
