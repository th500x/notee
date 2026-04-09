/**
 * 卡池抽取抽屉
 * 
 * @description 全屏抽屉，展示卡池内所有卡牌预览（按稀有度分组，50%缩放）
 *              底部固定抽取按钮 + 保底进度
 *              严格复用编组-军营的卡牌预览模式（scale 0.5, 128x192, skillsMap）
 */

import { useState, useEffect, useCallback } from 'react';
import { RARITY_LABELS, RARITY_COLORS, API_CONFIG } from '@/constants';
import TroopCard from '@shared/components/card/TroopCard';
import CharacterCard from '@shared/components/card/CharacterCard';
import {
  poolFactionDigitFromPlayerFactionId,
  cardMatchesPlayerPoolFaction,
} from '@/utils/poolCardFilters';

const poolDebug = import.meta.env.DEV;

function countByRarity(cards) {
  const m = {};
  for (const c of cards) {
    const k = String(c?.rarity ?? '').toLowerCase() || '(empty)';
    m[k] = (m[k] || 0) + 1;
  }
  return m;
}

const RARITY_ORDER = { core: 4, legendary: 3, epic: 2, rare: 1, common: 0 };
const POOL_LABEL = { troop: '部队卡池', character: '将领卡池' };
const PROB_DISPLAY = { legendary: '5%', epic: '10%', rare: '30%', common: '55%' };
const rarityLabel = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇' };

export default function CardPoolDrawer({
  poolType, status, loading, drawResult, error, skillsMap, factionId, playerSilver,
  onDraw, onClearResult, onClose, onRefreshStatus,
}) {
  const baseUrl = import.meta.env.BASE_URL;
  const poolStatus = status?.[poolType];
  const [poolCards, setPoolCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [showResult, setShowResult] = useState(false);
  const [previewCard, setPreviewCard] = useState(null);

  // 打开时刷新状态
  useEffect(() => { onRefreshStatus(); }, []);

  const loadPoolCards = useCallback(async () => {
    setCardsLoading(true);
    try {
      const endpoint = poolType === 'troop' ? 'troops' : 'characters';
      const res = await fetch(`${API_CONFIG.BASE_URL}/config/${endpoint}`);
      const data = await res.json();
      if (data.success) {
        const allCards = (data[endpoint] || []).filter((c) => c.rarity !== 'core');
        const factionNum = poolFactionDigitFromPlayerFactionId(factionId);
        const pType = poolType === 'troop' ? 'troop' : 'character';
        const filtered = factionNum
          ? allCards.filter((c) => cardMatchesPlayerPoolFaction(c?.id, pType, factionNum))
          : allCards;

        if (poolDebug) {
          console.log('[CardPoolDrawer]', endpoint, {
            factionId,
            factionDigit: factionNum,
            raw: allCards.length,
            filtered: filtered.length,
            byRarity: countByRarity(filtered),
          });
        }

        setPoolCards(filtered);
      } else if (poolDebug) {
        console.warn('[CardPoolDrawer] API success=false', data);
      }
    } catch (e) {
      console.error('[CardPoolDrawer] 加载卡池数据失败:', e);
    } finally {
      setCardsLoading(false);
    }
  }, [poolType, factionId]);

  useEffect(() => {
    loadPoolCards();
  }, [loadPoolCards]);

  useEffect(() => {
    if (drawResult?.success) {
      setShowResult(true);
      onRefreshStatus();
    }
  }, [drawResult]);

  // 按稀有度分组
  const grouped = {};
  poolCards.forEach((card) => {
    const r = String(card.rarity || 'common').toLowerCase();
    if (!grouped[r]) grouped[r] = [];
    grouped[r].push(card);
  });
  // 展示顺序：传奇 → 史诗 → 稀有 → 普通（与概率条视觉一致）
  const sortedRarities = Object.keys(grouped).sort(
    (a, b) => (RARITY_ORDER[b] ?? -1) - (RARITY_ORDER[a] ?? -1),
  );

  // 用实时银两（来自PlayerContext）判断是否可抽取
  const currentSilver = playerSilver ?? status?.silver ?? 0;
  const canDraw = !loading && (poolStatus?.remainingDraws ?? 0) > 0
    && currentSilver >= (status?.drawCost ?? 40);
  const costLabel = status?.drawCost ?? 40;

  return (
    <>
      {/* 遮罩 */}
      <div className="fixed inset-0 bg-black/50 z-[110]" onClick={onClose} />

      {/* 抽屉主体 */}
      <div className="fixed left-0 right-0 bottom-0 z-[111] bg-stone-900 border-t-2 border-amber-700/50
                      rounded-t-2xl flex flex-col top-[4.5rem] sm:top-14 min-h-0 overflow-hidden">

        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-sm font-bold">
              {poolType === 'troop' ? '⚔️' : '🎴'} {POOL_LABEL[poolType]}
            </span>
            <span className="text-stone-500 text-xs">
              （{poolType === 'troop' ? '每次2张' : '每次1张'}）
            </span>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-white text-xl px-2 py-1">✕</button>
        </div>

        {/* 概率展示条 */}
        <div className="flex items-center justify-center gap-3 px-4 py-2 bg-stone-800/60 border-b border-stone-700/50 flex-shrink-0">
          {['legendary', 'epic', 'rare', 'common'].map(r => (
            <div key={r} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: RARITY_COLORS[r] }} />
              <span className="text-stone-400 text-[10px]">{RARITY_LABELS[r]}</span>
              <span className="text-stone-500 text-[10px]">{PROB_DISPLAY[r]}</span>
            </div>
          ))}
        </div>

        {/* 卡牌预览区（可滚动，复用军营的 50% 缩放模式） */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3">
          {cardsLoading ? (
            <div className="text-center py-8 text-stone-500 text-sm">加载卡池数据中...</div>
          ) : poolCards.length === 0 ? (
            <div className="text-center py-8 text-stone-500 text-sm">暂无可用卡牌</div>
          ) : (
            sortedRarities.map(rarity => (
              <div key={rarity} className="mb-3">
                <div className="text-stone-500 text-[10px] mb-1.5 px-1 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: RARITY_COLORS[rarity] }} />
                  {rarityLabel[rarity] || rarity}（{grouped[rarity].length}）
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {grouped[rarity].map(card => (
                    <div
                      key={card.id}
                      style={{ width: 128, height: 192 }}
                      className="cursor-pointer overflow-hidden isolate"
                      onClick={() => setPreviewCard(card)}
                    >
                      <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
                        {poolType === 'troop' ? (
                          <TroopCard troop={card} skillsMap={skillsMap} showDetails baseUrl={baseUrl} disableHoverScale />
                        ) : (
                          <CharacterCard character={card} skillsMap={skillsMap} showDetails={true} baseUrl={baseUrl} disableHoverScale />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 底部固定：保底进度 + 抽取按钮 */}
        <div className="flex-shrink-0 border-t border-stone-700 bg-stone-900 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-stone-400 text-xs">🎯 传奇保底</span>
              <span className="text-amber-400 text-xs font-bold">
                {poolStatus?.pityCount ?? 0}/{poolStatus?.pityThreshold ?? 50}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-stone-400 text-xs">今日剩余</span>
              <span className={`text-xs font-bold ${(poolStatus?.remainingDraws ?? 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {poolStatus?.remainingDraws ?? 0}/{poolStatus?.dailyLimit ?? 5}
              </span>
            </div>
          </div>
          <div className="w-full h-1.5 bg-stone-700 rounded-full mb-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all"
              style={{ width: `${Math.min(100, ((poolStatus?.pityCount ?? 0) / (poolStatus?.pityThreshold ?? 50)) * 100)}%` }}
            />
          </div>
          {error && <div className="text-red-400 text-xs text-center mb-2">{error}</div>}
          <button
            onClick={onDraw}
            disabled={!canDraw}
            className={`w-full py-3 rounded-xl text-sm font-bold transition-all
              ${canDraw
                ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white hover:from-amber-500 hover:to-amber-400 active:scale-[0.98] shadow-lg shadow-amber-600/30'
                : 'bg-stone-700 text-stone-500 cursor-not-allowed'}`}
          >
            {loading ? '抽取中...' : `💰 抽取（${costLabel}银两）`}
          </button>
        </div>
      </div>

      {/* 卡牌预览浮层：点击缩略图 → 100%大小居中显示（复用军营逻辑） */}
      {previewCard && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60"
          onClick={() => setPreviewCard(null)}>
          <div onClick={e => e.stopPropagation()}>
            {poolType === 'troop' ? (
              <TroopCard troop={previewCard} skillsMap={skillsMap} showDetails={true} baseUrl={baseUrl} />
            ) : (
              <CharacterCard character={previewCard} skillsMap={skillsMap} showDetails={true} baseUrl={baseUrl} />
            )}
          </div>
        </div>
      )}

      {/* 抽取结果弹窗 */}
      {showResult && drawResult?.success && (
        <DrawResultOverlay
          poolType={poolType}
          cards={drawResult.cards}
          poolCards={poolCards}
          skillsMap={skillsMap}
          baseUrl={baseUrl}
          rarityLabel={rarityLabel}
          onClose={() => { setShowResult(false); onClearResult(); }}
        />
      )}
    </>
  );
}

/** 抽取结果弹窗 */
function DrawResultOverlay({ poolType, cards, poolCards, skillsMap, baseUrl, rarityLabel, onClose }) {
  // 用 cardId 从 poolCards 查找完整配置数据
  const poolCardsMap = {};
  poolCards.forEach(c => { poolCardsMap[c.id] = c; });

  const hasPitySuppressed = Array.isArray(cards) && cards.some((c) => c.pityLegendarySuppressed);

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-[210]" onClick={onClose} />
      <div className="fixed inset-0 z-[211] flex items-center justify-center px-4" onClick={onClose}>
        <div className="bg-stone-900 border-2 border-amber-600/50 rounded-2xl p-4 max-w-md w-full shadow-2xl"
             onClick={e => e.stopPropagation()}>
          <h3 className="text-amber-400 text-center font-bold mb-4">
            {poolType === 'troop' ? '⚔️ 部队卡抽取结果' : '🎴 将领卡抽取结果'}
          </h3>
          {hasPitySuppressed && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-amber-950/80 border border-amber-600/40 text-[11px] leading-relaxed text-amber-100/95">
              <span className="text-amber-400 font-semibold">保底说明：</span>
              本轮已触发<span className="text-orange-300">传奇保底</span>，但因<span className="text-orange-200">今日传奇卡已达获取上限</span>（每池每日最多 1 张），系统已按规则将档位降为史诗或稀有；<span className="text-stone-300">保底计数已重置</span>，并非界面错误。
            </div>
          )}
          <div className="flex justify-center gap-3 flex-wrap">
            {cards.map((card, i) => {
              // 优先使用完整配置数据，fallback 到基础字段
              const fullConfig = poolCardsMap[card.cardId];
              return (
                <div key={i} className="flex flex-col items-center">
                  <div style={{ width: 128, height: 192 }} className="overflow-hidden rounded-lg isolate">
                    <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
                      {poolType === 'troop' ? (
                        <TroopCard
                          troop={fullConfig || { id: card.cardId, name: card.cardName, rarity: card.rarity }}
                          skillsMap={skillsMap}
                          showDetails
                          baseUrl={baseUrl}
                          disableHoverScale
                        />
                      ) : (
                        <CharacterCard
                          character={fullConfig || { id: card.cardId, name: card.cardName, rarity: card.rarity }}
                          skillsMap={skillsMap}
                          showDetails={true}
                          baseUrl={baseUrl}
                          disableHoverScale
                        />
                      )}
                    </div>
                  </div>
                  <div className="mt-1 text-center">
                    <div className="text-xs font-bold" style={{ color: RARITY_COLORS[card.rarity] }}>
                      {RARITY_LABELS[card.rarity]}
                    </div>
                    <div className="text-stone-300 text-[10px]">{card.cardName || '未知'}</div>
                    {card.pityLegendarySuppressed && (
                      <div className="mt-1 text-[10px] text-amber-200/90 max-w-[140px] leading-snug">
                        本张：保底传奇 → 因今日上限实为「{rarityLabel[card.rarity] || card.rarity}」
                      </div>
                    )}
                  </div>
                  {card.compensated && (
                    <div className="mt-0.5 text-[10px] text-amber-400/80 bg-amber-900/30 px-2 py-0.5 rounded">
                      {card.compensation?.type === 'silver' ? `💰+${card.compensation.amount}` : `🌾+${card.compensation.amount}`}
                      <span className="text-stone-500 ml-1">
                        {card.reason === 'character_duplicate'
                          ? '(已持有)'
                          : card.reason === 'character_rarity_limit'
                            ? '(稀有度已满)'
                            : card.reason === 'troop_limit'
                              ? '(超限)'
                              : card.reason === 'no_card_available'
                                ? '(无可抽候选)'
                                : ''}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={onClose}
            className="w-full mt-4 py-2 bg-stone-700 hover:bg-stone-600 text-stone-300 rounded-lg text-sm transition-colors"
          >
            确认
          </button>
        </div>
      </div>
    </>
  );
}
