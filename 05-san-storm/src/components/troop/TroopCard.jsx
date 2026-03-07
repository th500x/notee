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
 * │   部队图标   │ ← 图标区 (90px) - 与将领卡牌一致
 * ├─────────────┤
 * │   基础属性   │ ← 属性区 (80px)
 * ├─────────────┤
 * │   部队技能   │ ← 技能区 (可变)
 * ├─────────────┤
 * │ 相性/地形    │ ← 底部 (可变)
 * └─────────────┘
 */
const TroopCard = ({ troop, skillsMap = {}, showDetails = true }) => {
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
    // 否则使用默认路径，使用 BASE_URL 确保路径正确
    return `${import.meta.env.BASE_URL}assets/troops/${troop.id}.png`;
  };

  // 获取卡面背景图片路径
  const getCardBackground = () => {
    const bgPath = `/assets/ui/card_bg_${troop.rarity}.png`;
    return bgPath;
  };

  return (
    <div className="relative w-[256px] group">
      {/* 卡牌容器 - 2:3比例，有描述时自适应高度 */}
      <div 
        className={`
          relative w-full ${troop.description ? 'min-h-[384px]' : 'h-[384px]'}
          rounded-xl overflow-hidden
          border-2 ${rarity.border}
          shadow-xl ${rarity.glow}
          transition-all duration-300
          hover:scale-105 hover:shadow-2xl
        `}
        style={{
          backgroundImage: `url(${getCardBackground()})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: '#1f2937'
        }}
      >
        
        {/* 顶部：部队名称区域 */}
        <div className={`
          relative h-[40px] px-3 py-2
          bg-black/10 backdrop-blur-sm
          flex items-center justify-between
        `}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{troopType.icon}</span>
            <h3 className="text-gray-900 font-bold text-lg truncate">
              {troop.name}
            </h3>
          </div>
          <div className={`
            px-2 py-0.5 rounded
            bg-black/20 backdrop-blur-sm
            text-xs font-medium text-gray-900
          `}>
            {rarity.name}
          </div>
        </div>

        {/* 中间：部队图标区域 - 左右布局，套用将领卡牌尺寸 */}
        <div className="relative h-[90px]">
          {/* 背景装饰 - 移除不透明背景 */}
          <div className="absolute inset-0 opacity-5">
            <div className={`absolute inset-0 bg-gradient-to-br ${rarity.bg}`} />
          </div>

          <div className="relative h-full flex items-center pl-6 pr-3 gap-6">
            {/* 左侧：部队图标 */}
            <div className="relative w-[70px] h-[70px] flex-shrink-0">
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
            </div>

            {/* 右侧：部队信息 - 使用grid布局平分左右两列 */}
            <div className="flex-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {/* 左列第一行：兵 */}
              <div className="flex items-center gap-1">
                <span className="text-green-400">👥</span>
                <span className="text-gray-700">兵</span>
                <span className="text-gray-900 font-bold">{troop.maxTroops}</span>
              </div>
              
              {/* 右列第一行：距 */}
              {troop.range && (
                <div className="flex items-center gap-1">
                  <span className="text-purple-400">🎯</span>
                  <span className="text-gray-700">距</span>
                  <span className="text-gray-900 font-bold">{troop.range}</span>
                </div>
              )}

              {/* 左列第二行：攻 */}
              <div className="flex items-center gap-1">
                <span className="text-red-400">⚔️</span>
                <span className="text-gray-700">攻</span>
                <span className="text-gray-900 font-bold">{troop.attack}</span>
              </div>
              
              {/* 右列第二行：速 */}
              <div className="flex items-center gap-1">
                <span className="text-yellow-400">⚡</span>
                <span className="text-gray-700">速</span>
                <span className="text-gray-900 font-bold">{troop.speed}</span>
              </div>

              {/* 左列第三行：防 */}
              <div className="flex items-center gap-1">
                <span className="text-blue-400">🛡️</span>
                <span className="text-gray-700">防</span>
                <span className="text-gray-900 font-bold">{troop.defense}</span>
              </div>
              
              {/* 右列第三行：移 */}
              <div className="flex items-center gap-1">
                <span className="text-cyan-400">🏃</span>
                <span className="text-gray-700">移</span>
                <span className="text-gray-900 font-bold">{troop.movement}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 移除原来的基础属性区域 */}

        {/* 技能区域 - 套用将领卡牌逻辑 */}
        {showDetails && troop.skills && troop.skills.length > 0 && (
          <div className="relative pl-6 pr-3 py-1.5 border-t-2 border-gray-400/40">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-purple-400 text-xs">⚔️</span>
              <span className="text-gray-700 text-xs font-medium">技能</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {troop.skills.slice(0, 3).map((skillId, index) => {
                const skill = skillsMap[skillId];
                const isActive = skillId.startsWith('skill_1_');
                
                return (
                  <div 
                    key={index}
                    className={`
                      px-1.5 py-1 rounded text-[10px] text-center
                      ${isActive 
                        ? `bg-gradient-to-r ${rarity.bg} bg-opacity-20 border ${rarity.border} border-opacity-40` 
                        : 'bg-gray-700/30 border border-gray-600/40'
                      }
                    `}
                    title={skill ? skill.description : ''}
                  >
                    <span className="font-medium truncate block text-gray-900">
                      {isActive ? '⚔️' : '🛡️'} {skill ? skill.name : skillId}
                    </span>
                  </div>
                );
              })}
            </div>
            {troop.skills.length > 3 && (
              <div className="text-center text-gray-600 text-[10px] mt-1">
                +{troop.skills.length - 3} 更多技能
              </div>
            )}
          </div>
        )}

        {/* 相性和地形区域 */}
        {showDetails && (
          <div className="relative pl-6 pr-3 py-3 border-t-2 border-gray-400/40">
            {/* 相性（兵种克制） */}
            <div className="mb-2">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-purple-400 text-xs">⚔️</span>
                <span className="text-gray-700 text-xs font-medium">相性</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex gap-2">
                  <span 
                    title="对步兵" 
                    className={troop.infantryCounter >= 1.0 ? 'text-green-600' : 'text-gray-500'}
                  >
                    🛡️{troop.infantryCounter}
                  </span>
                  <span 
                    title="对骑兵" 
                    className={troop.cavalryCounter >= 1.0 ? 'text-green-600' : 'text-gray-500'}
                  >
                    🐎{troop.cavalryCounter}
                  </span>
                  <span 
                    title="对弓兵" 
                    className={troop.archerCounter >= 1.0 ? 'text-green-600' : 'text-gray-500'}
                  >
                    🏹{troop.archerCounter}
                  </span>
                  <span 
                    title="对攻城" 
                    className={troop.siegeCounter >= 1.0 ? 'text-green-600' : 'text-gray-500'}
                  >
                    🏰{troop.siegeCounter}
                  </span>
                </div>
              </div>
            </div>

            {/* 地形适应 */}
            <div className="mb-2">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-green-400 text-xs">🌍</span>
                <span className="text-gray-700 text-xs font-medium">地形</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex gap-2">
                  <span 
                    title="平原" 
                    className={troop.plainAdapt >= 1.0 ? 'text-green-600' : 'text-gray-500'}
                  >
                    🌾{troop.plainAdapt}
                  </span>
                  <span 
                    title="丘陵" 
                    className={troop.hillAdapt >= 1.0 ? 'text-green-600' : 'text-gray-500'}
                  >
                    ⛰️{troop.hillAdapt}
                  </span>
                  <span 
                    title="树林" 
                    className={troop.forestAdapt >= 1.0 ? 'text-green-600' : 'text-gray-500'}
                  >
                    🌲{troop.forestAdapt}
                  </span>
                  <span 
                    title="攻城" 
                    className={troop.siegeAdapt >= 1.0 ? 'text-green-600' : 'text-gray-500'}
                  >
                    🏰{troop.siegeAdapt}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 描述区域 - 新增 */}
        {showDetails && troop.description && (
          <div className="relative pl-6 pr-3 py-3 border-t-2 border-gray-400/40">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-amber-400 text-xs">📜</span>
              <span className="text-gray-700 text-xs font-medium">描述</span>
            </div>
            <p className="text-gray-800 text-xs leading-relaxed">
              {troop.description}
            </p>
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
    
    // 兵种克制倍率（新系统）
    infantryCounter: PropTypes.number,
    cavalryCounter: PropTypes.number,
    archerCounter: PropTypes.number,
    siegeCounter: PropTypes.number,
    
    // 地形适应性
    plainAdapt: PropTypes.number,
    hillAdapt: PropTypes.number,
    forestAdapt: PropTypes.number,
    siegeAdapt: PropTypes.number,
    
    // 技能
    skills: PropTypes.arrayOf(PropTypes.string),
    
    // 描述
    description: PropTypes.string
  }).isRequired,
  skillsMap: PropTypes.object, // 技能映射
  showDetails: PropTypes.bool
};

export default TroopCard;
