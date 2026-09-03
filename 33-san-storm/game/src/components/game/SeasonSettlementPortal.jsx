/**
 * 赛季结算弹窗/横幅容器（见 19-3 §9.1/§9.3）
 *
 * **不再自带浮动入口按钮**：入口按钮已移至顶栏（`TopStatusBar`，「隐藏按钮」右侧）。
 * 本组件由 `GamePage` 以 props 驱动，仅负责按 `status.phase` 渲染：
 *   - `sealed` → 顶部封档横幅（写操作由后端门禁拦截）。
 *   - `window_open` + `modalOpen` → 三页选择向导（confirm）。
 *   - `apply_pending` → 阻塞式发放弹窗（apply）；门禁会 403 写操作，故未领取前教程链无法推进。
 *
 * 状态拉取/轮询在 `hooks/useSeasonSettlement.js`，单源，避免重复 fetch。
 */
import { lazy, Suspense } from 'react';
import PropTypes from 'prop-types';

const SeasonSettlementModal = lazy(() => import('@/components/game/SeasonSettlementModal'));
const SeasonSettlementClaimModal = lazy(() => import('@/components/game/SeasonSettlementClaimModal'));

export default function SeasonSettlementPortal({ playerId, status, modalOpen, onModalOpenChange, onRefresh }) {
  if (!playerId) return null;
  const phase = status?.phase;

  return (
    <>
      {phase === 'sealed' ? (
        <div className="fixed inset-x-0 top-0 z-[110] flex justify-center px-4 pt-2">
          <div className="max-w-md rounded-lg border border-amber-500/60 bg-black/90 px-4 py-2 text-center text-xs text-amber-200 shadow-lg">
            本赛季存档已封档，等待新赛季开启。期间无法继续游戏。
          </div>
        </div>
      ) : null}

      {modalOpen && phase === 'window_open' ? (
        <Suspense fallback={null}>
          <SeasonSettlementModal
            playerId={playerId}
            onClose={() => onModalOpenChange?.(false)}
            onConfirmed={() => {
              onModalOpenChange?.(false);
              onRefresh?.();
            }}
          />
        </Suspense>
      ) : null}

      {phase === 'apply_pending' ? (
        <Suspense fallback={null}>
          <SeasonSettlementClaimModal
            playerId={playerId}
            claim={status?.claim}
            fromSeason={status?.fromSeason}
            toSeason={status?.toSeason}
            onClaimed={onRefresh}
          />
        </Suspense>
      ) : null}
    </>
  );
}

SeasonSettlementPortal.propTypes = {
  playerId: PropTypes.string,
  status: PropTypes.object,
  modalOpen: PropTypes.bool,
  onModalOpenChange: PropTypes.func,
  onRefresh: PropTypes.func,
};
