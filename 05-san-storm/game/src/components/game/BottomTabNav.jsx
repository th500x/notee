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

export default function BottomTabNav({ activeTab, onTabChange }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 z-50 bg-gradient-to-r from-amber-900 to-amber-800 flex items-stretch shadow-[0_-2px_10px_rgba(0,0,0,0.3)]">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center transition-colors relative
              ${isActive ? 'text-yellow-300' : 'text-white/50 hover:text-white/70'}`}
            aria-label={tab.label}
            aria-selected={isActive}
            role="tab"
          >
            <span className="text-2xl">{tab.icon}</span>
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
