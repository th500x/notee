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
        <div className="relative h-[100px] bg-gradient-to-b from-gray-800 to-gray-900">
          {/* 背景装饰 */}
          <div className="absolute inset-0 opacity-10">
            <div className={`absolute inset-0 bg-gradient-to-br ${rarityConfig.gradient}`} />
          </div>

          <div className="relative h-full flex items-center p-3 gap-3">
            {/* 左侧：将领图标占位 */}
            <div className="relative w-[80px] h-[80px] flex-shrink-0">
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

            {/* 右侧：核心属性 - 4行布局，固定宽度对齐 */}
            <div className="flex-1 flex flex-col justify-center gap-1.5">
              {/* 第一行：运、勇 */}
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-yellow-400">🎲</span>
                  <span className="text-gray-400">运</span>
                  <span className="text-white font-bold w-6">{character.luck}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-pink-400">💪</span>
                  <span className="text-gray-400">勇</span>
                  <span className="text-white font-bold w-6">{character.courage}</span>
                </div>
              </div>
              
              {/* 第二行：统、武 */}
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-red-400">⚔️</span>
                  <span className="text-gray-400">统</span>
                  <span className="text-white font-bold w-6">{character.command}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-blue-400">🗡️</span>
                  <span className="text-gray-400">武</span>
                  <span className="text-white font-bold w-6">{character.combat}</span>
                </div>
              </div>
              
              {/* 第三行：智、政 */}
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-green-400">📚</span>
                  <span className="text-gray-400">智</span>
                  <span className="text-white font-bold w-6">{character.intelligence}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-purple-400">📜</span>
                  <span className="text-gray-400">政</span>
                  <span className="text-white font-bold w-6">{character.politics}</span>
                </div>
              </div>
              
              {/* 第四行：魅、兵种适应性 */}
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-indigo-400">✨</span>
                  <span className="text-gray-400">魅</span>
                  <span className="text-white font-bold w-6">{character.charisma}</span>
                </div>
                {/* 兵种适应性显示 */}
                {character.troopAffinity && (
                  <div className="flex items-center gap-1">
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
                      
                      return Object.entries(affinities)
                        .filter(([_, bonus]) => bonus > 0)
                        .map(([type, bonus]) => (
                          <span key={type} className="text-yellow-400 font-bold text-xs">
                            {troopIcons[type]}{bonus}%
                          </span>
                        ));
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 技能区域 - 固定2个技能 */}
        {showDetails && character.skills && character.skills.length > 0 && (
          <div className="relative px-3 py-2 bg-gray-800/90 backdrop-blur-sm border-t border-gray-700">
            <div className="flex items-center gap-1 mb-1.5">
              <span className="text-purple-400 text-xs">⚔️</span>
              <span className="text-gray-400 text-xs font-medium">技能</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {character.skills.slice(0, 2).map((skillId, index) => {
                const skill = skillsMap[skillId];
                const isActive = skillId.startsWith('skill_1_');
                return (
                  <div 
                    key={index} 
                    className={`
                      px-2 py-1 rounded text-xs
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

        {/* 羁绊区域 - 2列布局，最多显示4个 */}
        {showDetails && (
          <div className="relative px-3 py-2 bg-gray-900/90 backdrop-blur-sm border-t border-gray-700">
            <div className="flex items-center gap-1 mb-1.5">
              <span className="text-amber-400 text-xs">🔗</span>
              <span className="text-gray-400 text-xs font-medium">羁绊</span>
            </div>
            {bonds.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {bonds.slice(0, 4).map((bondName, index) => {
                  const bond = bondsMap[bondName];
                  const isActive = bond && bond.type === 'active';
                  return (
                    <div 
                      key={index} 
                      className={`
                        px-2 py-1 rounded text-xs
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
              <div className="text-center text-gray-500 text-xs py-1">
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
            {/* 角色描述 */}
            {character.description && (
              <div className="text-gray-400 text-xs leading-relaxed">
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
