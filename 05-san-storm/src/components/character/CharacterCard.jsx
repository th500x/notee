/**
 * 将领卡片组件 V2 - 卡牌风格
 * 
 * @description 展示单个将领的信息卡片，采用部队卡牌风格
 * @module components/character/CharacterCard
 * 
 * 尺寸: 256 × 384 px (2:3比例)
 * 布局: 竖版卡牌
 */

import PropTypes from 'prop-types';

/**
 * 稀有度配置
 */
const RARITY_CONFIG = {
  core: {
    name: '核心',
    gradient: 'from-yellow-400 to-yellow-600',
    border: 'border-yellow-500',
    glow: 'shadow-yellow-500/50',
  },
  legendary: {
    name: '传奇',
    gradient: 'from-orange-400 to-orange-600',
    border: 'border-orange-500',
    glow: 'shadow-orange-500/50',
  },
  epic: {
    name: '史诗',
    gradient: 'from-purple-400 to-purple-600',
    border: 'border-purple-500',
    glow: 'shadow-purple-500/50',
  },
  rare: {
    name: '稀有',
    gradient: 'from-blue-400 to-blue-600',
    border: 'border-blue-500',
    glow: 'shadow-blue-500/50',
  },
  common: {
    name: '普通',
    gradient: 'from-gray-400 to-gray-600',
    border: 'border-gray-500',
    glow: 'shadow-gray-500/50',
  },
  mythic: {
    name: '神话',
    gradient: 'from-red-400 to-red-600',
    border: 'border-red-500',
    glow: 'shadow-red-500/50',
  }
};

/**
 * 性格特质配置
 */
const TRAIT_CONFIG = {
  brave: {
    name: '勇猛',
    icon: '⚔️',
    color: 'text-yellow-400',
    description: '始终保持高昂，不易气馁'
  },
  reckless: {
    name: '无惧',
    icon: '🔥',
    color: 'text-orange-500',
    description: '无所畏惧，士气极高'
  },
  calm: {
    name: '冷静',
    icon: '🧊',
    color: 'text-blue-400',
    description: '稳定发挥，不受波动'
  },
  normal: {
    name: '平凡',
    icon: '⭐',
    color: 'text-gray-400',
    description: '标准表现，无特殊修正'
  },
  cautious: {
    name: '谨慎',
    icon: '🛡️',
    color: 'text-green-400',
    description: '略显保守，需要鼓舞'
  },
  timid: {
    name: '怯懦',
    icon: '💧',
    color: 'text-purple-400',
    description: '容易恐惧，需要保护'
  }
};

/**
 * 生涯阶段映射
 */
const STAGE_MAP = {
  'early': '茅庐',
  'peak': '巅峰',
  'late': '不惑',
  'dead': '卒',
  '茅庐': '茅庐',
  '巅峰': '巅峰',
  '不惑': '不惑',
  '卒': '卒',
};

/**
 * 获取稀有度配置
 */
function getRarityConfig(rarity) {
  return RARITY_CONFIG[rarity] || RARITY_CONFIG.common;
}

/**
 * 获取生涯文本
 */
function getStageText(stage) {
  return STAGE_MAP[stage] || stage;
}

/**
 * 将领卡片组件
 * @param {Object} props
 * @param {Object} props.character - 将领数据
 * @param {Object} props.skillsMap - 技能映射
 * @param {Object} props.bondsMap - 羁绊映射
 * @param {boolean} props.showDetails - 是否显示详细信息
 */
export function CharacterCard({ character, skillsMap = {}, bondsMap = {}, showDetails = true }) {
  const rarityConfig = getRarityConfig(character.rarity);
  
  // 解析羁绊
  let bonds = [];
  if (Array.isArray(character.bonds)) {
    bonds = character.bonds;
  } else if (character.bond) {
    bonds = character.bond.split(';').map(b => b.trim()).filter(b => b);
  }
  
  // 判断传记加成
  // 帝王级别传记：+1.0
  const imperialBiographies = ['《先主传》', '《武帝纪》', '《灵帝纪》'];
  const isImperialBiography = character.biography && imperialBiographies.includes(character.biography);
  
  // 普通传记：+0.5（《三国志》无加成）
  const hasBiographyBonus = character.biography && character.biography !== '《三国志》';
  
  // 获取加成值
  const biographyBonus = isImperialBiography ? '+1' : (hasBiographyBonus ? '+0.5' : null);
  
  return (
    <div className="relative w-[256px] h-[384px] group">
      {/* 卡牌容器 */}
      <div className={`
        relative w-full h-full
        bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900
        rounded-xl overflow-hidden
        border-2 ${rarityConfig.border}
        shadow-xl ${rarityConfig.glow}
        transition-all duration-300
        hover:scale-105 hover:shadow-2xl
      `}
      >
        
        {/* 顶部：将领名称 */}
        <div className={`
          relative h-[40px] px-3 py-2
          bg-gradient-to-r ${rarityConfig.gradient}
          flex items-center justify-between
        `}>
          <div className="flex items-center gap-2">
            <span className="text-xl">👤</span>
            <h3 className="text-white font-bold text-base truncate">
              {character.name}
            </h3>
          </div>
          <div className={`
            px-2 py-0.5 rounded
            bg-black/30 backdrop-blur-sm
            text-xs font-medium text-white
          `}>
            {rarityConfig.name}
          </div>
        </div>

        {/* 中间：将领信息区域 */}
        <div className="relative h-[90px] bg-gradient-to-b from-gray-800 to-gray-900">
          {/* 背景装饰 */}
          <div className="absolute inset-0 opacity-10">
            <div className={`absolute inset-0 bg-gradient-to-br ${rarityConfig.gradient}`} />
          </div>

          <div className="relative h-full flex items-center p-2 gap-2">
            {/* 左侧：将领图标占位 */}
            <div className="relative w-[70px] h-[70px] flex-shrink-0">
              <div className={`
                absolute inset-0 rounded-lg
                border-2 ${rarityConfig.border}
                bg-gray-900/50 backdrop-blur-sm
                flex items-center justify-center
                overflow-hidden
              `}>
                {/* 将领头像占位符 */}
                <div className="w-full h-full flex items-center justify-center flex-col gap-1 text-gray-500">
                  <span className="text-4xl">👤</span>
                  <span className="text-[10px]">待添加</span>
                </div>
              </div>

              {/* 生涯标识 */}
              <div className={`
                absolute -top-1 -right-1
                px-2 py-0.5 rounded-full
                bg-gradient-to-br ${rarityConfig.gradient}
                border-2 ${rarityConfig.border}
                text-xs font-bold text-white
                shadow-lg
              `}>
                {getStageText(character.stage)}
              </div>
            </div>

            {/* 右侧：核心属性 - 使用Grid布局平分左右两列 */}
            <div className="flex-1 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
              {/* 左列第一行：运 */}
              <div className="flex items-center gap-1">
                <span className="text-yellow-400">🎲</span>
                <span className="text-gray-400">运</span>
                <span className="text-white font-bold">{character.luck}</span>
              </div>
              
              {/* 右列第一行：勇 */}
              <div className="flex items-center gap-1">
                <span className="text-pink-400">💪</span>
                <span className="text-gray-400">勇</span>
                <span className="text-white font-bold">{character.courage}</span>
              </div>
              
              {/* 左列第二行：统 */}
              <div className="flex items-center gap-1">
                <span className="text-red-400">⚔️</span>
                <span className="text-gray-400">统</span>
                <span className="text-white font-bold">{character.command}</span>
              </div>
              
              {/* 右列第二行：武 */}
              <div className="flex items-center gap-1">
                <span className="text-blue-400">🗡️</span>
                <span className="text-gray-400">武</span>
                <span className="text-white font-bold">{character.combat}</span>
              </div>
              
              {/* 左列第三行：智 */}
              <div className="flex items-center gap-1">
                <span className="text-green-400">📚</span>
                <span className="text-gray-400">智</span>
                <span className="text-white font-bold">{character.intelligence}</span>
              </div>
              
              {/* 右列第三行：政 */}
              <div className="flex items-center gap-1">
                <span className="text-purple-400">📜</span>
                <span className="text-gray-400">政</span>
                <span className="text-white font-bold">{character.politics}</span>
              </div>
              
              {/* 左列第四行：魅 */}
              <div className="flex items-center gap-1">
                <span className="text-indigo-400">✨</span>
                <span className="text-gray-400">魅</span>
                <span className="text-white font-bold">{character.charisma}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 特性区域 - 兵种适应性和性格 */}
        {showDetails && (
          <div className="relative px-3 py-1.5 bg-gray-800/90 backdrop-blur-sm border-t border-gray-700">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-cyan-400 text-xs">⚡</span>
              <span className="text-gray-400 text-xs font-medium">特性</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {/* 兵种适应性 */}
              {character.troopAffinity && (
                <>
                  {(() => {
                    // 解析兵种适应性
                    const parseAffinity = (affinityStr) => {
                      const affinities = {};
                      if (!affinityStr) return affinities;
                      affinityStr.split(';').forEach(pair => {
                        const [troopType, bonus] = pair.split(':');
                        affinities[troopType] = parseInt(bonus) || 0;
                      });
                      return affinities;
                    };
                    
                    const affinities = parseAffinity(character.troopAffinity);
                    const troopIcons = { infantry: '🛡️', cavalry: '🐎', archer: '🏹' };
                    const troopNames = { infantry: '步', cavalry: '骑', archer: '弓' };
                    
                    return Object.entries(affinities)
                      .filter(([_, bonus]) => bonus > 0)
                      .map(([type, bonus]) => (
                        <div key={type} className="flex items-center justify-center gap-0.5 px-1.5 py-0.5 rounded bg-yellow-900/30 border border-yellow-500/30">
                          <span className="text-yellow-400">{troopIcons[type]}</span>
                          <span className="text-gray-300">{troopNames[type]}</span>
                          <span className="text-yellow-400 font-bold">+{bonus}%</span>
                        </div>
                      ));
                  })()}
                </>
              )}
              
              {/* 性格特质 */}
              {character.trait && TRAIT_CONFIG[character.trait] && (
                <div 
                  className="flex items-center justify-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-900/50 border border-gray-600/30"
                  title={TRAIT_CONFIG[character.trait].description}
                >
                  <span className="text-xs">{TRAIT_CONFIG[character.trait].icon}</span>
                  <span className={`text-xs font-medium ${TRAIT_CONFIG[character.trait].color}`}>
                    {TRAIT_CONFIG[character.trait].name[0]}
                  </span>
                  {character.traitModifier !== 0 && (
                    <span className={`text-xs font-bold ${character.traitModifier > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {character.traitModifier > 0 ? '+' : ''}{character.traitModifier}%
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 技能区域 - 每行3个技能 */}
        {showDetails && character.skills && character.skills.length > 0 && (
          <div className="relative px-3 py-1.5 bg-gray-800/90 backdrop-blur-sm border-t border-gray-700">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-purple-400 text-xs">⚔️</span>
              <span className="text-gray-400 text-xs font-medium">技能</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {character.skills.slice(0, 3).map((skillId, index) => {
                const skill = skillsMap[skillId];
                const isActive = skillId.startsWith('skill_1_');
                return (
                  <div 
                    key={index} 
                    className={`
                      px-1.5 py-0.5 rounded text-xs text-center
                      ${isActive 
                        ? 'bg-red-900/30 border border-red-500/30 text-red-300' 
                        : 'bg-blue-900/30 border border-blue-500/30 text-blue-300'
                      }
                    `}
                    title={skill ? skill.description : ''}
                  >
                    <span className="font-medium truncate block">
                      {isActive ? '⚔️' : '🛡️'} {skill ? skill.name : skillId}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 羁绊区域 - 每行3个羁绊 */}
        {showDetails && (
          <div className="relative px-3 py-1.5 bg-gray-900/90 backdrop-blur-sm border-t border-gray-700">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-amber-400 text-xs">🔗</span>
              <span className="text-gray-400 text-xs font-medium">羁绊</span>
            </div>
            {bonds.length > 0 ? (
              <div className="grid grid-cols-3 gap-1.5">
                {bonds.slice(0, 6).map((bondName, index) => {
                  const bond = bondsMap[bondName];
                  const isActive = bond && bond.type === 'active';
                  return (
                    <div 
                      key={index} 
                      className={`
                        px-1.5 py-0.5 rounded text-xs text-center
                        ${isActive 
                          ? 'bg-amber-900/30 border border-amber-500/30 text-amber-300' 
                          : 'bg-teal-900/30 border border-teal-500/30 text-teal-300'
                        }
                      `}
                      title={bond ? bond.description : ''}
                    >
                      <span className="font-medium truncate block">
                        {isActive ? '🔗' : '🤝'} {bondName}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-gray-500 text-xs py-0.5">
                无羁绊
              </div>
            )}
          </div>
        )}

        {/* 传记区域 */}
        {showDetails && character.biography && (
          <div className="relative px-3 py-2 bg-gray-800/90 backdrop-blur-sm border-t border-gray-700">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div className="flex items-center gap-1">
                <span className={hasBiographyBonus ? 'text-emerald-400' : 'text-gray-400'}>📖</span>
                <span className="text-gray-400 font-bold">传记</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-white font-bold">
                  {character.biography}
                </span>
                {biographyBonus && (
                  <span className="text-white font-bold">{biographyBonus}</span>
                )}
              </div>
            </div>
            {/* 角色描述 - 固定高度，不裁剪 */}
            {character.description && (
              <div className="text-gray-400 text-xs leading-relaxed min-h-[3rem]">
                {character.description}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

CharacterCard.propTypes = {
  character: PropTypes.shape({
    name: PropTypes.string.isRequired,
    rarity: PropTypes.string.isRequired,
    stage: PropTypes.string.isRequired,
    luck: PropTypes.number.isRequired,
    courage: PropTypes.number.isRequired,
    command: PropTypes.number.isRequired,
    combat: PropTypes.number.isRequired,
    intelligence: PropTypes.number.isRequired,
    politics: PropTypes.number.isRequired,
    charisma: PropTypes.number.isRequired,
    trait: PropTypes.string,
    traitModifier: PropTypes.number,
    skills: PropTypes.arrayOf(PropTypes.string),
    bonds: PropTypes.oneOfType([
      PropTypes.arrayOf(PropTypes.string),
      PropTypes.string
    ]),
    bond: PropTypes.string,
    biography: PropTypes.string,
    description: PropTypes.string
  }).isRequired,
  skillsMap: PropTypes.object,
  bondsMap: PropTypes.object,
  showDetails: PropTypes.bool
};
