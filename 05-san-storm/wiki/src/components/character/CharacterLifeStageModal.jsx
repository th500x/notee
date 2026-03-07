/**
 * 将领生涯详情弹窗组件
 * 
 * @description 展示将领的生涯阶段信息（采用黄巾之乱剧本框架UI风格）
 */

import { useLifeStages } from '@/hooks/useLifeStages';

function CharacterLifeStageModal({ character, onClose }) {
  const { loading, getCharacterLifeStage } = useLifeStages();
  
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl p-8 text-center border-2 border-blue-500 shadow-xl shadow-blue-500/50">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-300">加载生涯数据...</p>
        </div>
      </div>
    );
  }

  // 查找该角色的生涯数据
  const characterLifeData = getCharacterLifeStage(character.id);
  
  if (!characterLifeData) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6 border-2 border-red-500 shadow-red-500/50" onClick={(e) => e.stopPropagation()}>
          <div className="text-center">
            <p className="text-4xl mb-4">😔</p>
            <p className="text-gray-300 mb-4">暂无 {character.name} 的生涯数据</p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-300 shadow-lg"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    );
  }

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

  const stageRanges = calculateStageRanges(characterLifeData.seasons);

  // 生涯阶段配置（采用势力卡牌风格）
  const stageConfigs = {
    early: {
      name: '茅庐期',
      icon: '🌱',
      gradient: 'from-green-400 to-green-600',
      border: 'border-green-500',
      glow: 'shadow-green-500/50',
      bgGradient: 'from-green-900/20 to-green-800/20',
    },
    peak: {
      name: '巅峰期',
      icon: '⭐',
      gradient: 'from-yellow-400 to-yellow-600',
      border: 'border-yellow-500',
      glow: 'shadow-yellow-500/50',
      bgGradient: 'from-yellow-900/20 to-yellow-800/20',
    },
    late: {
      name: '不惑期',
      icon: '🧙',
      gradient: 'from-purple-400 to-purple-600',
      border: 'border-purple-500',
      glow: 'shadow-purple-500/50',
      bgGradient: 'from-purple-900/20 to-purple-800/20',
    },
    death: {
      name: '卒',
      icon: '💀',
      gradient: 'from-gray-400 to-gray-600',
      border: 'border-gray-500',
      glow: 'shadow-gray-500/50',
      bgGradient: 'from-gray-900/20 to-gray-800/20',
    },
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl shadow-2xl max-w-2xl w-full border-2 border-orange-500 shadow-orange-500/50" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 - 采用势力卡牌顶部风格 */}
        <div className="relative h-[60px] px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📜</span>
            <div>
              <h2 className="text-xl font-bold text-white">
                {characterLifeData.name} - 生涯详情
              </h2>
              <p className="text-xs text-white/80">
                {characterLifeData.birthYear}年生 - {characterLifeData.deathYear}年卒
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-3xl font-bold leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* 生涯阶段卡片网格 - 2x2布局，采用势力卡牌风格 */}
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(stageConfigs).map(([stage, config]) => (
              <div 
                key={stage}
                className={`
                  relative
                  bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900
                  rounded-lg overflow-hidden
                  border-2 ${config.border}
                  shadow-lg ${config.glow}
                  transition-all duration-300
                  hover:scale-105 hover:shadow-xl
                `}
              >
                {/* 顶部：阶段名称 */}
                <div className={`
                  relative h-[50px] px-4 py-2
                  bg-gradient-to-r ${config.gradient}
                  flex items-center gap-3
                `}>
                  <span className="text-3xl">{config.icon}</span>
                  <h3 className="text-white font-bold text-lg">
                    {config.name}
                  </h3>
                </div>

                {/* 中间：赛季范围显示 */}
                <div className={`relative p-6 bg-gradient-to-b ${config.bgGradient}`}>
                  <div className="text-center">
                    <div className="text-gray-400 text-sm mb-2">赛季范围</div>
                    <div className="text-white font-bold text-3xl">
                      {stageRanges[stage] || '-'}
                    </div>
                  </div>
                </div>

                {/* 底部：装饰边框 */}
                <div className={`h-1 bg-gradient-to-r ${config.gradient}`} />
              </div>
            ))}
          </div>
        </div>

        {/* 底部说明 */}
        <div className="px-6 pb-6">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700">
            <div className="flex items-start gap-2">
              <span className="text-blue-400 text-xl">ℹ️</span>
              <div className="flex-1">
                <p className="text-gray-300 text-sm leading-relaxed">
                  生涯阶段反映了将领在不同赛季的成长轨迹。茅庐期为初出茅庐，巅峰期为能力巅峰，不惑期为经验老道，卒为退出历史舞台。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CharacterLifeStageModal;
