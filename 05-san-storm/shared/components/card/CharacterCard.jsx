/**
 * 将领卡片组件（共享版本）
 * 
 * @description 展示单个将领的信息卡片，采用卡牌风格，支持翻牌查看生涯
 * 
 * 尺寸: 256 × 384 px (2:3比例)
 * 布局: 竖版卡牌
 * 
 * @param {Object} character - 将领数据对象
 * @param {string} character.id - 将领ID
 * @param {string} character.name - 将领名称
 * @param {string} character.rarity - 稀有度 (core/legendary/epic/rare/common)
 * @param {string} character.stage - 生涯阶段 (early/peak/late/dead)
 * @param {number} character.luck - 运气值
 * @param {number} character.courage - 勇猛
 * @param {number} character.command - 统率
 * @param {number} character.combat - 武力
 * @param {number} character.intelligence - 智力
 * @param {number} character.politics - 政治
 * @param {number} character.charm - 魅力
 * @param {string} [character.trait] - 性格特质
 * @param {number} [character.traitModifier] - 性格修正值
 * @param {string} [character.troopAffinity] - 兵种适应性
 * @param {string[]} [character.skills] - 技能ID数组
 * @param {string[]|string} [character.bonds] - 羁绊数组或字符串
 * @param {string} [character.bond] - 羁绊字符串（兼容旧格式）
 * @param {string} [character.biography] - 传记
 * @param {string} [character.description] - 角色描述
 * 
 * @param {Object} [skillsMap={}] - 技能映射对象
 * @param {Object} [bondsMap={}] - 羁绊映射对象
 * @param {boolean} [showDetails=true] - 是否显示详细信息
 * @param {string} [baseUrl=''] - 资源基础路径
 * @param {Object} [lifeStageData] - 生涯数据（用于翻牌）
 * @param {Function} [onSelect] - 选择回调函数
 * @param {boolean} [isSelected=false] - 是否选中（用于角色创建）
 * @param {string} [characterType] - 将领类型标签（military/strategist/balanced，用于角色创建）
 * @param {string} [totalPoints] - 总点数（用于角色创建）
 * 
 * @example
 * <CharacterCard 
 *   character={characterData}
 *   skillsMap={skills}
 *   bondsMap={bonds}
 *   showDetails={true}
 *   baseUrl="/05-san-storm/"
 *   lifeStageData={lifeStages}
 *   onSelect={(char) => console.log(char)}
 * />
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { parseEnhanceSlots, getEnhanceSlotDisplay } from '@shared/utils/characterEnhanceCombat';

/**
 * 稀有度配置
 */
const RARITY_CONFIG = {
  core: {
    name: '核心',
    gradient: 'from-yellow-200 to-yellow-300',
    border: 'border-yellow-400',
    glow: 'shadow-yellow-300/50',
  },
  legendary: {
    name: '传奇',
    gradient: 'from-orange-200 to-orange-300',
    border: 'border-orange-400',
    glow: 'shadow-orange-300/50',
  },
  epic: {
    name: '史诗',
    gradient: 'from-purple-200 to-purple-300',
    border: 'border-purple-400',
    glow: 'shadow-purple-300/50',
  },
  rare: {
    name: '稀有',
    gradient: 'from-blue-200 to-blue-300',
    border: 'border-blue-400',
    glow: 'shadow-blue-300/50',
  },
  common: {
    name: '普通',
    gradient: 'from-gray-200 to-gray-300',
    border: 'border-gray-400',
    glow: 'shadow-gray-300/50',
  },
};

/**
 * 兵种适性 · 性格特质 — 卡面「特性」条（tooltip 与技能/羁绊一致）
 */
const AFFINITY_META = {
  infantry: { short: '步', label: '步兵', icon: '🛡️' },
  cavalry: { short: '骑', label: '骑兵', icon: '🐎' },
  archer: { short: '弓', label: '弓兵', icon: '🏹' },
};

function parseTroopAffinityString(affinityStr) {
  const affinities = {};
  if (!affinityStr || typeof affinityStr !== 'string') return affinities;
  affinityStr.split(';').forEach((pair) => {
    const [troopType, bonus] = pair.split(':');
    const key = troopType && troopType.trim();
    if (!key) return;
    const n = parseInt(String(bonus).trim(), 10);
    affinities[key] = Number.isFinite(n) ? n : 0;
  });
  return affinities;
}

function EnhanceSlotBadge({ slot, slotIndex, activeTooltip, setActiveTooltip }) {
  const display = getEnhanceSlotDisplay(slot, slotIndex);
  const tooltipKey = `enhance_slot_${slotIndex}`;
  const baseClass = display.locked
    ? 'border-stone-400 bg-stone-200/70 text-stone-500'
    : display.empty
      ? 'border-dashed border-gray-300 bg-gray-100/80 text-gray-400'
      : slot?.kind === 'attack'
        ? 'border-red-300 bg-red-50/90 text-red-700'
        : 'border-blue-300 bg-blue-50/90 text-blue-700';

  return (
    <button
      type="button"
      className={`relative shrink-0 w-7 h-7 rounded border text-sm leading-none flex items-center justify-center cursor-pointer ${baseClass}`}
      onClick={(e) => {
        e.stopPropagation();
        setActiveTooltip(activeTooltip === tooltipKey ? null : tooltipKey);
      }}
      aria-label={display.tooltip}
    >
      {display.emoji}
      {activeTooltip === tooltipKey && display.tooltip && (
        <div className="pointer-events-none absolute bottom-full right-0 z-50 mb-1 max-w-[220px] break-words rounded bg-gray-900 px-2 py-1 text-[10px] text-white shadow-lg">
          {display.tooltip}
        </div>
      )}
    </button>
  );
}

function affinityChipTooltip(type, bonus) {
  const row = AFFINITY_META[type];
  return row
    ? `${row.label}适性 +${bonus}%。该将领统率${row.label}部队时，按规则获得属性发挥加成。`
    : `兵种适性「${type}」+${bonus}%。（配置扩展类型，详情以数值与战斗结算为准。）`;
}

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
  early: '茅庐',
  peak: '巅峰',
  late: '不惑',
  death: '卒',
  dead: '卒',
  茅庐: '茅庐',
  巅峰: '巅峰',
  不惑: '不惑',
  卒: '卒',
};

/**
 * 获取稀有度配置
 */
function getRarityConfig(rarity) {
  return RARITY_CONFIG[rarity] || RARITY_CONFIG.common;
}

/** 战术地图已接主动技的阶段上限（阶段 1～5 已实装） */
const TACTICS_ACTIVE_SKILL_IMPLEMENTED_PHASE_MAX = 5;

/**
 * @param {object|undefined|null} skill skillsMap 项
 */
function isSkillImplementedInTactics(skill) {
  if (!skill || typeof skill !== 'object') return false;
  const ph = Number(skill.implementationPhase);
  return Number.isFinite(ph) && ph >= 1 && ph <= TACTICS_ACTIVE_SKILL_IMPLEMENTED_PHASE_MAX;
}

/**
 * 获取生涯文本
 */
function getStageText(stage) {
  return STAGE_MAP[stage] || stage;
}

/**
 * 将领卡片组件
 * @param {boolean} [disableHoverScale=false] 为 true 时关闭 hover 放大（缩略列表/卡池格等，避免窄屏裁切溢出）
 */
function CharacterCard({ 
  character, 
  skillsMap = {}, 
  bondsMap = {}, 
  showDetails = true,
  baseUrl = '',
  lifeStageData = null,
  onSelect,
  isSelected = false,
  characterType = null,
  totalPoints = null,
  disableHoverScale = false,
}) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState(null);
  const rarityConfig = getRarityConfig(character.rarity);
  const enhanceSlots = parseEnhanceSlots(character.characterEnhanceSlots);

  // 解析属性加成（×10存储，显示时除以10）
  const ab = character.attributeBonus || {};
  const getBonus = (key) => ab[key] ? ab[key] / 10 : 0;
  // 带加成的属性值显示辅助
  const attrDisplay = (base, bonusKey) => {
    const bonus = getBonus(bonusKey);
    if (bonus <= 0) return { value: base, hasBonus: false };
    return { value: (parseFloat(base) + bonus).toFixed(1), hasBonus: true };
  };
  // 计算生涯阶段范围
  const calculateStageRanges = (seasons) => {
    const ranges = { early: null, peak: null, late: null, death: null };
    if (!seasons || seasons.length === 0) return ranges;

    const sortedSeasons = [...seasons].sort((a, b) => {
      const seasonNumA = parseInt(a.season.replace('S', ''));
      const seasonNumB = parseInt(b.season.replace('S', ''));
      return seasonNumA - seasonNumB;
    });

    ['early', 'peak', 'late'].forEach(stage => {
      const stageSeasons = sortedSeasons.filter(s => s.stage === stage);
      if (stageSeasons.length > 0) {
        const first = stageSeasons[0].season;
        const last = stageSeasons[stageSeasons.length - 1].season;
        ranges[stage] = first === last ? first : `${first}-${last}`;
      }
    });

    const deathSeasons = sortedSeasons.filter(s => s.stage === 'death');
    if (deathSeasons.length > 0) {
      ranges.death = deathSeasons[0].season;
    }

    return ranges;
  };
  
  const stageRanges = lifeStageData ? calculateStageRanges(lifeStageData.seasons) : null;
  
  // 生涯阶段配置
  const stageConfigs = {
    early: { name: '茅庐期', icon: '🌱', gradient: 'from-green-400 to-green-600', border: 'border-green-500' },
    peak: { name: '巅峰期', icon: '⭐', gradient: 'from-yellow-400 to-yellow-600', border: 'border-yellow-500' },
    late: { name: '不惑期', icon: '🧙', gradient: 'from-purple-400 to-purple-600', border: 'border-purple-500' },
    death: { name: '卒', icon: '💀', gradient: 'from-gray-400 to-gray-600', border: 'border-gray-500' },
  };
  
  // 解析羁绊
  let bonds = [];
  if (Array.isArray(character.bonds)) {
    bonds = character.bonds;
  } else if (character.bond) {
    bonds = character.bond.split(';').map(b => b.trim()).filter(b => b);
  }
  
  // 判断传记加成
  const imperialBiographies = ['《先主传》', '《武帝纪》', '《灵帝纪》'];
  const isImperialBiography = character.biography && imperialBiographies.includes(character.biography);
  const hasBiographyBonus = character.biography && character.biography !== '《三国志》';
  const biographyBonus = isImperialBiography ? '+1' : (hasBiographyBonus ? '+0.5' : null);
  
  // 获取卡面背景图片路径
  const getCardBackground = () => {
    const rarityToFilename = {
      'common': 'bg_r1',
      'rare': 'bg_r2',
      'epic': 'bg_r3',
      'legendary': 'bg_r4',
      'core': 'bg_r5'
    };
    
    const filename = rarityToFilename[character.rarity] || 'bg_r1';
    return `${baseUrl}assets/san_1_ui_card/bg/${filename}.png`;
  };

  // 处理点击事件
  const handleClick = () => {
    if (lifeStageData) {
      setIsFlipped(!isFlipped);
    }
    if (onSelect) {
      onSelect(character);
    }
  };
  
  return (
    <div 
      className={`relative w-[256px] h-[384px] group ${(lifeStageData || onSelect) ? 'cursor-pointer' : ''}`}
      style={{ perspective: '1000px' }}
      onClick={handleClick}
    >
      {/* 翻牌容器 */}
      <div 
        className="relative w-full h-full transition-transform duration-700"
        style={{
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
        }}
      >
        {/* 正面 */}
        <div 
          className="absolute w-full h-full"
          style={{ backfaceVisibility: 'hidden' }}
        >
          {renderCardFront()}
        </div>

        {/* 背面 */}
        {lifeStageData && (
          <div 
            className="absolute w-full h-full"
            style={{ 
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)'
            }}
          >
            {renderCardBack()}
          </div>
        )}
      </div>
      
      {/* 选中标记（用于角色创建） */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg z-10">
          ✓
        </div>
      )}
    </div>
  );
  
  // 渲染卡牌正面
  function renderCardFront() {
    return (
      <div 
        className={`
          relative w-full h-full
          rounded-xl overflow-hidden
          border-2 ${rarityConfig.border}
          shadow-xl ${rarityConfig.glow}
          transition-all duration-300
          ${disableHoverScale ? '' : 'hover:scale-105 hover:shadow-2xl'}
          ${isSelected ? 'ring-4 ring-blue-400 scale-105' : ''}
        `}
        style={{
          backgroundImage: `url(${getCardBackground()})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: '#1f2937'
        }}
      >
        
        {/* 顶部：将领名称 */}
        <div className={`
          relative h-[40px] px-4 py-2 z-10
          bg-black/10 backdrop-blur-sm
          flex items-center justify-between
        `}>
          <div className="flex items-center gap-2">
            <span className="text-xl">👤</span>
            <h3 className="text-gray-900 font-bold text-base truncate">
              {character.name}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {/* 士气显示（编组界面传入） */}
            {character.morale != null && (() => {
              const m = character.morale;
              const moraleColor = m >= 80 ? '#FFD700' : m >= 60 ? '#4CAF50' : m >= 40 ? '#FFC107' : '#F44336';
              const tooltipKey = 'morale';
              const moraleStatus = m >= 100 ? { label: '超高昂', atk: '+10%', def: '+5%' }
                : m >= 80 ? { label: '高昂', atk: '+10%', def: '+5%' }
                : m >= 60 ? { label: '普通', atk: '无', def: '无' }
                : m >= 40 ? { label: '低落', atk: '-5%', def: '-10%' }
                : { label: '崩溃', atk: '-10%', def: '-15%' };
              return (
                <div className="relative">
                  <div
                    className="px-2 py-0.5 rounded bg-black/20 backdrop-blur-sm flex items-center gap-0.5 text-[11px] font-bold cursor-pointer"
                    style={{ color: moraleColor }}
                    onClick={(e) => { e.stopPropagation(); setActiveTooltip(activeTooltip === tooltipKey ? null : tooltipKey); }}
                  >
                    <span>🔥</span>
                    <span>{m}</span>
                  </div>
                  {activeTooltip === tooltipKey && (
                    <div className="absolute z-[100] top-full left-0 mt-1 px-2 py-1.5 rounded bg-gray-900 text-white text-[10px] whitespace-nowrap shadow-lg leading-relaxed"
                      onClick={(e) => e.stopPropagation()}>
                      <div style={{ color: moraleColor }} className="font-bold mb-0.5">🔥 {moraleStatus.label}（{m}/120）</div>
                      <div>⚔️ 攻击：{moraleStatus.atk}</div>
                      <div>🛡️ 防御：{moraleStatus.def}</div>
                    </div>
                  )}
                </div>
              );
            })()}
            {/* 类型标签（用于角色创建或Wiki显示） */}
            {(characterType || character.characterType) && (
              <div className={`
                px-2 py-0.5 rounded
                bg-gray-200/90 backdrop-blur-sm
                border border-gray-300
                text-xs font-bold text-gray-900
                shadow-lg
              `}>
                {(() => {
                  const type = characterType || character.characterType;
                  const typeMap = {
                    'Military': '武官', 'military': '武官', '武官': '武官',
                    'Strategist': '文官', 'strategist': '文官', '文官': '文官',
                    'Balanced': '文武', 'balanced': '文武', '文武': '文武',
                  };
                  return typeMap[type] || type;
                })()}
              </div>
            )}
            {/* 总点数（用于角色创建） */}
            {totalPoints && (
              <div className={`
                px-2 py-0.5 rounded
                bg-black/20 backdrop-blur-sm
                text-xs font-medium text-gray-900
              `}>
                {totalPoints}
              </div>
            )}
            {/* 稀有度（默认显示） */}
            {!characterType && !character.characterType && !totalPoints && (
              <div className={`
                px-2 py-0.5 rounded
                bg-black/20 backdrop-blur-sm
                text-xs font-medium text-gray-900
              `}>
                {rarityConfig.name}
              </div>
            )}
          </div>
        </div>

        {/* 中间：将领信息区域 */}
        <div className="relative h-[90px]">
          <div className="absolute inset-0 opacity-5">
            <div className={`absolute inset-0 bg-gradient-to-br ${rarityConfig.gradient}`} />
          </div>

          <div className="relative h-full flex items-center px-4 py-3 gap-2">
            {/* 左侧：将领图标占位 */}
            <div className="relative w-[70px] h-[70px] flex-shrink-0">
              <div className={`
                absolute inset-0 rounded-lg
                border-2 ${rarityConfig.border}
                bg-gray-900/50 backdrop-blur-sm
                flex items-center justify-center
                overflow-hidden
              `}>
                {character.avatar ? (
                  <img 
                    src={`${baseUrl}${character.avatar}`}
                    alt={character.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center flex-col gap-1 text-gray-500">
                    <span className="text-4xl">👤</span>
                    <span className="text-[10px]">待添加</span>
                  </div>
                )}
              </div>

              {/* 生涯标识 */}
              {character.stage && (
              <div className={`
                absolute -top-1 -right-1
                px-1.5 py-0 rounded-full
                bg-gray-200/90 backdrop-blur-sm
                border border-gray-300
                text-[10px] font-bold text-gray-900
                shadow-lg
              `}>
                {getStageText(character.stage)}
              </div>
              )}

              {/* 运气标识 - 右下角 */}
              <div className={`
                absolute -bottom-1 -right-1
                px-1 py-0.5 rounded-full
                bg-gray-200/90 backdrop-blur-sm
                border border-gray-300
                text-[11px] font-bold text-gray-900
                shadow-lg
                flex items-center gap-0.5
              `}>
                <span className="text-gray-700">🎲</span>
                {(() => { const d = attrDisplay(character.luck, 'luck'); return (
                  <span className={d.hasBonus ? 'text-green-700' : ''}>{d.value}</span>
                ); })()}
              </div>
            </div>

            {/* 右侧：核心属性（竖向排列：左列勇武统，右列智政魅） */}
            <div className="flex-1 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-pink-400">💪</span>
                <span className="text-gray-700">勇</span>
                {(() => { const d = attrDisplay(character.courage, 'courage'); return <span className={`font-bold ${d.hasBonus ? 'text-green-700' : 'text-gray-900'}`}>{d.value}</span>; })()}
              </div>
              
              <div className="flex items-center gap-1">
                <span className="text-green-400">📚</span>
                <span className="text-gray-700">智</span>
                {(() => { const d = attrDisplay(character.intelligence, 'intelligence'); return <span className={`font-bold ${d.hasBonus ? 'text-green-700' : 'text-gray-900'}`}>{d.value}</span>; })()}
              </div>
              
              <div className="flex items-center gap-1">
                <span className="text-blue-400">🗡️</span>
                <span className="text-gray-700">武</span>
                {(() => { const d = attrDisplay(character.combat, 'combat'); return <span className={`font-bold ${d.hasBonus ? 'text-green-700' : 'text-gray-900'}`}>{d.value}</span>; })()}
              </div>
              
              <div className="flex items-center gap-1">
                <span className="text-purple-400">📜</span>
                <span className="text-gray-700">政</span>
                {(() => { const d = attrDisplay(character.politics, 'politics'); return <span className={`font-bold ${d.hasBonus ? 'text-green-700' : 'text-gray-900'}`}>{d.value}</span>; })()}
              </div>
              
              <div className="flex items-center gap-1">
                <span className="text-red-400">⚔️</span>
                <span className="text-gray-700">统</span>
                {(() => { const d = attrDisplay(character.command, 'command'); return <span className={`font-bold ${d.hasBonus ? 'text-green-700' : 'text-gray-900'}`}>{d.value}</span>; })()}
              </div>
              
              <div className="flex items-center gap-1">
                <span className="text-indigo-400">✨</span>
                <span className="text-gray-700">魅</span>
                {(() => { const d = attrDisplay(character.charm, 'charm'); return <span className={`font-bold ${d.hasBonus ? 'text-green-700' : 'text-gray-900'}`}>{d.value}</span>; })()}
              </div>
            </div>
          </div>
        </div>

        {/* 特性区域 */}
        {showDetails && (
          <div className="relative px-4 py-1 border-t-2 border-gray-400/40">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-cyan-400 text-xs">⚡</span>
                <span className="text-gray-700 text-xs font-medium">特性</span>
              </div>
              <EnhanceSlotBadge
                slot={enhanceSlots[0]}
                slotIndex={0}
                activeTooltip={activeTooltip}
                setActiveTooltip={setActiveTooltip}
              />
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {/* 如果没有特性数据，显示两个"暂无"框 */}
              {!character.troopAffinity && !character.trait ? (
                <>
                  {['no_trait_a', 'no_trait_b'].map((tooltipKey) => (
                    <div
                      key={tooltipKey}
                      className="relative flex cursor-pointer items-center justify-center gap-0.5 rounded border border-gray-300 bg-gray-200/80 px-1.5 py-0.5 text-[11px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTooltip(activeTooltip === tooltipKey ? null : tooltipKey);
                      }}
                    >
                      <span>⭐</span>
                      <span className="font-bold text-gray-400">无</span>
                      {activeTooltip === tooltipKey && (
                        <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 max-w-[220px] break-words rounded bg-gray-900 px-2 py-1 text-[10px] text-white shadow-lg">
                          暂无兵种适性与性格词条。
                        </div>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {/* 兵种适应性 */}
                  {character.troopAffinity && (
                    <>
                      {(() => {
                        const affinities = parseTroopAffinityString(character.troopAffinity);
                        return Object.entries(affinities)
                          .filter(([, bonus]) => bonus > 0)
                          .map(([type, bonus]) => {
                            const meta = AFFINITY_META[type];
                            const icon = meta?.icon ?? '⚔️';
                            const short = meta?.short ?? String(type).slice(0, 1);
                            const tooltipKey = `affinity_${type}`;
                            const tooltipText = affinityChipTooltip(type, bonus);
                            return (
                              <div
                                key={type}
                                className="relative flex cursor-pointer items-center justify-center gap-0.5 rounded border border-gray-300 bg-gray-200/80 px-1.5 py-0.5 text-[11px]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTooltip(activeTooltip === tooltipKey ? null : tooltipKey);
                                }}
                              >
                                <span className="text-yellow-600">{icon}</span>
                                <span className="font-bold text-gray-700">{short}</span>
                                <span className="font-bold text-yellow-600">+{bonus}%</span>
                                {activeTooltip === tooltipKey && tooltipText && (
                                  <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 max-w-[220px] break-words rounded bg-gray-900 px-2 py-1 text-[10px] text-white shadow-lg">
                                    {tooltipText}
                                  </div>
                                )}
                              </div>
                            );
                          });
                      })()}
                    </>
                  )}
                  
                  {/* 性格特质 */}
                  {character.trait && TRAIT_CONFIG[character.trait] && (
                    <div
                      className="relative flex cursor-pointer items-center justify-center gap-0.5 rounded border border-gray-300 bg-gray-200/80 px-1.5 py-0.5 text-[11px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        const tooltipKey = 'trait_personality';
                        setActiveTooltip(activeTooltip === tooltipKey ? null : tooltipKey);
                      }}
                    >
                      <span>{TRAIT_CONFIG[character.trait].icon}</span>
                      <span className={`font-bold ${TRAIT_CONFIG[character.trait].color}`}>
                        {TRAIT_CONFIG[character.trait].name[0]}
                      </span>
                      {character.traitModifier != null && character.traitModifier !== 0 && (
                        <span className={`font-bold ${character.traitModifier > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {character.traitModifier > 0 ? '+' : ''}{character.traitModifier}
                        </span>
                      )}
                      {activeTooltip === 'trait_personality' && (() => {
                        const t = TRAIT_CONFIG[character.trait];
                        let tip = `${t.name}：${t.description}`;
                        if (character.traitModifier != null && character.traitModifier !== 0) {
                          const tm = character.traitModifier;
                          const sign = tm > 0 ? '+' : '';
                          tip += ` 配置修正值：${sign}${tm}；相对基础士气 70 累计 ${sign}${tm * 2} 点；战斗另有性格伤害乘子。`;
                        }
                        return (
                          <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 max-w-[220px] break-words rounded bg-gray-900 px-2 py-1 text-[10px] text-white shadow-lg">
                            {tip}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* 技能区域 */}
        {showDetails && (character.skills?.length > 0 || enhanceSlots[1]) && (
          <div className="relative px-4 py-1 border-t-2 border-gray-400/40">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-purple-400 text-xs">⚔️</span>
                <span className="text-gray-700 text-xs font-medium">技能</span>
              </div>
              <EnhanceSlotBadge
                slot={enhanceSlots[1]}
                slotIndex={1}
                activeTooltip={activeTooltip}
                setActiveTooltip={setActiveTooltip}
              />
            </div>
            {character.skills && character.skills.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5">
              {character.skills.slice(0, 3).map((skillId, index) => {
                const skill = skillsMap[skillId];
                const isActive = skillId && typeof skillId === 'string' && skillId.startsWith('san_1_skill_1_');
                const skillRarityConfig = skill ? getRarityConfig(skill.rarity) : rarityConfig;
                const tooltipKey = `skill_${index}`;
                const tacticsOk = isSkillImplementedInTactics(skill);
                const tooltipText = skill
                  ? (tacticsOk ? (skill.description || skill.name) : `【战术未实装】${skill.description || skill.name || ''}`.trim())
                  : `【战术未实装】${skillId || ''}`.trim();

                const placeholderClasses =
                  'bg-gray-200/90 border border-dashed border-gray-400 text-gray-500 opacity-90 saturate-0 cursor-default';
                const normalClasses = `
                      cursor-pointer
                      bg-gradient-to-r ${skillRarityConfig.gradient} bg-opacity-20 border ${skillRarityConfig.border} border-opacity-40
                    `;

                return (
                  <div 
                    key={index}
                    className={`
                      relative px-1.5 py-1 rounded text-[10px] text-center
                      ${tacticsOk ? normalClasses : placeholderClasses}
                    `}
                    onClick={(e) => { e.stopPropagation(); setActiveTooltip(activeTooltip === tooltipKey ? null : tooltipKey); }}
                  >
                    <span className={`font-bold truncate block ${tacticsOk ? 'text-gray-900' : 'text-gray-600'}`}>
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
            ) : null}
          </div>
        )}

        {/* 羁绊区域 */}
        {showDetails && (
          <div className="relative px-4 py-1 border-t-2 border-gray-400/40">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-amber-400 text-xs">🔗</span>
                <span className="text-gray-700 text-xs font-medium">羁绊</span>
              </div>
              <EnhanceSlotBadge
                slot={enhanceSlots[2]}
                slotIndex={2}
                activeTooltip={activeTooltip}
                setActiveTooltip={setActiveTooltip}
              />
            </div>
            {bonds.length > 0 ? (
              <div className="grid grid-cols-3 gap-1.5">
                {bonds.slice(0, 6).map((bondName, index) => {
                  const bond = bondsMap[bondName];
                  const isActive = bond && bond.type === 'active';
                  const bondRarityConfig = bond ? getRarityConfig(bond.rarity) : rarityConfig;
                  const tooltipKey = `bond_${index}`;
                  const tooltipText = bond ? (bond.description || bond.name || bondName) : bondName;
                  
                  return (
                    <div 
                      key={index} 
                      className={`
                        relative px-1.5 py-1 rounded text-[10px] text-center cursor-pointer
                        bg-gradient-to-r ${bondRarityConfig.gradient} bg-opacity-20 border ${bondRarityConfig.border} border-opacity-40
                      `}
                      onClick={(e) => { e.stopPropagation(); setActiveTooltip(activeTooltip === tooltipKey ? null : tooltipKey); }}
                    >
                      <span className="font-bold truncate block text-gray-900">
                        {isActive ? '🔗' : '🤝'} {bondName}
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
            ) : (
              <div className="text-center text-gray-600 text-xs py-0.5">
                无羁绊
              </div>
            )}
          </div>
        )}

        {/* 传记区域 */}
        {showDetails && character.biography && (
          <div className="relative px-4 py-2 border-t-2 border-gray-400/40">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div className="flex items-center gap-1">
                <span className={hasBiographyBonus ? 'text-emerald-400' : 'text-gray-700'}>📖</span>
                <span className="text-gray-700 font-bold">传记</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-900 font-bold">
                  {character.biography}
                </span>
                {biographyBonus && (
                  <span className="text-gray-900 font-bold">{biographyBonus}</span>
                )}
              </div>
            </div>
            {character.description && (
              <div className="text-gray-800 text-xs leading-relaxed min-h-[3rem]">
                {character.description}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
  
  // 渲染卡牌背面（生涯信息）
  function renderCardBack() {
    return (
      <div 
        className={`
          relative w-full h-full
          rounded-xl overflow-hidden
          border-2 ${rarityConfig.border}
          shadow-xl ${rarityConfig.glow}
        `}
        style={{
          backgroundImage: `url(${getCardBackground()})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: '#1f2937'
        }}
      >
        {/* 顶部：将领名称 + 生涯标题 */}
        <div className={`
          relative h-[40px] px-4 py-2
          bg-black/10 backdrop-blur-sm
          flex items-center justify-between
        `}>
          <div className="flex items-center gap-2">
            <span className="text-xl">📜</span>
            <h3 className="text-gray-900 font-bold text-base truncate">
              {character.name} 生涯
            </h3>
          </div>
          <div className={`
            px-2 py-0.5 rounded
            bg-black/20 backdrop-blur-sm
            text-xs font-medium text-gray-900
          `}>
            {rarityConfig.name}
          </div>
        </div>

        {/* 中间：2x2生涯阶段网格 */}
        <div className="relative px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(stageConfigs).map(([stage, config]) => (
              <div 
                key={stage}
                className={`
                  relative
                  rounded-lg overflow-hidden
                  border-2 ${config.border}
                  bg-gray-900/50 backdrop-blur-sm
                  shadow-md
                `}
              >
                <div className={`
                  h-[32px] px-2 py-1
                  bg-gradient-to-r ${config.gradient}
                  flex items-center justify-center gap-1
                `}>
                  <span className="text-lg">{config.icon}</span>
                  <span className="text-white font-bold text-sm">{config.name}</span>
                </div>

                <div className="p-3 text-center">
                  <div className="text-white font-bold text-xl">
                    {stageRanges[stage] || '-'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 底部：生涯说明 */}
        <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-black/20 backdrop-blur-sm border-t-2 border-gray-400/40">
          <div className="text-gray-900 text-xs leading-relaxed space-y-0.5">
            <p>🌱 茅庐：年龄&lt;25岁，属性修正95%</p>
            <p>⭐ 巅峰：年龄25-45岁，属性修正100%</p>
            <p>🧙 不惑：年龄&gt;45岁，属性修正90%</p>
            <p>💀 卒：锚点年已卒，启用不定，属性修正80%</p>
          </div>
        </div>
      </div>
    );
  }
}

CharacterCard.propTypes = {
  character: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    rarity: PropTypes.string.isRequired,
    stage: PropTypes.string,
    luck: PropTypes.number.isRequired,
    courage: PropTypes.number.isRequired,
    command: PropTypes.number.isRequired,
    combat: PropTypes.number.isRequired,
    intelligence: PropTypes.number.isRequired,
    politics: PropTypes.number.isRequired,
    charm: PropTypes.number.isRequired,
    trait: PropTypes.string,
    traitModifier: PropTypes.number,
    morale: PropTypes.number,
    troopAffinity: PropTypes.string,
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
  showDetails: PropTypes.bool,
  baseUrl: PropTypes.string,
  lifeStageData: PropTypes.object,
  onSelect: PropTypes.func,
  isSelected: PropTypes.bool,
  characterType: PropTypes.string,
  totalPoints: PropTypes.string,
  disableHoverScale: PropTypes.bool,
};

export default CharacterCard;
