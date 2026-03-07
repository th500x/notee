/**
 * 生涯详情组件 V2 - 卡牌风格
 * 
 * @description 展示武将在不同赛季的生涯变化和属性变化
 * @module components/character/LifeStageDetail
 * 
 * 尺寸: 256 × 192 px (2:1比例，高度为武将卡牌的一半)
 * 布局: 横版卡牌
 */

import PropTypes from 'prop-types';

/**
 * 阶段配置
 */
const STAGE_CONFIG = {
  early: {
    name: '茅庐',
    icon: '🌱',
    gradient: 'from-green-400 to-green-600',
    border: 'border-green-500',
    glow: 'shadow-green-500/50',
    description: '初出茅庐',
    modifier: '95%',
  },
  peak: {
    name: '巅峰',
    icon: '⭐',
    gradient: 'from-yellow-400 to-yellow-600',
    border: 'border-yellow-500',
    glow: 'shadow-yellow-500/50',
    description: '人生巅峰',
    modifier: '100%',
  },
  late: {
    name: '不惑',
    icon: '🧙',
    gradient: 'from-purple-400 to-purple-600',
    border: 'border-purple-500',
    glow: 'shadow-purple-500/50',
    description: '不惑之年',
    modifier: '90%',
  },
  death: {
    name: '卒',
    icon: '💀',
    gradient: 'from-gray-400 to-gray-600',
    border: 'border-gray-500',
    glow: 'shadow-gray-500/50',
    description: '已故',
    modifier: '80%',
  },
};

/**
 * 获取阶段配置
 */
function getStageConfig(stage) {
  return STAGE_CONFIG[stage] || STAGE_CONFIG.peak;
}

/**
 * 计算生涯阶段的赛季范围
 * @param {Array} seasons - 所有赛季数据
 * @returns {Object} 各阶段的赛季范围
 */
function calculateStageRanges(seasons) {
  const ranges = {
    early: null,
    peak: null,
    late: null,
    death: null,
  };

  if (!seasons || seasons.length === 0) return ranges;

  // 按赛季排序
  const sortedSeasons = [...seasons].sort((a, b) => {
    const seasonNumA = parseInt(a.season.replace('S', ''));
    const seasonNumB = parseInt(b.season.replace('S', ''));
    return seasonNumA - seasonNumB;
  });

  // 计算每个阶段的范围
  ['early', 'peak', 'late'].forEach(stage => {
    const stageSeasons = sortedSeasons.filter(s => s.stage === stage);
    if (stageSeasons.length > 0) {
      const first = stageSeasons[0].season;
      const last = stageSeasons[stageSeasons.length - 1].season;
      ranges[stage] = first === last ? first : `${first}-${last}`;
    }
  });

  // 卒阶段只显示开始的赛季
  const deathSeasons = sortedSeasons.filter(s => s.stage === 'death');
  if (deathSeasons.length > 0) {
    ranges.death = deathSeasons[0].season;
  }

  return ranges;
}

/**
 * 生涯卡片组件
 * @param {Object} props
 * @param {Object} props.seasonData - 当前赛季数据
 * @param {string} props.characterName - 武将名称
 * @param {Array} props.allSeasons - 所有赛季数据（用于计算阶段范围）
 */
export function LifeStageCard({ seasonData, characterName, allSeasons }) {
  const stageConfig = getStageConfig(seasonData.stage);
  const stageRanges = calculateStageRanges(allSeasons);
  
  return (
    <div className="relative w-[256px] h-[192px] group">
      {/* 卡牌容器 */}
      <div className={`
        relative w-full h-full
        bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900
        rounded-xl overflow-hidden
        border-2 ${stageConfig.border}
        shadow-xl ${stageConfig.glow}
        transition-all duration-300
        hover:scale-105 hover:shadow-2xl
      `}>
        
        {/* 顶部：武将和赛季信息 - 44px */}
        <div className={`
          relative h-[44px] px-3 py-2
          bg-gradient-to-r ${stageConfig.gradient}
          flex items-center justify-between
        `}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{stageConfig.icon}</span>
            <h3 className="text-white font-bold text-sm">
              {characterName} · {seasonData.season} {seasonData.seasonName}
            </h3>
          </div>
          <div className={`
            px-2 py-0.5 rounded
            bg-black/30 backdrop-blur-sm
            text-xs font-medium text-white
          `}>
            {stageConfig.name}
          </div>
        </div>

        {/* 中间：基本信息 - 74px */}
        <div className="relative px-3 py-3 bg-gray-800/90 backdrop-blur-sm border-t border-gray-700">
          <div className="grid grid-cols-2 gap-2.5 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-blue-400">📅</span>
              <span className="text-gray-400">年份</span>
              <span className="text-white font-bold">{seasonData.year}年</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-purple-400">🎂</span>
              <span className="text-gray-400">年龄</span>
              <span className="text-white font-bold">{seasonData.age}岁</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-amber-400">📊</span>
              <span className="text-gray-400">总属性</span>
              <span className="text-white font-bold">{seasonData.total}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-green-400">⚡</span>
              <span className="text-gray-400">修正</span>
              <span className="text-white font-bold">{stageConfig.modifier}</span>
            </div>
          </div>
        </div>

        {/* 底部：生涯阶段范围 - 74px */}
        <div className="relative px-3 py-3 bg-gray-900/90 backdrop-blur-sm border-t border-gray-700">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            {/* 茅庐 */}
            <div className="flex items-center gap-1.5">
              <span className="text-green-400">🌱</span>
              <span className="text-gray-400">茅庐:</span>
              <span className="text-white font-medium">
                {stageRanges.early || ''}
              </span>
            </div>
            
            {/* 巅峰 */}
            <div className="flex items-center gap-1.5">
              <span className="text-yellow-400">⭐</span>
              <span className="text-gray-400">巅峰:</span>
              <span className="text-white font-medium">
                {stageRanges.peak || ''}
              </span>
            </div>
            
            {/* 不惑 */}
            <div className="flex items-center gap-1.5">
              <span className="text-purple-400">🧙</span>
              <span className="text-gray-400">不惑:</span>
              <span className="text-white font-medium">
                {stageRanges.late || ''}
              </span>
            </div>
            
            {/* 卒 */}
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">💀</span>
              <span className="text-gray-400">卒:</span>
              <span className="text-white font-medium">
                {stageRanges.death || ''}
              </span>
            </div>
          </div>
        </div>

        {/* 已故标识 */}
        {seasonData.isDead && (
          <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-red-500/90 backdrop-blur-sm">
            <span className="text-white text-xs font-bold">💀 已故</span>
          </div>
        )}
      </div>
    </div>
  );
}

LifeStageCard.propTypes = {
  seasonData: PropTypes.shape({
    season: PropTypes.string.isRequired,
    seasonName: PropTypes.string.isRequired,
    year: PropTypes.number.isRequired,
    age: PropTypes.number.isRequired,
    stage: PropTypes.string.isRequired,
    total: PropTypes.number.isRequired,
    isDead: PropTypes.bool,
    attributes: PropTypes.shape({
      luck: PropTypes.number.isRequired,
      courage: PropTypes.number.isRequired,
      command: PropTypes.number.isRequired,
      combat: PropTypes.number.isRequired,
      intelligence: PropTypes.number.isRequired,
      politics: PropTypes.number.isRequired,
      charisma: PropTypes.number.isRequired,
    }).isRequired,
  }).isRequired,
  characterName: PropTypes.string.isRequired,
  allSeasons: PropTypes.arrayOf(PropTypes.object).isRequired,
};

/**
 * 生涯详情组件（保留原有的弹窗功能）
 * @param {Object} props
 * @param {Object} props.characterData - 武将完整数据（包含所有赛季）
 * @param {Function} props.onClose - 关闭回调
 */
export function LifeStageDetail({ characterData, onClose }) {
  if (!characterData) {
    return null;
  }

  // 计算成长轨迹统计
  const stageStats = {
    early: characterData.seasons.filter(s => s.stage === 'early').length,
    peak: characterData.seasons.filter(s => s.stage === 'peak').length,
    late: characterData.seasons.filter(s => s.stage === 'late').length,
    death: characterData.seasons.filter(s => s.stage === 'death').length,
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="sticky top-0 bg-white border-b-2 border-gray-200 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {characterData.name} - 生涯详情
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {characterData.birthYear}年生
              {characterData.deathYear && ` - ${characterData.deathYear}年卒`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {/* 成长轨迹统计 */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">成长轨迹统计</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 text-center">
                <p className="text-3xl mb-2">🌱</p>
                <p className="text-sm text-gray-600">茅庐期</p>
                <p className="text-2xl font-bold text-green-700">{stageStats.early}</p>
                <p className="text-xs text-gray-500">个赛季</p>
              </div>
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 text-center">
                <p className="text-3xl mb-2">⭐</p>
                <p className="text-sm text-gray-600">巅峰期</p>
                <p className="text-2xl font-bold text-yellow-700">{stageStats.peak}</p>
                <p className="text-xs text-gray-500">个赛季</p>
              </div>
              <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4 text-center">
                <p className="text-3xl mb-2">🧙</p>
                <p className="text-sm text-gray-600">不惑期</p>
                <p className="text-2xl font-bold text-purple-700">{stageStats.late}</p>
                <p className="text-xs text-gray-500">个赛季</p>
              </div>
              <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4 text-center">
                <p className="text-3xl mb-2">💀</p>
                <p className="text-sm text-gray-600">卒</p>
                <p className="text-2xl font-bold text-gray-700">{stageStats.death}</p>
                <p className="text-xs text-gray-500">个赛季</p>
              </div>
            </div>
          </div>

          {/* 所有赛季卡牌列表 */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-3">所有赛季</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {characterData.seasons.map((season) => (
                <LifeStageCard
                  key={season.season}
                  seasonData={season}
                  characterName={characterData.name}
                  allSeasons={characterData.seasons}
                />
              ))}
            </div>
          </div>

          {/* 基础属性对比 */}
          <div className="mt-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">基础属性（无修正）</h3>
            <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center">
                  <p className="text-xs text-gray-600">🎲 运气</p>
                  <p className="text-lg font-bold text-gray-900">{characterData.baseAttributes.luck}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600">💪 勇气</p>
                  <p className="text-lg font-bold text-gray-900">{characterData.baseAttributes.courage}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600">⚔️ 统帅</p>
                  <p className="text-lg font-bold text-gray-900">{characterData.baseAttributes.command}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600">🗡️ 武力</p>
                  <p className="text-lg font-bold text-gray-900">{characterData.baseAttributes.combat}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600">📚 智力</p>
                  <p className="text-lg font-bold text-gray-900">{characterData.baseAttributes.intelligence}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600">🏛️ 政治</p>
                  <p className="text-lg font-bold text-gray-900">{characterData.baseAttributes.politics}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600">✨ 魅力</p>
                  <p className="text-lg font-bold text-gray-900">{characterData.baseAttributes.charisma}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600">📊 总计</p>
                  <p className="text-lg font-bold text-blue-600">
                    {Object.values(characterData.baseAttributes).reduce((sum, val) => sum + val, 0).toFixed(1)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

LifeStageDetail.propTypes = {
  characterData: PropTypes.shape({
    name: PropTypes.string.isRequired,
    birthYear: PropTypes.number.isRequired,
    deathYear: PropTypes.number,
    seasons: PropTypes.arrayOf(PropTypes.object).isRequired,
    baseAttributes: PropTypes.object.isRequired,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
};
