/**
 * 势力列表页面
 * 
 * @description 展示所有势力，支持筛选、排序
 */

import { useFactions } from '@/hooks/useFactions';
import { useCharacters } from '@/hooks/useCharacters';
import FactionCard from '@shared/components/card/FactionCard';

/**
 * 势力列表页面
 */
function FactionsPage() {
  const { factions, loading, error } = useFactions();
  const { characters, loading: charactersLoading } = useCharacters();

  if (loading || charactersLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">加载势力列表...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-600">❌ 加载失败: {error}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-4">势力系统</h2>
      <p className="text-gray-600 mb-6">
        选择你的势力，开启三国征程。每个势力都有独特的特性和玩法。
      </p>
      
      {/* 势力统计 */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900">{factions.length}</p>
            <p className="text-sm text-gray-600">势力总数</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">
              {factions.filter(f => f.difficulty === '简单').length}
            </p>
            <p className="text-sm text-gray-600">推荐势力</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">
              {factions.reduce((sum, f) => sum + (f.max_players || f.maxPlayers || 0), 0)}
            </p>
            <p className="text-sm text-gray-600">总玩家位</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-600">
              {factions.filter(f => f.difficulty === '简单' || f.difficulty === '中等').length}
            </p>
            <p className="text-sm text-gray-600">新手友好</p>
          </div>
        </div>
      </div>

      {/* 势力卡牌网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-items-center">
        {factions.map(faction => {
          // 查找君主名称
          const leader = characters.find(char => char.id === faction.leader);
          const leaderName = leader ? leader.name : faction.leader;
          
          return (
            <FactionCard 
              key={faction.id}
              faction={faction}
              leaderName={leaderName}
            />
          );
        })}
      </div>

      {/* 设计说明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-8">
        <h3 className="text-base font-semibold text-blue-900 mb-3">设计说明</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>• <strong>卡牌尺寸：</strong>256 × 384 px (2:3比例)</p>
          <p>• <strong>难度配色：</strong>简单绿色 → 中等黄色 → 困难红色 → 极难紫色</p>
          <p>• <strong>信息展示：</strong>势力名称、君主、人数上限、风格、难度、加成效果</p>
          <p>• <strong>交互效果：</strong>悬停放大、点击选择</p>
          <p>• <strong>视觉风格：</strong>与官职卡牌、部队卡牌保持一致的暗色系风格</p>
        </div>
      </div>
    </div>
  );
}

export default FactionsPage;
