import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { getTroopPortraitUrlAttempts } from '../../utils/troopIconUrls';

/**
 * 部队卡牌组件（共享版本）
 *
 * @description 显示部队的详细信息，包括属性、技能、相性、地形适应等
 *
 * 尺寸: 外框固定 256 × 384 px（与 CharacterCard 一致）；超出内容在牌内纵向滚动。
 *
 * @param {boolean} [disableHoverScale=false] - 为 true 时关闭 hover 放大（卡池/背包等缩略列表，避免窄屏溢出）
 */
const TroopCard = ({
  troop,
  skillsMap = {},
  showDetails = true,
  compactMode = false,
  baseUrl = '',
  onSelect,
  disableHoverScale = false,
}) => {
  const [activeTooltip, setActiveTooltip] = useState(null);
  /** 按序尝试的立绘 URL（含 troop/troops/_raw 与稀有度兜底） */
  const iconUrls = useMemo(
    () => getTroopPortraitUrlAttempts(troop, baseUrl),
    [baseUrl, troop.iconPath, troop.id, troop.rarity, troop.troopType, troop.weaponType]
  );
  const [iconStep, setIconStep] = useState(0);

  useEffect(() => {
    setIconStep(0);
  }, [iconUrls]);

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

  const resolvedTroopIconSrc = iconStep < iconUrls.length ? iconUrls[iconStep] : '';

  const handleTroopIconError = () => {
    setIconStep((s) => (s + 1 < iconUrls.length ? s + 1 : iconUrls.length));
  };

  /** 卡面背景（稀有度底图，与部队图标路径无关） */
  const getCardBackground = () => {
    const rarityToFilename = {
      common: 'bg_r1',
      rare: 'bg_r2',
      epic: 'bg_r3',
      legendary: 'bg_r4',
      core: 'bg_r5',
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

  const handleClick = () => {
    if (onSelect) {
      onSelect(troop);
    }
  };

  const hoverScaleClass = disableHoverScale ? '' : 'hover:scale-105 hover:shadow-2xl';

  return (
    <div
      className={`relative w-[256px] h-[384px] group ${onSelect ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
    >
      <div
        className={`
          relative w-full h-full flex flex-col
          rounded-xl overflow-hidden
          border-2 ${rarity.border}
          shadow-xl ${rarity.glow}
          transition-all duration-300
          ${hoverScaleClass}
        `}
        style={{
          backgroundImage: `url(${getCardBackground()})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: '#1f2937',
        }}
      >

        {/* 顶部：部队名称区域 */}
        <div className={`
          relative h-[40px] flex-shrink-0 px-3 py-2
          bg-black/10 backdrop-blur-sm
          flex items-center justify-between
        `}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl flex-shrink-0">{troopType.icon}</span>
            <h3 className="text-gray-900 font-bold text-lg truncate">
              {troop.name}
            </h3>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
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
        <div className="relative h-[90px] flex-shrink-0">
          <div className="absolute inset-0 opacity-5">
            <div className={`absolute inset-0 bg-gradient-to-br ${rarity.bg}`} />
          </div>

          <div className="relative h-full flex items-center pl-6 pr-3 gap-6">
            <div className="relative w-[70px] h-[70px] flex-shrink-0">
              <div className={`
                absolute inset-0 rounded-lg
                border-2 ${rarity.border}
                bg-gray-900/50 backdrop-blur-sm
                flex items-center justify-center
                overflow-hidden
              `}>
                {iconStep < 2 && resolvedTroopIconSrc ? (
                  <img
                    key={resolvedTroopIconSrc}
                    src={resolvedTroopIconSrc}
                    alt={troop.name}
                    className="w-full h-full object-cover"
                    onError={handleTroopIconError}
                  />
                ) : null}
                <div
                  className={`${iconStep < iconUrls.length && resolvedTroopIconSrc ? 'hidden' : 'flex'} w-full h-full items-center justify-center flex-col gap-1 text-gray-500`}
                >
                  <span className="text-4xl">{troopType.icon}</span>
                  <span className="text-[10px]">待添加</span>
                </div>
              </div>

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

            <div className="flex-1 flex flex-col gap-1 text-xs min-w-0">
              {troop.range ? (
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  <span className="text-purple-400">🎯</span>
                  <div className="flex items-center gap-0.5 flex-wrap">
                    {Array.from({ length: troop.range }, (_, i) => (
                      <div
                        key={i}
                        className="w-[10px] h-[10px] rounded-sm bg-green-500/80 border border-green-400 flex-shrink-0"
                      />
                    ))}
                  </div>
                </div>
              ) : null}

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

        {/* 技能 / 相性 / 描述：牌内滚动，保证总高 384 */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
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

          {showDetails && !compactMode && (
            <div className="relative pl-6 pr-3 py-3 border-t-2 border-gray-400/40">
              <div className="mb-2">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-purple-400 text-xs">⚔️</span>
                  <span className="text-gray-700 text-xs font-medium">相性</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex gap-2 flex-wrap">
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

              <div className="mb-2">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-green-400 text-xs">🌍</span>
                  <span className="text-gray-700 text-xs font-medium">地形</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex gap-2 flex-wrap">
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
  onSelect: PropTypes.func,
  disableHoverScale: PropTypes.bool,
};

export default TroopCard;
