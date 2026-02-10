import React from 'react';
import PropTypes from 'prop-types';

/**
 * 部队卡牌组件 V2
 * 
 * 尺寸: 256 × 384 px (2:3比例)
 * 布局: 竖版
 * 
 * 布局结构:
 * ┌─────────────┐
 * │   部队名称   │ ← 顶部 (40px)
 * ├─────────────┤
 * │   部队图标   │ ← 图标区 (120px) - 缩小
 * ├─────────────┤
 * │   基础属性   │ ← 属性区 (80px) - 增大
 * ├─────────────┤
 * │   部队技能   │ ← 技能区 (80px) - 新增
 * ├─────────────┤
 * │ 克制/地形    │ ← 底部 (64px)
 * └─────────────┘
 */
const TroopCard = ({ troop, showDetails = true }) => {
  // 稀有度颜色映射
  const rarityColors = {
    core: {
      bg: 'from-yellow-400 to-yellow-600',
      border: 'border-yellow-500',
      text: 'text-yellow-400',
      glow: 'shadow-yellow-500/50',
      name: '核心'
    },
    legendary: {
      bg: 'from-orange-400 to-orange-600',
      border: 'border-orange-500',
      text: 'text-orange-400',
      glow: 'shadow-orange-500/50',
      name: '传奇'
    },
    epic: {
      bg: 'from-purple-400 to-purple-600',
      border: 'border-purple-500',
      text: 'text-purple-400',
      glow: 'shadow-purple-500/50',
      name: '史诗'
    },
    rare: {
      bg: 'from-blue-400 to-blue-600',
      border: 'border-blue-500',
      text: 'text-blue-400',
      glow: 'shadow-blue-500/50',
      name: '稀有'
    },
    common: {
      bg: 'from-gray-400 to-gray-600',
      border: 'border-gray-500',
      text: 'text-gray-400',
      glow: 'shadow-gray-500/50',
      name: '普通'
    }
  };

  // 兵种类型映射
  const troopTypeMap = {
    infantry: { name: '步兵', icon: '🛡️', color: 'text-blue-400' },
    cavalry: { name: '骑兵', icon: '🐎', color: 'text-red-400' },
    archer: { name: '弓兵', icon: '🏹', color: 'text-green-400' }
  };

  const rarity = rarityColors[troop.rarity] || rarityColors.common;
  const troopType = troopTypeMap[troop.troopType] || troopTypeMap.infantry;

  // 获取部队图标路径
  const getTroopIcon = () => {
    // 如果有自定义图标路径，使用自定义路径
    if (troop.iconPath) {
      return troop.iconPath;
    }
    // 否则使用默认路径: /assets/troops/{troop_id}.png
    return `/assets/troops/${troop.id}.png`;
  };

  return (
    <div className="relative w-[256px] h-[384px] group">
      {/* 卡牌容器 - 2:3比例 */}
      <div className={`
        relative w-full h-full
        bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900
        rounded-xl overflow-hidden
        border-2 ${rarity.border}
        shadow-xl ${rarity.glow}
        transition-all duration-300
        hover:scale-105 hover:shadow-2xl
      `}>
        
        {/* 顶部：部队名称区域 */}
        <div className={`
          relative h-[40px] px-3 py-2
          bg-gradient-to-r ${rarity.bg}
          flex items-center justify-between
        `}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{troopType.icon}</span>
            <h3 className="text-white font-bold text-lg truncate">
              {troop.name}
            </h3>
          </div>
          <div className={`
            px-2 py-0.5 rounded
            bg-black/30 backdrop-blur-sm
            text-xs font-medium text-white
          `}>
            {rarity.name}
          </div>
        </div>

        {/* 中间：部队图标区域 - 左右布局 */}
        <div className="relative h-[120px] bg-gradient-to-b from-gray-800 to-gray-900">
          {/* 背景装饰 */}
          <div className="absolute inset-0 opacity-10">
            <div className={`absolute inset-0 bg-gradient-to-br ${rarity.bg}`} />
          </div>

          <div className="relative h-full flex items-center p-3 gap-3">
            {/* 左侧：部队图标 */}
            <div className="relative w-[100px] h-[100px] flex-shrink-0">
              {/* 图标容器 */}
              <div className={`
                absolute inset-0 rounded-lg
                border-2 ${rarity.border}
                bg-gray-900/50 backdrop-blur-sm
                flex items-center justify-center
                overflow-hidden
              `}>
                <img
                  src={getTroopIcon()}
                  alt={troop.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // 图片加载失败时显示占位符
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                {/* 占位符 */}
                <div className="hidden w-full h-full items-center justify-center flex-col gap-1 text-gray-500">
                  <span className="text-4xl">{troopType.icon}</span>
                  <span className="text-[10px]">待添加</span>
                </div>
              </div>

              {/* 兵种标识 */}
              <div className={`
                absolute -top-1 -right-1
                w-8 h-8 rounded-full
                bg-gradient-to-br ${rarity.bg}
                border-2 ${rarity.border}
                flex items-center justify-center
                text-lg
                shadow-lg
              `}>
                {troopType.icon}
              </div>
            </div>

            {/* 右侧：部队信息 */}
            <div className="flex-1 flex flex-col justify-center gap-3">
              {/* 兵力 */}
              <div className="flex items-center gap-2">
                <span className="text-green-400 text-2xl">👥</span>
                <div className="flex flex-col">
                  <span className="text-gray-400 text-[10px]">兵力</span>
                  <span className="text-white font-bold text-base">
                    {troop.maxTroops}
                  </span>
                </div>
              </div>

              {/* 射程 - 根据射程显示不同图标 */}
              {troop.range && (
                <div className="flex items-center gap-2">
                  <span className="text-purple-400 text-2xl">
                    {troop.range === 1 ? '⚔️' : '🎯'}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-gray-400 text-[10px]">
                      {troop.range === 1 ? '近战' : '射程'}
                    </span>
                    <span className="text-white font-bold text-base">
                      {troop.range}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 基础属性区域 - 攻防速移 */}
        {showDetails && (
          <div className="relative px-3 py-2 bg-gray-900/90 backdrop-blur-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-red-400 text-base">⚔️</span>
                <span className="text-gray-400">攻击</span>
                <span className="text-white font-bold ml-auto">{troop.attack}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-blue-400 text-base">🛡️</span>
                <span className="text-gray-400">防御</span>
                <span className="text-white font-bold ml-auto">{troop.defense}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-yellow-400 text-base">⚡</span>
                <span className="text-gray-400">速度</span>
                <span className="text-white font-bold ml-auto">{troop.speed}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-cyan-400 text-base">🏃</span>
                <span className="text-gray-400">移速</span>
                <span className="text-white font-bold ml-auto">{troop.movement}</span>
              </div>
            </div>
          </div>
        )}

        {/* 技能区域 - 新增 */}
        {showDetails && troop.skills && troop.skills.length > 0 && (
          <div className="relative px-3 py-2 bg-gray-800/90 backdrop-blur-sm border-t border-gray-700">
            <div className="flex items-center gap-1 mb-1.5">
              <span className="text-purple-400 text-xs">✨</span>
              <span className="text-gray-400 text-xs font-medium">技能</span>
            </div>
            <div className="space-y-1">
              {troop.skills.slice(0, 2).map((skillId, index) => (
                <div key={index} className={`
                  px-2 py-1 rounded
                  bg-gradient-to-r ${rarity.bg} bg-opacity-10
                  border ${rarity.border} border-opacity-30
                `}>
                  <span className="text-white text-xs">{skillId}</span>
                </div>
              ))}
              {troop.skills.length > 2 && (
                <div className="text-center text-gray-500 text-[10px]">
                  +{troop.skills.length - 2} 更多技能
                </div>
              )}
            </div>
          </div>
        )}

        {/* 克制和地形区域 */}
        {showDetails && (
          <div className="relative px-3 py-2 bg-gray-900/90 backdrop-blur-sm border-t border-gray-700">
            {/* 克制关系 */}
            <div className="space-y-1 mb-2">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-green-400">✓</span>
                <span className="text-gray-400">克制</span>
                <span className="text-green-400 font-medium ml-auto">
                  {troopTypeMap[troop.counterType]?.name || '-'}
                </span>
                <span className="text-yellow-400 text-[10px]">
                  ×{troop.counterMultiplier || 1.0}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-red-400">✗</span>
                <span className="text-gray-400">被克</span>
                <span className="text-red-400 font-medium ml-auto">
                  {troopTypeMap[troop.counteredBy]?.name || '-'}
                </span>
              </div>
            </div>

            {/* 地形适应 */}
            <div className="flex items-center justify-between text-[10px] pt-1 border-t border-gray-700/50">
              <span className="text-gray-500">地形</span>
              <div className="flex gap-2">
                <span title="平原" className={troop.plainAdapt >= 1.0 ? 'text-green-400' : 'text-gray-500'}>
                  🌾{troop.plainAdapt}
                </span>
                <span title="丘陵" className={troop.hillAdapt >= 1.0 ? 'text-green-400' : 'text-gray-500'}>
                  ⛰️{troop.hillAdapt}
                </span>
                <span title="森林" className={troop.forestAdapt >= 1.0 ? 'text-green-400' : 'text-gray-500'}>
                  🌲{troop.forestAdapt}
                </span>
                <span title="攻城" className={troop.siegeAdapt >= 1.0 ? 'text-green-400' : 'text-gray-500'}>
                  🏰{troop.siegeAdapt}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

TroopCard.propTypes = {
  troop: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    rarity: PropTypes.oneOf(['core', 'legendary', 'epic', 'rare', 'common']).isRequired,
    troopType: PropTypes.oneOf(['infantry', 'cavalry', 'archer']).isRequired,
    iconPath: PropTypes.string,
    attack: PropTypes.number.isRequired,
    defense: PropTypes.number.isRequired,
    speed: PropTypes.number.isRequired,
    movement: PropTypes.number.isRequired, // 移速
    maxTroops: PropTypes.number.isRequired,
    range: PropTypes.number, // 射程（可选）
    counterType: PropTypes.string,
    counteredBy: PropTypes.string,
    counterMultiplier: PropTypes.number,
    plainAdapt: PropTypes.number,
    hillAdapt: PropTypes.number,
    forestAdapt: PropTypes.number,
    siegeAdapt: PropTypes.number,
    skills: PropTypes.arrayOf(PropTypes.string)
  }).isRequired,
  showDetails: PropTypes.bool
};

export default TroopCard;
