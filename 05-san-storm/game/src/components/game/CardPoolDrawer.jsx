/**
 * 卡池抽取抽屉
 * 
 * @description 全屏抽屉，展示卡池内所有卡牌预览（按稀有度分组，50%缩放）
 *              底部固定抽取按钮 + 保底进度
 *              严格复用编组-军营的卡牌预览模式（scale 0.5, 128x192, skillsMap）
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RARITY_LABELS, RARITY_COLORS, API_CONFIG } from '@/constants';
import { fetchWithTimeout } from '@/services/httpClient';
import { useCards } from '@/contexts/PlayerContext';
import TroopCard from '@shared/components/card/TroopCard';
import CharacterCard from '@shared/components/card/CharacterCard';
import {
  poolFactionDigitFromPlayerFactionId,
  filterCardsForPoolPreview,
} from '@/utils/poolCardFilters';
import {
  PLAYABLE_POOL_SEASON,
  RECRUIT_POOL_SEASON,
  poolDrawerTabLabel,
} from '@/constants/seasonLabels';
import {
  getNextCardPoolDrawRefreshAt,
  formatCardPoolDrawRefreshCountdown,
} from '@/utils/cardPoolHalfDayRefresh';
import { useCountdownTicker } from '@/hooks/useCountdownTicker';
import PlayerTopResourceBadges from '@/components/game/PlayerTopResourceBadges';
import PoolResultModalFrame from '@/components/game/PoolResultModalFrame';
import {
  getPoolDrawCompensationUi,
  poolDrawHasRarityLimitCompensation,
  poolDrawResultModalTitle,
} from '@/utils/poolDrawCompensationUi';
import EchoChoiceModal from '@/components/game/EchoChoiceModal';
import { formatLegendaryProbPercent } from '@/utils/factionLegendaryReserveDisplay';

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
const rarityLabel = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇' };

/** 抽屉标题旁 · 卡池机制一句话（21-1 残影 / 22-1 老兵） */
const POOL_MECHANIC_HINT = {
  character: '重复已拥有将领可三选一：强攻/坚守残影或转化；卡池残影最多 2 槽',
  troop: '传奇·核心部队战后累计达阈值可晋升老兵，roll 全属性永久加成',
};

export default function CardPoolDrawer({
  poolType, status, loading, choiceLoading, drawResult, echoChoiceError, error, skillsMap, factionId, playerSilver,
  onDraw, onClearResult, onClose, onRefreshStatus, onResolveEchoChoice, onAfterEchoChoice, onResumePendingEcho,
}) {
  const baseUrl = import.meta.env.BASE_URL;
  const inventoryCards = useCards();
  const ownedPoolConfigIds = useMemo(() => {
    const want = poolType === 'troop' ? 'troop' : 'character';
    const s = new Set();
    for (const c of inventoryCards) {
      if (c.cardType === want && c.cardId != null && String(c.cardId).length > 0) {
        s.add(String(c.cardId));
      }
    }
    return s;
  }, [inventoryCards, poolType]);

  const isPoolConfigOwned = useCallback(
    (configId) => ownedPoolConfigIds.has(String(configId)),
    [ownedPoolConfigIds],
  );

  const poolStatus = status?.[poolType];
  const probDisplay = useMemo(() => {
    const probs = poolStatus?.probabilities || status?.probabilities;
    if (!probs) {
      return { legendary: '5%', epic: '10%', rare: '30%', common: '55%' };
    }
    return {
      legendary: formatLegendaryProbPercent(probs.legendary),
      epic: formatLegendaryProbPercent(probs.epic),
      rare: formatLegendaryProbPercent(probs.rare),
      common: formatLegendaryProbPercent(probs.common),
    };
  }, [poolStatus?.probabilities, status?.probabilities]);
  const legendaryQuota = poolStatus?.legendaryQuota ?? 0;
  const nowTick = useCountdownTicker(!!poolType, 60_000);
  const nextDrawRefreshAt = useMemo(
    () => getNextCardPoolDrawRefreshAt(new Date(nowTick)),
    [nowTick],
  );
  const drawRefreshCountdownLabel = useMemo(
    () => formatCardPoolDrawRefreshCountdown(nextDrawRefreshAt, nowTick),
    [nextDrawRefreshAt, nowTick],
  );
  const autoRefreshBoundaryRef = useRef(0);
  const loadGenerationRef = useRef(0);

  useEffect(() => {
    if (!poolType || typeof onRefreshStatus !== 'function') return;
    const msLeft = nextDrawRefreshAt.getTime() - nowTick;
    if (msLeft > 1500) return;
    const boundary = nextDrawRefreshAt.getTime();
    if (autoRefreshBoundaryRef.current === boundary) return;
    if (msLeft <= 0) {
      autoRefreshBoundaryRef.current = boundary;
      onRefreshStatus();
    }
  }, [poolType, nextDrawRefreshAt, nowTick, onRefreshStatus]);

  const [basePoolCards, setBasePoolCards] = useState([]);
  const [recruitPoolCards, setRecruitPoolCards] = useState([]);
  const [characterPoolTab, setCharacterPoolTab] = useState('base');
  const [cardsLoading, setCardsLoading] = useState(true);
  const [showResult, setShowResult] = useState(false);
  const [previewCard, setPreviewCard] = useState(null);

  const recruitEnabled =
    poolType === 'character' &&
    !!status?.recruit?.enabled &&
    !!status?.recruit?.san0Band;

  const displayPoolCards = useMemo(() => {
    if (poolType !== 'character' || !recruitEnabled) return basePoolCards;
    return characterPoolTab === 'recruit' ? recruitPoolCards : basePoolCards;
  }, [poolType, recruitEnabled, characterPoolTab, basePoolCards, recruitPoolCards]);

  const activeDrawSeason = useMemo(() => {
    if (poolType !== 'character') return PLAYABLE_POOL_SEASON;
    if (!recruitEnabled) return PLAYABLE_POOL_SEASON;
    return characterPoolTab === 'recruit' ? RECRUIT_POOL_SEASON : PLAYABLE_POOL_SEASON;
  }, [poolType, recruitEnabled, characterPoolTab]);

  const drawerTitle = useMemo(() => {
    if (poolType === 'troop') {
      return `⚔️ ${poolDrawerTabLabel('troop', PLAYABLE_POOL_SEASON)}`;
    }
    if (recruitEnabled) {
      const seasonKey = characterPoolTab === 'recruit' ? RECRUIT_POOL_SEASON : PLAYABLE_POOL_SEASON;
      return `🎴 ${poolDrawerTabLabel('character', seasonKey)}`;
    }
    return `🎴 ${poolDrawerTabLabel('character', PLAYABLE_POOL_SEASON)}`;
  }, [poolType, recruitEnabled, characterPoolTab]);

  const loadPoolCards = useCallback(async () => {
    const gen = ++loadGenerationRef.current;
    setCardsLoading(true);
    try {
      let recruitInfo = status?.recruit ?? null;
      if (typeof onRefreshStatus === 'function') {
        const fresh = await onRefreshStatus();
        if (gen !== loadGenerationRef.current) return;
        if (fresh?.recruit != null) {
          recruitInfo = fresh.recruit;
        }
      }

      const endpoint = poolType === 'troop' ? 'troops' : 'characters';
      const pType = poolType === 'troop' ? 'troop' : 'character';
      const factionNum = poolFactionDigitFromPlayerFactionId(factionId);
      const san0Band = recruitInfo?.san0Band || null;
      const recruitOn =
        poolType === 'character' && recruitInfo?.enabled && san0Band;

      const fetchSeasonCards = async (season, opts) => {
        const res = await fetchWithTimeout(
          `${API_CONFIG.BASE_URL}/config/${endpoint}?season=${encodeURIComponent(season)}`,
        );
        const data = await res.json();
        if (!data.success) return [];
        const allCards = (data[endpoint] || []).filter((c) => c.rarity !== 'core');
        return filterCardsForPoolPreview(allCards, pType, factionNum, opts);
      };

      const baseCards = await fetchSeasonCards(PLAYABLE_POOL_SEASON, {
        season: PLAYABLE_POOL_SEASON,
      });
      if (gen !== loadGenerationRef.current) return;

      let recruitCards = [];
      if (recruitOn) {
        recruitCards = await fetchSeasonCards(RECRUIT_POOL_SEASON, {
          season: RECRUIT_POOL_SEASON,
          san0Band,
        });
        if (gen !== loadGenerationRef.current) return;
        if (poolDebug) {
          console.log('[CardPoolDrawer] recruit pool', {
            san0Band,
            count: recruitCards.length,
            byRarity: countByRarity(recruitCards),
          });
        }
      }

      setBasePoolCards(baseCards);
      setRecruitPoolCards(recruitCards);

      if (poolDebug) {
        console.log('[CardPoolDrawer]', endpoint, {
          factionId,
          factionDigit: factionNum,
          base: baseCards.length,
          recruit: recruitOn ? recruitCards.length : 'off',
          byRarity: countByRarity(baseCards),
        });
      }
    } catch (e) {
      console.error('[CardPoolDrawer] 加载卡池数据失败:', e);
    } finally {
      if (gen === loadGenerationRef.current) {
        setCardsLoading(false);
      }
    }
  }, [
    poolType,
    factionId,
    status?.recruit?.enabled,
    status?.recruit?.san0Band,
    onRefreshStatus,
  ]);

  useEffect(() => {
    if (poolType !== 'character') setCharacterPoolTab('base');
  }, [poolType]);

  useEffect(() => {
    loadPoolCards();
  }, [loadPoolCards]);

  /** 仅打开将领卡池时恢复 pending 三选一（部队卡池不触发） */
  useEffect(() => {
    if (poolType !== 'character') return;
    if (typeof onResumePendingEcho !== 'function') return;
    onResumePendingEcho();
  }, [poolType, onResumePendingEcho, status?.pendingEchoChoice?.pendingEchoDrawId]);

  useEffect(() => {
    if (drawResult?.success) {
      setShowResult(true);
      onRefreshStatus?.();
    }
  }, [drawResult, onRefreshStatus]);

  const poolCardsMapForDup = useMemo(() => {
    const m = {};
    displayPoolCards.forEach((c) => { m[c.id] = c; });
    return m;
  }, [displayPoolCards]);

  const pendingEchoCard = useMemo(() => {
    if (!drawResult?.echoChoiceRequired || !Array.isArray(drawResult.cards)) return null;
    const card = drawResult.cards.find((c) => c.echoChoiceRequired) || drawResult.cards[0];
    if (!card?.cardId) return null;
    return poolCardsMapForDup[card.cardId] || {
      id: card.cardId,
      name: card.cardName || card.cardId,
      rarity: card.rarity || 'common',
    };
  }, [drawResult, poolCardsMapForDup]);

  const handleEchoConfirm = useCallback(async (choice) => {
    if (!choice || typeof onResolveEchoChoice !== 'function') return;
    const pendingId = drawResult?.pendingEchoDrawId ?? status?.pendingEchoChoice?.pendingEchoDrawId;
    const res = await onResolveEchoChoice(choice, pendingId);
    if (!res?.success) return;
    setShowResult(false);
    onClearResult();
    if (typeof onAfterEchoChoice === 'function') {
      void onAfterEchoChoice(res);
    }
    if (typeof onRefreshStatus === 'function') {
      void onRefreshStatus();
    }
  }, [
    onResolveEchoChoice,
    onAfterEchoChoice,
    onClearResult,
    onRefreshStatus,
    drawResult?.pendingEchoDrawId,
    status?.pendingEchoChoice?.pendingEchoDrawId,
  ]);

  // 按稀有度分组
  const grouped = {};
  displayPoolCards.forEach((card) => {
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
  const nextDrawCost = poolStatus?.nextDrawCost ?? status?.drawCostTiers?.[0]?.cost ?? 30;
  const pendingEchoBlocking = poolType === 'character' && (
    !!status?.pendingEchoChoice?.pendingEchoDrawId
    || !!drawResult?.echoChoiceRequired
  );
  const canDraw = !loading && !pendingEchoBlocking && (poolStatus?.remainingDraws ?? 0) > 0
    && nextDrawCost != null && currentSilver >= nextDrawCost;
  const costLabel = nextDrawCost ?? '—';

  return (
    <>
      {/* 遮罩 */}
      <div className="fixed inset-0 bg-black/50 z-[130]" onClick={onClose} />

      {/* 抽屉主体 */}
      <div className="fixed left-0 right-0 bottom-0 z-[131] bg-stone-900 border-t-2 border-amber-700/50
                      rounded-t-2xl flex flex-col top-[4.5rem] sm:top-14 min-h-0 overflow-hidden
                      isolate">

        {/* 标题栏：与大地图顶栏同口径的四项资源靠右上（三公府封赏卡池） */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-stone-700 flex-shrink-0 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <span className="text-amber-400 text-sm font-bold truncate shrink-0 max-w-[42%] sm:max-w-none">
              {drawerTitle}
            </span>
            <span className="text-stone-500 text-xs shrink-0">
              （{poolType === 'troop' ? '每次2张' : '每次1张'}）
            </span>
            <span
              className="hidden md:inline text-stone-500 text-[10px] leading-snug truncate min-w-0 flex-1"
              title={POOL_MECHANIC_HINT[poolType]}
            >
              {POOL_MECHANIC_HINT[poolType]}
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 pointer-events-auto">
            <PlayerTopResourceBadges variant="panel" />
            <button type="button" onClick={onClose} className="text-stone-400 hover:text-white text-xl px-2 py-1 shrink-0" aria-label="关闭">
              ✕
            </button>
          </div>
        </div>

        <p className="md:hidden px-4 pb-2 -mt-1 text-stone-500 text-[10px] leading-snug border-b border-stone-700/50 flex-shrink-0">
          {POOL_MECHANIC_HINT[poolType]}
        </p>

        {recruitEnabled ? (
          <div className="flex gap-1 px-3 py-2 bg-stone-900/80 border-b border-stone-700/50 flex-shrink-0">
            {[
              { key: 'base', season: PLAYABLE_POOL_SEASON },
              { key: 'recruit', season: RECRUIT_POOL_SEASON },
            ].map((tab) => {
              const active = characterPoolTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setCharacterPoolTab(tab.key)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                    active
                      ? 'border-amber-600/70 bg-amber-950/50 text-amber-100'
                      : 'border-stone-600/70 bg-stone-800/60 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {poolDrawerTabLabel('character', tab.season)}
                </button>
              );
            })}
          </div>
        ) : null}

        {/* 概率展示条 */}
        <div className="flex items-center justify-center gap-3 px-4 py-2 bg-stone-800/60 border-b border-stone-700/50 flex-shrink-0">
          {['legendary', 'epic', 'rare', 'common'].map(r => (
            <div key={r} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: RARITY_COLORS[r] }} />
              <span className="text-stone-400 text-[10px]">{RARITY_LABELS[r]}</span>
              <span className="text-stone-500 text-[10px]">{probDisplay[r]}</span>
            </div>
          ))}
        </div>

        {/* 卡牌预览区（可滚动，复用军营的 50% 缩放模式） */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 bg-stone-900 relative z-0">
          {cardsLoading ? (
            <div className="text-center py-8 text-stone-500 text-sm">加载卡池数据中...</div>
          ) : displayPoolCards.length === 0 ? (
            <div className="text-center py-8 text-stone-500 text-sm">
              {recruitEnabled && characterPoolTab === 'recruit' ? (
                Number(status?.recruit?.catalogCount) === 0 ? (
                  <>
                    楚汉争霸卡池暂无将领：服务端尚未同步楚汉时代将领配置（与招贤是否批准无关）。
                    {poolDebug ? (
                      <span className="mt-2 block text-[10px] text-stone-600">
                        开发提示：在 backend 目录执行 node database/import-config-data.js characters
                      </span>
                    ) : null}
                  </>
                ) : (
                  '招贤池暂无可用将领（请确认朝政·招贤纳士已开启）'
                )
              ) : (
                '暂无可用卡牌'
              )}
            </div>
          ) : (
            sortedRarities.map(rarity => (
              <div key={rarity} className="mb-3">
                <div className="text-stone-500 text-[10px] mb-1.5 px-1 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: RARITY_COLORS[rarity] }} />
                  {rarityLabel[rarity] || rarity}（{grouped[rarity].length}）
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {grouped[rarity].map(card => {
                    const owned = isPoolConfigOwned(card.id);
                    return (
                      <div
                        key={card.id}
                        style={{ width: 128, height: 192 }}
                        className="relative cursor-pointer overflow-hidden rounded-sm bg-stone-900"
                        onClick={() => setPreviewCard(card)}
                        aria-label={owned ? `${card.name || card.id}（已拥有）` : (card.name || String(card.id))}
                      >
                        <div
                          style={{
                            transform: 'scale(0.5)',
                            transformOrigin: 'top left',
                            width: 256,
                            height: 384,
                            overflow: 'hidden',
                          }}
                        >
                          {poolType === 'troop' ? (
                            <TroopCard
                              troop={card}
                              skillsMap={skillsMap}
                              showDetails
                              baseUrl={baseUrl}
                              disableHoverScale
                              suppressSkillTooltips
                            />
                          ) : (
                            <CharacterCard character={card} skillsMap={skillsMap} showDetails={true} baseUrl={baseUrl} disableHoverScale />
                          )}
                        </div>
                        {owned && (
                          <div
                            className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-sm bg-black/45"
                            aria-hidden
                          >
                            <span
                              className="min-w-[5.25rem] rounded-lg border-2 border-amber-500/75 bg-neutral-950 px-3.5 py-2 text-center text-[11px] font-bold leading-snug text-amber-50 shadow-xl ring-2 ring-black/40"
                            >
                              已拥有
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 底部固定：保底进度 + 抽取按钮 */}
        <div className="flex-shrink-0 border-t border-stone-700 bg-stone-900 px-4 py-3">
          <p className="mb-2 text-[10px] leading-snug text-stone-500 text-center">
            势力{poolType === 'troop' ? '部队' : '将领'}传奇储备 {legendaryQuota} 张 · 概率随储备变化（0 张时自然传奇 0%）
          </p>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-stone-400 text-xs">🎯 传奇保底</span>
              <span className="text-amber-400 text-xs font-bold">
                {poolStatus?.pityCount ?? 0}/{poolStatus?.pityThreshold ?? 50}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 max-w-[62%]">
              <span className="text-stone-400 text-xs shrink-0">今日剩余</span>
              <span className={`text-xs font-bold tabular-nums shrink-0 ${(poolStatus?.remainingDraws ?? 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {poolStatus?.remainingDraws ?? 0}/{poolStatus?.dailyLimit ?? 10}
              </span>
              <span
                className="text-[10px] tabular-nums text-stone-500 shrink-0"
                title="半天窗刷新后可再抽（08:00 / 12:00）"
              >
                {drawRefreshCountdownLabel}
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
          {pendingEchoBlocking && (
            <div className="text-amber-300 text-xs text-center mb-2 leading-relaxed">
              有待处理的重复将领选择，请先完成上方弹窗中的三选一
            </div>
          )}
          {recruitEnabled ? (
            <p className="text-[10px] text-stone-500 text-center mb-2 leading-snug">
              当前从「{poolDrawerTabLabel('character', activeDrawSeason)}」抽取（费用 / 次数 / 传奇保底共用）
            </p>
          ) : null}
          <button
            onClick={() => onDraw(activeDrawSeason)}
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

      {/* 重复将领三选一（仅将领卡池） */}
      {poolType === 'character' && showResult && drawResult?.success && drawResult.echoChoiceRequired && (
        <EchoChoiceModal
          card={pendingEchoCard}
          echoState={drawResult.echoState}
          pendingEchoDrawId={drawResult.pendingEchoDrawId}
          skillsMap={skillsMap}
          baseUrl={baseUrl}
          loading={choiceLoading}
          error={echoChoiceError}
          onConfirm={handleEchoConfirm}
        />
      )}

      {/* 抽取结果弹窗 */}
      {showResult && drawResult?.success && !drawResult.echoChoiceRequired && (
        <DrawResultOverlay
          poolType={poolType}
          cards={drawResult.cards}
          poolCards={displayPoolCards}
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
  const hasRarityLimitComp = poolDrawHasRarityLimitCompensation(cards);
  const primaryCompUi = Array.isArray(cards)
    ? cards.map((c) => getPoolDrawCompensationUi(c, poolType)).find(Boolean)
    : null;
  const modalTitle = poolDrawResultModalTitle(cards, poolType);

  return (
    <PoolResultModalFrame
      title={modalTitle}
      onClose={onClose}
    >
      {hasRarityLimitComp && primaryCompUi && (
        <div className="mb-3 px-3 py-2.5 rounded-lg bg-rose-950/90 border-2 border-rose-500/50 text-[12px] leading-relaxed text-rose-50">
          <div className="text-rose-300 font-bold text-sm mb-1">{primaryCompUi.bannerTitle}</div>
          <div>{primaryCompUi.bannerBody}</div>
        </div>
      )}
      {!hasRarityLimitComp && primaryCompUi && (
        <div className="mb-3 px-3 py-2.5 rounded-lg bg-amber-950/90 border-2 border-amber-500/40 text-[12px] leading-relaxed text-amber-50">
          <div className="text-amber-300 font-bold text-sm mb-1">{primaryCompUi.bannerTitle}</div>
          <div>{primaryCompUi.bannerBody}</div>
        </div>
      )}
      {hasPitySuppressed && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-amber-950/80 border border-amber-600/40 text-[11px] leading-relaxed text-amber-100/95">
          <span className="text-amber-400 font-semibold">保底说明：</span>
          本轮已触发<span className="text-orange-300">传奇保底</span>，但因<span className="text-orange-200">今日传奇卡已达获取上限</span>（每池每日最多 1 张），系统已按规则将档位降为史诗或稀有；<span className="text-stone-300">保底计数已重置</span>，并非界面错误。
        </div>
      )}
      <div className="flex justify-center gap-3 flex-wrap">
        {cards.map((card, i) => {
          const fullConfig = poolCardsMap[card.cardId];
          const compUi = getPoolDrawCompensationUi(card, poolType);
          return (
            <div key={i} className="flex flex-col items-center">
              <div
                style={{ width: 128, height: 192 }}
                className={`overflow-hidden rounded-lg bg-stone-900 relative ${card.compensated ? 'opacity-45 grayscale' : ''}`}
              >
                {card.compensated && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                    <span className="px-2 py-1 rounded bg-black/75 text-[10px] font-bold text-rose-200 border border-rose-500/60">
                      未入背包
                    </span>
                  </div>
                )}
                <div
                  style={{
                    transform: 'scale(0.5)',
                    transformOrigin: 'top left',
                    width: 256,
                    height: 384,
                    overflow: 'hidden',
                  }}
                >
                  {poolType === 'troop' ? (
                    <TroopCard
                      troop={fullConfig || { id: card.cardId, name: card.cardName, rarity: card.rarity }}
                      skillsMap={skillsMap}
                      showDetails
                      baseUrl={baseUrl}
                      disableHoverScale
                      suppressSkillTooltips
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
              {card.compensated && compUi && (
                <div className="mt-1.5 text-[11px] font-semibold text-rose-200 bg-rose-950/80 border border-rose-500/50 px-2.5 py-1 rounded-md text-center max-w-[150px] leading-snug">
                  {compUi.cardTag}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </PoolResultModalFrame>
  );
}
