/**
 * 战事竞态士气条（32-4 §1.3 · 17-3 §7.4）
 */

const BAR_H_PX = 5;

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

  const leftColor = isOffensive ? 'bg-sky-400/90' : 'bg-red-400/90';
  const rightColor = isOffensive ? 'bg-red-400/90' : 'bg-sky-400/90';

  return (
    <div
      className={`relative w-full overflow-hidden rounded-sm bg-stone-900/80 ${className}`}
      style={{ height: BAR_H_PX }}
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
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[9px] leading-none text-stone-100/95 tabular-nums">
        {att}/{def}
      </span>
    </div>
  );
}
