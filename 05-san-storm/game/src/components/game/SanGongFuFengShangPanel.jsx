/**
 * 三公府 · 互动 · 封赏：俸禄（国力档位日领）+ 礼盒/兑换/军备（占位）+ 将领/部队卡池入口（与 `CardPoolPoolButton` 同源样式）。
 * 打开卡池后仍由 `GamePage` 的 `CardPoolDrawer` + `useCardPool` 承接（经 `onOpenPool`）。
 */

import { useCallback, useEffect, useState } from 'react';
import { CardPoolPoolButton } from '@/components/game/CardPoolPoolButton';
import PoolResultModalFrame from '@/components/game/PoolResultModalFrame';
import { playerAPI } from '@/services/playerApi';
import { RARITY, RARITY_COLORS } from '@/constants';

const SUPPLY_TIER_LINE_HEX = {
  S: RARITY_COLORS[RARITY.LEGENDARY],
  A: RARITY_COLORS[RARITY.EPIC],
  B: RARITY_COLORS[RARITY.RARE],
  C: RARITY_COLORS[RARITY.COMMON],
  D: '#78716c',
};

const STIPEND_TOOLTIP = '按本势力国力档位（S～D）领取银两与粮草：档位越高基准越大。';

const GIFT_BOX_TOOLTIP =
  '规划：消耗银两开启礼盒，随机获得物品（道具/卡池等细则待定）。当前仅为入口占位。';

const EXCHANGE_TOOLTIP =
  '规划：消耗指定资源或道具兑换奖励（兑换池、日限与扣费细则待定）。当前仅为入口占位。';

const ARMAMENT_TOOLTIP =
  '规划：消耗贡献值兑换额外探索/战斗/匪寨次数（每日 0:00 重置兑换机会，细则见 12-1 §4.3）。当前仅为入口占位。';

/**
 * @param {{
 *   onOpenPool: (type: 'character' | 'troop') => void,
 *   drawerOpen?: boolean,
 *   troopRemaining: string | number,
 *   charRemaining: string | number,
 *   dailyLimit: string | number,
 *   playerId?: string | null,
 *   onAfterStipendClaim?: () => void | Promise<void>,
 * }} props
 */
export default function SanGongFuFengShangPanel({
  onOpenPool,
  drawerOpen = false,
  troopRemaining,
  charRemaining,
  dailyLimit,
  playerId,
  onAfterStipendClaim,
}) {
  const [stipendStatus, setStipendStatus] = useState(null);
  const [stipendLoadErr, setStipendLoadErr] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [toast, setToast] = useState(null);
  const [stipendResult, setStipendResult] = useState(null);

  const loadStipend = useCallback(async () => {
    if (!playerId) {
      setStipendStatus(null);
      return;
    }
    setStipendLoadErr(null);
    try {
      const res = await playerAPI.getSanGongFuStipendStatus(playerId);
      if (res.success && res.data) {
        setStipendStatus(res.data);
      } else {
        setStipendStatus(null);
        setStipendLoadErr(res.error || '俸禄状态加载失败');
      }
    } catch (e) {
      setStipendStatus(null);
      setStipendLoadErr(e?.message || '俸禄状态加载失败');
    }
  }, [playerId]);

  useEffect(() => {
    loadStipend();
  }, [loadStipend]);

  const stipendRemaining = stipendStatus?.remainingToday ?? 1;
  const stipendMax = stipendStatus?.maxPerDay ?? 1;
  const stipendSubLabel =
    stipendLoadErr != null ? '—' : stipendStatus?.claimedToday ? '今日已领' : `${stipendRemaining}/${stipendMax}`;

  const onClaimStipend = useCallback(async () => {
    setToast(null);
    if (!playerId) {
      setToast('未登录');
      return;
    }
    if (claiming) return;
    if (stipendStatus && !stipendStatus.canClaim) {
      setToast(stipendStatus.blockReason || '当前不可领取');
      return;
    }
    setClaiming(true);
    try {
      const res = await playerAPI.claimSanGongFuStipend(playerId);
      if (res.success && res.data?.silver != null && res.data?.food != null && res.data?.supplyTier) {
        setStipendResult({
          silver: res.data.silver,
          food: res.data.food,
          supplyTier: res.data.supplyTier,
          rollPercent: res.data.rollPercent,
          tierCoeff: res.data.tierCoeff,
          baseSilver: res.data.baseSilver,
          baseFood: res.data.baseFood,
          appliedSilver: res.data.appliedSilver,
          appliedFood: res.data.appliedFood,
          resourceMultiplier: res.data.resourceMultiplier,
          rationBonus: res.data.rationBonus,
          reputationGranted: res.data.reputationGranted ?? 0,
          contributionGranted: res.data.contributionGranted ?? 0,
        });
        await loadStipend();
        await onAfterStipendClaim?.();
      } else {
        setToast(res.error || '领取失败');
      }
    } catch (e) {
      setToast(e?.message || '领取失败');
    } finally {
      setClaiming(false);
    }
  }, [playerId, claiming, stipendStatus, loadStipend, onAfterStipendClaim]);

  const closeStipendResult = useCallback(() => {
    setStipendResult(null);
    loadStipend();
  }, [loadStipend]);

  const tierHex = stipendResult?.supplyTier
    ? SUPPLY_TIER_LINE_HEX[String(stipendResult.supplyTier).toUpperCase()] || RARITY_COLORS[RARITY.COMMON]
    : RARITY_COLORS[RARITY.COMMON];

  return (
    <div className="shrink-0 rounded-lg border border-stone-700/40 bg-stone-900/30 px-2 py-2 text-left">
      <div className="mb-2 text-left text-[10px] font-semibold text-amber-500/90">封赏</div>
      {stipendLoadErr ? (
        <div className="mb-2 text-[10px] text-red-400/90">{stipendLoadErr}</div>
      ) : null}
      {toast ? (
        <div className="mb-2 rounded border border-amber-800/40 bg-amber-950/50 px-2 py-1 text-[10px] text-amber-100">
          {toast}
        </div>
      ) : null}
      <div className="flex flex-wrap justify-start gap-3 overflow-visible">
        <CardPoolPoolButton
          icon="💰"
          label="俸禄"
          remaining={stipendRemaining}
          dailyLimit={stipendMax}
          subLabel={stipendSubLabel}
          drawerOpen={drawerOpen}
          tooltip={STIPEND_TOOLTIP}
          disabled={claiming}
          onClick={onClaimStipend}
        />
        <CardPoolPoolButton
          icon="🎁"
          label="礼盒"
          subLabel="敬请期待"
          remaining={0}
          dailyLimit={1}
          drawerOpen={drawerOpen}
          tooltip={GIFT_BOX_TOOLTIP}
          onClick={() => {
            setToast('礼盒功能筹备中，敬请期待');
          }}
        />
        <CardPoolPoolButton
          icon="🔄"
          label="兑换"
          subLabel="敬请期待"
          remaining={0}
          dailyLimit={1}
          drawerOpen={drawerOpen}
          tooltip={EXCHANGE_TOOLTIP}
          onClick={() => {
            setToast('兑换功能筹备中，敬请期待');
          }}
        />
        <CardPoolPoolButton
          icon="🛡️"
          label="军备"
          subLabel="敬请期待"
          remaining={0}
          dailyLimit={1}
          drawerOpen={drawerOpen}
          tooltip={ARMAMENT_TOOLTIP}
          onClick={() => {
            setToast('军备功能筹备中，敬请期待');
          }}
        />
        <CardPoolPoolButton
          icon="🎴"
          label="将领卡池"
          remaining={charRemaining}
          dailyLimit={dailyLimit}
          drawerOpen={drawerOpen}
          onClick={() => onOpenPool?.('character')}
        />
        <CardPoolPoolButton
          icon="⚔️"
          label="部队卡池"
          remaining={troopRemaining}
          dailyLimit={dailyLimit}
          drawerOpen={drawerOpen}
          onClick={() => onOpenPool?.('troop')}
        />
      </div>

      {stipendResult ? (
        <PoolResultModalFrame title="💰 领取俸禄结果" onClose={closeStipendResult}>
          <div className="flex flex-col items-center">
            <div
              style={{ width: 128, height: 192 }}
              className="relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border-2 border-amber-700/45 bg-gradient-to-b from-stone-400/20 via-stone-800/50 to-stone-950/90 px-2 py-3 shadow-inner"
            >
              <div className="text-center">
                <div className="text-2xl leading-none">💰</div>
                <div className="mt-1 text-base font-bold tabular-nums text-amber-200">+{stipendResult.silver}</div>
              </div>
              <div className="h-px w-16 bg-amber-700/40" />
              <div className="text-center">
                <div className="text-2xl leading-none">🌾</div>
                <div className="mt-1 text-base font-bold tabular-nums text-lime-200">+{stipendResult.food}</div>
              </div>
            </div>
            <div className="mt-3 text-center space-y-1">
              <div className="text-xs font-bold" style={{ color: tierHex }}>
                国力 {String(stipendResult.supplyTier).toUpperCase()}
              </div>
              {Number.isFinite(stipendResult.rollPercent) &&
              stipendResult.baseSilver != null &&
              stipendResult.baseFood != null ? (
                <div className="text-stone-400 text-[10px] leading-snug">
                  基础俸禄 B：
                  {Number.isFinite(stipendResult.tierCoeff) ? (
                    <>
                      <span className="text-stone-500">档系数 {stipendResult.tierCoeff}</span>
                      {' × '}
                    </>
                  ) : null}
                  随机 <span className="text-amber-200/90">{stipendResult.rollPercent}%</span>
                  {' → 银 '}
                  {stipendResult.baseSilver}
                  {' · 粮 '}
                  {stipendResult.baseFood}
                  <span className="block text-stone-500">（银向下取整；粮 = 银 × 5）</span>
                </div>
              ) : null}
              {stipendResult.resourceMultiplier > 1 &&
              stipendResult.appliedSilver != null &&
              stipendResult.appliedFood != null ? (
                <div className="text-stone-400 text-[10px]">
                  官职资源 ×{stipendResult.resourceMultiplier} → 银 {stipendResult.appliedSilver} · 粮{' '}
                  {stipendResult.appliedFood}
                </div>
              ) : null}
              {stipendResult.rationBonus &&
              (stipendResult.rationBonus.bonusSilver > 0 || stipendResult.rationBonus.bonusFood > 0) ? (
                <div className="text-amber-200/80 text-[10px]">
                  粮饷政策 Bonus +{stipendResult.rationBonus.bonusSilver} 银 · +
                  {stipendResult.rationBonus.bonusFood} 粮（{stipendResult.rationBonus.bonusPctApplied}%）
                </div>
              ) : null}
              {stipendResult.reputationGranted > 0 ? (
                <div className="text-purple-300 text-[10px] tabular-nums">
                  声望 +{stipendResult.reputationGranted}
                </div>
              ) : null}
              {stipendResult.contributionGranted > 0 ? (
                <div className="text-cyan-300 text-[10px] tabular-nums">
                  贡献 +{stipendResult.contributionGranted}
                </div>
              ) : null}
              <div className="mt-0.5 text-stone-300 text-[10px]">获得银两与粮草</div>
            </div>
          </div>
        </PoolResultModalFrame>
      ) : null}
    </div>
  );
}
