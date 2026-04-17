/**
 * ExploreTab - 探索Tab页
 *
 * @description 正式游戏中的探索功能，替代 ExploreDemo
 *              使用 PlayerContext 真实数据，通过 useEventSystem hook 驱动
 *              探索点与大地图一致：默认主城 `DEFAULT_EXPLORE_LOCATION_ID`（荒郊与 `cities` 同行 `wildernessEnabled`）
 */

import { useState } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import useEventSystem, { DEFAULT_EXPLORE_LOCATION_ID } from '@/hooks/useEventSystem';
import ExplorePanel from '@/components/event/ExplorePanel';
import { PHASE } from '@/components/event/EventConstants';

export default function ExploreTab({ onClose }) {
  const { player, cards } = usePlayerContext();
  const eventSystem = useEventSystem(player, cards);
  const { phase, quota, eventsLoading, explorePoolAt, startExplore } = eventSystem;

  const [exploreHover, setExploreHover] = useState(null);

  const bgPath = 'assets/san_1_map/illus_bg/av1_00001_.png';
  const baseUrl = import.meta.env.BASE_URL;

  const poolLen = explorePoolAt(DEFAULT_EXPLORE_LOCATION_ID).length;
  const canExplore =
    phase === PHASE.IDLE && !eventsLoading && poolLen > 0 && quota.canExplore;
  const poolEmpty = phase === PHASE.IDLE && !eventsLoading && poolLen <= 0;

  const quotaBlock = (
    <>
      <div className="text-white/80 text-xs mt-1 border-t border-white/20 pt-1">
        🔍 探索：<span className={quota.remaining > 0 ? 'text-green-400' : 'text-red-400'}>
          {quota.remaining}/{quota.max}
        </span>
        {quota.remaining < quota.max && !quota.inRestPeriod && (
          <span className="text-white/40 ml-1">（{quota.minutesUntilRefill}分后补充）</span>
        )}
        {quota.inRestPeriod && (
          <span className="text-white/40 ml-1">（💤{quota.minutesUntilRefill}分后恢复）</span>
        )}
      </div>
      <div className="text-white/30 text-[10px] mt-1">
        每小时+{quota.refillPerHour}次 · 上限{quota.max}次 · 0:00~8:00💤
      </div>
    </>
  );

  return (
    <div className="relative w-full h-full">
      {/* 概念背景图 */}
      <div className="absolute inset-0 bg-cover bg-center overflow-hidden"
        style={{ backgroundImage: `url(${baseUrl}${bgPath})` }}>
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* 顶部信息栏 */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10">
        <div className="px-4 py-2 bg-black/60 rounded-lg backdrop-blur-sm">
          <h2 className="text-white font-bold text-lg">🗺️ 探索</h2>
          <p className="text-white/60 text-xs mt-1">点击地图上的探索点触发事件</p>
        </div>
        <div className="flex items-start gap-2">
          <div className="px-4 py-2 bg-black/60 rounded-lg backdrop-blur-sm text-right">
            <div className="text-white text-sm font-medium">
              🔍 探索次数：<span className={quota.remaining > 0 ? 'text-green-400' : 'text-red-400'}>
                {quota.remaining}/{quota.max}
              </span>
            </div>
            <div className="text-white/50 text-xs mt-1">
              {quota.remaining < quota.max ? `${quota.minutesUntilRefill}分钟后补充` : '已满'}
            </div>
          </div>
          {onClose && (
            <button onClick={onClose}
              className="px-3 py-2 bg-black/60 rounded-lg backdrop-blur-sm text-white/70 hover:text-white text-sm">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 探索点（与 DEFAULT_EXPLORE_LOCATION_ID 一致） */}
      <div
        className={`absolute z-10 group ${canExplore ? 'cursor-pointer' : 'cursor-not-allowed'}`}
        style={{ left: '35%', top: '55%' }}
        onMouseEnter={() => setExploreHover('wilderness')}
        onMouseLeave={() => setExploreHover(null)}
        onClick={canExplore ? () => startExplore(DEFAULT_EXPLORE_LOCATION_ID) : undefined}>
        {canExplore && (
          <div className="absolute inset-0 -m-4 rounded-full bg-amber-400/30 animate-ping" />
        )}
        <div className={`relative text-4xl select-none transition-transform
          ${canExplore ? 'hover:scale-125 active:scale-95' : ''}
          ${poolEmpty ? 'grayscale opacity-[0.38] brightness-[0.82] saturate-50' : !canExplore ? 'opacity-60' : ''}`}>📜</div>
        {exploreHover === 'wilderness' && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black/80 rounded-lg backdrop-blur-sm whitespace-nowrap">
            <div className="text-white text-sm font-medium">阳翟荒郊</div>
            <div className="text-white/60 text-xs">
              {eventsLoading ? '加载事件中...'
                : !quota.canExplore ? '探索次数不足'
                : poolEmpty ? '本地点暂无可探索事件'
                : `点击探索（${poolLen}种事件）`}
            </div>
            {poolEmpty && quota.canExplore && (
              <div className="text-white/45 text-[10px] mt-0.5">次日 0 点（服务器日期）后事件链等进度将重置</div>
            )}
            {quotaBlock}
          </div>
        )}
      </div>

      {/* 事件面板（所有弹窗） */}
      <ExplorePanel eventSystem={eventSystem} />
    </div>
  );
}
