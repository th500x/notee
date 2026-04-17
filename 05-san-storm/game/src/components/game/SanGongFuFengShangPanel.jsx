/**
 * 三公府 · 朝政 · 封赏：俸禄（占位）+ 将领/部队卡池入口（与 `CardPoolPoolButton` 同源样式）。
 * 打开卡池后仍由 `GamePage` 的 `CardPoolDrawer` + `useCardPool` 承接（经 `onOpenPool`）。
 */

import { CardPoolPoolButton } from '@/components/game/CardPoolPoolButton';

/**
 * @param {{
 *   onOpenPool: (type: 'character' | 'troop') => void,
 *   drawerOpen?: boolean,
 *   troopRemaining: string | number,
 *   charRemaining: string | number,
 *   dailyLimit: string | number,
 * }} props
 */
export default function SanGongFuFengShangPanel({
  onOpenPool,
  drawerOpen = false,
  troopRemaining,
  charRemaining,
  dailyLimit,
}) {
  return (
    <div className="shrink-0 rounded-lg border border-stone-700/40 bg-stone-900/30 px-2 py-2 text-left">
      <div className="mb-2 text-left text-[10px] font-semibold text-amber-500/90">封赏</div>
      <div className="flex flex-wrap justify-start gap-3">
        <CardPoolPoolButton
          icon="💰"
          label="俸禄"
          subLabel="敬请期待"
          drawerOpen={drawerOpen}
          tooltip="按势力国力为臣属发放银两与粮草（占位，规则待实装）"
          onClick={() => {}}
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
    </div>
  );
}
