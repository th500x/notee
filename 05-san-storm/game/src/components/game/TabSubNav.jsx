/**
 * 全屏子 Tab 横条（编组 LineupTab / 主城 / 势力 / 驻地编组卡池 A·B 等共用样式）
 *
 * @param {{ id: string, label: string }[]} tabs
 * @param {string} activeTabId
 * @param {(id: string) => void} onTabChange
 * @param {() => void} [onClose] 与子 Tab 同行右侧 ✕；`hideClose` 为 true 时可省略
 * @param {boolean} [hideClose] 为 true 时不渲染右侧 ✕（用于嵌套子 Tab 条，如驻地编组内将领1/2）
 */

import { TabPageCloseButton } from '@/components/game/TabPageCloseAffordance';

export default function TabSubNav({ tabs, activeTabId, onTabChange, onClose, hideClose = false }) {
  const close = typeof onClose === 'function' ? onClose : () => {};

  return (
    <div className="flex items-center border-b border-amber-900/50 bg-stone-900/80 sticky top-0 z-10 shrink-0">
      <div className="flex flex-1 min-w-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative truncate px-0.5
              ${activeTabId === tab.id ? 'text-amber-400' : 'text-stone-500 hover:text-stone-300'}`}
          >
            {tab.label}
            {activeTabId === tab.id && (
              <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-amber-500 rounded-full" />
            )}
          </button>
        ))}
      </div>
      {!hideClose ? <TabPageCloseButton onClose={close} variant="bar" /> : null}
    </div>
  );
}
