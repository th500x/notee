/**
 * 三公府 · 朝政（横屏左下象限 / 竖屏「朝政」Tab）：「三公」入口（势力战事 / 势力政策）。
 *
 * 品阶口径与 `PositionCard`「品阶 Lv」一致（`config_positions.position_level`）：**数字越小品阶越高**
 * （Lv.0 君主 … Lv.6 校尉）。文案「三阶官职以上」对应 **品阶 Lv ≤ 3**（四方将军及以上）。
 * 未满足时整象限描灰 +「三阶官职以上专属」。后端玩法占位后续再接。
 *
 * **一品（position_level === 1）**：该品阶下可有**多种官职配置**（非单指某一官名）。满足时在本象限内额外展示
 * 「提议战事 / 结束战事」占位入口（规则待实装）。
 */

import { CardPoolPoolButton } from '@/components/game/CardPoolPoolButton';

/** 四方将军为 Lv.3；「三阶及以上」含 Lv.0～3 */
const MAX_POSITION_LEVEL_FOR_SANGONG_SECTION = 3;

/** 一品档：position_level === 1（仅次于君主 Lv.0；具体官名由 config_positions 决定） */
const TIER1_POSITION_LEVEL = 1;

/**
 * @param {{
 *   positionLevel?: number|null,
 *   onOpenFactionWars?: () => void,
 *   factionWarDrawerOpen?: boolean,
 * }} props
 */
export default function SanGongFuChaoZhengPanel({
  positionLevel,
  onOpenFactionWars,
  factionWarDrawerOpen = false,
}) {
  const lv = Number(positionLevel);
  const unlocked = Number.isFinite(lv) && lv <= MAX_POSITION_LEVEL_FOR_SANGONG_SECTION;
  const isTier1Official = Number.isFinite(lv) && lv === TIER1_POSITION_LEVEL;

  if (!unlocked) {
    return (
      <div
        className="relative flex h-full min-h-0 flex-col items-center justify-center overflow-hidden rounded-lg border border-stone-600/50 bg-stone-950 grayscale brightness-[0.55] contrast-[0.92]"
        aria-label="三阶官职以上专属"
      >
        <div className="absolute inset-0 bg-black/40" aria-hidden />
        <p className="relative z-10 px-3 text-sm font-semibold text-stone-400">三阶官职以上专属</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-1">
      <div className="shrink-0 rounded-lg border border-stone-700/40 bg-stone-900/30 px-2 py-2 text-left">
        <div className="mb-2 text-left text-[10px] font-semibold text-amber-500/90">三公</div>
        <div className="flex flex-wrap justify-start gap-3">
          <CardPoolPoolButton
            icon="⚔️"
            label="势力战事"
            subLabel="攻城类列表"
            drawerOpen={factionWarDrawerOpen}
            onClick={() => onOpenFactionWars?.()}
            tooltip="查看本势力作为攻方、进行中的攻城类（siege）PVP 战事，并可主动结束（品阶 Lv≤3）。"
          />
          <CardPoolPoolButton
            icon="📜"
            label="势力政策"
            subLabel="敬请期待"
            onClick={() => {}}
            tooltip="势力政策（占位，规则待实装）"
          />
        </div>
      </div>

      {isTier1Official && (
        <div className="shrink-0 rounded-lg border border-amber-800/35 bg-stone-900/40 px-2 py-2 text-left">
          <div className="mb-2 text-left text-[10px] font-semibold text-amber-400/95">
            一品官职（position_level = 1）
          </div>
          <p className="mb-2 text-[10px] leading-snug text-stone-500">
            战事提议与结案入口（占位）：适用于该品阶下**任意**官职配置；后续接审批流与 POST /api/pvp-wars/:id/cancel
            的 endedByOfficial 等。
          </p>
          <div className="flex flex-wrap justify-start gap-3">
            <CardPoolPoolButton
              icon="📝"
              label="提议战事"
              subLabel="占位"
              onClick={() => {}}
              tooltip="一品官职提议战事（占位，待实装）"
            />
            <CardPoolPoolButton
              icon="🕊️"
              label="结束战事"
              subLabel="占位"
              onClick={() => {}}
              tooltip="一品主持结案（占位，传 endedByOfficial）；日常结束攻方攻城战事请用上方「势力战事」。"
            />
          </div>
        </div>
      )}
    </div>
  );
}
