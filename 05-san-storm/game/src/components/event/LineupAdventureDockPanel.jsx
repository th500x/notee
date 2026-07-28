/**
 * 战场入口 · 编组探险格：打开 Extra 挂机派遣面板（14-3）。
 * 与 Explore / 匪寨同构：标题 / 状态 / 兵符行 / 说明 / 按钮。
 */

import { useCallback, useEffect, useState } from 'react';
import { adventureAPI } from '@/services/adventureApi';

const SLOT_LABELS = { 1: 'A', 2: 'B', 3: 'C', 4: 'D' };

/**
 * @param {{
 *   playerId?: string|null,
 *   interactionsLocked?: boolean,
 *   onOpen: () => void,
 *   refreshKey?: number,
 *   rootClassName?: string,
 * }} props
 */
export default function LineupAdventureDockPanel({
  playerId = null,
  interactionsLocked = false,
  onOpen,
  refreshKey = 0,
  rootClassName = '',
}) {
  const [loading, setLoading] = useState(false);
  const [statusLabel, setStatusLabel] = useState('—');
  const [detailLines, setDetailLines] = useState([]);
  const [canOpen, setCanOpen] = useState(false);
  const [hasReady, setHasReady] = useState(false);
  const [tokens, setTokens] = useState(0);
  const [costPerDispatch, setCostPerDispatch] = useState(1);

  const load = useCallback(async () => {
    if (!playerId || interactionsLocked) {
      setStatusLabel(interactionsLocked ? '抵达战场入口后方可派遣' : '登录后可派遣');
      setDetailLines([]);
      setCanOpen(false);
      setHasReady(false);
      setTokens(0);
      return;
    }
    setLoading(true);
    try {
      const res = await adventureAPI.getStatus(playerId);
      if (!res?.success) {
        setStatusLabel(res?.error || '状态加载失败');
        setDetailLines([]);
        setCanOpen(false);
        setHasReady(false);
        setTokens(0);
        return;
      }
      const list = Array.isArray(res.adventures)
        ? res.adventures
        : res.adventure
          ? [res.adventure]
          : [];
      const max = Number(res.maxConcurrent) > 0 ? Number(res.maxConcurrent) : 4;
      const cost = Number(res.costPerDispatch) > 0 ? Number(res.costPerDispatch) : 1;
      const tokenN =
        res.tacticTokenRemaining != null
          ? Math.max(0, Math.floor(Number(res.tacticTokenRemaining) || 0))
          : 0;
      const readyN = list.filter((a) => a.status === 'ready').length;
      const waitN = list.filter((a) => a.status === 'dispatched').length;
      setHasReady(readyN > 0);
      setCostPerDispatch(cost);
      setTokens(tokenN);

      if (list.length === 0) {
        setStatusLabel(`可派遣 · 0/${max}`);
      } else if (readyN > 0 && waitN > 0) {
        setStatusLabel(`出征 ${waitN} · 可领 ${readyN} · ${list.length}/${max}`);
      } else if (readyN > 0) {
        setStatusLabel(`有报告可领取 · ${list.length}/${max}`);
      } else {
        setStatusLabel(`编组出征中 · ${list.length}/${max}`);
      }

      const lines = list.map((a) => {
        const lab = a.extraSlotLabel || SLOT_LABELS[a.extraSlot] || a.extraSlot;
        if (a.status === 'ready') return `${lab} 可领`;
        return `${lab} 等待中`;
      });
      setDetailLines(lines);
      setCanOpen(true);
    } catch (e) {
      setStatusLabel(e?.message || '网络错误');
      setDetailLines([]);
      setCanOpen(false);
      setHasReady(false);
      setTokens(0);
    } finally {
      setLoading(false);
    }
  }, [playerId, interactionsLocked]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const rootCls =
    (rootClassName && String(rootClassName).trim()) ||
    'max-h-[42vh] overflow-y-auto px-3 py-2 border-b border-stone-700 text-sm text-stone-200';

  return (
    <div className={rootCls}>
      <div className="flex items-baseline justify-between gap-2 min-h-[1.25rem]">
        <div className="font-medium min-w-0 text-amber-200/95 leading-tight">编组探险</div>
        <div className="shrink-0 text-[10px] text-stone-400 text-right leading-tight max-w-[11rem]">
          Extra 挂机
        </div>
      </div>

      <div className="text-stone-500 text-[10px] mt-1.5 leading-snug space-y-0.5 min-h-[3.25rem]">
        <div>{loading ? '加载中…' : statusLabel}</div>
        {detailLines.length > 0 ? (
          <div className="text-stone-600">{detailLines.join(' · ')}</div>
        ) : (
          <div className="text-stone-600">使用上阵 Extra（A–D）外出 · 与主公编组无关</div>
        )}
        <div className="invisible" aria-hidden>
          —
        </div>
      </div>

      <div className="text-stone-300 text-xs mt-2 border-t border-stone-600 pt-2">
        🎖️ 兵符：
        {loading ? (
          <span className="text-stone-400">加载中…</span>
        ) : (
          <span className={tokens >= costPerDispatch ? 'text-green-400' : 'text-red-400'}>
            {tokens}
          </span>
        )}
      </div>

      <div className="text-stone-500 text-[10px] mt-1 leading-snug min-h-[2.5em]">
        最多四路并行 · 每次派遣消耗兵符 ×{costPerDispatch}
      </div>

      {!interactionsLocked ? (
        <button
          type="button"
          disabled={!canOpen || loading}
          onClick={() => canOpen && onOpen?.()}
          className="mt-2 w-full py-1.5 rounded-lg text-[11px] font-bold bg-gradient-to-r from-emerald-800 to-teal-800 text-emerald-50 disabled:from-stone-700 disabled:to-stone-700 disabled:text-stone-500"
        >
          {loading ? '…' : hasReady ? '📜 领取报告' : '🏕️ 编组探险'}
        </button>
      ) : (
        <div
          className="mt-2 w-full py-1.5 rounded-lg text-[11px] font-bold text-center text-stone-500 bg-stone-800/50 border border-stone-700/60"
          aria-hidden
        >
          —
        </div>
      )}
    </div>
  );
}
