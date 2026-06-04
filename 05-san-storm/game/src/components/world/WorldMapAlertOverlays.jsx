import { lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import AncientModal from '@/components/common/AncientModal';
import PvpAutoDuelReplay from '@/pvp/auto-duel/PvpAutoDuelReplay';
import PvpDefenseOutcomeModal from '@/components/game/PvpDefenseOutcomeModal';
// 战术对决事件回放壳（重）：懒加载，仅当权威结果含 eventReplay.roomId 时挂（17-5-3 阶段 5）
const PvpTacticalBattleShell = lazy(() => import('@/pvp/tactical/PvpTacticalBattleShell'));

/** 大地图：PVP / 道路 / 通用提示弹层（不含战斗 portal） */
export default function WorldMapAlertOverlays({
  pvpChallenge,
  pvpCountdownDisplay,
  pvpAttackerAdjudicating,
  pvpDefenseWaiting,
  pvpDefenseOutcome,
  onPvpDefenseOutcomeClose,
  authoritativeReplayOverlay,
  onAuthoritativeReplayClose,
  roadAttackerAlert,
  onRoadAttackerConfirm,
  onRoadAttackerClose,
  roadGateRetreatNotice,
  onRoadGateNoticeClose,
  showRoadGateNotice,
  pvpDefenseAlert,
  onPvpDefenseAlertConfirm,
  simpleAlertMessage,
  onSimpleAlertClose,
  siegeData,
  banditRaidData,
  banditRaidResult,
}) {
  return (
    <>
      {pvpChallenge && (
        <AncientModal isOpen type="confirm" title="⚔️ 攻城对战" preventClose hideButtons>
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

      {pvpAttackerAdjudicating && (
        <AncientModal isOpen type="confirm" title="⚔️ 战场裁定中" preventClose hideButtons>
          <div className="text-center space-y-3 text-gray-800 text-sm py-2 px-1">
            <p>本场由服务端演算，请稍候…</p>
            <p className="text-gray-500 text-xs">
              守军主公：<span className="text-amber-800 font-semibold">{pvpAttackerAdjudicating.defenderName}</span>
            </p>
          </div>
        </AncientModal>
      )}

      {pvpDefenseWaiting && (
        <AncientModal isOpen type="confirm" title="⚔️ 战场裁定中" preventClose hideButtons>
          <div className="text-center space-y-3 text-gray-700 text-sm py-2 px-1">
            <p>本场由服务端演算，请稍候…</p>
            <p className="text-gray-500 text-xs">
              攻城方：<span className="text-red-800 font-semibold">{pvpDefenseWaiting.attackerName || '未知'}</span>
            </p>
          </div>
        </AncientModal>
      )}

      {pvpDefenseOutcome && (
        <PvpDefenseOutcomeModal outcome={pvpDefenseOutcome} onClose={onPvpDefenseOutcomeClose} />
      )}

      {/* 攻方权威回放：有事件房间 → 全屏事件回放壳；关闭后进结算（17-5-3 阶段 5）。否则退回旧简化回放。 */}
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

      {roadAttackerAlert && !siegeData && !banditRaidData && !banditRaidResult && (
        <AncientModal
          isOpen
          type="warning"
          title="🛤️ 道路遭遇"
          confirmText="确定"
          showCancel={false}
          invokeOnCloseAfterConfirm={false}
          onConfirm={onRoadAttackerConfirm}
          onClose={onRoadAttackerClose}
        >
          <div className="text-center space-y-3">
            <p className="text-gray-800 text-base">您已与对方在道路上触发对战。</p>
            <p className="text-gray-800">
              点击 <span className="font-semibold text-amber-900">确定</span> 由服务端权威推演本场（与攻城披挂同源），先观看战场演示再进入结算。
            </p>
          </div>
        </AncientModal>
      )}

      {showRoadGateNotice && roadGateRetreatNotice && (
        <AncientModal
          isOpen
          type="info"
          title="道路位置已调整"
          confirmText="知道了"
          showCancel={false}
          onConfirm={onRoadGateNoticeClose}
          onClose={onRoadGateNoticeClose}
        >
          <p className="text-gray-800 text-sm text-left leading-relaxed px-1">{roadGateRetreatNotice}</p>
        </AncientModal>
      )}

      {pvpDefenseAlert && !siegeData && !banditRaidData && !banditRaidResult && (
        <AncientModal
          isOpen
          type="warning"
          title="🏰 城池遭袭"
          confirmText="确定"
          showCancel={false}
          onConfirm={onPvpDefenseAlertConfirm}
        >
          <div className="text-center space-y-3">
            <p className="text-gray-800 text-base">
              <span className="font-bold text-red-700">{pvpDefenseAlert.attackerName}</span> 正在攻打城池
            </p>
            <p className="text-gray-800">
              点击 <span className="font-semibold text-amber-900">确定</span> 可等待裁定结束后在战报中查看文字记录；也可稍后打开「聊天」面板「战报」页。
            </p>
            <p className="text-gray-800">
              约 <span className="text-red-700 font-bold text-xl">{pvpDefenseAlert.remainingSeconds}</span> 秒后本提示将自动关闭（战斗由服务端 AI 演算，与是否观战无关）。
            </p>
            <p className="text-gray-500 text-xs">提示关闭后请勿反复操作，稍候即弹出裁定结果。</p>
          </div>
        </AncientModal>
      )}

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
