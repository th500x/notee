/**
 * 势力卡牌组件
 * 
 * @description 展示势力信息的卡牌，包括势力名称、君主、难度、加成等
 * @module shared/components/card/FactionCard
 */

/**
 * 难度配置映射
 */
const difficultyConfig = {
  '简单': {
    gradient: 'from-green-400 to-green-600',
    border: 'border-green-500',
    glow: 'shadow-green-500/50',
    icon: '✓'
  },
  '中级': {
    gradient: 'from-yellow-400 to-yellow-600',
    border: 'border-yellow-500',
    glow: 'shadow-yellow-500/50',
    icon: '⚡'
  },
  '困难': {
    gradient: 'from-red-400 to-red-600',
    border: 'border-red-500',
    glow: 'shadow-red-500/50',
    icon: '⚔️'
  },
  '极难': {
    gradient: 'from-purple-400 to-purple-600',
    border: 'border-purple-500',
    glow: 'shadow-purple-500/50',
    icon: '💀'
  }
};

/**
 * 势力卡牌组件
 * 
 * @param {Object} props - 组件属性
 * @param {Object} props.faction - 势力数据（支持JSON格式和API格式）
 * @param {string} [props.leaderName] - 君主名称（已解析）
 * @param {boolean} [props.selected] - 是否被选中
 * @param {boolean} [props.disabled] - 是否禁用（如已满员）
 * @param {Function} [props.onClick] - 点击回调
 */
function FactionCard({ faction, leaderName, selected = false, disabled = false, onClick }) {
  // 兼容两种数据格式：JSON(camelCase) 和 API(snake_case)
  const name = faction.name || faction.faction_name;
  const maxPlayers = faction.maxPlayers || faction.max_players;
  const style = faction.style || faction.style_text;
  const currentPlayers = faction.currentPlayers ?? faction.current_players;
  const isFull = faction.isFull ?? faction.is_full;
  // recommended 从 difficulty 推导：简单 = 推荐
  const recommended = faction.recommended ?? (faction.difficulty === '简单');

  // faction_bonuses 可能是 JSON 字符串（从API）或数组（从JSON文件）
  let bonuses = faction.faction_bonuses || faction.bonuses || [];
  if (typeof bonuses === 'string') {
    try { bonuses = JSON.parse(bonuses); } catch { bonuses = []; }
  }

  const config = difficultyConfig[faction.difficulty] || difficultyConfig['中级'];
  const displayLeaderName = leaderName || faction.leader;

  return (
    <div 
      className={`relative w-[256px] min-h-[384px] group hover:z-10 ${onClick ? 'cursor-pointer' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={() => !disabled && onClick && onClick(faction)}
    >
      {/* 选中指示器 */}
      {selected && (
        <div className="absolute -inset-1 rounded-xl bg-blue-500/40 animate-pulse z-0" />
      )}
      {/* 卡牌容器 */}
      <div className={`
        relative w-full min-h-full
        bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900
        rounded-xl overflow-hidden
        border-2 ${selected ? 'border-blue-400' : config.border}
        shadow-xl ${selected ? 'shadow-blue-500/50' : config.glow}
        transition-all duration-300
        hover:scale-105 hover:shadow-2xl
      `}>
        
        {/* 顶部：势力名称 */}
        <div className={`
          relative h-[40px] px-3 py-2
          bg-gradient-to-r ${config.gradient}
          flex items-center justify-between
        `}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{faction.icon}</span>
            <h3 className="text-white font-bold text-base truncate">
              {name}
            </h3>
          </div>
          {recommended && (
            <div className="px-2 py-0.5 rounded bg-black/30 backdrop-blur-sm text-xs font-medium text-white">
              推荐
            </div>
          )}
        </div>

        {/* 中间：势力图标区域 */}
        <div className="relative h-[120px] bg-gradient-to-b from-gray-800 to-gray-900">
          {/* 背景装饰 */}
          <div className="absolute inset-0 opacity-10">
            <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient}`} />
          </div>

          <div className="relative h-full flex items-center p-3 gap-3">
            {/* 左侧：势力图标 */}
            <div className="relative w-[100px] h-[100px] flex-shrink-0">
              <div className={`
                absolute inset-0 rounded-lg
                border-2 ${config.border}
                bg-gray-900/50 backdrop-blur-sm
                flex items-center justify-center
                overflow-hidden
              `}>
                <div className="text-6xl">
                  {faction.icon}
                </div>
              </div>

              {/* 难度标识 */}
              <div className={`
                absolute -top-1 -right-1
                w-8 h-8 rounded-full
                bg-gradient-to-br ${config.gradient}
                border-2 ${config.border}
                flex items-center justify-center
                text-xs font-bold text-white
                shadow-lg
              `}>
                {config.icon}
              </div>
            </div>

            {/* 右侧：势力信息 */}
            <div className="flex-1 flex flex-col justify-center gap-2">
              {/* 君主 */}
              <div className="flex items-center gap-2">
                <span className="text-yellow-400 text-xl">👑</span>
                <div className="flex flex-col">
                  <span className="text-gray-400 text-[10px]">君主</span>
                  <span className="text-white font-bold text-sm truncate">
                    {displayLeaderName}
                  </span>
                </div>
              </div>

              {/* 人数上限 */}
              <div className="flex items-center gap-2">
                <span className="text-blue-400 text-xl">👥</span>
                <div className="flex flex-col">
                  <span className="text-gray-400 text-[10px]">
                    {currentPlayers != null ? '玩家数' : '人数上限'}
                  </span>
                  <span className="text-white font-bold text-sm">
                    {currentPlayers != null ? `${currentPlayers}/${maxPlayers}` : maxPlayers}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 势力描述 */}
        {faction.description && (
          <div className="relative px-3 py-2 bg-gray-900/90 backdrop-blur-sm border-t border-gray-700">
            <p className="text-gray-300 text-xs leading-relaxed">
              {faction.description}
            </p>
          </div>
        )}

        {/* 风格和类型 */}
        <div className="relative px-3 py-2 bg-gray-800/90 backdrop-blur-sm border-t border-gray-700">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <span className="text-purple-400">🎨</span>
              <span className="text-gray-400">风格</span>
            </div>
            <span className="text-white font-medium">
              {style}
            </span>
          </div>
        </div>

        {/* 势力加成区域 */}
        {bonuses && bonuses.length > 0 && (
          <div className="relative px-3 py-2 bg-gray-900/90 backdrop-blur-sm border-t border-gray-700">
            <div className="flex items-center gap-1 mb-1.5">
              <span className="text-green-400 text-xs">💪</span>
              <span className="text-gray-400 text-xs font-medium">势力加成</span>
            </div>
            <div className="space-y-1">
              {/* 第一行：前两个加成 */}
              <div className="flex items-center text-xs bg-gray-800/50 rounded px-2 py-1 min-h-[24px]">
                {bonuses.length > 0 ? (
                  <div className="flex items-center gap-2 overflow-hidden">
                    {bonuses.slice(0, 2).map((bonus, index) => (
                      <div key={index} className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-green-400">✓</span>
                        <span className="text-gray-300 whitespace-nowrap text-[11px]">{bonus}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-600 text-[10px]">无加成</span>
                )}
              </div>
              
              {/* 第二行：第三个加成 */}
              {bonuses.length > 2 && (
                <div className="flex items-center text-xs bg-gray-800/50 rounded px-2 py-1 min-h-[24px]">
                  <div className="flex items-center gap-1">
                    <span className="text-green-400">✓</span>
                    <span className="text-gray-300 text-[11px]">{bonuses[2]}</span>
                  </div>
                </div>
              )}
              
              {/* 第三行：第四个加成或显示更多 */}
              {bonuses.length > 3 && (
                <div className="flex items-center text-xs bg-gray-800/50 rounded px-2 py-1 min-h-[24px]">
                  <div className="flex items-center gap-1">
                    <span className="text-green-400">✓</span>
                    <span className="text-gray-300 text-[11px]">{bonuses[3]}</span>
                    {bonuses.length > 4 && (
                      <span className="text-gray-500 text-[10px] ml-2">
                        +{bonuses.length - 4} 更多
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 难度信息 */}
        <div className="relative px-3 py-2 bg-gray-800/90 backdrop-blur-sm border-t border-gray-700">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <span className="text-orange-400">⚔️</span>
              <span className="text-gray-400">难度</span>
            </div>
            <span className="text-white font-medium">
              {faction.difficulty}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FactionCard;
