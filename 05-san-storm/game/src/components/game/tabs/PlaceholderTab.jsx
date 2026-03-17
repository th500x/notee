/**
 * 占位Tab
 * 
 * @description 尚未实装的功能Tab通用占位组件
 */

const TAB_INFO = {
  faction: { icon: '⚔️', title: '势力管理', desc: '势力信息、外交、资源兑换等功能' },
  city:    { icon: '🏰', title: '主城',     desc: '驻地管理、仓库、守城配置等功能' },
  map:     { icon: '🗺️', title: '世界地图', desc: '城市分布、事件标记、战事导航等功能' },
};

export default function PlaceholderTab({ tabId }) {
  const info = TAB_INFO[tabId] || { icon: '📋', title: '功能', desc: '' };

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="text-6xl mb-4">{info.icon}</div>
      <h2 className="text-xl font-bold text-gray-700 mb-2">{info.title}</h2>
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-6 py-4 text-center max-w-sm">
        <p className="text-amber-800 font-medium mb-1">⚠️ 尚未实装</p>
        <p className="text-amber-700 text-sm">{info.desc}</p>
      </div>
    </div>
  );
}
