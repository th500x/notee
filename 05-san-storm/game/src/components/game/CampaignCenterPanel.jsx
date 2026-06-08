/**
 * 大地图「战役中心」：列表 + CampaignFlipCard，数据来自 GET /api/campaign/center
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import CampaignFlipCard, { eraToFrontEraLine } from '@shared/components/card/CampaignFlipCard.jsx';
import { formatCompletionRewardBadge } from '@shared/utils/campaignRewardBadge';
import CampaignBattle from '@/components/campaign/CampaignBattle.jsx';
import AncientModal from '@/components/common/AncientModal';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { campaignAPI } from '@/services/campaignApi';
import { validateMainLineupBattleGate } from '@/utils/mainLineupTroops';
import { clearInflightBattleTroopSnapshot } from '@/utils/inflightBattleTroopSnapshot';

function posterUrlFor(filename) {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}assets/san_1_ui_card/illus_camp/${filename}`;
}

export default function CampaignCenterPanel({ playerId, open, onClose, season = 'san_1', onClaimed }) {
  const { player, cards } = usePlayerContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [toast, setToast] = useState('');
  const [claimBusy, setClaimBusy] = useState(false);
  /** 非 null 时全屏进入战役战斗（战报带 campaignId） */
  const [battleCtx, setBattleCtx] = useState(null);
  const [battleEntryGateMessage, setBattleEntryGateMessage] = useState(null);

  const load = useCallback(async () => {
    if (!playerId) return;
    setLoading(true);
    setError('');
    try {
      const res = await campaignAPI.getCenter(playerId, season);
      if (!res.success) {
        setError(res.error || '加载失败');
        setPayload(null);
        return;
      }
      setPayload(res);
      const campaigns = res.campaigns || [];
      const initial =
        res.autoOpenCampaignId && campaigns.some((c) => c.campaign_id === res.autoOpenCampaignId)
          ? res.autoOpenCampaignId
          : campaigns[0]?.campaign_id ?? null;
      setSelectedId(initial);
    } catch (e) {
      setError(e.message || '网络错误');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [playerId, season]);

  useEffect(() => {
    if (open && playerId) load();
  }, [open, playerId, load]);

  useEffect(() => {
    if (!open) setBattleCtx(null);
  }, [open]);

  const selected = useMemo(() => {
    if (!payload?.campaigns?.length) return null;
    return payload.campaigns.find((c) => c.campaign_id === selectedId) || payload.campaigns[0];
  }, [payload, selectedId]);

  /** 与后端 computeCampaignCenterDropdownParenInner「挑战结束」口径一致 */
  const selectedChallengeEnded = useMemo(() => {
    if (!selected?.progress) return false;
    const { progress } = selected;
    return (
      !!progress.rewardClaimed ||
      Number(progress.playCount) >= Number(progress.maxPlayCount) ||
      !!progress.expired
    );
  }, [selected]);

  const showToast = (msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2800);
  };

  const handleClaim = async () => {
    if (!selected || !playerId || claimBusy) return;
    const { progress } = selected;
    if (progress.rewardClaimed) {
      showToast('已领取过奖励');
      return;
    }
    setClaimBusy(true);
    try {
      const res = await campaignAPI.claimReward(playerId, selected.campaign_id);
      if (res.success) {
        const g = res.granted || {};
        const parts = [`银两 +${g.silver ?? 0}`, `粮草 +${g.food ?? 0}`];
        if (g.badge?.displayName) {
          parts.push(`${g.badge.displayName} +${g.badge.quantity ?? 1}`);
        }
        showToast(`领取成功：${parts.join('，')}`);
        onClaimed?.();
        await load();
      } else {
        showToast(res.error || '领取失败');
      }
    } catch (e) {
      showToast(e.message || '领取失败');
    } finally {
      setClaimBusy(false);
    }
  };

  const handleCampaignCenterClose = useCallback(() => {
    clearInflightBattleTroopSnapshot();
    onClose?.();
  }, [onClose]);

  if (!open) return null;

  if (battleCtx) {
    return (
      <div className="fixed inset-0 z-[240]">
        <CampaignBattle
          campaignId={battleCtx.id}
          campaignName={battleCtx.name}
          minRounds={battleCtx.minRounds}
          maxRounds={battleCtx.maxRounds}
          playerId={playerId}
          onClose={() => {
            clearInflightBattleTroopSnapshot();
            setBattleCtx(null);
            load();
            onClaimed?.();
          }}
        />
      </div>
    );
  }

  /** 与 CampaignFlipCard 默认宽度一致，顶栏/下拉/卡牌同宽 */
  const CARD_W_CLASS = 'w-full max-w-[256px]';

  return (
    <div
      className="fixed inset-0 z-[220] flex flex-col bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="campaign-center-title"
    >
      <div className="flex-1 overflow-y-auto px-3 py-4 pb-8 flex flex-col items-center">
        <div className={`${CARD_W_CLASS} flex flex-col gap-3`}>
          <div className="flex shrink-0 items-center justify-between gap-2 rounded-lg border border-amber-900/50 bg-stone-900/95 px-2 py-2.5 sm:px-3 sm:py-3">
            <h2 id="campaign-center-title" className="truncate text-base font-semibold text-amber-100 sm:text-lg">
              战役中心
            </h2>
            <button
              type="button"
              className="shrink-0 rounded-lg bg-stone-700 px-2.5 py-1.5 text-sm text-stone-100 active:bg-stone-600 sm:px-3"
              onClick={handleCampaignCenterClose}
            >
              关闭
            </button>
          </div>

          {loading && <p className="py-8 text-center text-sm text-stone-300">加载中…</p>}
          {error && !loading && (
            <p className="py-6 text-center text-sm text-red-300">{error}</p>
          )}

          {!loading && !error && payload && (
            <>
              {payload.campaigns?.length === 0 ? (
                <p className="py-8 text-center text-sm text-stone-400">暂无战役配置（请导入 config_campaigns）</p>
              ) : (
                <>
                  <label className="block text-sm text-stone-300">选择战役</label>
                  <select
                    className="w-full rounded-lg border border-stone-600 bg-stone-800 px-2 py-2 text-sm text-stone-100 sm:px-3"
                    value={selected?.campaign_id || ''}
                    onChange={(e) => setSelectedId(e.target.value)}
                  >
                    {payload.campaigns.map((c) => (
                      <option key={c.campaign_id} value={c.campaign_id}>
                        {c.progress.unlocked ? '' : '🔒 '}
                        {c.campaign_name}（{c.dropdown_paren_inner ?? c.campaign_id}）
                      </option>
                    ))}
                  </select>

                  {selected && (
                    <div className="flex w-full flex-col items-center gap-4">
                      <div className="w-full text-center text-xs text-stone-400">
                        挑战 {selected.progress.playCount}/{selected.progress.maxPlayCount} ·
                        {selected.progress.rewardClaimed ? ' 已领奖' : ' 未领奖'}
                        {selected.progress.bestScore != null ? ` · 最高 ${selected.progress.bestScore}` : ''}
                      </div>

                      <CampaignFlipCard
                        posterUrl={posterUrlFor(selected.posterFilename)}
                        frontLine1={eraToFrontEraLine(selected.era)}
                        frontLine2={selected.campaign_name}
                        campaignType={selected.campaign_type}
                        completionRewardSilver={selected.completion_reward_silver}
                        completionRewardFood={selected.completion_reward_food}
                        completionRewardBadge={formatCompletionRewardBadge(selected.completion_reward_badge)}
                        description1={selected.description_1}
                        description2={selected.description_2}
                        description3={selected.description_3 || ''}
                        onStartBattle={
                          selectedChallengeEnded
                            ? undefined
                            : () => {
                                // playable 在 API payload 的战役根上（与 progress 同级），勿用 progress.playable
                                if (!selected.playable) {
                                  if (selected.progress.expired) showToast('本战役挑战窗口已过期');
                                  else if (!selected.progress.unlocked) showToast('尚未到达解锁时间');
                                  else if (selected.progress.rewardClaimed) showToast('已领取奖励，无法再挑战');
                                  else showToast('挑战次数已用完');
                                  return;
                                }
                                const gate = validateMainLineupBattleGate({
                                  cards,
                                  playerFood: player?.food ?? 0,
                                });
                                if (!gate.ok) {
                                  setBattleEntryGateMessage(gate.message || '条件不足');
                                  return;
                                }
                                setBattleCtx({
                                  id: selected.campaign_id,
                                  name: selected.campaign_name,
                                  minRounds: selected.min_rounds ?? null,
                                  maxRounds: selected.max_rounds ?? 30,
                                });
                              }
                        }
                      />

                      {selected.progress.playCount >= 1 &&
                        !selected.progress.rewardClaimed &&
                        selected.progress.bestScore != null && (
                          <button
                            type="button"
                            disabled={claimBusy}
                            className="w-full rounded-xl bg-amber-700 px-3 py-2.5 text-sm font-medium text-amber-50 shadow disabled:opacity-50"
                            onClick={handleClaim}
                          >
                            {claimBusy ? '领取中…' : '领取通关奖励（按最高综合分档位）'}
                          </button>
                        )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {toast ? (
        <div className="pointer-events-none fixed bottom-24 left-1/2 -translate-x-1/2 z-[230] max-w-[90vw] px-4 py-2 rounded-lg bg-stone-900/95 text-stone-100 text-sm border border-amber-800/60 shadow-lg">
          {toast}
        </div>
      ) : null}

      {battleEntryGateMessage ? (
        <AncientModal
          isOpen
          type="warning"
          title="无法开战"
          confirmText="确定"
          onClose={() => {
            clearInflightBattleTroopSnapshot();
            setBattleEntryGateMessage(null);
          }}
          onConfirm={() => {
            clearInflightBattleTroopSnapshot();
            setBattleEntryGateMessage(null);
          }}
        >
          <p className="text-center text-gray-800 text-sm">{battleEntryGateMessage}</p>
          <p className="text-center text-gray-500 text-xs mt-2">请返回编组调整兵力或补充粮草后再试。</p>
        </AncientModal>
      ) : null}
    </div>
  );
}
