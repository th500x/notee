/**
 * 三公府 · 势力战事 —「谏言决算」：目标城、发动费、AI 审批预览、临时政策三开关与提交。
 */

import { useCallback, useMemo, useState } from 'react';
import {
  TRANSIENT_POLICY_KEY,
  TRANSIENT_POLICY_META,
  TRANSIENT_POLICY_ORDER,
} from '@/constants/factionPolicyLabels';

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   targetCityName: string,
 *   targetCityId?: string|null,
 *   proposalKind: 'pvp' | 'pve',
 *   approvalPreview: object|null,
 *   proposalCost: object|null,
 *   targetCityType?: string|null,
 *   transientPolicyFees?: Record<string, { silver: number, food: number }>|null,
 *   canSubmit?: boolean,
 *   submitDisabledReason?: string,
 *   onSubmit?: (transientPolicies: { frontAssault: boolean, rearAssault: boolean, imperialMarch: boolean }) => Promise<{ ok: boolean, message?: string }>,
 * }} props
 */
export default function WarRemonstranceSettlementModal({
  open,
  onClose,
  targetCityName,
  targetCityId,
  proposalKind,
  approvalPreview,
  proposalCost,
  targetCityType,
  transientPolicyFees,
  canSubmit = false,
  submitDisabledReason,
  onSubmit,
}) {
  const [frontAssault, setFrontAssault] = useState(false);
  const [rearAssault, setRearAssault] = useState(false);
  const [imperialMarch, setImperialMarch] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const showTransient = proposalKind === 'pvp';

  const policyFeeTotal = useMemo(() => {
    let silver = 0;
    let food = 0;
    const fees = transientPolicyFees || {};
    if (frontAssault && fees.frontAssault) {
      silver += fees.frontAssault.silver || 0;
      food += fees.frontAssault.food || 0;
    }
    if (rearAssault && fees.rearAssault) {
      silver += fees.rearAssault.silver || 0;
      food += fees.rearAssault.food || 0;
    }
    if (imperialMarch && fees.imperialMarch) {
      silver += fees.imperialMarch.silver || 0;
      food += fees.imperialMarch.food || 0;
    }
    return { silver, food };
  }, [frontAssault, rearAssault, imperialMarch, transientPolicyFees]);

  const reserves = proposalCost?.reserves || {};
  const policyAffordable =
    (Number(reserves.silver) || 0) >= policyFeeTotal.silver &&
    (Number(reserves.food) || 0) >= policyFeeTotal.food;

  const ct = String(targetCityType || '').trim();
  const tier = ct && proposalCost?.tiers?.[ct] ? proposalCost.tiers[ct] : null;
  const warSilver = tier?.silver || 0;
  const warFood = tier?.food || 0;
  const totalSilver = warSilver + policyFeeTotal.silver;
  const totalFood = warFood + policyFeeTotal.food;
  const warAffordable =
    (Number(reserves.silver) || 0) >= totalSilver &&
    (Number(reserves.food) || 0) >= totalFood;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !onSubmit || submitting) return;
    if (!warAffordable || (showTransient && !policyAffordable)) {
      setSubmitError('势力储备不足以支付发动费与已选临时政策');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await onSubmit({
        frontAssault: showTransient && frontAssault,
        rearAssault: showTransient && rearAssault,
        imperialMarch: showTransient && imperialMarch,
      });
      if (res?.ok) {
        onClose();
      } else {
        setSubmitError(res?.message || '谏言提交失败');
      }
    } catch (e) {
      setSubmitError(e?.message || '谏言提交失败');
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    onSubmit,
    submitting,
    warAffordable,
    policyAffordable,
    showTransient,
    frontAssault,
    rearAssault,
    imperialMarch,
    onClose,
  ]);

  if (!open) return null;

  const kindLabel = proposalKind === 'pvp' ? '势力 PVP 攻城' : '中立城 PVE 攻城';
  const base = approvalPreview?.base;
  const minR = approvalPreview?.minRate;
  const maxR = approvalPreview?.maxRate;
  const pct = (x) => (Number.isFinite(x) ? `${Math.round(Number(x) * 100)}%` : '—');
  const mult = proposalCost?.multiplierPercent;
  const mo = proposalCost?.monthOrdinal;
  const rs = reserves.silver;
  const rf = reserves.food;

  const submitBlocked =
    !canSubmit ||
    submitting ||
    !warAffordable ||
    (showTransient && policyFeeTotal.silver + policyFeeTotal.food > 0 && !policyAffordable);

  return (
    <>
      <div
        className="fixed inset-0 z-[138] bg-black/70"
        onClick={onClose}
        role="presentation"
        aria-hidden
      />
      <div
        className="fixed left-1/2 top-1/2 z-[139] max-h-[90vh] w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-amber-700/55 bg-stone-900 p-4 shadow-2xl ring-1 ring-stone-950/80"
        role="dialog"
        aria-modal="true"
        aria-labelledby="war-remonstrance-title"
      >
        <div className="mb-3 flex items-start justify-between gap-2 border-b border-stone-700/70 pb-2">
          <h2 id="war-remonstrance-title" className="text-sm font-bold text-amber-200">
            谏言决算
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 px-2 py-0.5 text-lg leading-none text-stone-400 hover:text-stone-100"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 text-left text-xs leading-relaxed text-stone-300">
          <div>
            <span className="text-stone-500">目标城</span>{' '}
            <span className="font-semibold text-amber-100/95">{targetCityName || targetCityId || '—'}</span>
            <span className="mx-1.5 text-stone-600">·</span>
            <span className="text-stone-500">类型</span>{' '}
            <span className="text-amber-200/90">{kindLabel}</span>
          </div>

          <div className="rounded-lg border border-stone-600/70 bg-stone-950 px-2.5 py-2">
            <div className="text-[11px] font-semibold text-amber-500/95">资源与发动消耗</div>
            {Number.isFinite(mo) && Number.isFinite(mult) ? (
              <p className="mt-1.5 text-[11px] text-stone-300">
                游戏历第 <strong className="text-amber-200/95">{mo}</strong> 月，消耗倍率{' '}
                <strong className="text-amber-200/95">{mult}%</strong>。
              </p>
            ) : null}
            {Number.isFinite(rs) && Number.isFinite(rf) ? (
              <p className="mt-1 text-[11px] text-stone-400">
                势力储备：银 <span className="text-stone-200">{rs}</span> · 粮{' '}
                <span className="text-stone-200">{rf}</span>
              </p>
            ) : null}
            {tier ? (
              <p className="mt-1.5 text-[11px] text-amber-100/90">
                发动战事（落营激活时扣）：银 <strong>{warSilver}</strong> · 粮 <strong>{warFood}</strong>
              </p>
            ) : null}
            {showTransient && policyFeeTotal.silver + policyFeeTotal.food > 0 ? (
              <p className="mt-1 text-[11px] text-amber-100/85">
                已选临时政策：银 <strong>{policyFeeTotal.silver}</strong> · 粮{' '}
                <strong>{policyFeeTotal.food}</strong>（审批通过时与发动费一并扣除）
              </p>
            ) : null}
            {(totalSilver > 0 || totalFood > 0) && (
              <p className="mt-1 text-[11px] font-medium text-stone-200">
                合计：银 {totalSilver} · 粮 {totalFood}
                {!warAffordable ? (
                  <span className="ml-1 text-red-400/95">
                    （储备不足
                    {Number.isFinite(rs) && Number.isFinite(rf)
                      ? ` · 当前储备：银 ${rs} · 粮 ${rf}`
                      : ''}
                    ）
                  </span>
                ) : null}
              </p>
            )}
          </div>

          {proposalKind === 'pve' ? (
            <p className="text-[10px] leading-snug text-stone-500">
              中立城 PVE 与势力 PVP 共用本谏言决算与 AI 君主审批；临时政策（前军 / 后军 / 御驾）仅 PVP 战事可选。
            </p>
          ) : null}

          {showTransient ? (
            <div className="rounded-lg border border-stone-600/70 bg-stone-950 px-2.5 py-2">
              <div className="text-[11px] font-semibold text-amber-500/95">临时政策（PVP · 合并审批）</div>
              <ul className="mt-2 space-y-2">
                {TRANSIENT_POLICY_ORDER.map((key) => {
                  const meta = TRANSIENT_POLICY_META[key];
                  const fee = transientPolicyFees?.[meta.feeKey];
                  const on =
                    key === TRANSIENT_POLICY_KEY.FRONT_ASSAULT
                      ? frontAssault
                      : key === TRANSIENT_POLICY_KEY.REAR_ASSAULT
                        ? rearAssault
                        : imperialMarch;
                  const setOn =
                    key === TRANSIENT_POLICY_KEY.FRONT_ASSAULT
                      ? setFrontAssault
                      : key === TRANSIENT_POLICY_KEY.REAR_ASSAULT
                        ? setRearAssault
                        : setImperialMarch;
                  return (
                    <li key={key} className="flex gap-2">
                      <label className="flex shrink-0 cursor-pointer items-start gap-1.5">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={on}
                          onChange={(e) => setOn(e.target.checked)}
                        />
                        <span>
                          <span className="font-medium text-amber-100/90">{meta.label}</span>
                          {fee ? (
                            <span className="ml-1 text-[10px] text-stone-500">
                              +{fee.silver}银 / +{fee.food}粮
                            </span>
                          ) : null}
                        </span>
                      </label>
                      <p className="text-[10px] leading-snug text-stone-500">{meta.summary}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div className="rounded-lg border border-stone-600/70 bg-stone-950 px-2.5 py-2">
            <div className="text-[11px] font-semibold text-amber-500/95">AI 君主同意率（预览）</div>
            <p className="mt-1 text-[11px] text-stone-300">
              基准约 <strong className="text-amber-200/95">{pct(base)}</strong>
              {Number.isFinite(minR) && Number.isFinite(maxR) ? (
                <>
                  {' '}
                  ；区间 <strong className="text-amber-200/95">{pct(minR)}</strong>～
                  <strong className="text-amber-200/95">{pct(maxR)}</strong>
                </>
              ) : null}
              。
            </p>
            {approvalPreview?.saturated ? (
              <p className="mt-1 text-[10px] text-amber-400/90">占城较多时，战事谏言倾向略作收敛。</p>
            ) : null}
          </div>

          {submitDisabledReason ? (
            <p className="text-[10px] text-amber-500/95">{submitDisabledReason}</p>
          ) : null}
          {submitError ? <p className="text-[10px] text-red-400/95">{submitError}</p> : null}
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-stone-700/60 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-stone-600 bg-stone-800 px-3 py-1.5 text-xs font-medium text-stone-200 hover:bg-stone-700"
          >
            取消
          </button>
          {onSubmit ? (
            <button
              type="button"
              disabled={submitBlocked}
              onClick={handleSubmit}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                submitBlocked
                  ? 'cursor-not-allowed border-stone-600 bg-stone-800/50 text-stone-500'
                  : 'border-amber-600 bg-amber-900/50 text-amber-100 hover:bg-amber-800/60'
              }`}
            >
              {submitting ? '提交中…' : '提交谏言'}
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}
