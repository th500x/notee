/**
 * 势力卡片展示页面
 * 
 * @description 展示所有势力的卡片样式（照抄官职页面结构）
 * @module components/faction/FactionCardExample
 */

import { useFactions } from '../../hooks/useFactions';
import { useCharacters } from '../../hooks/useCharacters';

/**
 * 势力卡片展示页面
 */
export function FactionCardExample() {
  const { factions, loading, error } = useFactions();
  const { characters, loading: charactersLoading } = useCharacters();

  if (loading || charactersLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">加载势力列表...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-600">❌ 加载失败: {error}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-4">势力系统</h2>
      <p className="text-gray-600 mb-6">
        选择你的势力，开启三国征程。每个势力都有独特的特性和玩法。
      </p>
      
      {/* 势力统计 */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900">{factions.length}</p>
            <p className="text-sm text-gray-600">势力总数</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">
              {factions.filter(f => f.recommended).length}
            </p>
            <p className="text-sm text-gray-600">推荐势力</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">
              {factions.reduce((sum, f) => sum + f.maxPlayers, 0)}
            </p>
            <p className="text-sm text-gray-600">总玩家位</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-600">
              {factions.filter(f => f.difficulty === '简单' || f.difficulty === '中等').length}
            </p>
            <p className="text-sm text-gray-600">新手友好</p>
          </div>
        </div>
      </div>

      {/* 势力卡牌网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-items-center">
        {factions.map(faction => {
          // 查找君主名称
          const leader = characters.find(char => char.id === faction.leader);
          const leaderName = leader ? leader.name : faction.leader;
          
          // 难度配置（照抄官职的等级配置）
          const difficultyConfig = {
            '简单': {
              gradient: 'from-green-400 to-green-600',
              border: 'border-green-500',
              glow: 'shadow-green-500/50',
              icon: '✓'
            },
            '中等': {
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
          const config = difficultyConfig[faction.difficulty] || difficultyConfig['中等'];
          
          return (
            <div key={faction.id} className="relative w-[256px] h-[384px] group">
              {/* 卡牌容器 */}
              <div className={`
                relative w-full h-full
                bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900
                rounded-xl overflow-hidden
                border-2 ${config.border}
                shadow-xl ${config.glow}
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
                      {faction.name}
                    </h3>
                  </div>
                  {faction.recommended && (
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
                        {/* 势力图标 */}
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
                            {leaderName}
                          </span>
                        </div>
                      </div>

                      {/* 人数上限 */}
                      <div className="flex items-center gap-2">
                        <span className="text-blue-400 text-xl">👥</span>
                        <div className="flex flex-col">
                          <span className="text-gray-400 text-[10px]">人数上限</span>
                          <span className="text-white font-bold text-sm">
                            {faction.maxPlayers}
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
                      {faction.styleText}
                    </span>
                  </div>
                </div>

                {/* 势力加成区域 - 每行最多显示2个加成 */}
                {faction.bonuses && faction.bonuses.length > 0 && (
                  <div className="relative px-3 py-2 bg-gray-900/90 backdrop-blur-sm border-t border-gray-700">
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className="text-green-400 text-xs">💪</span>
                      <span className="text-gray-400 text-xs font-medium">势力加成</span>
                    </div>
                    <div className="space-y-1">
                      {/* 第一行：前两个加成 */}
                      <div className="flex items-center text-xs bg-gray-800/50 rounded px-2 py-1 min-h-[24px]">
                        {faction.bonuses.length > 0 ? (
                          <div className="flex items-center gap-2 overflow-hidden">
                            {faction.bonuses.slice(0, 2).map((bonus, index) => (
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
                      {faction.bonuses.length > 2 && (
                        <div className="flex items-center text-xs bg-gray-800/50 rounded px-2 py-1 min-h-[24px]">
                          <div className="flex items-center gap-1">
                            <span className="text-green-400">✓</span>
                            <span className="text-gray-300 text-[11px]">{faction.bonuses[2]}</span>
                          </div>
                        </div>
                      )}
                      
                      {/* 第三行：第四个加成或显示更多 */}
                      {faction.bonuses.length > 3 && (
                        <div className="flex items-center text-xs bg-gray-800/50 rounded px-2 py-1 min-h-[24px]">
                          <div className="flex items-center gap-1">
                            <span className="text-green-400">✓</span>
                            <span className="text-gray-300 text-[11px]">{faction.bonuses[3]}</span>
                            {faction.bonuses.length > 4 && (
                              <span className="text-gray-500 text-[10px] ml-2">
                                +{faction.bonuses.length - 4} 更多
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
        })}
      </div>

      {/* 设计说明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-8">
        <h3 className="text-base font-semibold text-blue-900 mb-3">设计说明</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>• <strong>卡牌尺寸：</strong>256 × 384 px (2:3比例)</p>
          <p>• <strong>难度配色：</strong>简单绿色 → 中等黄色 → 困难红色 → 极难紫色</p>
          <p>• <strong>信息展示：</strong>势力名称、君主、人数上限、风格、难度、加成效果</p>
          <p>• <strong>交互效果：</strong>悬停放大、点击选择</p>
          <p>• <strong>视觉风格：</strong>与官职卡牌、部队卡牌保持一致的暗色系风格</p>
        </div>
      </div>
    </div>
  );
}
