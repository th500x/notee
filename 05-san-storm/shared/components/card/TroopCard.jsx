import React, { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * 部队卡牌组件（共享版本）
 * 
 * @description 显示部队的详细信息，包括属性、技能、相性、地形适应等
 * 
 * 尺寸: 256 × 384 px (2:3比例)
 * 布局: 竖版卡牌
 * 
 * @param {Object} troop - 部队数据对象
 * @param {string} troop.id - 部队ID
 * @param {string} troop.name - 部队名称
 * @param {string} troop.rarity - 稀有度 (core/legendary/epic/rare/common)
 * @param {string} troop.troopType - 兵种类型 (infantry/cavalry/archer)
 * @param {string} [troop.weaponType] - 武器类型，用于图标路径
 * @param {string} [troop.iconPath] - 自定义图标路径
 * @param {string} [troop.faction] - 势力名称
 * @param {number} troop.attack - 攻击力
 * @param {number} troop.defense - 防御力
 * @param {number} troop.speed - 速度
 * @param {number} troop.movement - 移速
 * @param {number} troop.maxTroops - 最大兵力
 * @param {number} [troop.currentTroops] - 当前兵力（可选，用于显示损耗）
 * @param {number} [troop.range] - 射程（可选）
 * @param {number} [troop.infantryCounter] - 对步兵克制倍率
 * @param {number} [troop.cavalryCounter] - 对骑兵克制倍率
 * @param {number} [troop.archerCounter] - 对弓兵克制倍率
 * @param {number} [troop.siegeCounter] - 对攻城克制倍率
 * @param {number} [troop.plainAdapt] - 平原适应性
 * @param {number} [troop.hillAdapt] - 丘陵适应性
 * @param {number} [troop.forestAdapt] - 树林适应性
 * @param {number} [troop.siegeAdapt] - 攻城适应性
 * @param {string[]} [troop.skills] - 技能ID数组
 * @param {string} [troop.description] - 部队描述
 * 
 * @param {Object} [skillsMap={}] - 技能映射对象 {skillId: {name, description, rarity}}
 * @param {boolean} [showDetails=true] - 是否显示详细信息
 * @param {string} [baseUrl=''] - 资源基础路径（用于图片加载）
 * @param {Function} [onSelect] - 选择回调函数
 * 
 * @example
 * <TroopCard 
 *   troop={troopData} 
 *   skillsMap={skills}
 *   showDetails={true}
 *   baseUrl="/05-san-storm/"
 *   onSelect={(troop) => console.log(troop)}
 * />
 */
const TroopCard = ({ 
  troop, 
  skillsMap = {}, 
  showDetails = true,
  compactMode = false,
  baseUrl = '',
  onSelect
}) => {
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [useIdIcon, setUseIdIcon] = useState(true); // 优先尝试ID专属图标

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

  // 获取部队图标路径（优先ID专属图标，fallback到稀有度+武器类型图标）
  const getTroopIcon = () => {
    if (troop.iconPath) {
      return troop.iconPath;
    }

    // 优先：ID专属图标（如 san_1_troop_0013.png）
    if (useIdIcon && troop.id) {
      return `${baseUrl}assets/san_1_ui_card/troop/${troop.id}.png`;
    }
    
    // Fallback：稀有度+武器类型图标
    return getRarityIcon();
  };

  // 稀有度+武器类型图标路径
  const getRarityIcon = () => {
    const rarityToPrefix = {
      'common': 'r1',
      'rare': 'r2',
      'epic': 'r3',
      'legendary': 'r4',
      'core': 'r4'
    };
    
    const rarityPrefix = rarityToPrefix[troop.rarity] || 'r1';
    
    const weaponType = troop.weaponType || '';
    let iconName;
    if (weaponType && weaponType.includes('_')) {
      iconName = weaponType;
    } else if (weaponType) {
      iconName = `${troop.troopType || 'infantry'}_${weaponType}`;
    } else {
      iconName = 'infantry_saber';
    }
    
    return `${baseUrl}assets/san_1_ui_card/troop/troop_${rarityPrefix}_${iconName}.png`;
  };

  // 获取卡面背景图片路径
  const getCardBackground = () => {
    const rarityToFilename = {
      'common': 'bg_r1',
      'rare': 'bg_r2',
      'epic': 'bg_r3',
      'legendary': 'bg_r4',
      'core': 'bg_r5'
    };
    
    const filename = rarityToFilename[troop.rarity] || 'bg_r1';
    return `${baseUrl}assets/san_1_ui_card/bg/${filename}.png`;
  };

  // 获取势力图标路径
  const getFactionIcon = () => {
    const factionToId = {
      '通用': 'san_1_faction_0001',
      '刘备': 'san_1_faction_1001',
      '曹操': 'san_1_faction_2001',
      '孙坚': 'san_1_faction_3001',
      '袁绍': 'san_1_faction_4001',
      '董卓': 'san_1_faction_5001',
      '汉室': 'san_1_faction_6001',
      '黄巾': 'san_1_faction_7001',
    };
    
    const factionId = factionToId[troop.faction] || 'san_1_faction_0001';
    return `${baseUrl}assets/san_1_battle/faction/${factionId}.png`;
  };

  // 处理点击事件
  const handleClick = () => {
    if (onSelect) {
      onSelect(troop);
    }
  };

  return (
    <div 
      className={`relative w-[256px] group ${onSelect ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
    >
      {/* 卡牌容器 */}
      <div 
        className={`
          relative w-full ${compactMode ? '' : (troop.description ? 'min-h-[384px]' : 'h-[384px]')}
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
          <div className="flex items-center gap-1">
            {/* 耐久度（使用次数）— 仅当传入 battleCount/maxBattleCount 时显示 */}
            {troop.maxBattleCount != null && (
              <div className="px-2 py-0.5 rounded bg-black/20 backdrop-blur-sm text-xs font-medium text-gray-900">
                🚩{(troop.maxBattleCount - (troop.battleCount || 0))}/{troop.maxBattleCount}
              </div>
            )}
            <div className={`
              px-2 py-0.5 rounded
              bg-black/20 backdrop-blur-sm
              text-xs font-medium text-gray-900
            `}>
              {rarity.name}
            </div>
          </div>
        </div>

        {/* 中间：部队图标区域 */}
        <div className="relative h-[90px]">
          <div className="absolute inset-0 opacity-5">
            <div className={`absolute inset-0 bg-gradient-to-br ${rarity.bg}`} />
          </div>

          <div className="relative h-full flex items-center pl-6 pr-3 gap-6">
            {/* 左侧：部队图标 */}
            <div className="relative w-[70px] h-[70px] flex-shrink-0">
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
                    if (useIdIcon) {
                      // ID专属图标不存在，fallback到稀有度图标
                      setUseIdIcon(false);
                      e.target.src = getRarityIcon();
                      return;
                    }
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div className="hidden w-full h-full items-center justify-center flex-col gap-1 text-gray-500">
                  <span className="text-4xl">{troopType.icon}</span>
                  <span className="text-[10px]">待添加</span>
                </div>
              </div>

              {/* 势力标记 - 右上角 */}
              {troop.faction && (
                <div className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-white/90 backdrop-blur-sm border border-gray-300 shadow-md flex items-center justify-center overflow-hidden">
                  <img
                    src={getFactionIcon()}
                    alt={troop.faction}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div className="hidden w-full h-full items-center justify-center text-[7px] text-gray-600 font-bold">
                    {troop.faction.charAt(0)}
                  </div>
                </div>
              )}

              {/* 兵力标识 - 右下角 */}
              <div className={`absolute -bottom-0.5 -right-0.5 px-0.5 rounded-full backdrop-blur-sm border text-[9px] font-bold shadow-md flex items-center gap-0.5 ${
                troop.currentTroops !== undefined && troop.currentTroops < troop.maxTroops
                  ? 'bg-yellow-400/90 border-yellow-500 text-gray-900'
                  : 'bg-green-500/90 border-green-400 text-gray-900'
              }`}>
                <span className={`text-[9px] ${
                  troop.currentTroops !== undefined && troop.currentTroops < troop.maxTroops
                    ? 'text-yellow-900'
                    : 'text-green-900'
                }`}>👥</span>
                <span>{troop.currentTroops !== undefined ? troop.currentTroops : troop.maxTroops}</span>
              </div>
            </div>

            {/* 右侧：部队信息 */}
            <div className="flex-1 flex flex-col gap-1 text-xs">
              {/* 攻击距离 - 小方格可视化 */}
              {troop.range && (
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-purple-400">🎯</span>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: troop.range }, (_, i) => (
                      <div
                        key={i}
                        className="w-[10px] h-[10px] rounded-sm bg-green-500/80 border border-green-400"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 四个属性 - 2列2行 */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-red-400">⚔️</span>
                  <span className="text-gray-700">攻</span>
                  <span className="text-gray-900 font-bold">{troop.attack}</span>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-yellow-400">⚡</span>
                  <span className="text-gray-700">速</span>
                  <span className="text-gray-900 font-bold">{troop.speed}</span>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-blue-400">🛡️</span>
                  <span className="text-gray-700">防</span>
                  <span className="text-gray-900 font-bold">{troop.defense}</span>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-cyan-400">🏃</span>
                  <span className="text-gray-700">移</span>
                  <span className="text-gray-900 font-bold">{troop.movement}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 技能区域 */}
        {(showDetails || compactMode) && troop.skills && troop.skills.length > 0 && (
          <div className="relative pl-6 pr-3 py-1.5 border-t-2 border-gray-400/40">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-purple-400 text-xs">⚔️</span>
              <span className="text-gray-700 text-xs font-medium">技能</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {troop.skills.slice(0, 3).map((skillId, index) => {
                const skill = skillsMap[skillId];
                const isActive = skillId.startsWith('skill_1_');
                const tooltipKey = `skill_${index}`;
                const tooltipText = skill ? (skill.description || skill.name) : skillId;
                
                return (
                  <div 
                    key={index}
                    className={`
                      relative px-1.5 py-1 rounded text-[10px] text-center cursor-pointer
                      ${isActive 
                        ? `bg-gradient-to-r ${rarity.bg} bg-opacity-20 border ${rarity.border} border-opacity-40` 
                        : 'bg-gray-700/30 border border-gray-600/40'
                      }
                    `}
                    onClick={(e) => { e.stopPropagation(); setActiveTooltip(activeTooltip === tooltipKey ? null : tooltipKey); }}
                  >
                    <span className="font-medium truncate block text-gray-900">
                      {isActive ? '⚔️' : '🛡️'} {skill ? skill.name : skillId}
                    </span>
                    {activeTooltip === tooltipKey && tooltipText && (
                      <div className="absolute z-50 bottom-full left-0 mb-1 px-2 py-1 rounded bg-gray-900 text-white text-[10px] max-w-[220px] break-words shadow-lg pointer-events-none">
                        {tooltipText}
                      </div>
                    )}
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
        {showDetails && !compactMode && (
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

        {/* 描述区域 */}
        {showDetails && !compactMode && troop.description && (
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
    weaponType: PropTypes.string,
    iconPath: PropTypes.string,
    faction: PropTypes.string,
    attack: PropTypes.number.isRequired,
    defense: PropTypes.number.isRequired,
    speed: PropTypes.number.isRequired,
    movement: PropTypes.number.isRequired,
    maxTroops: PropTypes.number.isRequired,
    currentTroops: PropTypes.number,
    range: PropTypes.number,
    infantryCounter: PropTypes.number,
    cavalryCounter: PropTypes.number,
    archerCounter: PropTypes.number,
    siegeCounter: PropTypes.number,
    plainAdapt: PropTypes.number,
    hillAdapt: PropTypes.number,
    forestAdapt: PropTypes.number,
    siegeAdapt: PropTypes.number,
    skills: PropTypes.arrayOf(PropTypes.string),
    description: PropTypes.string,
    battleCount: PropTypes.number,
    maxBattleCount: PropTypes.number
  }).isRequired,
  skillsMap: PropTypes.object,
  showDetails: PropTypes.bool,
  compactMode: PropTypes.bool,
  baseUrl: PropTypes.string,
  onSelect: PropTypes.func
};

export default TroopCard;
