/**
 * ExplorePanel - 探索事件面板
 * 
 * @description 从 ExploreDemo 提取的事件 UI 组件，用于正式游戏
 *              接收 useEventSystem hook 的状态和操作
 *              不再包含 MOCK 数据，所有数据来自 props
 */

import { useState, useCallback, useEffect } from 'react';
import AncientModal, { Divider } from '@/components/common/AncientModal';
import FortunePreview from './FortunePreview';
import EventBattle from './EventBattle';
import EventGobang from './EventGobang';
import { PHASE, FACTOR_CN } from './EventConstants';
import { parseRewards, parseRequiredItems, isFactorOption } from './eventUtils';
import { API_CONFIG } from '@/constants';
import { loadSharedData } from '@/services/dataService';
import TroopCard from '@shared/components/card/TroopCard';
import CharacterCard from '@shared/components/card/CharacterCard';
import EquipmentCard from '@shared/components/card/EquipmentCard';
import TitleAchievementCard from '@shared/components/card/TitleAchievementCard';

export default function ExplorePanel({ eventSystem }) {
  const {
    phase, currentEvent, chosenOption, fortune, battleResult,
    minigameInfo, isSuccess, team, replaceVars, itemNameMap, playerSilver,
    playerResources, playerItemsList,
    closeEvent, chooseOption, confirmResult, endBattle, endMinigame, closeReward,
    rewardDetails, battleScore, playerId, isTutorial,
  } = eventSystem;

  const [hoveredOption, setHoveredOption] = useState(null);

  // 选择选项时清除预览
  const handleChooseOption = useCallback((option, optionKey) => {
    setHoveredOption(null);
    chooseOption(option, optionKey);
  }, [chooseOption]);

  return (
    <>
      {/* ===== 事件对话框 ===== */}
      <AncientModal isOpen={phase === PHASE.EVENT && !!currentEvent} onClose={closeEvent}
        type="info" title={currentEvent?.event_name || ''} hideButtons>
        {currentEvent && (
          <div>
            <div className="text-xs text-gray-500 mb-2">📍 {currentEvent.location}
              {currentEvent.trigger_context === 'minigame' && <span className="ml-2 text-amber-600">🎮 迷你游戏</span>}
              {currentEvent.trigger_context === 'reward' && <span className="ml-2 text-green-600">🎁 奖励事件</span>}
            </div>
            {[currentEvent.description_1, currentEvent.description_2, currentEvent.description_3]
              .filter(Boolean).map((desc, i) => (
                <p key={i} className="text-gray-800 leading-relaxed mb-1">{replaceVars(desc)}</p>
              ))}
            <Divider />
            {(isFactorOption(currentEvent.option_a) || isFactorOption(currentEvent.option_b)) && (
              <div className="text-xs text-gray-400 mb-2">点击「预测」查看运势概率</div>
            )}
            <div className="space-y-2">
              {/* 选项A */}
              <OptionBlock
                label="🅰️" option={currentEvent.option_a} colorScheme="amber"
                team={team} hoveredOption={hoveredOption} optionKey="A"
                playerResources={playerResources} playerItemsList={playerItemsList}
                itemNameMap={itemNameMap}
                onChoose={(opt) => handleChooseOption(opt, 'A')}
                onTogglePreview={() => setHoveredOption(prev => prev === 'A' ? null : 'A')}
              />
              {/* 选项B */}
              <OptionBlock
                label="🅱️" option={currentEvent.option_b} colorScheme="blue"
                team={team} hoveredOption={hoveredOption} optionKey="B"
                playerResources={playerResources} playerItemsList={playerItemsList}
                itemNameMap={itemNameMap}
                onChoose={(opt) => handleChooseOption(opt, 'B')}
                onTogglePreview={() => setHoveredOption(prev => prev === 'B' ? null : 'B')}
              />
            </div>
          </div>
        )}
      </AncientModal>

      {/* ===== 迷你游戏（内嵌五子棋） ===== */}
      {phase === PHASE.MINIGAME && minigameInfo && (
        <EventGobang difficulty={minigameInfo.difficulty} onGameEnd={endMinigame} />
      )}

      {/* ===== 骰子动画 ===== */}
      <AncientModal isOpen={phase === PHASE.ROLLING} onClose={() => {}}
        type="info" title="因子判定中..." hideButtons preventClose>
        <div className="text-center py-6">
          <div className="text-6xl animate-bounce">🎲</div>
          <p className="text-gray-500 mt-4 text-sm">投掷骰子中...</p>
        </div>
      </AncientModal>

      {/* ===== 判定结果 ===== */}
      <AncientModal isOpen={phase === PHASE.RESULT && !!fortune} onClose={() => {}}
        type={isSuccess ? 'info' : 'warning'} title="判定结果"
        confirmText={isSuccess ? '领取奖励' : (chosenOption?.triggerBattle ? '进入战斗' : '领取奖励')}
        onConfirm={confirmResult} preventClose>
        {fortune && chosenOption && fortune.baseScore !== undefined && (
          <ResultDisplay fortune={fortune} chosenOption={chosenOption} isSuccess={isSuccess} replaceVars={replaceVars} />
        )}
      </AncientModal>

      {/* ===== 惩罚战斗（真实战斗系统） ===== */}
      {phase === PHASE.BATTLE && (
        <EventBattle onBattleEnd={endBattle} playerId={playerId} playerName={team.player?.name} playerSilver={playerSilver} currentEvent={currentEvent} />
      )}

      {/* ===== 奖励结算 ===== */}
      <AncientModal isOpen={phase === PHASE.REWARD && !!chosenOption} onClose={closeReward}
        type="reward" title="探索结算" confirmText="确定" preventClose>
        {chosenOption && (
          <RewardDisplay fortune={fortune} chosenOption={chosenOption}
            battleResult={battleResult} battleScore={battleScore}
            replaceVars={replaceVars} itemNameMap={itemNameMap}
            rewardDetails={rewardDetails} />
        )}
      </AncientModal>

      {/* ===== 探索返回中动画 ===== */}
      {phase === PHASE.RETURNING && <ReturningOverlay isTutorial={isTutorial} />}
    </>
  );
}


// ========== 子组件 ==========

/** 检查玩家是否满足 requiredItems */
function checkRequirements(requiredItems, playerResources, playerItemsList) {
  if (!requiredItems) return { canAfford: true, missing: '' };
  const costs = requiredItems.split(';').map(s => s.trim()).filter(Boolean);
  const missingList = [];
  for (const cost of costs) {
    const [key, val] = cost.split(':');
    const need = parseInt(val) || 1; // 无数量默认1
    const resourceFields = ['silver', 'food', 'reputation', 'contribution', 'morale'];
    if (resourceFields.includes(key)) {
      const have = playerResources?.[key] ?? 0;
      if (have < need) missingList.push(`${key === 'silver' ? '银两' : key === 'food' ? '粮草' : key === 'reputation' ? '声望' : key === 'contribution' ? '贡献' : '士气'}不足（${have}/${need}）`);
    } else if (key.includes('_item_')) {
      const items = playerItemsList ? (typeof playerItemsList === 'string' ? JSON.parse(playerItemsList) : playerItemsList) : {};
      const have = items[key] || 0;
      if (have < need) missingList.push(`道具不足（${have}/${need}）`);
    }
  }
  return { canAfford: missingList.length === 0, missing: missingList.join('、') };
}

/** 选项按钮块（A/B通用） */
function OptionBlock({ label, option, colorScheme, team, hoveredOption, optionKey, onChoose, onTogglePreview, playerResources, playerItemsList, itemNameMap }) {
  const isFactor = isFactorOption(option);
  const isHovered = hoveredOption === optionKey;
  const { canAfford, missing } = checkRequirements(option.requiredItems, playerResources, playerItemsList);
  const disabled = !canAfford;
  const bg = disabled
    ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60'
    : colorScheme === 'amber'
      ? 'bg-amber-50 border-amber-300 hover:bg-amber-100 hover:border-amber-400'
      : 'bg-blue-50 border-blue-300 hover:bg-blue-100 hover:border-blue-400';
  const textColor = disabled ? 'text-gray-400' : colorScheme === 'amber' ? 'text-amber-900' : 'text-blue-900';
  const btnActive = colorScheme === 'amber'
    ? 'bg-amber-200 border-amber-400 text-amber-800'
    : 'bg-blue-200 border-blue-400 text-blue-800';
  const btnIdle = colorScheme === 'amber'
    ? 'bg-amber-50 border-amber-300 text-amber-600 hover:bg-amber-100'
    : 'bg-blue-50 border-blue-300 text-blue-600 hover:bg-blue-100';

  return (
    <div>
      <div className="flex gap-2">
        <button onClick={disabled ? undefined : () => onChoose(option)}
          className={`flex-1 px-4 py-3 rounded-lg text-left transition-all border ${bg}`}>
          <div className={`font-medium ${textColor}`}>
            {label} {option.text}
            {option.requiredItems && (
              <span className={`text-xs ml-2 ${disabled ? 'text-red-400' : 'text-red-500'}`}>
                (消耗 {parseRequiredItems(option.requiredItems, itemNameMap)})
              </span>
            )}
            {option.mainFactor === 'minigame' && (
              <span className="text-xs text-amber-600 ml-2">🎮 五子棋</span>
            )}
          </div>
          {disabled && <div className="text-xs text-red-400 mt-1">⚠️ {missing}</div>}
          {isFactor && !disabled && (
            <div className="text-xs text-gray-500 mt-1">
              判定：{FACTOR_CN[option.mainFactor]}≥{option.mainRequirement} + {FACTOR_CN[option.subFactors]}≥{option.subRequirement}
            </div>
          )}
          {option.mainFactor === 'always' && !disabled && (
            <div className="text-xs text-green-600 mt-1">无需判定，直接领取</div>
          )}
          {option.mainFactor === 'minigame' && !disabled && (
            <div className="text-xs text-gray-500 mt-1">
              难度：{option.mainRequirement.split(':')[1] === 'easy' ? '简单' :
                option.mainRequirement.split(':')[1] === 'medium' ? '中等' : '困难'}
            </div>
          )}
        </button>
        {isFactor && (
          <button onClick={onTogglePreview}
            className={`px-3 rounded-lg border text-xs font-medium transition-all shrink-0
              ${isHovered ? btnActive : btnIdle}`}>
            🎲<br/>预测
          </button>
        )}
        {option.mainFactor === 'always' && (
          <button onClick={onTogglePreview}
            className={`px-3 rounded-lg border text-xs font-medium transition-all shrink-0
              ${isHovered ? btnActive : btnIdle}`}>
            🎁<br/>奖励
          </button>
        )}
      </div>
      {isHovered && isFactor && <FortunePreview option={option} team={team} />}
      {isHovered && option.mainFactor === 'always' && (
        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg text-xs">
          <div className="text-green-700 font-medium mb-1">🎁 奖励预览</div>
          <div className="text-green-800">
            {parseRewards(option.rewards || '', itemNameMap).map((r, i) => (
              <div key={i}>{r.text}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** 判定结果显示 */
function ResultDisplay({ fortune, chosenOption, isSuccess, replaceVars }) {
  const willBattle = !isSuccess && chosenOption?.triggerBattle;
  return (
    <div className="text-center">
      <div className="text-2xl mb-2">{fortune.emoji}</div>
      <div className={`text-xl font-bold ${fortune.color} mb-1`}>{fortune.name}</div>
      <div className="text-sm text-gray-500 mb-1">
        🎲 骰子：{fortune.dice}点（×{fortune.diceMultiplier}）
      </div>
      <div className="text-sm text-gray-500 mb-3">
        基础实力 {fortune.baseScore.toFixed(1)}% → 最终 {fortune.finalRate.toFixed(1)}% → 奖励倍率 ×{fortune.multiplier}
      </div>
      <Divider />
      <p className="text-gray-800 font-medium">
        {replaceVars(isSuccess ? chosenOption.successText : chosenOption.failureText)}
      </p>
      {willBattle && (
        <p className="text-red-600 text-xs mt-2">⚠️ 因子判定失败，触发惩罚战斗！</p>
      )}
    </div>
  );
}

/** 奖励结算显示 */
function RewardDisplay({ fortune, chosenOption, battleResult, battleScore, replaceVars, itemNameMap, rewardDetails }) {
  const [previewCard, setPreviewCard] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [skillsMap, setSkillsMap] = useState({});

  // 加载技能数据（用于TroopCard技能tooltip）
  useEffect(() => {
    loadSharedData('skills').then(data => {
      if (data?.skills) {
        const map = {};
        data.skills.forEach(s => { map[s.id] = s; });
        setSkillsMap(map);
      }
    }).catch(() => {});
  }, []);

  const handleCardClick = useCallback(async (cardId, cardType) => {
    if (!cardId || previewLoading) return;
    // 官职不支持预览（不是卡牌）
    if (cardType === 'position') return;
    setPreviewLoading(true);
    try {
      let endpoint, dataKey;
      if (cardType === 'troop') { endpoint = 'troops'; dataKey = 'troop'; }
      else if (cardType === 'character') { endpoint = 'characters'; dataKey = 'character'; }
      else if (cardType === 'title') { endpoint = 'titles'; dataKey = 'title'; }
      else { endpoint = 'equipment'; dataKey = 'equipment'; }
      const res = await fetch(`${API_CONFIG.BASE_URL}/config/${endpoint}/${cardId}`);
      const data = await res.json();
      if (data.success) {
        setPreviewCard({ data: data[dataKey] || data.troop || data.character || data.equipment || data.title, type: cardType });
      }
    } catch (err) {
      console.error('[RewardDisplay] 获取卡牌配置失败:', err);
    } finally {
      setPreviewLoading(false);
    }
  }, [previewLoading]);

  // 从后端 details 构建完整奖励列表（后端是唯一真相源）
  // 如果后端没有返回 details，则 fallback 到 parseRewards
  const RESOURCE_EMOJI = { reputation: '🎖️ 声望', contribution: '🤝 贡献', silver: '💰 银两', food: '🌾 粮草' };
  const buildRewardsFromDetails = useCallback((parsedRewards, details) => {
    if (!details || details.length === 0) return parsedRewards;

    const result = [];
    const typeLabel = { troop: '⚔️ 部队', character: '👤 将领', equipment: '🛡️ 装备件', title: '🎖️ 称号' };
    details.forEach(d => {
      if (d.type === 'resource') {
        const label = RESOURCE_EMOJI[d.resource] || d.resource;
        result.push({ text: `${label} +${d.amount}` });
      } else if (d.type === 'morale') {
        result.push({ text: `💪 士气 +${d.amount}` });
      } else if (d.type === 'card' || d.type === 'random_card') {
        result.push({
          text: `${typeLabel[d.cardType] || '📦 卡牌'}「${d.cardName || d.cardId}」`,
          cardId: d.cardId,
          cardType: d.cardType,
        });
      } else if (d.type === 'position') {
        result.push({ text: `👑 官职「${d.positionName}」` });
      } else if (d.type === 'item') {
        result.push({ text: `🔑 ${d.itemName || '道具'} ×${d.quantity || 1}` });
      } else if (d.type === 'character_duplicate') {
        result.push({ text: `💰 将领重复补偿 +${d.compensation}银两` });
      } else if (d.type === 'card_duplicate') {
        const label = d.cardType === 'title' ? '称号' : d.cardType === 'achievement' ? '成就' : '卡牌';
        result.push({ text: `💰 ${label}重复补偿 +${d.compensation}银两` });
      } else if (d.type === 'troop_over_limit') {
        result.push({ text: `🌾 部队超限补偿 +${d.compensation}粮草` });
      }
      // 忽略 unknown 类型（如 troopgrade 等非奖励标记）
    });
    return result;
  }, []);

  const rawRewards = parseRewards(chosenOption.rewards || '', itemNameMap, fortune?.multiplier);
  const rawBonusRewards = chosenOption.bonusRewards ? parseRewards(chosenOption.bonusRewards, itemNameMap) : [];

  // 用后端实际结果构建显示
  const rewards = buildRewardsFromDetails(rawRewards, rewardDetails?.rewards);
  const bonusRewards = buildRewardsFromDetails(rawBonusRewards, rewardDetails?.bonusRewards);

  return (
    <div>
      {/* 运势（仅因子判定显示，always类型无dice） */}
      {fortune?.dice != null && (
        <div className="text-center mb-3">
          <span className={`font-bold ${fortune.color}`}>{fortune.name}</span>
          <span className="text-gray-500 text-sm ml-2">×{fortune.multiplier}</span>
        </div>
      )}

      {/* 战斗结果 */}
      {battleResult && (
        <>
          <div className="text-center mb-2">
            <span className={battleResult === 'victory' ? 'text-green-600' : 'text-red-600'}>
              {battleResult === 'victory' ? '✅ 战斗胜利' : '❌ 战斗失败'}
            </span>
            {chosenOption.battleVictoryText && battleResult === 'victory' && (
              <p className="text-sm text-gray-600 mt-1">{replaceVars(chosenOption.battleVictoryText)}</p>
            )}
            {chosenOption.battleDefeatText && battleResult === 'defeat' && (
              <p className="text-sm text-gray-600 mt-1">{replaceVars(chosenOption.battleDefeatText)}</p>
            )}
          </div>
          {/* 战斗评分 */}
          {battleScore && (
            <div className="bg-gray-50 rounded-lg p-3 mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">战斗评分</span>
                <span className={`text-lg font-bold ${
                  battleScore.grade === 'S' ? 'text-yellow-500' :
                  battleScore.grade === 'A' ? 'text-green-500' :
                  battleScore.grade === 'B' ? 'text-blue-500' :
                  battleScore.grade === 'C' ? 'text-gray-600' : 'text-gray-400'
                }`}>
                  {battleScore.grade} · {battleScore.score}分
                </span>
              </div>
              <div className="text-xs text-gray-400 space-y-0.5">
                <div>敌方消耗 +{battleScore.details.killScore} / 己方损失 {battleScore.details.lossScore}</div>
                <div>回合倍率 ×{battleScore.details.turnMultiplier}（第{battleScore.details.roundNum}回合）</div>
              </div>
            </div>
          )}
          <Divider />
        </>
      )}

      {/* always类型显示成功文本 */}
      {chosenOption.mainFactor === 'always' && !battleResult && (
        <div className="text-center mb-3">
          <p className="text-gray-800">{replaceVars(chosenOption.successText)}</p>
        </div>
      )}

      {/* 实际奖励 */}
      <div className="text-xs text-gray-500 font-medium mb-2">
        实际奖励{fortune?.multiplier != null && fortune.multiplier !== 1.0 ? `（倍率 ×${fortune.multiplier}）` : ''}
      </div>
      <div className="space-y-1 mb-3">
        {rewards.map((r, i) => (
          <RewardItem key={i} reward={r} onCardClick={handleCardClick} />
        ))}
      </div>

      {/* 鸿运额外奖励 */}
      {fortune?.name === '鸿运' && bonusRewards.length > 0 && (
        <>
          <Divider />
          <div className="text-xs text-yellow-600 font-medium mb-2">🌟 鸿运额外奖励</div>
          <div className="space-y-1">
            {bonusRewards.map((r, i) => (
              <RewardItem key={i} reward={r} onCardClick={handleCardClick} isBonus />
            ))}
          </div>
        </>
      )}

      {/* 战斗失败额外损失 */}
      {battleResult === 'defeat' && (
        <>
          <Divider />
          <div className="text-xs text-red-500">⚠️ 战斗失败，额外损失兵力</div>
        </>
      )}

      {/* 卡牌预览弹窗 — 使用共享卡牌组件 */}
      {previewCard && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
          onClick={() => setPreviewCard(null)}>
          <div onClick={e => e.stopPropagation()} className="relative">
            {previewCard.type === 'troop' && (
              <TroopCard troop={previewCard.data} skillsMap={skillsMap} showDetails baseUrl={import.meta.env.BASE_URL} />
            )}
            {previewCard.type === 'character' && (
              <CharacterCard character={previewCard.data} skillsMap={skillsMap} showDetails baseUrl={import.meta.env.BASE_URL} />
            )}
            {previewCard.type === 'equipment' && (
              <EquipmentCard equipment={previewCard.data} baseUrl={import.meta.env.BASE_URL} />
            )}
            {previewCard.type === 'title' && (
              <TitleAchievementCard item={previewCard.data} type="title" baseUrl={import.meta.env.BASE_URL} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** 单条奖励项（卡牌类可点击） */
function RewardItem({ reward, onCardClick, isBonus }) {
  const hasCard = reward.cardId && reward.cardType;
  const textColor = isBonus ? 'text-yellow-700' : 'text-gray-800';
  if (hasCard) {
    return (
      <div className={`text-sm ${textColor} cursor-pointer hover:text-amber-600 underline decoration-dashed underline-offset-2`}
        onClick={() => onCardClick(reward.cardId, reward.cardType)}>
        {reward.text} 👁️
      </div>
    );
  }
  return <div className={`text-sm ${textColor}`}>{reward.text}</div>;
}

/** 探索返回中动画 */
function ReturningOverlay({ isTutorial }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center">
      <style>{`@keyframes returnBar { from { width: 0% } to { width: 100% } }`}</style>
      <div className="px-8 py-6 bg-black/70 rounded-xl backdrop-blur-sm text-center">
        <div className="text-4xl mb-3 animate-bounce">{isTutorial ? '📜' : '🚩'}</div>
        <div className="text-white font-bold text-lg mb-2">{isTutorial ? '新手指引进行中' : '探索返回中'}</div>
        <div className="w-48 h-2 bg-gray-700 rounded-full overflow-hidden mx-auto">
          <div className="h-full bg-amber-500 rounded-full"
            style={{ animation: 'returnBar 5s linear forwards' }} />
        </div>
        <div className="text-white/50 text-xs mt-2">{isTutorial ? '准备下一个事件...' : '正在返回探索点...'}</div>
      </div>
    </div>
  );
}
