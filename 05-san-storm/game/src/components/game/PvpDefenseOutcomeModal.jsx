import { useState, useEffect, useMemo, useCallback } from 'react';
import AncientModal from '@/components/common/AncientModal';
import SiegeReplayMini from '@/components/game/SiegeReplayMini';
import { buildBattleScoreFormulaLines, resolveKillLossTroopCounts } from '@/systems/battleScoreSystem';

/** 披挂 PVP 裁定结束：评分摘要 + 可选简化回放（与战报列表 SiegeReplayMini 同源） */
export default function PvpDefenseOutcomeModal({
  outcome,
  onClose,
  scoreMultiplierLineLabel = '攻城积分倍率',
  replayNoticeBlockingRef = null,
}) {
  const [replayOpen, setReplayOpen] = useState(false);

  /** 须走 `AncientModal` 的 `handleClose`（约 200ms 后再调 `onClose`），禁止「确定」里同步 `onClose` 先卸掉壳再 `setState` — 会卡死全屏交互 */
  const handleMainShellClose = useCallback(() => {
    setReplayOpen(false);
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!replayNoticeBlockingRef) return undefined;
    replayNoticeBlockingRef.current = replayOpen;
    return () => {
      replayNoticeBlockingRef.current = false;
    };
  }, [replayOpen, replayNoticeBlockingRef]);
  const logLines = Array.isArray(outcome?.battleLog)
    ? outcome.battleLog
    : typeof outcome?.battleLog === 'string'
      ? outcome.battleLog.split('\n')
      : [];
  const logStr = logLines.join('\n');
  const canReplay =
    logStr.length > 12 &&
    /═══\s*第\s*\d+\s*回合\s*═══/.test(logStr) &&
    /次攻击/.test(logStr) &&
    /\[攻方\]/.test(logStr);

  const sd = outcome?.defenderScoreDetails;
  const score = outcome?.defenderBattleScore;
  const grade = outcome?.defenderBattleGrade;
  const formulaOpts =
    scoreMultiplierLineLabel && scoreMultiplierLineLabel !== '攻城积分倍率'
      ? { finalMultiplierLabel: scoreMultiplierLineLabel }
      : undefined;
  const formulaLines =
    sd && score != null ? buildBattleScoreFormulaLines(sd, score, formulaOpts).lines : [];
  const troopCounts = useMemo(() => resolveKillLossTroopCounts(sd), [sd]);

  return (
    <>
      <AncientModal
        isOpen
        type="info"
        title="⚔️ 战斗结束"
        confirmText="确定"
        onClose={handleMainShellClose}
      >
        <div className="text-center space-y-2 text-sm text-gray-800 max-h-[22rem] overflow-y-auto text-left px-1">
          <p>
            {outcome.attackerWon ? (
              <span className="text-red-600 font-bold">攻城方获胜</span>
            ) : (
              <span className="text-green-700 font-bold">守军防守成功</span>
            )}
          </p>
          {canReplay && (
            <button
              type="button"
              onClick={() => setReplayOpen(true)}
              className="w-full py-2 rounded-lg bg-amber-800/50 border border-amber-600/50 text-amber-100 text-xs hover:bg-amber-700/50"
            >
              攻城战报 · 简化回放
            </button>
          )}
          {score != null && sd && (
            <div className="text-left text-[11px] text-gray-700 border-t border-gray-200 pt-2 mt-2 space-y-0.5">
              <div className="text-amber-800/90 font-medium">战斗评分</div>
              <div className="font-semibold text-gray-900">
                {grade} · {score}分
              </div>
              <div>
                歼敌 {troopCounts.killTroops != null ? troopCounts.killTroops : '—'} / 战损{' '}
                {troopCounts.lossTroops != null ? troopCounts.lossTroops : '—'}
                <span className="text-gray-500">（兵力）</span>
              </div>
              <div>
                +{sd.killScore} / {sd.lossScore}
                <span className="text-gray-500">（评分）</span>
              </div>
              <div>
                基础分 {sd.baseScore}（上两项代数和）
              </div>
              {sd.turnMultiplier != null && sd.roundNum != null && (
                <div>
                  回合倍率 ×{sd.turnMultiplier}（第{sd.roundNum}回合）
                </div>
              )}
              {sd.siegeScoreMultiplier != null && Number(sd.siegeScoreMultiplier) !== 1 && (
                <div>
                  {scoreMultiplierLineLabel} ×{sd.siegeScoreMultiplier}
                </div>
              )}
              {formulaLines.length > 0 && (
                <div className="mt-1 pt-1 border-t border-gray-200 space-y-0.5 text-[10px] text-gray-600 leading-snug">
                  <div className="text-gray-700">完整计分步骤</div>
                  {formulaLines.map((row, i) => (
                    <div key={i}>{row.text}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </AncientModal>
      {replayOpen && (
        <AncientModal
          isOpen
          onClose={() => setReplayOpen(false)}
          type="confirm"
          title="攻城战报 · 简化回放"
          hideButtons
          width="max-w-md"
        >
          <div className="-mx-2 -my-2 bg-[#1a1a2e] rounded p-2 text-left">
            <SiegeReplayMini
              open
              onClose={() => setReplayOpen(false)}
              battleLog={logStr}
              leftLabel="攻方"
              rightLabel="守军"
              initialAttackerTroops={outcome.initialAttackerTroops}
              initialDefenderTroops={outcome.initialDefenderTroops}
            />
          </div>
        </AncientModal>
      )}
    </>
  );
}
