/**
 * 战事竞态士气条（32-4 §1.3 · 17-3 §7.4）
 * 战事图标：上边沿进攻方 / 下边沿防守方，数值居中；不撑破 66×36 外框。
 */

export const WAR_MORALE_EDGE_BAR_H_PX = 7;

/** 进攻方 sky · 防守方 red（与 17-3 / 32-4 一致，不随玩家视角翻转） */
export const WAR_MORALE_ATTACKER_COLOR = 'bg-sky-400/90';
export const WAR_MORALE_DEFENDER_COLOR = 'bg-red-400/90';

/**
 * @param {number|null|undefined} attackerWarMorale
 * @param {number|null|undefined} defenderWarMorale
 * @returns {boolean}
 */
export function shouldShowWarMoraleBar(attackerWarMorale, defenderWarMorale, hasWarMoraleInit) {
  if (!hasWarMoraleInit) return false;
  return (
    Number.isFinite(Number(attackerWarMorale)) && Number.isFinite(Number(defenderWarMorale))
  );
}

/**
 * 单边士气边条（贴图标上/下边沿 · 按单方占比填充）
 * @param {{ value: number, colorClass: string, edge?: 'top' | 'bottom', className?: string }} props
 */
export function WarMoraleSideEdgeBar({
  value,
  colorClass,
  edge = 'top',
  className = '',
}) {
  const v = Math.max(0, Math.min(120, Math.round(Number(value) || 0)));
  const pct = (v / 120) * 100;
  const roundClass = edge === 'top' ? 'rounded-t-[5px]' : 'rounded-b-[5px]';

  return (
    <div
      className={`relative w-full shrink-0 overflow-hidden bg-stone-900/85 ${roundClass} ${className}`}
      style={{ height: WAR_MORALE_EDGE_BAR_H_PX }}
      aria-hidden
    >
      <div
        className={`absolute inset-y-0 left-0 ${colorClass}`}
        style={{ width: `${pct}%` }}
      />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] leading-none font-semibold text-stone-50 tabular-nums drop-shadow-[0_0_1px_rgba(0,0,0,0.9)]">
        {v}
      </span>
    </div>
  );
}

/**
 * 独立竞态条（非图标边沿场景备用）
 * @param {{ attackerWarMorale: number, defenderWarMorale: number, isOffensive?: boolean }} props
 */
export default function WarMoraleRaceBar({
  attackerWarMorale,
  defenderWarMorale,
  isOffensive = true,
  className = '',
}) {
  const att = Math.max(0, Math.round(Number(attackerWarMorale) || 0));
  const def = Math.max(0, Math.round(Number(defenderWarMorale) || 0));
  const attPct = Math.max(0, Math.min(100, (att / 120) * 100));

  const leftColor = isOffensive ? WAR_MORALE_ATTACKER_COLOR : WAR_MORALE_DEFENDER_COLOR;
  const rightColor = isOffensive ? WAR_MORALE_DEFENDER_COLOR : WAR_MORALE_ATTACKER_COLOR;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-sm bg-stone-900/80 ${className}`}
      style={{ height: WAR_MORALE_EDGE_BAR_H_PX + 1 }}
      title={`战事士气 ${att}/${def}`}
      aria-label={`战事士气 ${att} 比 ${def}`}
    >
      <div
        className={`absolute inset-y-0 left-0 ${leftColor}`}
        style={{ width: `${attPct}%` }}
      />
      <div
        className={`absolute inset-y-0 right-0 ${rightColor}`}
        style={{ width: `${100 - attPct}%` }}
      />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] leading-none font-semibold text-stone-50 tabular-nums drop-shadow-[0_0_1px_rgba(0,0,0,0.9)]">
        {att}/{def}
      </span>
    </div>
  );
}
