import { useState } from 'react';
import AncientModal from '@/components/common/AncientModal';
import SiegeReplayMini from '@/components/game/SiegeReplayMini';
import { getRarityHex, getRarityLabelCn } from '@/constants';
import { shortEquipmentDisplayName } from '@/utils/equipmentDisplayName';

/** 攻城结算里服务端权威战报的简化回放入口 */
function AuthoritativeSiegeReplayButton({
  battleLogLines,
  initialAttackerTroops,
  initialDefenderTroops,
}) {
  const [open, setOpen] = useState(false);
  const logStr = Array.isArray(battleLogLines) ? battleLogLines.join('\n') : '';
  const canReplay =
    logStr.length > 12 &&
    /═══\s*第\s*\d+\s*回合\s*═══/.test(logStr) &&
    /次攻击/.test(logStr) &&
    /\[攻方\]/.test(logStr);
  if (!canReplay) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full py-2 rounded-lg bg-stone-800 border border-amber-600/40 text-amber-200 text-xs hover:bg-stone-700"
      >
        攻城战报 · 简化回放
      </button>
      {open && (
        <AncientModal
          isOpen
          onClose={() => setOpen(false)}
          type="confirm"
          title="攻城战报 · 简化回放"
          hideButtons
          width="max-w-md"
        >
          <div className="-mx-2 -my-2 bg-[#1a1a2e] rounded p-2 text-left">
            <SiegeReplayMini
              open
              onClose={() => setOpen(false)}
              battleLog={logStr}
              leftLabel="攻方"
              rightLabel="守军"
              initialAttackerTroops={initialAttackerTroops}
              initialDefenderTroops={initialDefenderTroops}
            />
          </div>
        </AncientModal>
      )}
    </>
  );
}

/**
 * 攻城 / 匪寨小型图战后结算：同一容器、标题「战斗结算」与同色系奖励行。
 * @param {'siege'|'bandit'} settlementKind
 */
export default function StrategicSettlementCard({
  onConfirm,
  onBanditContinue = null,
  onBanditDefeatAbandon = null,
  settlementKind = 'siege',
  banditOutcome = null,
  silverReward = 0,
  reputationReward = 0,
  contributionReward = 0,
  foodReward = 0,
  banditBaseSilver = 0,
  banditBaseFood = 0,
  banditMilestone = null,
  equipmentDrop = null,
  chestRewards = [],
  killCount = null,
  siegeNpcKilled = null,
  siegeNpcTotal = null,
  banditOpponentName = '',
  tacticalScoreText = null,
  authoritativeBattleLog = null,
  initialAttackerTroops = null,
  initialDefenderTroops = null,
  showZeroKillNote = false,
  siegeCompleted = false,
  battleReportFailed = false,
  extraFooterNote = null,
  banditBadgeGranted = null,
  banditBadgeError = null,
}) {
  const sr = Math.max(0, Number(silverReward) || 0);
  const rr = Math.max(0, Number(reputationReward) || 0);
  const cr = Math.max(0, Number(contributionReward) || 0);
  const fr = Math.max(0, Number(foodReward) || 0);
  const bbs = Math.max(0, Number(banditBaseSilver) || 0);
  const bbf = Math.max(0, Number(banditBaseFood) || 0);
  const milestone =
    banditMilestone && typeof banditMilestone === 'object' ? banditMilestone : null;
  const msSilver = milestone ? Math.max(0, Number(milestone.silver) || 0) : 0;
  const msFood = milestone ? Math.max(0, Number(milestone.food) || 0) : 0;
  const kc = killCount != null && Number.isFinite(Number(killCount)) ? Number(killCount) : null;
  const kcShown = kc != null ? kc : 0;
  const showVictoryEmoji =
    settlementKind === 'bandit'
      ? banditOutcome === 'victory'
      : !!((kc != null ? kcShown : 0) || sr || cr || fr);

  const chestList = Array.isArray(chestRewards) ? chestRewards : [];

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-xl border border-amber-500/30 bg-gray-900/95 p-6 text-center space-y-3">
        <div className="text-4xl">{showVictoryEmoji ? '⚔️' : '💀'}</div>
        <div className="text-xl font-bold text-amber-400">战斗结算</div>
        {settlementKind === 'bandit' && banditOpponentName ? (
          <div className="text-sm text-stone-300">{banditOpponentName}</div>
        ) : null}
        {tacticalScoreText ? (
          <div className="text-sm text-gray-300">{tacticalScoreText}</div>
        ) : null}
        {rr > 0 && <div className="text-yellow-300 text-sm">⭐ 获得 {rr} 声望</div>}
        {cr > 0 && <div className="text-sky-300 text-sm">贡献 +{cr}</div>}
        {settlementKind === 'bandit' && banditOutcome === 'victory' ? (
          <>
            {(bbs > 0 || bbf > 0) && (
              <div className="text-stone-400 text-xs pt-0.5">本层战斗奖励</div>
            )}
            {bbs > 0 && <div className="text-amber-300 text-sm">💰 获得 {bbs} 银两</div>}
            {bbf > 0 && <div className="text-lime-200/95 text-sm">🌾 获得 {bbf} 粮草</div>}
            {milestone && (msSilver > 0 || msFood > 0) && (
              <>
                <div className="text-stone-400 text-xs pt-1 border-t border-amber-500/20 mt-1">
                  通关第 {milestone.layer} 层（{milestone.tierLabel || milestone.tier}档）
                </div>
                {msSilver > 0 && (
                  <div className="text-amber-200 text-sm">💰 获得 {msSilver} 银两</div>
                )}
                {msFood > 0 && (
                  <div className="text-lime-200/90 text-sm">🌾 获得 {msFood} 粮草</div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {sr > 0 && <div className="text-amber-300 text-sm">💰 获得 {sr} 银两</div>}
            {fr > 0 && <div className="text-lime-200/95 text-sm">🌾 获得 {fr} 粮草</div>}
          </>
        )}
        {equipmentDrop && (
          <div
            className="text-sm font-medium"
            style={{ color: getRarityHex(equipmentDrop.rarity) }}
          >
            🎁 攻城战后随机掉落（约 5%）：{equipmentDrop.name}（{getRarityLabelCn(equipmentDrop.rarity)}）
          </div>
        )}
        {chestList.length > 0 && (
          <div className="mt-1 space-y-1 border-t border-amber-500/25 pt-2 text-left text-sm">
            <div className="text-[11px] text-stone-500">📦 地图内宝箱</div>
            {chestList.map((r, i) => (
              <div
                key={`${r.equipmentId || 'eq'}-${i}`}
                className="text-sm font-medium"
                style={{ color: getRarityHex(r.rarity) }}
              >
                {shortEquipmentDisplayName(r.name)}（{getRarityLabelCn(r.rarity)}）
              </div>
            ))}
          </div>
        )}
        {banditBadgeGranted && (banditBadgeGranted.displayName || banditBadgeGranted.itemId) ? (
          <div className="text-sm text-emerald-300/95">
            🎖️ 获得 {banditBadgeGranted.displayName || banditBadgeGranted.itemId}
            {Number(banditBadgeGranted.quantity) > 1 ? ` ×${banditBadgeGranted.quantity}` : ''}
          </div>
        ) : null}
        {banditBadgeError ? (
          <div className="text-xs text-amber-200/90 text-left leading-snug">
            徽章未能自动入库：{banditBadgeError}（本场银两等仍按服务端为准，可稍后重试。）
          </div>
        ) : null}
        {kc != null && settlementKind === 'siege' ? (
          <div className="text-sm text-gray-300">本场击杀：{kc}</div>
        ) : null}
        {settlementKind === 'siege' ? (
          <div className="text-sm text-gray-400">
            NPC守军：本场消灭 {kcShown} 支
            {siegeNpcTotal != null && Number(siegeNpcTotal) > 0 && (
              <>
                {' '}
                · 累计已消灭 {siegeNpcKilled ?? 0}/{siegeNpcTotal}
              </>
            )}
          </div>
        ) : null}
        {extraFooterNote ? (
          <div className="text-xs text-stone-500 text-center leading-snug">{extraFooterNote}</div>
        ) : null}
        {battleReportFailed ? (
          <div className="text-xs text-red-300 text-left leading-snug">
            战报未能可靠保存到服务器，奖励以服务端记录为准；若反复出现请稍后重试或联系管理。
          </div>
        ) : null}
        {Array.isArray(authoritativeBattleLog) && authoritativeBattleLog.length > 0 && (
          <>
            <AuthoritativeSiegeReplayButton
              battleLogLines={authoritativeBattleLog}
              initialAttackerTroops={initialAttackerTroops}
              initialDefenderTroops={initialDefenderTroops}
            />
            <details className="mt-2 max-h-32 overflow-y-auto text-left text-[11px] text-stone-400">
              <summary className="cursor-pointer text-amber-500/90">文字战报（服务端）</summary>
              <pre className="mt-1 whitespace-pre-wrap font-sans">{authoritativeBattleLog.join('\n')}</pre>
            </details>
          </>
        )}
        {showZeroKillNote && (
          <div className="text-xs text-stone-500">（目标已被其他玩家击杀，无新增奖励）</div>
        )}
        {siegeCompleted && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-900/50 p-3">
            <div className="font-bold text-amber-400">🏰 城池攻破！</div>
          </div>
        )}
        {typeof onBanditContinue === 'function' ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onBanditContinue}
              className="flex-1 min-w-0 rounded-lg bg-gradient-to-r from-amber-700 to-yellow-700 py-2.5 text-sm font-bold text-amber-100"
            >
              继续
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 min-w-0 rounded-lg bg-gradient-to-r from-amber-700 to-yellow-700 py-2.5 text-sm font-bold text-amber-100"
            >
              退出
            </button>
          </div>
        ) : typeof onBanditDefeatAbandon === 'function' ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onBanditDefeatAbandon}
              className="flex-1 min-w-0 rounded-lg border border-stone-500 bg-stone-800 py-2.5 text-sm font-bold text-stone-200 hover:bg-stone-700"
            >
              放弃
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 min-w-0 rounded-lg bg-gradient-to-r from-amber-700 to-yellow-700 py-2.5 text-sm font-bold text-amber-100"
            >
              确定
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onConfirm}
            className="w-full rounded-lg bg-gradient-to-r from-amber-700 to-yellow-700 py-2.5 text-sm font-bold text-amber-100"
          >
            确定
          </button>
        )}
      </div>
    </div>
  );
}
