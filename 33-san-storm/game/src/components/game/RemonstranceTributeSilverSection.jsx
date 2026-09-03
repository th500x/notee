/**
 * 官员谏言 · 上供银两档位选择（12-1 §9.4）
 */

import { useMemo } from 'react';
import {
  TRIBUTE_APPROVAL_BONUS_PER_STEP,
  TRIBUTE_CONTRIBUTION_PER_STEP,
  TRIBUTE_SILVER_STEP,
  buildTributeSilverOptions,
} from '@/utils/remonstranceTributeSilverDisplay';

const fmtNum = (n) => Math.max(0, Math.floor(Number(n) || 0)).toLocaleString('zh-CN');

/**
 * @param {{
 *   tributeSilver: number,
 *   onTributeSilverChange: (n: number) => void,
 *   playerSilver?: number,
 *   disabled?: boolean,
 * }} props
 */
export default function RemonstranceTributeSilverSection({
  tributeSilver,
  onTributeSilverChange,
  playerSilver = 0,
  disabled = false,
}) {
  const balance = Math.max(0, Math.floor(Number(playerSilver) || 0));
  const options = useMemo(() => buildTributeSilverOptions(balance), [balance]);
  const steps = Math.floor(Math.max(0, tributeSilver) / TRIBUTE_SILVER_STEP);
  const bonusPct = Math.round(steps * TRIBUTE_APPROVAL_BONUS_PER_STEP * 100);
  const contribution = steps * TRIBUTE_CONTRIBUTION_PER_STEP;
  const unaffordable = tributeSilver > 0 && balance < tributeSilver;

  return (
    <div className="rounded-lg border border-stone-600/70 bg-stone-950 px-2.5 py-2">
      <div className="text-[11px] font-semibold text-amber-500/95">上供银两（可选）</div>
      <p className="mt-1 text-[10px] leading-snug text-stone-500">
        每 {TRIBUTE_SILVER_STEP} 银 +{Math.round(TRIBUTE_APPROVAL_BONUS_PER_STEP * 100)}% 通过率、+{TRIBUTE_CONTRIBUTION_PER_STEP} 贡献；
        自个人银两扣，划入势力储备（提交即扣，与审批结果无关）。
      </p>
      <p className="mt-1 text-[11px] text-stone-400">
        个人银两：<span className="text-stone-200">{fmtNum(balance)}</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((amt) => {
          const active = tributeSilver === amt;
          const tooMuch = amt > 0 && balance < amt;
          return (
            <button
              key={amt}
              type="button"
              disabled={disabled || tooMuch}
              onClick={() => onTributeSilverChange(amt)}
              className={`rounded border px-2 py-1 text-[10px] font-medium tabular-nums ${
                active
                  ? 'border-amber-600/70 bg-amber-950/50 text-amber-100'
                  : tooMuch
                    ? 'cursor-not-allowed border-stone-700/50 bg-stone-900/30 text-stone-600'
                    : 'border-stone-600/60 bg-stone-900/40 text-stone-300 hover:border-amber-800/50'
              }`}
            >
              {amt === 0 ? '不上供' : `${fmtNum(amt)} 银`}
            </button>
          );
        })}
      </div>
      {tributeSilver > 0 ? (
        <p className="mt-2 text-[11px] text-stone-300">
          已选上供 <span className="font-semibold text-amber-200/95">{fmtNum(tributeSilver)}</span> 银
          {bonusPct > 0 ? (
            <>
              {' '}
              · 通过率 <span className="text-emerald-300/90">+{bonusPct}%</span>
            </>
          ) : null}
          {contribution > 0 ? (
            <>
              {' '}
              · 贡献 <span className="text-sky-300/90">+{contribution}</span>
            </>
          ) : null}
        </p>
      ) : null}
      {unaffordable ? (
        <p className="mt-1 text-[10px] text-red-400/90">个人银两不足以支付所选上供档位。</p>
      ) : null}
    </div>
  );
}
