/**
 * 三公府 · 朝政（横屏右下象限 / 竖屏「朝政」Tab）：「三公」入口（势力战事 / 势力政策）。
 *
 * 品阶口径与 `PositionCard`「品阶 Lv」一致（`config_positions.position_level`）：**数字越小品阶越高**
 * （Lv.0 君主 … Lv.6 校尉）。文案「一阶官职以上」对应 **品阶 Lv ≤ 1**。
 * 未满足时半透明遮罩 + 底层 UI 预览，居中「一阶官职以上专属」。
 *
 * **一品（position_level === 1）**：可发布文书（显示于势力 Tab · 公告 · 文书）。
 */

import { CardPoolPoolButton } from '@/components/game/CardPoolPoolButton';
import SanGongFuDocumentPostPanel from '@/components/game/SanGongFuDocumentPostPanel';
import SanGongFuPositionLockedShell from '@/components/game/SanGongFuPositionLockedShell';
import {
  CHAOZHENG_MAX_POSITION_LEVEL,
  isChaoZhengUnlocked,
} from '@/utils/sanGongPositionGates';

const LOCK_LABEL = '一阶官职以上专属';

/** 一品档：position_level === 1（仅次于君主 Lv.0） */
const TIER1_POSITION_LEVEL = 1;

/**
 * @param {{
 *   playerId?: string|null,
 *   positionLevel?: number|null,
 *   onOpenFactionWars?: () => void,
 *   factionWarDrawerOpen?: boolean,
 *   onDocumentPosted?: () => void,
 * }} props
 */
export default function SanGongFuChaoZhengPanel({
  playerId,
  positionLevel,
  onOpenFactionWars,
  factionWarDrawerOpen = false,
  onDocumentPosted,
}) {
  const lv = Number(positionLevel);
  const unlocked = isChaoZhengUnlocked(positionLevel);
  const isTier1Official = Number.isFinite(lv) && lv === TIER1_POSITION_LEVEL;

  const body = (
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
            tooltip={`查看本势力作为攻方、进行中的攻城类（siege）PVP 战事，并可主动结束（品阶 Lv≤${CHAOZHENG_MAX_POSITION_LEVEL}）。`}
          />
          <CardPoolPoolButton
            icon="📜"
            label="势力政策"
            subLabel="敬请期待"
            onClick={() => {}}
            tooltip="势力政策、文书发布与战事提议/结案等（占位，规则待实装）"
          />
        </div>
      </div>

      {isTier1Official ? (
        <SanGongFuDocumentPostPanel playerId={playerId} onPosted={onDocumentPosted} />
      ) : null}
    </div>
  );

  if (!unlocked) {
    return <SanGongFuPositionLockedShell label={LOCK_LABEL}>{body}</SanGongFuPositionLockedShell>;
  }

  return body;
}
