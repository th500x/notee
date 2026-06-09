/**
 * 三公府 · 封赏 · 银粮兑换弹窗
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { playerAPI } from '@/services/playerApi';
import PoolResultModalFrame from '@/components/game/PoolResultModalFrame';
import { FOOD_PER_SILVER } from '@/utils/sanGongResourceExchangeDisplay';

const fmtNum = (n) => Math.max(0, Math.floor(Number(n) || 0)).toLocaleString('zh-CN');

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   playerId?: string | null,
 *   onAfterExchange?: () => void | Promise<void>,
 * }} props
 */
export default function SanGongResourceExchangeModal({
  open,
  onClose,
  playerId,
  onAfterExchange,
}) {
  const [preview, setPreview] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [busyPack, setBusyPack] = useState(null);
  const [toast, setToast] = useState(null);
  const [result, setResult] = useState(null);

  const loadPreview = useCallback(async () => {
    if (!playerId) {
      setPreview(null);
      return;
    }
    setLoadErr(null);
    try {
      const res = await playerAPI.getSanGongFuResourceExchangePreview(playerId);
      if (res.success && res.data) {
        setPreview(res.data);
      } else {
        setPreview(null);
        setLoadErr(res.error || '兑换预览加载失败');
      }
    } catch (e) {
      setPreview(null);
      setLoadErr(e?.message || '兑换预览加载失败');
    }
  }, [playerId]);

  useEffect(() => {
    if (!open) return;
    setToast(null);
    setResult(null);
    void loadPreview();
  }, [open, loadPreview]);

  const remainingTotal = useMemo(() => {
    if (!preview?.packs?.length) return 0;
    return preview.packs.filter((p) => !p.claimedToday).length;
  }, [preview]);

  const onExchange = useCallback(
    async (packId) => {
      setToast(null);
      if (!playerId || busyPack) return;
      setBusyPack(packId);
      try {
        const res = await playerAPI.submitSanGongFuResourceExchange(playerId, packId);
        if (res.success && res.data) {
          setResult(res.data);
          await loadPreview();
          await onAfterExchange?.();
        } else {
          setToast(res.error || '兑换失败');
        }
      } catch (e) {
        setToast(e?.message || '兑换失败');
      } finally {
        setBusyPack(null);
      }
    },
    [playerId, busyPack, loadPreview, onAfterExchange],
  );

  if (!open) return null;

  const imbalancePct =
    preview?.imbalanceR != null && Number.isFinite(Number(preview.imbalanceR))
      ? Math.round(Number(preview.imbalanceR) * 100)
      : null;

  return (
    <>
      <PoolResultModalFrame title="🔄 银粮兑换" onClose={onClose}>
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
                  兑换基数（俸禄 B，无日随机）：银{' '}
                  <span className="text-amber-200/90 tabular-nums">{fmtNum(preview.baseSilver)}</span>
                  {' · 粮 '}
                  <span className="text-lime-200/90 tabular-nums">{fmtNum(preview.baseFood)}</span>
                  {preview.supplyTier ? (
                    <span className="text-stone-500"> · 国力 {String(preview.supplyTier)}</span>
                  ) : null}
                  {preview.resourceMultiplier > 1 ? (
                    <span className="text-stone-500"> · 官职 ×{preview.resourceMultiplier}</span>
                  ) : null}
                </div>
                <div className="mt-1">
                  势力池：银 {fmtNum(preview.poolSilver)} · 粮 {fmtNum(preview.poolFood)}
                  {imbalancePct != null ? (
                    <span className="text-stone-500">
                      {' '}
                      · 粮/公允比 {imbalancePct}%（1 银={FOOD_PER_SILVER} 粮）
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-stone-500">
                  每包每自然日 1 次（0:00 刷新，与俸禄一致）；优享包由势力池额外 +20% 发出。
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {preview.packs.map((pack) => {
                  const isSilverPay = pack.paySilver > 0;
                  const payLabel = isSilverPay
                    ? `付 ${fmtNum(pack.paySilver)} 银`
                    : `付 ${fmtNum(pack.payFood)} 粮`;
                  const recvLabel = isSilverPay
                    ? `得 ${fmtNum(pack.receiveFood)} 粮`
                    : `得 ${fmtNum(pack.receiveSilver)} 银`;
                  const disabled = !pack.canExchange || !!busyPack;
                  return (
                    <div
                      key={pack.packId}
                      className="rounded-lg border border-stone-700/55 bg-stone-900/50 px-2.5 py-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-[11px] font-semibold text-amber-500/95">{pack.label}</div>
                        <div className="text-[10px] tabular-nums text-stone-500">
                          {pack.claimedToday ? '今日已兑' : '0/1 → 1/1'}
                        </div>
                      </div>
                      <div className="mt-1.5 text-[11px] text-stone-300">
                        {payLabel}
                        <span className="text-stone-600"> → </span>
                        {recvLabel}
                      </div>
                      <div className="mt-0.5 text-[10px] text-stone-500">
                        松紧 k={Number(pack.k).toFixed(2)}
                        {pack.poolBonusPct > 0 ? ` · 池赠 +${pack.poolBonusPct}%` : ''}
                      </div>
                      {!pack.canExchange && pack.blockReason ? (
                        <div className="mt-1 text-[10px] text-red-400/85">{pack.blockReason}</div>
                      ) : null}
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onExchange(pack.packId)}
                        className={`mt-2 w-full rounded border px-2 py-1.5 text-[11px] font-medium ${
                          disabled
                            ? 'cursor-not-allowed border-stone-700/40 bg-stone-900/30 text-stone-600'
                            : 'border-amber-700/50 bg-amber-950/40 text-amber-100 hover:bg-amber-900/50'
                        }`}
                      >
                        {busyPack === pack.packId ? '兑换中…' : '确认兑换'}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 text-center text-[10px] text-stone-500">
                今日剩余可兑包数：{remainingTotal}/4
              </div>
            </>
          ) : !loadErr ? (
            <div className="py-6 text-center text-[11px] text-stone-500">加载中…</div>
          ) : null}
        </div>
      </PoolResultModalFrame>

      {result ? (
        <PoolResultModalFrame title="🔄 兑换完成" onClose={() => setResult(null)}>
          <div className="flex flex-col items-center gap-2 text-center text-[11px]">
            {result.paySilver > 0 ? (
              <div className="text-stone-300">
                付出 <span className="text-amber-200 tabular-nums">{fmtNum(result.paySilver)}</span> 银
              </div>
            ) : null}
            {result.payFood > 0 ? (
              <div className="text-stone-300">
                付出 <span className="text-lime-200 tabular-nums">{fmtNum(result.payFood)}</span> 粮
              </div>
            ) : null}
            {result.receiveFood > 0 ? (
              <div className="text-stone-300">
                获得 <span className="text-lime-200 tabular-nums">{fmtNum(result.receiveFood)}</span> 粮
              </div>
            ) : null}
            {result.receiveSilver > 0 ? (
              <div className="text-stone-300">
                获得 <span className="text-amber-200 tabular-nums">{fmtNum(result.receiveSilver)}</span> 银
              </div>
            ) : null}
          </div>
        </PoolResultModalFrame>
      ) : null}
    </>
  );
}
