/**
 * 道具卡池抽屉：3×3 轮盘（外 8 奖 + 中心剩余次数），费用/半天窗与将领·部队卡池一致。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import PlayerTopResourceBadges from '@/components/game/PlayerTopResourceBadges';
import PoolResultModalFrame from '@/components/game/PoolResultModalFrame';
import {
  getNextCardPoolDrawRefreshAt,
  formatCardPoolDrawRefreshCountdown,
} from '@/utils/cardPoolHalfDayRefresh';
import { useCountdownTicker } from '@/hooks/useCountdownTicker';
import { getBatchDrawTotalCost } from '@shared/utils/cardPoolDrawEconomy.js';

/** 轮盘外圈顺序：左上 → 右上 → …（中心为抽次） */
const SLOT_ORDER = [
  'treasure_4xxx',
  'treasure_5xxx',
  'badge_x1',
  'token_x1',
  'jade_x1',
  'badge_x20',
  'food_150',
  'food_200',
];

const FALLBACK_LABELS = {
  treasure_4xxx: '随机传奇宝物×1',
  treasure_5xxx: '随机核心宝物×1',
  badge_x1: '黄巾徽章×1',
  badge_x20: '黄巾徽章×20',
  token_x1: '兵符×1',
  jade_x1: '玉牌×1',
  food_150: '粮草×150',
  food_200: '粮草×200',
};

/**
 * @param {{
 *   status: object|null,
 *   loading?: boolean,
 *   drawResult?: object|null,
 *   error?: string|null,
 *   playerSilver?: number|null,
 *   onDraw: (poolSeason: null, drawMode?: 'single'|'batch') => void | Promise<void>,
 *   onClearResult: () => void,
 *   onClose: () => void,
 *   onRefreshStatus?: () => void | Promise<void>,
 * }} props
 */
export default function ItemCardPoolDrawer({
  status,
  loading = false,
  drawResult = null,
  error = null,
  playerSilver = null,
  onDraw,
  onClearResult,
  onClose,
  onRefreshStatus,
}) {
  const [showResult, setShowResult] = useState(false);
  const [highlightPrizeId, setHighlightPrizeId] = useState(null);
  const nowMs = useCountdownTicker(1000);

  useEffect(() => {
    void onRefreshStatus?.();
  }, [onRefreshStatus]);

  useEffect(() => {
    if (!drawResult?.success) return;
    setShowResult(true);
    const first = drawResult.cards?.[0];
    const pid = first?.prizeId || null;
    setHighlightPrizeId(pid);
    if (!pid) return undefined;
    const t = window.setTimeout(() => setHighlightPrizeId(null), 2200);
    return () => window.clearTimeout(t);
  }, [drawResult]);

  const poolStatus = status?.item;
  const prizesById = useMemo(() => {
    const m = {};
    for (const p of poolStatus?.prizes || []) {
      m[p.id] = p;
    }
    return m;
  }, [poolStatus?.prizes]);

  const slots = useMemo(
    () =>
      SLOT_ORDER.map((id) => ({
        id,
        label: prizesById[id]?.label || FALLBACK_LABELS[id] || id,
        chancePercent: prizesById[id]?.chancePercent,
      })),
    [prizesById],
  );

  const currentSilver = playerSilver ?? status?.silver ?? 0;
  const dailyLimit = poolStatus?.dailyLimit ?? 10;
  const remainingDraws = poolStatus?.remainingDraws ?? 0;
  const nextDrawCost = poolStatus?.nextDrawCost ?? status?.drawCostTiers?.[0]?.cost ?? 30;
  const batchDrawCost =
    poolStatus?.batchDrawTotalCost ?? status?.batchDrawTotalCost ?? getBatchDrawTotalCost();
  const canBatchDraw =
    !loading &&
    (poolStatus?.canBatchDraw ?? remainingDraws === dailyLimit) &&
    remainingDraws === dailyLimit &&
    currentSilver >= batchDrawCost;
  const canSingleDraw =
    !loading && remainingDraws > 0 && nextDrawCost != null && currentSilver >= nextDrawCost;

  const drawRefreshAt = useMemo(() => getNextCardPoolDrawRefreshAt(new Date(nowMs)), [nowMs]);
  const drawRefreshCountdownLabel = formatCardPoolDrawRefreshCountdown(drawRefreshAt, nowMs);

  const handleResultClose = useCallback(() => {
    setShowResult(false);
    setHighlightPrizeId(null);
    onClearResult();
  }, [onClearResult]);

  const resultLines = useMemo(() => {
    if (!drawResult?.cards?.length) return [];
    return drawResult.cards.map((c, i) => ({
      key: `${c.prizeId || c.cardId || i}-${i}`,
      text: c.displayName || c.cardName || c.prizeLabel || c.cardId || '奖品',
    }));
  }, [drawResult]);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[130]" onClick={onClose} aria-hidden="true" />

      <div
        className="fixed left-0 right-0 bottom-0 z-[131] bg-stone-900 border-t-2 border-amber-700/50
                      rounded-t-2xl flex flex-col top-[4.5rem] sm:top-14 min-h-0 overflow-hidden isolate"
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-stone-700 flex-shrink-0 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <span className="text-amber-400 text-sm font-bold truncate">道具卡池</span>
            <span className="text-stone-500 text-xs shrink-0">（每次 1 奖）</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 pointer-events-auto">
            <PlayerTopResourceBadges variant="panel" />
            <button
              type="button"
              onClick={onClose}
              className="text-stone-400 hover:text-white text-xl px-2 py-1 shrink-0"
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 flex flex-col items-center justify-center gap-4">
          <div
            className="grid grid-cols-3 gap-2 w-full max-w-sm mx-auto"
            role="list"
            aria-label="道具卡池奖品轮盘"
          >
            {Array.from({ length: 9 }, (_, idx) => {
              if (idx === 4) {
                return (
                  <button
                    key="center"
                    type="button"
                    onClick={() => {
                      if (canSingleDraw) void onDraw(null, 'single');
                    }}
                    disabled={!canSingleDraw}
                    className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 px-1
                      ${canSingleDraw
                        ? 'border-amber-500/70 bg-gradient-to-b from-amber-900/80 to-stone-900 text-amber-100'
                        : 'border-stone-600 bg-stone-800/80 text-stone-500 cursor-not-allowed'}`}
                  >
                    <span className="text-[10px] text-stone-400">剩余</span>
                    <span
                      className={`text-lg font-bold tabular-nums ${
                        remainingDraws > 0 ? 'text-amber-300' : 'text-red-400'
                      }`}
                    >
                      {remainingDraws}
                      <span className="text-xs font-normal text-stone-500">/{dailyLimit}</span>
                    </span>
                    <span className="text-[9px] text-stone-500 tabular-nums">
                      {drawRefreshCountdownLabel}
                    </span>
                  </button>
                );
              }
              const slotIndex = idx < 4 ? idx : idx - 1;
              const slot = slots[slotIndex];
              const lit = highlightPrizeId && slot?.id === highlightPrizeId;
              return (
                <div
                  key={slot?.id || idx}
                  role="listitem"
                  className={`aspect-square rounded-xl border flex flex-col items-center justify-center px-1.5 text-center transition-all
                    ${lit
                      ? 'border-amber-400 bg-amber-950/70 shadow-lg shadow-amber-600/40 scale-[1.03]'
                      : 'border-amber-800/40 bg-stone-800/90'}`}
                >
                  <span className="text-[11px] leading-snug text-stone-100 font-medium">
                    {slot?.label}
                  </span>
                  {slot?.chancePercent != null ? (
                    <span className="mt-1 text-[9px] text-stone-500 tabular-nums">
                      {slot.chancePercent}%
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>

          {error ? <div className="text-red-400 text-xs text-center">{error}</div> : null}

          {remainingDraws > 0 && remainingDraws < dailyLimit ? (
            <p className="text-[10px] text-stone-500 text-center leading-snug max-w-sm">
              本窗已进行过单抽，十连不可用；剩余次数仅可继续单抽
            </p>
          ) : null}
          {remainingDraws === dailyLimit ? (
            <p className="text-[10px] text-stone-500 text-center leading-snug max-w-sm">
              单抽与十连互斥：须先选一种方式用完本窗 {dailyLimit} 次额度
            </p>
          ) : null}
        </div>

        <div className="flex-shrink-0 border-t border-stone-700 bg-stone-900/95 px-3 py-3 safe-area-pb">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void onDraw(null, 'single')}
              disabled={!canSingleDraw}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all
                ${canSingleDraw
                  ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white hover:from-amber-500 hover:to-amber-400 active:scale-[0.98] shadow-lg shadow-amber-600/30'
                  : 'bg-stone-700 text-stone-500 cursor-not-allowed'}`}
            >
              {loading ? '抽取中...' : `💰 抽取（${nextDrawCost ?? '—'}银两）`}
            </button>
            <button
              type="button"
              onClick={() => void onDraw(null, 'batch')}
              disabled={!canBatchDraw}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all
                ${canBatchDraw
                  ? 'bg-gradient-to-r from-orange-700 to-orange-600 text-white hover:from-orange-600 hover:to-orange-500 active:scale-[0.98] shadow-lg shadow-orange-700/30'
                  : 'bg-stone-700 text-stone-500 cursor-not-allowed'}`}
            >
              {loading ? '抽取中...' : `💰 十连（${batchDrawCost}银两 · 赠2抽）`}
            </button>
          </div>
        </div>
      </div>

      {showResult && drawResult?.success ? (
        <PoolResultModalFrame title="🎁 道具卡池结果" onClose={handleResultClose}>
          <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
            {resultLines.map((line) => (
              <li
                key={line.key}
                className="rounded-lg border border-amber-800/40 bg-stone-800/80 px-3 py-2 text-sm text-amber-50 text-center"
              >
                {line.text}
              </li>
            ))}
          </ul>
          {drawResult.cost != null ? (
            <p className="mt-3 text-center text-[11px] text-stone-500">
              消耗 {drawResult.cost} 银两 · 剩余 {drawResult.remainingDraws ?? '—'} 次
            </p>
          ) : null}
        </PoolResultModalFrame>
      ) : null}
    </>
  );
}
