/**
 * 地图 Tab 右侧：战役中心入口卡片（尺寸与 WorldMapFactionThumb 一致）
 */

import TabNotifyDot from '@/components/game/TabNotifyDot';

const CAMPAIGN_BORDER = '#d97706';
const CAMPAIGN_BG = 'rgba(217, 119, 6, 0.12)';

/**
 * @param {{ onOpen?: () => void, showNotifyDot?: boolean }} props
 */
export default function WorldMapCampaignCenterThumb({ onOpen, showNotifyDot = false }) {
  if (typeof onOpen !== 'function') return null;

  return (
    <button
      type="button"
      data-world-map-campaign-center-thumb
      className="flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-lg border-2 px-2 py-2 text-center transition-colors hover:bg-stone-900/40"
      style={{
        borderColor: CAMPAIGN_BORDER,
        backgroundColor: CAMPAIGN_BG,
      }}
      aria-label={showNotifyDot ? '战役中心，有可攻略战役' : '战役中心'}
      onClick={onOpen}
    >
      <span className="relative inline-flex text-2xl leading-none" aria-hidden>
        ⚔️
        {showNotifyDot ? <TabNotifyDot /> : null}
      </span>
      <span className="w-full truncate text-xs font-semibold leading-tight text-stone-100">战役中心</span>
      <span className="text-[10px] text-stone-400">历史战役</span>
    </button>
  );
}
