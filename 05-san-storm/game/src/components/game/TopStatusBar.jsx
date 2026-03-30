/**
 * 顶部状态栏
 * 
 * @description 56px固定顶部，显示页面标题 + 四大资源 + 设置按钮
 */

import { useState, useEffect, useMemo } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { computeDisplayGameDate } from '@/utils/gameTime';

const TAB_TITLES = {
  lineup: '编组配置',
  faction: '势力管理',
  city: '主城',
  map: '世界地图',
};

function ResourceBadge({ icon, value, low = false }) {
  return (
    <div className={`flex items-center space-x-0.5 rounded-full px-1.5 py-0.5 text-xs
      ${low ? 'bg-red-500/30 animate-pulse' : 'bg-black/20'}`}>
      <span>{icon}</span>
      <span className="text-white font-medium">{value ?? '-'}</span>
    </div>
  );
}

export default function TopStatusBar({ activeTab, onOpenSidebar }) {
  const { player, loading, gameTime } = usePlayerContext();
  const [timeTick, setTimeTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTimeTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);

  /** 大地图（activeTab=null）不显示左侧标题，仅保留游戏日期，避免竖屏拥挤 */
  const title = activeTab == null ? null : TAB_TITLES[activeTab] || '真三風雲';

  const mapGameDate = useMemo(() => {
    void timeTick;
    if (activeTab !== null || !gameTime) return null;
    return computeDisplayGameDate(gameTime);
  }, [activeTab, gameTime, timeTick]);

  return (
    <div className="fixed top-0 left-0 right-0 h-14 z-50 bg-gradient-to-r from-amber-900 to-amber-800 flex items-center px-3 shadow-lg">
      {/* 左侧：子页面标题；大地图仅游戏历法 */}
      <div className="flex-shrink-0 mr-2 sm:mr-3 flex items-center min-w-0 gap-2">
        {title != null && title !== '' && (
          <span className="text-white text-lg font-bold truncate">{title}</span>
        )}
        {mapGameDate && (
          <span
            className="text-amber-100/90 text-xs sm:text-sm font-semibold whitespace-nowrap tabular-nums shrink-0"
            title={`锚点：${gameTime.anchorAt} · ${gameTime.realHoursPerGameDay}现实小时/游戏日`}
          >
            公元{mapGameDate.year}年{mapGameDate.month}月{mapGameDate.day}日
          </span>
        )}
      </div>

      {/* 中间留空（预留事件系统） + 右侧资源 */}
      <div className="flex-1 flex items-center justify-end gap-2 sm:gap-20 overflow-x-auto">
        {loading ? (
          <span className="text-white/60 text-xs">加载中...</span>
        ) : (
          <>
            <ResourceBadge icon="🎖️" value={player?.reputation} />
            <ResourceBadge icon="🤝" value={player?.contribution} />
            <ResourceBadge icon="💰" value={player?.silver} low={player?.silver < 10} />
            <ResourceBadge icon="🌾" value={player?.food} low={player?.food < 100} />
          </>
        )}
      </div>

      {/* 右侧：设置按钮 */}
      <button
        onClick={onOpenSidebar}
        className="flex-shrink-0 ml-3 sm:ml-20 text-xl text-white/80 hover:text-white active:scale-95 transition-all"
        aria-label="个人中心"
      >
        ⚙️
      </button>
    </div>
  );
}
