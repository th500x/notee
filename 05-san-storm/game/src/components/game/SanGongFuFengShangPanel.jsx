/**
 * 三公府 · 互动 · 封赏：礼盒/兑换/军备 + 道具/将领/部队卡池入口（与 `CardPoolPoolButton` 同源样式）。
 * 日俸已迁至君主每日传书领取，本面板不再提供俸禄按钮。
 * 打开卡池后仍由 `GamePage` 的 `CardPoolDrawer` / `ItemCardPoolDrawer` + `useCardPool` 承接（经 `onOpenPool`）。
 */

import { useCallback, useEffect, useState } from 'react';
import { CardPoolPoolButton } from '@/components/game/CardPoolPoolButton';
import SanGongResourceExchangeModal from '@/components/game/SanGongResourceExchangeModal';
import SanGongGiftBoxModal from '@/components/game/SanGongGiftBoxModal';
import SanGongArmamentModal from '@/components/game/SanGongArmamentModal';
import { playerAPI } from '@/services/playerApi';

const GIFT_BOX_TOOLTIP =
  '消耗贡献兑换传奇宝物（4xxx 编号，每件 50 贡献）；每自然日 1 次（0:00 刷新，与银粮兑换一致）。';

const EXCHANGE_TOOLTIP =
  '个人银两与粮草同势力储备互换：基数=俸禄 B（档系数×官职倍数）；名义 1:5，松紧随池子余量；优享包池侧 +20%。每包每日 1 次（0:00 刷新）。';

const ARMAMENT_TOOLTIP =
  '消耗贡献兑换兵符或玉牌：10 贡献兑 1 件；每日最多 5 兵符 + 5 玉牌（0:00 刷新，与礼盒一致）。';

/**
 * @param {{
 *   onOpenPool: (type: 'character' | 'troop' | 'item') => void,
 *   drawerOpen?: boolean,
 *   troopRemaining: string | number,
 *   charRemaining: string | number,
 *   itemRemaining?: string | number,
 *   dailyLimit: string | number,
 *   playerId?: string | null,
 *   onAfterResourceChange?: () => void | Promise<void>,
 * }} props
 */
export default function SanGongFuFengShangPanel({
  onOpenPool,
  drawerOpen = false,
  troopRemaining,
  charRemaining,
  itemRemaining = '?',
  dailyLimit,
  playerId,
  onAfterResourceChange,
  /** @deprecated 兼容旧 prop；等同 onAfterResourceChange */
  onAfterStipendClaim,
}) {
  const afterChange = onAfterResourceChange || onAfterStipendClaim;
  const [toast, setToast] = useState(null);
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [exchangeRemaining, setExchangeRemaining] = useState(4);
  const [giftBoxOpen, setGiftBoxOpen] = useState(false);
  const [giftBoxRemaining, setGiftBoxRemaining] = useState(1);
  const [armamentOpen, setArmamentOpen] = useState(false);
  const [armamentRemaining, setArmamentRemaining] = useState(10);

  const loadExchangeRemaining = useCallback(async () => {
    if (!playerId) {
      setExchangeRemaining(4);
      return;
    }
    try {
      const res = await playerAPI.getSanGongFuResourceExchangePreview(playerId);
      if (res.success && res.data?.packs?.length) {
        const left = res.data.packs.filter((p) => !p.claimedToday).length;
        setExchangeRemaining(left);
      }
    } catch {
      /* ignore */
    }
  }, [playerId]);

  useEffect(() => {
    loadExchangeRemaining();
  }, [loadExchangeRemaining]);

  const loadGiftBoxRemaining = useCallback(async () => {
    if (!playerId) {
      setGiftBoxRemaining(1);
      return;
    }
    try {
      const res = await playerAPI.getSanGongFuGiftBoxPreview(playerId);
      if (res.success && res.data) {
        setGiftBoxRemaining(res.data.claimedToday ? 0 : 1);
      }
    } catch {
      /* ignore */
    }
  }, [playerId]);

  useEffect(() => {
    loadGiftBoxRemaining();
  }, [loadGiftBoxRemaining]);

  const loadArmamentRemaining = useCallback(async () => {
    if (!playerId) {
      setArmamentRemaining(10);
      return;
    }
    try {
      const res = await playerAPI.getSanGongFuArmamentPreview(playerId);
      if (res.success && res.data) {
        setArmamentRemaining(Math.max(0, Math.floor(Number(res.data.remainingTotal) || 0)));
      }
    } catch {
      /* ignore */
    }
  }, [playerId]);

  useEffect(() => {
    loadArmamentRemaining();
  }, [loadArmamentRemaining]);

  return (
    <div className="shrink-0 rounded-lg border border-stone-700/40 bg-stone-900/30 px-2 py-2 text-left">
      <div className="mb-2 text-left text-[10px] font-semibold text-amber-500/90">封赏</div>
      {toast ? (
        <div className="mb-2 rounded border border-amber-800/40 bg-amber-950/50 px-2 py-1 text-[10px] text-amber-100">
          {toast}
        </div>
      ) : null}
      <div className="flex flex-wrap justify-start gap-3 overflow-visible">
        <CardPoolPoolButton
          icon="🎁"
          label="礼盒"
          subLabel={giftBoxRemaining > 0 ? `${giftBoxRemaining}/1` : '今日已兑'}
          remaining={giftBoxRemaining}
          dailyLimit={1}
          drawerOpen={drawerOpen}
          tooltip={GIFT_BOX_TOOLTIP}
          onClick={() => setGiftBoxOpen(true)}
        />
        <CardPoolPoolButton
          icon="🔄"
          label="兑换"
          subLabel={`${exchangeRemaining}/4`}
          remaining={exchangeRemaining}
          dailyLimit={4}
          drawerOpen={drawerOpen}
          tooltip={EXCHANGE_TOOLTIP}
          onClick={() => setExchangeOpen(true)}
        />
        <CardPoolPoolButton
          icon="🛡️"
          label="军备"
          subLabel={armamentRemaining > 0 ? `${armamentRemaining}/10` : '今日已兑'}
          remaining={armamentRemaining}
          dailyLimit={10}
          drawerOpen={drawerOpen}
          tooltip={ARMAMENT_TOOLTIP}
          onClick={() => {
            setToast(null);
            setArmamentOpen(true);
          }}
        />
        <CardPoolPoolButton
          icon="🎲"
          label="道具卡池"
          remaining={itemRemaining}
          dailyLimit={dailyLimit}
          drawerOpen={drawerOpen}
          onClick={() => onOpenPool?.('item')}
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

      <SanGongResourceExchangeModal
        open={exchangeOpen}
        onClose={() => setExchangeOpen(false)}
        playerId={playerId}
        onAfterExchange={async () => {
          await loadExchangeRemaining();
          await afterChange?.();
        }}
      />

      <SanGongGiftBoxModal
        open={giftBoxOpen}
        onClose={() => setGiftBoxOpen(false)}
        playerId={playerId}
        onAfterRedeem={async () => {
          await loadGiftBoxRemaining();
          await afterChange?.();
        }}
      />

      <SanGongArmamentModal
        open={armamentOpen}
        onClose={() => setArmamentOpen(false)}
        playerId={playerId}
        onAfterRedeem={async () => {
          await loadArmamentRemaining();
          await afterChange?.();
        }}
      />
    </div>
  );
}
