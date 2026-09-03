import { useMemo, useState } from 'react';
import AncientModal from '@/components/common/AncientModal';
import PvpAutoDuelReplay from '@/pvp/auto-duel/PvpAutoDuelReplay';
import { getRarityHex, getRarityLabelCn } from '@/constants';
import { shortEquipmentDisplayName } from '@/utils/equipmentDisplayName';
import {
  BANDIT_BETWEEN_LAYER_HEAL_FOOD_HEAVY,
  BANDIT_BETWEEN_LAYER_HEAL_FOOD_LIGHT,
  BANDIT_BETWEEN_LAYER_HEAL_HEAVY,
  BANDIT_BETWEEN_LAYER_HEAL_LIGHT,
  computeBanditBetweenLayerHeal,
} from '@shared/utils/banditBetweenLayerHeal.js';

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
        战报 · 简化回放
      </button>
      {open && (
        <AncientModal
          isOpen
          onClose={() => setOpen(false)}
          type="confirm"
          title="战报 · 简化回放"
          hideButtons
          width="max-w-md"
        >
          <div className="-mx-2 -my-2 bg-[#1a1a2e] rounded p-2 text-left">
            <PvpAutoDuelReplay
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
  personalSilverEarned = null,
  factionSilverToPool = 0,
  siegeRewardPersonalSharePct = null,
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
  /** 道路 PVP / 在线城防：不展示 NPC 守军累计行 */
  hideNpcGarrisonLine = false,
  /** 显式胜负（覆盖银两/击杀启发式） */
  playerVictory = null,
  /** 匪寨连战补兵：编组当前/上限（含 inflight） */
  banditHealTroops = null,
  /** 当前粮草（用于禁用不足档） */
  playerFood = 0,
}) {
  /** @type {['none'|'light'|'heavy', Function]} */
  const [banditHealTier, setBanditHealTier] = useState('none');
  const sr = Math.max(0, Number(silverReward) || 0);
  const personalSilver =
    personalSilverEarned != null && Number.isFinite(Number(personalSilverEarned))
      ? Math.max(0, Number(personalSilverEarned))
      : sr;
  const factionPoolSilver = Math.max(0, Number(factionSilverToPool) || 0);
  const sharePct =
    siegeRewardPersonalSharePct != null && Number.isFinite(Number(siegeRewardPersonalSharePct))
      ? Math.round(Number(siegeRewardPersonalSharePct))
      : null;
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
    playerVictory != null
      ? !!playerVictory
      : settlementKind === 'bandit'
        ? banditOutcome === 'victory'
        : !!((kc != null ? kcShown : 0) || personalSilver || cr || fr);

  const chestList = Array.isArray(chestRewards) ? chestRewards : [];
  const showBanditBetweenLayerHeal =
    settlementKind === 'bandit' &&
    banditOutcome === 'victory' &&
    typeof onBanditContinue === 'function';
  const healTroops = Array.isArray(banditHealTroops) ? banditHealTroops : [];
  const foodHave = Math.max(0, Math.floor(Number(playerFood) || 0));
  const lightQuote = useMemo(
    () => computeBanditBetweenLayerHeal({ troops: healTroops, tier: 'light' }),
    [healTroops],
  );
  const heavyQuote = useMemo(
    () => computeBanditBetweenLayerHeal({ troops: healTroops, tier: 'heavy' }),
    [healTroops],
  );
  const lightCost = lightQuote.ok ? lightQuote.foodCost : 0;
  const heavyCost = heavyQuote.ok ? heavyQuote.foodCost : 0;
  const lightAffordable = lightQuote.ok && foodHave >= lightCost;
  const heavyAffordable = heavyQuote.ok && foodHave >= heavyCost;
  const healTroopsMissing = showBanditBetweenLayerHeal && healTroops.length === 0;
  const healAllFull =
    showBanditBetweenLayerHeal &&
    healTroops.length > 0 &&
    lightQuote.ok &&
    lightCost === 0 &&
    heavyQuote.ok &&
    heavyCost === 0;
  const selectedHealCost =
    banditHealTier === 'light' ? lightCost : banditHealTier === 'heavy' ? heavyCost : 0;
  const continueBlockedByHeal =
    showBanditBetweenLayerHeal &&
    banditHealTier !== 'none' &&
    (banditHealTier === 'light' ? !lightAffordable : !heavyAffordable);

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
            {personalSilver > 0 && (
              <div className="text-amber-300 text-sm">💰 获得 {personalSilver} 银两</div>
            )}
            {factionPoolSilver > 0 && (
              <div className="text-stone-400 text-xs">
                另有 {factionPoolSilver} 银两入势力池
                {sharePct != null && sharePct < 100 ? `（个人份额 ${sharePct}%）` : ''}
              </div>
            )}
            {sr > 0 && personalSilver !== sr && personalSilver <= 0 && (
              <div className="text-amber-300 text-sm">💰 本场净银 {sr}（已按政策入势力池）</div>
            )}
            {fr > 0 && <div className="text-lime-200/95 text-sm">🌾 获得 {fr} 粮草</div>}
          </>
        )}
        {equipmentDrop && (
          <div
            className="text-sm font-medium"
            style={{ color: getRarityHex(equipmentDrop.rarity) }}
          >
            🎁 战后随机掉落（约 5%）：{equipmentDrop.name}（{getRarityLabelCn(equipmentDrop.rarity)}）
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
        {settlementKind === 'siege' && !hideNpcGarrisonLine ? (
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
        {showBanditBetweenLayerHeal ? (
          <div className="space-y-2 border-t border-amber-500/20 pt-2 text-left">
            <div className="text-[11px] text-stone-400">
              连战补兵（可选，点继续时扣粮；退出不扣）· 粮草 {foodHave}
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-xs text-stone-200">
              <input
                type="radio"
                name="bandit-between-layer-heal"
                className="mt-0.5"
                checked={banditHealTier === 'none'}
                onChange={() => setBanditHealTier('none')}
              />
              <span>不补兵</span>
            </label>
            <label
              className={`flex items-start gap-2 text-xs ${
                lightAffordable ? 'cursor-pointer text-stone-200' : 'cursor-not-allowed text-stone-500'
              }`}
            >
              <input
                type="radio"
                name="bandit-between-layer-heal"
                className="mt-0.5"
                checked={banditHealTier === 'light'}
                disabled={!lightAffordable}
                onChange={() => setBanditHealTier('light')}
              />
              <span>
                轻补 +{BANDIT_BETWEEN_LAYER_HEAL_LIGHT}/支（{BANDIT_BETWEEN_LAYER_HEAL_FOOD_LIGHT}{' '}
                粮/受益支）· 合计 {lightCost} 粮
                {!lightAffordable && lightQuote.ok ? ' · 粮不足' : ''}
              </span>
            </label>
            <label
              className={`flex items-start gap-2 text-xs ${
                heavyAffordable ? 'cursor-pointer text-stone-200' : 'cursor-not-allowed text-stone-500'
              }`}
            >
              <input
                type="radio"
                name="bandit-between-layer-heal"
                className="mt-0.5"
                checked={banditHealTier === 'heavy'}
                disabled={!heavyAffordable}
                onChange={() => setBanditHealTier('heavy')}
              />
              <span>
                重补 +{BANDIT_BETWEEN_LAYER_HEAL_HEAVY}/支（{BANDIT_BETWEEN_LAYER_HEAL_FOOD_HEAVY}{' '}
                粮/受益支）· 合计 {heavyCost} 粮
                {!heavyAffordable && heavyQuote.ok ? ' · 粮不足' : ''}
              </span>
            </label>
            {healTroopsMissing ? (
              <div className="text-[11px] text-amber-200/80">
                未读到终场兵力，合计暂为 0；请退出后重开一局再试连战补兵。
              </div>
            ) : null}
            {healAllFull ? (
              <div className="text-[11px] text-stone-500">当前编组已满编，补兵无需扣粮。</div>
            ) : null}
            {banditHealTier !== 'none' && selectedHealCost > 0 ? (
              <div className="text-[11px] text-lime-200/80">继续将消耗 {selectedHealCost} 粮草</div>
            ) : null}
          </div>
        ) : null}
        {typeof onBanditContinue === 'function' ? (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={continueBlockedByHeal}
              onClick={() => {
                if (continueBlockedByHeal) return;
                const tier =
                  showBanditBetweenLayerHeal && banditHealTier !== 'none' ? banditHealTier : null;
                onBanditContinue(tier);
              }}
              className={`flex-1 min-w-0 rounded-lg bg-gradient-to-r from-amber-700 to-yellow-700 py-2.5 text-sm font-bold text-amber-100 ${
                continueBlockedByHeal ? 'opacity-40 cursor-not-allowed' : ''
              }`}
            >
              继续
            </button>
            <button
              type="button"
              onClick={() => {
                setBanditHealTier('none');
                onConfirm();
              }}
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
