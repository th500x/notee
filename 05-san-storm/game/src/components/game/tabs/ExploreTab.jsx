/**
 * ExploreTab - 探索Tab页
 * 
 * @description 正式游戏中的探索功能，替代 ExploreDemo
 *              使用 PlayerContext 真实数据，通过 useEventSystem hook 驱动
 */

import { useState } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import useEventSystem from '@/hooks/useEventSystem';
import ExplorePanel from '@/components/event/ExplorePanel';
import { PHASE } from '@/components/event/EventConstants';

export default function ExploreTab({ onClose }) {
  const { player, cards } = usePlayerContext();
  const eventSystem = useEventSystem(player, cards);
  const { phase, quota, eventsLoading, exploreEvents, startExplore } = eventSystem;

  const [showTooltip, setShowTooltip] = useState(false);

  const bgPath = 'assets/san_1_map/illus_bg/av1_00001_.png';
  const baseUrl = import.meta.env.BASE_URL;

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

      {/* 探索点 */}
      <div className="absolute z-10 cursor-pointer group" style={{ left: '35%', top: '55%' }}
        onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}
        onClick={phase === PHASE.IDLE && !eventsLoading && exploreEvents.length > 0 ? startExplore : undefined}>
        <div className="absolute inset-0 -m-4 rounded-full bg-amber-400/30 animate-ping" />
        <div className={`relative text-4xl select-none transition-transform
          ${phase === PHASE.IDLE && quota.canExplore && exploreEvents.length > 0
            ? 'hover:scale-125 active:scale-95' : 'opacity-60'}`}>📜</div>
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black/80 rounded-lg backdrop-blur-sm whitespace-nowrap">
            <div className="text-white text-sm font-medium">南阳荒郊</div>
            <div className="text-white/60 text-xs">
              {eventsLoading ? '加载事件中...' : quota.canExplore ? `点击探索（${exploreEvents.length}种事件）` : '探索次数不足'}
            </div>
          </div>
        )}
      </div>

      {/* 事件面板（所有弹窗） */}
      <ExplorePanel eventSystem={eventSystem} />
    </div>
  );
}
