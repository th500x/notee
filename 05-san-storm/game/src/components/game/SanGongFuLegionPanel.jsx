/**
 * 三公府 · 军团（横屏左下象限 / 竖屏「军团」Tab）
 * 品阶门闸：三阶官职以上（position_level ≤ 3）；未达时半透明遮罩 + 底层预览。
 * 编制入口；势力 Tab「军团」象限为只读展示（见 FactionLegionSection）。
 */

import { isLegionUnlocked } from '@/utils/sanGongPositionGates';
import SanGongFuPositionLockedShell from '@/components/game/SanGongFuPositionLockedShell';

const LOCK_LABEL = '三阶官职以上专属';

/**
 * @param {{ positionLevel?: number|null }} props
 */
export default function SanGongFuLegionPanel({ positionLevel }) {
  const unlocked = isLegionUnlocked(positionLevel);

  const body = (
    <div className="flex h-full min-h-[6rem] flex-col items-center justify-center rounded-lg border border-stone-700/40 bg-stone-900/30 px-3 py-4 text-center">
      <div className="text-[10px] font-semibold text-stone-500">军团</div>
      <p className="mt-2 max-w-[18rem] text-[10px] leading-snug text-stone-600">
        军团编制、成员邀请与驻地联动（占位，规则待实装）。
      </p>
    </div>
  );

  if (!unlocked) {
    return <SanGongFuPositionLockedShell label={LOCK_LABEL}>{body}</SanGongFuPositionLockedShell>;
  }

  return body;
}
