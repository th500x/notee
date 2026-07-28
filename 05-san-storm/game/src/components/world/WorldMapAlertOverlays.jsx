import { lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import AncientModal from '@/components/common/AncientModal';
import PvpAutoDuelReplay from '@/pvp/auto-duel/PvpAutoDuelReplay';
import SiegeChargeCinematic from '@/components/world/SiegeChargeCinematic';
// 战术对决事件回放壳（重）：懒加载，仅当权威结果含 eventReplay.roomId 时挂（17-5-3 阶段 5）
const PvpTacticalBattleShell = lazy(() => import('@/pvp/tactical/PvpTacticalBattleShell'));

/** 大地图：PVP / 道路 / 通用提示弹层（不含战斗 portal） */
export default function WorldMapAlertOverlays({
  pvpChallenge,
  pvpCountdownDisplay,
  pvpAttackerAdjudicating,
  pvpDefenseWaiting,
  authoritativeReplayOverlay,
  onAuthoritativeReplayClose,
  roadGateRetreatNotice,
  onRoadGateNoticeClose,
  showRoadGateNotice,
  simpleAlertMessage,
  onSimpleAlertClose,
  siegeData,
  banditRaidData,
  banditRaidResult,
  pendingSiegeConfirm = null,
  onPendingSiegeConfirm = null,
  onPendingSiegeCancel = null,
  siegeAdjudicating = false,
  siegeChargeCinematic = null,
  onSiegeChargeComplete = null,
}) {
  return (
    <>
      {pendingSiegeConfirm && (
        <AncientModal
          isOpen
          type="confirm"
          title="攻城"
          confirmText="进入自动战斗"
          cancelText="取消"
          showCancel
          onConfirm={onPendingSiegeConfirm}
          onClose={onPendingSiegeCancel}
        >
          <div className="text-center space-y-3 text-gray-800 text-sm py-1">
            <p>
              {pendingSiegeConfirm.kind === 'baseCamp'
                ? `是否对「${pendingSiegeConfirm.cityName || '目标城'}」攻方大本营进入自动战斗？`
                : `是否对「${pendingSiegeConfirm.cityName || '城池'}」进入自动战斗？`}
            </p>
            <p className="text-gray-500 text-xs leading-relaxed">
              开战后面板将自动演算并播放冲锋动画，无需进入棋盘操作。
            </p>
          </div>
        </AncientModal>
      )}

      {(siegeAdjudicating || pvpAttackerAdjudicating) && (
        <AncientModal isOpen type="confirm" title="战场裁定中" preventClose hideButtons>
          <div className="text-center space-y-3 text-gray-800 text-sm py-2 px-1">
            <p>本场由服务端演算，请稍候…</p>
            {pvpAttackerAdjudicating?.defenderName ? (
              <p className="text-gray-500 text-xs">
                守军主公：
                <span className="text-amber-800 font-semibold">{pvpAttackerAdjudicating.defenderName}</span>
              </p>
            ) : null}
          </div>
        </AncientModal>
      )}

      {siegeChargeCinematic ? (
        <SiegeChargeCinematic
          open
          title={siegeChargeCinematic.title}
          leftLabel={siegeChargeCinematic.leftLabel}
          rightLabel={siegeChargeCinematic.rightLabel}
          attackerWon={!!siegeChargeCinematic.attackerWon}
          initialAttackerTroops={siegeChargeCinematic.initialAttackerTroops}
          initialDefenderTroops={siegeChargeCinematic.initialDefenderTroops}
          attackerTroopsEnd={siegeChargeCinematic.attackerTroopsEnd}
          defenderTroopsEnd={siegeChargeCinematic.defenderTroopsEnd}
          onComplete={onSiegeChargeComplete}
        />
      ) : null}

      {pvpChallenge && (
        <AncientModal isOpen type="confirm" title="攻城对战" preventClose hideButtons>
          <div className="text-center space-y-4">
            <p className="text-gray-800 text-base">
              约 <span className="text-red-700 font-bold text-xl">{pvpCountdownDisplay}</span> 秒后由服务端裁定本场（AI 代打）
            </p>
            <p className="text-gray-500 text-xs">
              对手：{pvpChallenge.defenderName || '未知'}
            </p>
            <div className="w-full bg-gray-300 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-600 to-red-600 transition-all duration-1000"
                style={{
                  width: `${Math.min(100, (pvpCountdownDisplay / Math.max(1, Number(pvpChallenge.waitSeconds) || 10)) * 100)}%`,
                }}
              />
            </div>
            <p className="text-gray-400 text-xs">无需对方点接受，请稍候…</p>
          </div>
        </AncientModal>
      )}

      {pvpDefenseWaiting && (
        <AncientModal isOpen type="confirm" title="战场裁定中" preventClose hideButtons>
          <div className="text-center space-y-3 text-gray-700 text-sm py-2 px-1">
            <p>本场由服务端演算，请稍候…</p>
            <p className="text-gray-500 text-xs">
              攻城方：<span className="text-red-800 font-semibold">{pvpDefenseWaiting.attackerName || '未知'}</span>
            </p>
            <p className="text-gray-500 text-xs">裁定完成后将播放战术对决回放并弹出战斗结算。</p>
          </div>
        </AncientModal>
      )}

      {authoritativeReplayOverlay && authoritativeReplayOverlay.eventReplayRoomId && (
        <Suspense fallback={null}>
          <PvpTacticalBattleShell
            roomId={authoritativeReplayOverlay.eventReplayRoomId}
            title={authoritativeReplayOverlay.eventReplayTitle || '战术对决'}
            onClose={authoritativeReplayOverlay.onPlaybackComplete || onAuthoritativeReplayClose}
          />
        </Suspense>
      )}

      {typeof document !== 'undefined' &&
        authoritativeReplayOverlay &&
        !authoritativeReplayOverlay.eventReplayRoomId &&
        createPortal(
          <div className="pointer-events-auto fixed inset-0 z-[235] flex items-center justify-center bg-black/85 px-3 py-6">
            <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-amber-600/40 bg-[#12121e] p-3 shadow-2xl">
              <div className="text-center text-amber-200/95 text-sm font-bold mb-2">战场演示</div>
              <PvpAutoDuelReplay
                open
                battleLog={authoritativeReplayOverlay.battleLogStr}
                leftLabel={authoritativeReplayOverlay.leftLabel || '攻方'}
                rightLabel={authoritativeReplayOverlay.rightLabel || '守军'}
                initialAttackerTroops={authoritativeReplayOverlay.initialAttackerTroops}
                initialDefenderTroops={authoritativeReplayOverlay.initialDefenderTroops}
                onPlaybackComplete={authoritativeReplayOverlay.onPlaybackComplete}
                onClose={onAuthoritativeReplayClose}
              />
            </div>
          </div>,
          document.body,
        )}

      <AncientModal
        isOpen={Boolean(showRoadGateNotice && roadGateRetreatNotice)}
        type="info"
        title="道路位置已调整"
        confirmText="知道了"
        showCancel={false}
        portalDedupeKey="road-gate-notice"
        onConfirm={onRoadGateNoticeClose}
        onClose={onRoadGateNoticeClose}
      >
        <p className="text-gray-800 text-sm text-left leading-relaxed px-1">{roadGateRetreatNotice}</p>
      </AncientModal>

      {simpleAlertMessage != null && (
        <AncientModal
          isOpen
          type="warning"
          title="提示"
          confirmText="确定"
          onConfirm={onSimpleAlertClose}
          onClose={onSimpleAlertClose}
        >
          <p className="text-center text-gray-800 text-sm whitespace-pre-wrap">{simpleAlertMessage}</p>
        </AncientModal>
      )}
    </>
  );
}
