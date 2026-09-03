/**
 * 赛季结算·发放领取弹窗（Phase 3 · 见 19-3 §9.3）
 *
 * 新赛季创角后、待发放（apply_pending）态出现：阻塞式弹窗，展示将发放的卡牌数与徽章占位道具，
 * 点击「领取」调用 apply（幂等）；成功后回调 onClaimed（上层刷新状态、放行继续游戏）。
 *
 * 仅展示后端 status.claim 摘要 + 调 apply；不读 .cjs、不重算规则。
 */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { seasonSettlementAPI } from '@/services/seasonSettlementApi';

const PANEL = 'rounded-xl border border-amber-700/50 bg-black/90 text-amber-100 shadow-2xl';

export default function SeasonSettlementClaimModal({ playerId, claim, fromSeason, toSeason, onClaimed }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const cardCount = claim?.cardCount ?? 0;
  const badgeEntries = Object.entries(claim?.badgeItems || {});

  async function handleClaim() {
    setSubmitting(true);
    setError('');
    const res = await seasonSettlementAPI.apply(playerId);
    setSubmitting(false);
    if (res?.success) {
      onClaimed?.();
      return;
    }
    setError(res?.error || '领取失败，请稍后重试');
  }

  return (
    <div className="fixed inset-0 z-[10100] flex items-center justify-center bg-black/80 p-4">
      <div className={`${PANEL} flex w-full max-w-md flex-col`}>
        <div className="border-b border-amber-800/50 px-5 py-3">
          <h2 className="text-base font-semibold text-amber-200">赛季结算 · 物品发放</h2>
          <p className="text-[11px] text-amber-400/70">
            {fromSeason && toSeason ? `${fromSeason} → ${toSeason}` : '新赛季'}
          </p>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm">
          <p className="text-amber-300/80">
            新赛季已开启。上赛季封存的继承物品现在可以领取，领取后即可开始新赛季。
          </p>
          <ul className="space-y-2">
            <li className="rounded-md bg-black/50 px-3 py-2">继承卡牌：<strong className="text-amber-100">{cardCount}</strong> 张</li>
            <li className="rounded-md bg-black/50 px-3 py-2">
              <span>徽章类占位道具：</span>
              {badgeEntries.length === 0 ? (
                <span className="text-amber-400/60">（无）</span>
              ) : (
                <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
                  {badgeEntries.map(([id, cnt]) => (
                    <span key={id} className="rounded bg-amber-900/40 px-2 py-0.5 text-xs">
                      {id} ×{cnt}
                    </span>
                  ))}
                </span>
              )}
            </li>
          </ul>
          {error ? <p className="text-xs text-red-300">{error}</p> : null}
        </div>

        <div className="flex justify-end border-t border-amber-800/50 px-5 py-3">
          <button
            type="button"
            disabled={submitting}
            onClick={handleClaim}
            className="rounded-md border border-amber-400 bg-amber-700/80 px-5 py-1.5 text-sm font-medium text-amber-50 hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? '领取中…' : '领取并进入新赛季'}
          </button>
        </div>
      </div>
    </div>
  );
}

SeasonSettlementClaimModal.propTypes = {
  playerId: PropTypes.string.isRequired,
  claim: PropTypes.shape({
    cardCount: PropTypes.number,
    badgeItems: PropTypes.object,
  }),
  fromSeason: PropTypes.string,
  toSeason: PropTypes.string,
  onClaimed: PropTypes.func,
};
