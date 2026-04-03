import { useMemo, useState, useEffect } from 'react';
import {
  generateCampaignMapSimulated,
  CAMPAIGN_PRESET_SAN_1_CAMP_1001_V1,
} from '@shared/utils/campaignMapGenerator';
import { API_CONFIG } from '@/constants';
import CampaignMapGrid from '@/components/campaign/CampaignMapGrid';

/**
 * 战役地图模拟预览（16×20，四象限 A/B/C/D）
 * 叠层与 Event 战 BattleTile 一致：tile_1_bg / tile_2_terrain / tile_3_object / tile_3_effect
 */
export default function CampaignMapDemoPage() {
  const [apiOk, setApiOk] = useState(null);
  const [apiError, setApiError] = useState('');

  const result = useMemo(
    () =>
      generateCampaignMapSimulated(CAMPAIGN_PRESET_SAN_1_CAMP_1001_V1, {
        seed: CAMPAIGN_PRESET_SAN_1_CAMP_1001_V1.seed,
      }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    const base = API_CONFIG.BASE_URL.replace(/\/$/, '');
    fetch(`${base}/campaign/presets/san_1_camp_1001_v1`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.success && j.preset?.campaign_id === 'san_1_camp_1001_v1') setApiOk(true);
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
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">战役地图 · 模拟生成 Demo</h1>
        <p className="text-gray-600 mt-2 text-sm leading-relaxed">
          预设：<code className="bg-gray-100 px-1 rounded">san_1_camp_1001_v1</code>（长社之战）· seed{' '}
          <code className="bg-gray-100 px-1">{result.seed}</code> · 与{' '}
          <code className="bg-gray-100 px-1">shared/utils/campaignMapGenerator.js</code> 及{' '}
          <code className="bg-gray-100 px-1">shared/data/campaign/san_1_camp_1001_v1.preset.json</code>{' '}
          一致。后端校验：
          {apiOk === true && (
            <span className="text-emerald-700 ml-1">GET /api/campaign/presets/san_1_camp_1001_v1 已对齐</span>
          )}
          {apiOk === false && (
            <span className="text-amber-700 ml-1">API 不可用（{apiError || 'offline'}），仅本地 preset 演示</span>
          )}
          {apiOk === null && <span className="text-gray-500 ml-1">校验中…</span>}
        </p>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-gray-700">
        <span>
          格内素材：<code className="bg-gray-100 px-1">public/assets/san_1_map/</code>（与 BattleMap 相同）；部队缩略图在{' '}
          <code className="bg-gray-100 px-1">public/assets/san_1_battle/</code>
          下按 <code className="bg-gray-100 px-1">quad_*_forces</code> 五档子目录（player / ally1 / ally2 / team / enemy）；卡面与编组界面仍用{' '}
          <code className="bg-gray-100 px-1">san_1_ui_card/troop/</code>
        </span>
        <span>底板 plain_grassland / plain_wasteland；地形 forest / hill / siege / river（lake/ford/road 无 PNG 时用半透明占位）</span>
        <span>对象：fence、military_tower、military_camp（2×1）；火焰 fire → tile_3_effect；象限 A/B/D 显示 NPC 部队缩略图</span>
        <span className="text-gray-500">虚线框：象限 A左上 B右上 C右下 D左下</span>
      </div>

      <CampaignMapGrid
        cells={result.cells}
        seed={result.seed}
        meta={
          <>
            与小型战斗地图相同素材路径；若本地未放入 PNG，底板/地形会回退为纯色块。
            <br />
            <span className="text-gray-500">详见 docs/tools/campaign/campaign-map-tile-ids.md</span>
          </>
        }
      />

      <p className="text-xs text-gray-500">
        说明：塔/栅/军营与 NPC 部队仅落在象限内<strong>最大可通行陆块</strong>；底板以绿地为主、荒地为链状延伸（类河流游走），象限缝与象限内均有软化；本象限<strong>每边最多 3 支</strong>，超出优先溢邻象限；部队数按 preset 中{' '}
        <code className="bg-gray-100 px-1">san_1_troop_*:N</code> 累加展开。战役运行时契约可后续再对齐。
      </p>
    </div>
  );
}
