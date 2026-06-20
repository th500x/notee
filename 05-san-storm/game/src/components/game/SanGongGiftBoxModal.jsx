/**
 * 三公府 · 封赏 · 礼盒：消耗贡献兑换传奇宝物
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import EquipmentCard from '@shared/components/card/EquipmentCard';
import { playerAPI } from '@/services/playerApi';
import PoolResultModalFrame from '@/components/game/PoolResultModalFrame';
import { RARITY, RARITY_COLORS } from '@/constants';
import { treasureConfigToEquipmentCard } from '@/utils/checkinRewardPreview';

const BASE_URL = import.meta.env.BASE_URL || '/';

const fmtNum = (n) => Math.max(0, Math.floor(Number(n) || 0)).toLocaleString('zh-CN');

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   playerId?: string | null,
 *   onAfterRedeem?: () => void | Promise<void>,
 * }} props
 */
export default function SanGongGiftBoxModal({
  open,
  onClose,
  playerId,
  onAfterRedeem,
}) {
  const [preview, setPreview] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [result, setResult] = useState(null);
  const [resultCard, setResultCard] = useState(null);

  const loadPreview = useCallback(async () => {
    if (!playerId) {
      setPreview(null);
      return;
    }
    setLoadErr(null);
    try {
      const res = await playerAPI.getSanGongFuGiftBoxPreview(playerId);
      if (res.success && res.data) {
        setPreview(res.data);
      } else {
        setPreview(null);
        setLoadErr(res.error || '礼盒预览加载失败');
      }
    } catch (e) {
      setPreview(null);
      setLoadErr(e?.message || '礼盒预览加载失败');
    }
  }, [playerId]);

  useEffect(() => {
    if (!open) return;
    setToast(null);
    setResult(null);
    setResultCard(null);
    setSelectedId(null);
    void loadPreview();
  }, [open, loadPreview]);

  const cost = preview?.contributionCost ?? 50;
  const canRedeemSelected = useMemo(() => {
    if (!preview?.canRedeem || !selectedId || busy) return false;
    return preview.treasures?.some((t) => t.id === selectedId);
  }, [preview, selectedId, busy]);

  const onRedeem = useCallback(async () => {
    setToast(null);
    if (!playerId || !selectedId || busy) return;
    setBusy(true);
    try {
      const res = await playerAPI.submitSanGongFuGiftBox(playerId, selectedId);
      if (res.success && res.data) {
        const granted = preview?.treasures?.find((t) => t.id === selectedId);
        setResultCard(granted ? treasureConfigToEquipmentCard(granted) : null);
        setResult(res.data);
        await loadPreview();
        await onAfterRedeem?.();
      } else {
        setToast(res.error || '兑换失败');
      }
    } catch (e) {
      setToast(e?.message || '兑换失败');
    } finally {
      setBusy(false);
    }
  }, [playerId, selectedId, busy, loadPreview, onAfterRedeem, preview?.treasures]);

  if (!open) return null;

  const legendaryHex = RARITY_COLORS[RARITY.LEGENDARY];

  return (
    <>
      <PoolResultModalFrame title="🎁 礼盒兑换" onClose={onClose}>
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
                  可兑换系统中全部传奇宝物（4xxx 编号）；每自然日 1 次（0:00 刷新，与银粮兑换一致）。
                </div>
                <div className="mt-1">
                  今日额度：{' '}
                  <span className="tabular-nums text-stone-300">
                    {preview.claimedToday ? '已兑换' : `${preview.remainingToday}/${preview.maxPerDay}`}
                  </span>
                </div>
              </div>

              {!preview.canRedeem && preview.blockReason ? (
                <div className="mb-2 text-[10px] text-red-400/85">{preview.blockReason}</div>
              ) : null}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(preview.treasures || []).map((treasure) => {
                  const selected = selectedId === treasure.id;
                  const disabled = !preview.canRedeem || busy;
                  return (
                    <button
                      key={treasure.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => setSelectedId(treasure.id)}
                      className={`rounded-lg border px-2.5 py-2 text-left transition-colors ${
                        selected
                          ? 'border-amber-600/70 bg-amber-950/40'
                          : 'border-stone-700/55 bg-stone-900/50 hover:border-stone-600/70'
                      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className="text-[11px] font-semibold"
                          style={{ color: legendaryHex }}
                        >
                          {treasure.name || treasure.id}
                        </div>
                        <div className="text-[10px] text-stone-500">传奇</div>
                      </div>
                      {treasure.specialEffectDesc ? (
                        <div className="mt-1 text-[10px] leading-snug text-stone-400">
                          {treasure.specialEffectDesc}
                        </div>
                      ) : null}
                      {Array.isArray(treasure.bonus) && treasure.bonus.length > 0 ? (
                        <div className="mt-1 text-[10px] text-stone-500">
                          {treasure.bonus.map((b) => `${b.key}+${b.value}`).join(' · ')}
                        </div>
                      ) : null}
                      <div className="mt-1.5 text-[10px] tabular-nums text-cyan-300/80">
                        消耗 {cost} 贡献
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={!canRedeemSelected}
                onClick={() => void onRedeem()}
                className={`mt-3 w-full rounded border px-2 py-1.5 text-[11px] font-medium ${
                  !canRedeemSelected
                    ? 'cursor-not-allowed border-stone-700/40 bg-stone-900/30 text-stone-600'
                    : 'border-amber-700/50 bg-amber-950/40 text-amber-100 hover:bg-amber-900/50'
                }`}
              >
                {busy ? '兑换中…' : '确认兑换所选宝物'}
              </button>
            </>
          ) : !loadErr ? (
            <div className="py-6 text-center text-[11px] text-stone-500">加载中…</div>
          ) : null}
        </div>
      </PoolResultModalFrame>

      {result ? (
        <PoolResultModalFrame
          title="🎁 兑换完成"
          panelClassName="max-w-sm"
          onClose={() => {
            setResult(null);
            setResultCard(null);
          }}
        >
          <div className="flex flex-col items-center gap-3">
            {resultCard ? (
              <EquipmentCard equipment={resultCard} baseUrl={BASE_URL} disableHoverScale />
            ) : (
              <div className="py-4 text-center text-[11px] text-stone-500">宝物卡牌加载中…</div>
            )}
            <div className="w-full space-y-1 text-center text-[10px] leading-snug text-stone-400">
              <div>
                消耗{' '}
                <span className="text-cyan-200/90 tabular-nums">{fmtNum(result.contributionSpent)}</span>{' '}
                贡献 · 剩余{' '}
                <span className="tabular-nums">{fmtNum(result.contributionAfter)}</span>
              </div>
              <div className="text-stone-500">宝物已入军营池</div>
            </div>
          </div>
        </PoolResultModalFrame>
      ) : null}
    </>
  );
}
