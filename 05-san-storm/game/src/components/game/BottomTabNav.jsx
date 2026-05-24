/**
 * 底部Tab导航
 * 
 * @description 64px固定底部，4个Tab切换
 */

const TABS = [
  { id: 'lineup',  icon: '📋', label: '编组' },
  { id: 'city',    icon: '🏰', label: '主城' },
  { id: 'faction', icon: '⚔️', label: '势力' },
  { id: 'map',     icon: '🗺️', label: '地图' },
];

/**
 * @param {{ activeTab: string|null, onTabChange: (id: string|null) => void, tabNotifyDots?: Record<string, boolean> }} props
 */
export default function BottomTabNav({ activeTab, onTabChange, tabNotifyDots = {} }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex min-h-16 items-stretch bg-gradient-to-r from-amber-900 to-amber-800 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-2px_10px_rgba(0,0,0,0.3)]">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const showNotifyDot = !!tabNotifyDots[tab.id];
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center transition-colors relative
              ${isActive ? 'text-yellow-300' : 'text-white/50 hover:text-white/70'}`}
            aria-label={showNotifyDot ? `${tab.label}，有新公告` : tab.label}
            aria-selected={isActive}
            role="tab"
          >
            <span className="relative inline-flex text-2xl leading-none">
              {tab.icon}
              {showNotifyDot ? (
                <span
                  className="pointer-events-none absolute -right-1 -top-0.5 h-3 w-3 rounded-full bg-red-500 ring-2 ring-amber-950 shadow-[0_0_6px_rgba(239,68,68,0.85)]"
                  aria-hidden
                />
              ) : null}
            </span>
            <span className="text-xs mt-0.5 font-medium">{tab.label}</span>
            {isActive && (
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-yellow-300 rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
