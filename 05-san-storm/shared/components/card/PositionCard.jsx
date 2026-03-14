/**
 * 官职卡片组件 V2 - 卡牌风格
 * 
 * @description 展示单个官职的信息卡片，采用部队卡牌风格
 * @module shared/components/card/PositionCard
 * 
 * 尺寸: 256 × 384 px (2:3比例)
 * 布局: 竖版卡牌
 */

import PropTypes from 'prop-types';

/**
 * 官职等级配置
 * Level 0 = 最高级（君主）
 * Level 8 = 最低级（军候）
 */
const LEVEL_CONFIG = {
  0: {
    name: '君主',
    gradient: 'from-red-400 to-red-600',
    border: 'border-red-500',
    glow: 'shadow-red-500/50',
    icon: '👑'
  },
  1: {
    name: '三公',
    gradient: 'from-orange-400 to-orange-600',
    border: 'border-orange-500',
    glow: 'shadow-orange-500/50',
    icon: '⭐⭐⭐'
  },
  2: {
    name: '重号将军',
    gradient: 'from-orange-400 to-orange-600',
    border: 'border-orange-500',
    glow: 'shadow-orange-500/50',
    icon: '⭐⭐'
  },
  3: {
    name: '四方将军',
    gradient: 'from-purple-400 to-purple-600',
    border: 'border-purple-500',
    glow: 'shadow-purple-500/50',
    icon: '🏛️'
  },
  4: {
    name: '杂号将军',
    gradient: 'from-blue-400 to-blue-600',
    border: 'border-blue-500',
    glow: 'shadow-blue-500/50',
    icon: '⚔️'
  },
  5: {
    name: '中郎将',
    gradient: 'from-green-400 to-green-600',
    border: 'border-green-500',
    glow: 'shadow-green-500/50',
    icon: '🎖️'
  },
  6: {
    name: '校尉',
    gradient: 'from-gray-400 to-gray-600',
    border: 'border-gray-500',
    glow: 'shadow-gray-500/50',
    icon: '▲'
  },
  7: {
    name: '都尉',
    gradient: 'from-gray-400 to-gray-600',
    border: 'border-gray-500',
    glow: 'shadow-gray-500/50',
    icon: '▲'
  },
  8: {
    name: '士官',
    gradient: 'from-gray-300 to-gray-500',
    border: 'border-gray-400',
    glow: 'shadow-gray-400/50',
    icon: '●'
  }
};

/**
 * 获取官职等级配置
 * @param {number} level - 官职等级 (0-8)
 * @returns {Object} 等级配置
 */
function getLevelConfig(level) {
  return LEVEL_CONFIG[level] || LEVEL_CONFIG[8];
}

/**
 * 官职卡片组件
 * @param {Object} props
 * @param {Object} props.position - 官职数据
 * @param {boolean} props.showDetails - 是否显示详细信息
 */
function PositionCard({ position, showDetails = true }) {
  const levelConfig = getLevelConfig(position.level);
  
  return (
    <div className="relative w-[256px] h-[384px] group">
      {/* 卡牌容器 */}
      <div className={`
        relative w-full h-full
        bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900
        rounded-xl overflow-hidden
        border-2 ${levelConfig.border}
        shadow-xl ${levelConfig.glow}
        transition-all duration-300
        hover:scale-105 hover:shadow-2xl
      `}
      >
        
        {/* 顶部：官职名称 */}
        <div className={`
          relative h-[40px] px-3 py-2
          bg-gradient-to-r ${levelConfig.gradient}
          flex items-center justify-between
        `}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{position.icon || levelConfig.icon}</span>
            <h3 className="text-white font-bold text-base truncate">
              {position.name}
            </h3>
          </div>
          <div className={`
            px-2 py-0.5 rounded
            bg-black/30 backdrop-blur-sm
            text-xs font-medium text-white
          `}>
            {levelConfig.name}
          </div>
        </div>

        {/* 中间：官职图标区域 */}
        <div className="relative h-[120px] bg-gradient-to-b from-gray-800 to-gray-900">
          {/* 背景装饰 */}
          <div className="absolute inset-0 opacity-10">
            <div className={`absolute inset-0 bg-gradient-to-br ${levelConfig.gradient}`} />
          </div>

          <div className="relative h-full flex items-center p-3 gap-3">
            {/* 左侧：官职图标 */}
            <div className="relative w-[100px] h-[100px] flex-shrink-0">
              <div className={`
                absolute inset-0 rounded-lg
                border-2 ${levelConfig.border}
                bg-gray-900/50 backdrop-blur-sm
                flex items-center justify-center
                overflow-hidden
              `}>
                {/* 官职图标 */}
                <div className="text-6xl">
                  {position.icon || levelConfig.icon}
                </div>
              </div>

              {/* 等级标识 */}
              <div className={`
                absolute -top-1 -right-1
                w-8 h-8 rounded-full
                bg-gradient-to-br ${levelConfig.gradient}
                border-2 ${levelConfig.border}
                flex items-center justify-center
                text-xs font-bold text-white
                shadow-lg
              `}>
                {position.level}
              </div>
            </div>

            {/* 右侧：官职信息 */}
            <div className="flex-1 flex flex-col justify-center gap-2">
              {/* 排名 */}
              <div className="flex items-center gap-2">
                <span className="text-yellow-400 text-xl">🏆</span>
                <div className="flex flex-col">
                  <span className="text-gray-400 text-[10px]">排名</span>
                  <span className="text-white font-bold text-sm">
                    #{position.rank}
                  </span>
                </div>
              </div>

              {/* 等级 */}
              <div className="flex items-center gap-2">
                <span className="text-purple-400 text-xl">📊</span>
                <div className="flex flex-col">
                  <span className="text-gray-400 text-[10px]">等级</span>
                  <span className="text-white font-bold text-sm">
                    Lv.{position.level}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 官职描述 */}
        {showDetails && position.description && (
          <div className="relative px-3 py-2 bg-gray-900/90 backdrop-blur-sm border-t border-gray-700">
            <p className="text-gray-300 text-xs leading-relaxed">
              {position.description}
            </p>
          </div>
        )}

        {/* 加成效果区域 - 固定两行布局 */}
        {showDetails && (
          <div className="relative px-3 py-2 bg-gray-800/90 backdrop-blur-sm border-t border-gray-700">
            <div className="flex items-center gap-1 mb-1.5">
              <span className="text-green-400 text-xs">💪</span>
              <span className="text-gray-400 text-xs font-medium">加成效果</span>
            </div>
            <div className="space-y-1">
              {/* 第一行：资源 + 声望（固定显示） */}
              <div className="flex items-center text-xs bg-gray-900/50 rounded px-2 py-1 min-h-[24px]">
                {position.position_bonuses && (position.position_bonuses.resourceBonus > 0 || position.position_bonuses.prestigeBonus > 0) ? (
                  <div className="flex items-center gap-3">
                    {position.position_bonuses.resourceBonus > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-400">💰</span>
                        <span className="text-gray-400">资源</span>
                        <span className="text-yellow-400 font-bold">
                          +{(position.position_bonuses.resourceBonus * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                    {position.position_bonuses.prestigeBonus > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-purple-400">⭐</span>
                        <span className="text-gray-400">声望</span>
                        <span className="text-purple-400 font-bold">
                          +{(position.position_bonuses.prestigeBonus * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-600 text-[10px]">无基础加成</span>
                )}
              </div>
              
              {/* 第二行：兵种加成（固定显示） */}
              <div className="flex items-center text-xs bg-gray-900/50 rounded px-2 py-1 min-h-[24px]">
                {position.position_bonuses && (position.position_bonuses.infantryBonus > 0 || position.position_bonuses.cavalryBonus > 0 || position.position_bonuses.archerBonus > 0) ? (
                  <div className="flex items-center gap-3">
                    {position.position_bonuses.infantryBonus > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-red-400">🛡️</span>
                        <span className="text-gray-400">步兵</span>
                        <span className="text-red-400 font-bold">
                          +{(position.position_bonuses.infantryBonus * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                    {position.position_bonuses.cavalryBonus > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-green-400">🐎</span>
                        <span className="text-gray-400">骑兵</span>
                        <span className="text-green-400 font-bold">
                          +{(position.position_bonuses.cavalryBonus * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                    {position.position_bonuses.archerBonus > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-blue-400">🏹</span>
                        <span className="text-gray-400">弓兵</span>
                        <span className="text-blue-400 font-bold">
                          +{(position.position_bonuses.archerBonus * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-600 text-[10px]">无兵种加成</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 特殊权限区域 */}
        {showDetails && position.permissions && position.permissions.length > 0 && (
          <div className="relative px-3 py-2 bg-gray-900/90 backdrop-blur-sm border-t border-gray-700">
            <div className="flex items-center gap-1 mb-1.5">
              <span className="text-cyan-400 text-xs">🔑</span>
              <span className="text-gray-400 text-xs font-medium">特殊权限</span>
            </div>
            {position.permissions.length <= 2 ? (
              /* 2项或更少：同一行显示 */
              <div className="flex items-center gap-2 text-xs">
                {position.permissions.map((permission, index) => (
                  <div key={index} className="flex items-center gap-1">
                    <span className="text-green-400">✓</span>
                    <span className="text-gray-300">{permission}</span>
                  </div>
                ))}
              </div>
            ) : (
              /* 3项或更多：分行显示，最多显示3项 */
              <div className="space-y-1">
                {position.permissions.slice(0, 3).map((permission, index) => (
                  <div key={index} className="flex items-start gap-1 text-xs">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span className="text-gray-300 leading-tight">{permission}</span>
                  </div>
                ))}
                {position.permissions.length > 3 && (
                  <div className="text-center text-gray-500 text-[10px]">
                    +{position.permissions.length - 3} 更多权限
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 晋升要求区域 */}
        {showDetails && position.requirement && (
          <div className="relative px-3 py-2 bg-gray-800/90 backdrop-blur-sm border-t border-gray-700">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                <span className="text-orange-400">🎯</span>
                <span className="text-gray-400">晋升要求</span>
              </div>
              <span className="text-white font-medium">
                {position.requirement}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

PositionCard.propTypes = {
  position: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    level: PropTypes.number.isRequired,
    icon: PropTypes.string,
    rank: PropTypes.number.isRequired,
    requirement: PropTypes.string,
    description: PropTypes.string,
    position_bonuses: PropTypes.shape({
      resourceBonus: PropTypes.number,
      prestigeBonus: PropTypes.number,
      infantryBonus: PropTypes.number,
      cavalryBonus: PropTypes.number,
      archerBonus: PropTypes.number
    }),
    permissions: PropTypes.arrayOf(PropTypes.string),
    color: PropTypes.string
  }).isRequired,
  showDetails: PropTypes.bool
};

export default PositionCard;
