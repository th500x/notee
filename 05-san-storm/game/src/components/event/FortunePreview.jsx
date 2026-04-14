/**
 * FortunePreview - 运势预览组件
 * 
 * @description 从 ExploreDemo 提取，显示运势概率分布和基准奖励
 *              接收队伍数据（显示值）进行计算
 */

import { useMemo } from 'react';
import { FORTUNE_LEVELS } from './EventConstants';
import { calcFortuneDistribution, parseRewards, exploreOptionTriggerBattle } from './eventUtils';

const BAR_COLORS = {
  '鸿运': 'bg-yellow-500',
  '大吉': 'bg-green-500',
  '吉':   'bg-blue-500',
  '凶':   'bg-orange-500',
  '大凶': 'bg-red-500',
};

export default function FortunePreview({ option, team }) {
  const { baseScore, distribution } = useMemo(
    () => calcFortuneDistribution(option, team.player, team.general1, team.general2),
    [option, team]
  );

  return (
    <div className="mt-2 rounded-lg border border-amber-600/50 overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #f5edd6 0%, #efe4c8 100%)' }}>
      <div className="px-3 py-1.5 bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800">
        <div className="text-amber-100 text-xs font-bold text-center">🎲 运势预测</div>
      </div>
      <div className="px-3 py-1 text-xs text-gray-500 border-b border-amber-600/20">
        队伍：{team.player?.name || '—'} / {team.general1?.name || '—'} / {team.general2?.name || '—'}
      </div>
      <div className="flex">
        {/* 左侧：概率分布 */}
        <div className="w-1/2 px-3 py-2 space-y-1 border-r border-amber-600/20">
          {FORTUNE_LEVELS.map(f => {
            const d = distribution[f.name];
            return (
              <div key={f.name} className="flex items-center gap-1 text-xs">
                <span className="w-10 shrink-0">{f.emoji}</span>
                <span className={`w-7 font-bold ${f.color}`}>{f.name}</span>
                <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${BAR_COLORS[f.name]}`}
                    style={{ width: `${d.probability}%` }} />
                </div>
                <span className="w-10 text-right text-gray-600">
                  {d.probability > 0 ? `${d.probability.toFixed(1)}%` : '—'}
                </span>
              </div>
            );
          })}
        </div>
        {/* 右侧：基准奖励 */}
        <div className="w-1/2 px-3 py-2">
          <div className="text-xs text-gray-500 mb-1">基准奖励：</div>
          {parseRewards(option.rewards).map((r, i) => (
            <div key={i} className="text-xs text-gray-700 leading-relaxed">{r.text}</div>
          ))}
          {option.bonusRewards && (
            <>
              <div className="text-xs text-yellow-600 mt-1.5 mb-0.5">鸿运额外：</div>
              {parseRewards(option.bonusRewards).map((r, i) => (
                <div key={i} className="text-xs text-yellow-700 leading-relaxed">{r.text}</div>
              ))}
            </>
          )}
        </div>
      </div>
      {exploreOptionTriggerBattle(option) ? (
        <div className="px-3 py-1.5 border-t border-amber-600/30 bg-amber-100/60 text-center text-xs text-amber-950 leading-snug">
          <span className="font-semibold text-red-800">⚠️ 凶/大凶将触发战斗</span>
        </div>
      ) : null}
      <div className="px-3 py-1.5 border-t border-amber-600/20 text-xs text-gray-600 text-left">
        基础实力：{baseScore.toFixed(1)}%（骰子将影响最终结果）
      </div>
    </div>
  );
}
