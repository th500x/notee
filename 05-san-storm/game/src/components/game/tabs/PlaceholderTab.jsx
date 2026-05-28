/**
 * 占位Tab
 *
 * @description 尚未实装的功能 Tab：壳层与编组 Tab 一致（顶栏/横屏角标 ✕ → 回大地图）
 */

import { TabPageCloseButton, useGameTabLandscape } from '@/components/game/TabPageCloseAffordance';

const TAB_INFO = {
  faction: { icon: '⚔️', title: '势力', desc: '势力信息、外交、资源兑换等功能' },
  city:    { icon: '🏰', title: '主城',     desc: '驻地管理、仓库、守城配置等功能' },
  map:     { icon: '🗺️', title: '世界地图', desc: '城市分布、事件标记、战事导航等功能' },
};

export default function PlaceholderTab({ tabId, onClose }) {
  const info = TAB_INFO[tabId] || { icon: '📋', title: '功能', desc: '' };
  const isLandscape = useGameTabLandscape();
  const close = typeof onClose === 'function' ? onClose : () => {};

  return (
    <div className="relative h-full flex flex-col min-h-0 bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900">
      {!isLandscape && (
        <div className="flex items-center border-b border-amber-900/50 bg-stone-900/80 sticky top-0 z-10 shrink-0">
          <div className="flex-1" />
          <TabPageCloseButton onClose={close} variant="bar" />
        </div>
      )}
      {isLandscape && <TabPageCloseButton onClose={close} variant="corner" />}

      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center py-16 px-4">
        <div className="text-6xl mb-4">{info.icon}</div>
        <h2 className="text-xl font-bold text-amber-100 mb-2">{info.title}</h2>
        <div className="bg-amber-950/50 border border-amber-700/40 rounded-lg px-6 py-4 text-center max-w-sm">
          <p className="text-amber-200 font-medium mb-1">⚠️ 尚未实装</p>
          <p className="text-amber-100/80 text-sm">{info.desc}</p>
        </div>
      </div>
    </div>
  );
}
