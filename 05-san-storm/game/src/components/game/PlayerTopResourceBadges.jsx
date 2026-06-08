/**
 * 顶栏同款四项资源：声望 · 贡献 · 银两 · 粮草（与 `TopStatusBar` 一致）。
 * 用于大地图顶栏、三公府封赏卡池抽屉等需与主界面资源口径对齐的场景。
 */

import { usePlayerContext } from '@/contexts/PlayerContext';

export function ResourceBadge({ icon, value, low = false, compact = false }) {
  return (
    <div
      className={`flex items-center rounded-full text-white ${
        compact ? 'space-x-0 px-1 py-0.5 text-[10px] leading-tight' : 'space-x-0.5 px-1.5 py-0.5 text-xs'
      } ${low ? 'bg-red-500/30 animate-pulse' : 'bg-black/20'}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="font-medium tabular-nums">{value ?? '-'}</span>
    </div>
  );
}

/**
 * @param {string} [className] — 外层容器 class
 * @param {'map'|'panel'} [variant] — map：顶栏琥珀底；panel：深底抽屉标题栏
 */
export default function PlayerTopResourceBadges({ className = '', variant = 'map' }) {
  const { player, loading } = usePlayerContext();

  if (loading) {
    const loadingCls =
      variant === 'panel'
        ? 'text-stone-400 text-[10px] whitespace-nowrap'
        : 'text-white/60 text-xs whitespace-nowrap';
    return <span className={`${loadingCls} ${className}`}>加载中…</span>;
  }

  return (
    <div
      className={`flex items-center justify-end gap-1 shrink-0 min-w-0 ${className}`}
      aria-label="玩家资源"
    >
      <ResourceBadge icon="🎖️" value={player?.reputation} compact />
      <ResourceBadge icon="🤝" value={player?.contribution} compact />
      <ResourceBadge icon="💰" value={player?.silver} low={player?.silver < 10} compact />
      <ResourceBadge icon="🌾" value={player?.food} low={player?.food < 100} compact />
    </div>
  );
}
