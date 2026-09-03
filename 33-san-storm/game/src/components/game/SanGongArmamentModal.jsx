/**
 * 三公府 · 封赏 · 军备：消耗贡献兑换兵符 / 玉牌（UI 对齐礼盒）
 */

import { useCallback, useEffect, useState } from 'react';
import { playerAPI } from '@/services/playerApi';
import PoolResultModalFrame from '@/components/game/PoolResultModalFrame';

const fmtNum = (n) => Math.max(0, Math.floor(Number(n) || 0)).toLocaleString('zh-CN');

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   playerId?: string | null,
 *   onAfterRedeem?: () => void | Promise<void>,
 * }} props
 */
export default function SanGongArmamentModal({
  open,
  onClose,
  playerId,
  onAfterRedeem,
}) {
  const [preview, setPreview] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);
  const [result, setResult] = useState(null);

  const loadPreview = useCallback(async () => {
    if (!playerId) {
      setPreview(null);
      return;
    }
    setLoadErr(null);
    try {
      const res = await playerAPI.getSanGongFuArmamentPreview(playerId);
      if (res.success && res.data) {
        setPreview(res.data);
      } else {
        setPreview(null);
        setLoadErr(res.error || '军备预览加载失败');
      }
    } catch (e) {
      setPreview(null);
      setLoadErr(e?.message || '军备预览加载失败');
    }
  }, [playerId]);

  useEffect(() => {
    if (!open) return;
    setToast(null);
    setResult(null);
    setBusyId(null);
    void loadPreview();
  }, [open, loadPreview]);

  const cost = preview?.contributionCost ?? 10;

  const onRedeem = useCallback(
    async (offerId) => {
      setToast(null);
      if (!playerId || !offerId || busyId) return;
      setBusyId(offerId);
      try {
        const res = await playerAPI.submitSanGongFuArmament(playerId, offerId);
        if (res.success && res.data) {
          setResult(res.data);
          await loadPreview();
          await onAfterRedeem?.();
        } else {
          setToast(res.error || '兑换失败');
        }
      } catch (e) {
        setToast(e?.message || '兑换失败');
      } finally {
        setBusyId(null);
      }
    },
    [playerId, busyId, loadPreview, onAfterRedeem],
  );

  if (!open) return null;

  return (
    <>
      <PoolResultModalFrame title="🛡️ 军备兑换" onClose={onClose} confirmLabel="关闭">
        <div className="max-h-[min(70vh,520px)] overflow-y-auto text-left">
          {loadErr ? (
            <div className="mb-2 text-[11px] text-red-400/90">{loadErr}</div>
          ) : null}
          {toast ? (
            <div className="mb-2 rounded border border-amber-800/40 bg-amber-950/50 px-2 py-1 text-[10px] text-amber-100">
              {toast}
            </div>
          ) : null}

          {preview ? (
            <>
              <div className="mb-3 rounded border border-stone-700/50 bg-stone-950/60 px-2.5 py-2 text-[10px] leading-snug text-stone-400">
                <div>
                  当前贡献{' '}
                  <span className="text-cyan-200/90 tabular-nums">{fmtNum(preview.contribution)}</span>
                  {' · 每件消耗 '}
                  <span className="text-cyan-200/90 tabular-nums">{cost}</span>
                  {' 贡献'}
                </div>
                <div className="mt-1 text-stone-500">
                  10 贡献可兑 1 兵符或 1 玉牌；每日各最多 5 件（0:00 刷新，与礼盒一致）。
                </div>
                <div className="mt-1">
                  今日剩余：{' '}
                  <span className="tabular-nums text-stone-300">
                    {preview.remainingTotal}/{preview.maxTotal}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:items-stretch">
                {(preview.offers || []).map((offer) => {
                  const disabled = !offer.canRedeem || !!busyId;
                  return (
                    <div
                      key={offer.offerId}
                      className="flex h-full flex-col rounded-lg border border-stone-700/55 bg-stone-900/50 px-2.5 py-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-[11px] font-semibold text-amber-100/95">
                          {offer.label}
                        </div>
                        <div className="text-[10px] tabular-nums text-stone-500">
                          {offer.remainingToday}/{offer.maxPerDay}
                        </div>
                      </div>
                      {offer.description ? (
                        <div className="mt-1 text-[10px] leading-snug text-stone-400">
                          {offer.description}
                        </div>
                      ) : null}
                      <div className="mt-1.5 text-[10px] tabular-nums text-cyan-300/80">
                        消耗 {offer.contributionCost ?? cost} 贡献
                      </div>
                      {!offer.canRedeem && offer.blockReason ? (
                        <div className="mt-1 text-[10px] text-red-400/80">{offer.blockReason}</div>
                      ) : null}
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => void onRedeem(offer.offerId)}
                        className={`mt-auto h-8 w-full shrink-0 rounded border px-2 text-[11px] font-medium leading-none ${
                          disabled
                            ? 'cursor-not-allowed border-stone-700/40 bg-stone-900/30 text-stone-600'
                            : 'border-amber-700/50 bg-amber-950/40 text-amber-100 hover:bg-amber-900/50'
                        }`}
                      >
                        {busyId === offer.offerId ? '兑换中…' : '确认兑换'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          ) : !loadErr ? (
            <div className="py-6 text-center text-[11px] text-stone-500">加载中…</div>
          ) : null}
        </div>
      </PoolResultModalFrame>

      {result ? (
        <PoolResultModalFrame
          title="🛡️ 兑换完成"
          panelClassName="max-w-sm"
          onClose={() => setResult(null)}
          confirmLabel="关闭"
        >
          <div className="space-y-2 text-center text-[11px] leading-snug text-stone-300">
            <div className="text-amber-100/95 font-semibold">
              获得 {result.itemName || result.itemId} ×{result.quantity ?? 1}
            </div>
            <div className="text-stone-400">
              消耗{' '}
              <span className="text-cyan-200/90 tabular-nums">{fmtNum(result.contributionSpent)}</span>{' '}
              贡献 · 剩余{' '}
              <span className="tabular-nums">{fmtNum(result.contributionAfter)}</span>
            </div>
            <div className="text-stone-500">
              今日该道具已兑 {result.redeemedToday}/{result.maxPerDay} · 背包持有{' '}
              {fmtNum(result.itemQuantityAfter)}
            </div>
          </div>
        </PoolResultModalFrame>
      ) : null}
    </>
  );
}
