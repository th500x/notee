/**
 * 势力政策 · 谏言决算 Modal（11-3 §7）
 *
 * 与 `WarRemonstranceSettlementModal` 同 z-index 层（138/139），样式同源。
 * 与战事谏言不同的是：本窗 **包含表单 + 提交** —— 玩家在卡片里点「谏言」打开本窗，
 * 调整该类目的参数 → 服务器跑 `passiveApprovalService` 审批 → 落库或仅落 CD。
 *
 * 支持四种表单形态（与 `factionPolicyLabels.POLICY_CATEGORY_META.formKind` 对齐）：
 *   - percentSlider：粮饷 Bonus / 城战个人份额
 *   - toggle：招贤开关
 *   - singleChoice：内政五选一
 *
 * 业务约束：
 *   - 仅大司马 / 大司空可见可点（按钮由上游 drawer 控制；本窗仅做最终提交）
 *   - 类目 CD 未到 → 上游应禁用按钮；本窗提交时若服务端 409 也兜底显示
 */

import { useEffect, useMemo, useState } from 'react';
import { factionPolicyAPI } from '@/services/factionPolicyApi';
import {
  POLICY_CATEGORY_META,
  POLICY_OUTCOME_LABEL,
  readPolicyConfigInitial,
} from '@/constants/factionPolicyLabels';

const pct = (x) => (Number.isFinite(x) ? `${Math.round(Number(x) * 100)}%` : '—');

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   factionId: string,
 *   category: string,
 *   currentConfig: object|null,
 *   cooldownActive: boolean,
 *   nextEligibleAt: string|null,
 *   approvalPreview: { base?: number, minRate?: number, maxRate?: number, saturated?: boolean, note?: string } | null,
 *   recruitMapping?: { san0Band: string|null, openCostSilver: number } | null,
 *   factionReserves?: { silver: number, food: number } | null,
 *   currentApproved?: boolean,
 *   onSubmitted?: (result: object) => void,
 * }} props
 */
export default function FactionPolicyRemonstranceModal({
  open,
  onClose,
  factionId,
  category,
  currentConfig,
  cooldownActive,
  nextEligibleAt,
  approvalPreview,
  recruitMapping,
  factionReserves,
  currentApproved,
  onSubmitted,
}) {
  const meta = POLICY_CATEGORY_META[category];
  const [draftConfig, setDraftConfig] = useState(() =>
    readPolicyConfigInitial(category, currentConfig),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (open) {
      setDraftConfig(readPolicyConfigInitial(category, currentConfig));
      setError(null);
      setResult(null);
      setSubmitting(false);
    }
  }, [open, category, currentConfig]);

  const base = approvalPreview?.base;
  const minR = approvalPreview?.minRate;
  const maxR = approvalPreview?.maxRate;

  const valueLabel = useMemo(() => {
    if (!meta) return '';
    return meta.valueLabel(draftConfig[meta.valueKey]);
  }, [meta, draftConfig]);

  // 招贤纳士专用：OFF→ON 时一次性扣费校验（汉室 0；其它势力 2000）
  const isRecruitOpening = useMemo(() => {
    if (category !== 'recruit') return false;
    const nextEnabled = !!draftConfig.enabled;
    return nextEnabled && !currentApproved;
  }, [category, draftConfig, currentApproved]);

  const recruitFeeInfo = useMemo(() => {
    if (category !== 'recruit') return null;
    const cost = Number(recruitMapping?.openCostSilver) || 0;
    const reserve = Number(factionReserves?.silver) || 0;
    return {
      san0Band: recruitMapping?.san0Band || null,
      openCostSilver: cost,
      reserveSilver: reserve,
      insufficient: isRecruitOpening && cost > 0 && reserve < cost,
    };
  }, [category, recruitMapping, factionReserves, isRecruitOpening]);

  const onSubmit = async () => {
    if (!meta || submitting || cooldownActive) return;
    if (recruitFeeInfo?.insufficient) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await factionPolicyAPI.submitLongTermProposal({
        factionId,
        category,
        config: draftConfig,
      });
      if (res && res.success && res.data) {
        setResult(res.data);
        onSubmitted?.(res.data);
      } else {
        setError((res && res.error) || '提案失败');
      }
    } catch (e) {
      setError(e?.message || '提案失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !meta) return null;

  const renderForm = () => {
    switch (meta.formKind) {
      case 'percentSlider': {
        const v = Number(draftConfig[meta.valueKey] ?? meta.minPct);
        return (
          <div>
            <input
              type="range"
              min={meta.minPct}
              max={meta.maxPct}
              step={meta.stepPct || 1}
              value={v}
              onChange={(e) =>
                setDraftConfig({ ...draftConfig, [meta.valueKey]: Number(e.target.value) })
              }
              disabled={submitting || cooldownActive || !!result}
              className="w-full accent-amber-500"
            />
            <div className="mt-1 flex items-center justify-between text-[10px] text-stone-500">
              <span>{meta.minPct}%</span>
              <span className="font-semibold text-amber-200/95">{valueLabel}</span>
              <span>{meta.maxPct}%</span>
            </div>
          </div>
        );
      }
      case 'toggle': {
        const enabled = !!draftConfig[meta.valueKey];
        return (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-stone-300">{valueLabel}</span>
            <button
              type="button"
              disabled={submitting || cooldownActive || !!result}
              onClick={() => setDraftConfig({ ...draftConfig, [meta.valueKey]: !enabled })}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-[11px] font-semibold ${
                enabled
                  ? 'border-amber-700/60 bg-amber-950/35 text-amber-100 hover:bg-amber-900/40'
                  : 'border-stone-600 bg-stone-800 text-stone-300 hover:bg-stone-700'
              } disabled:opacity-50`}
            >
              {enabled ? '关闭' : '开启'}
            </button>
          </div>
        );
      }
      case 'singleChoice': {
        const cur = draftConfig[meta.valueKey];
        return (
          <div className="flex flex-wrap gap-1.5">
            {meta.options.map((opt) => {
              const active = cur === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={submitting || cooldownActive || !!result}
                  onClick={() => setDraftConfig({ ...draftConfig, [meta.valueKey]: opt.value })}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${
                    active
                      ? 'border-amber-500/70 bg-amber-950/45 text-amber-100'
                      : 'border-stone-600 bg-stone-800 text-stone-300 hover:bg-stone-700'
                  } disabled:opacity-50`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        );
      }
      default:
        return null;
    }
  };

  const renderResultBox = () => {
    if (!result) return null;
    const ok = !!result.approved;
    const nextAt = result.policy?.nextEligibleAt;
    const nextText = nextAt
      ? new Date(nextAt).toLocaleString('zh-CN', { hour12: false })
      : '—';
    return (
      <div
        className={`rounded-lg border px-2.5 py-2 ${
          ok ? 'border-emerald-700/60 bg-emerald-950/30' : 'border-amber-700/60 bg-amber-950/30'
        }`}
      >
        <div className={`text-[11px] font-semibold ${ok ? 'text-emerald-300' : 'text-amber-300'}`}>
          {POLICY_OUTCOME_LABEL[ok ? 'approved' : 'rejected']} · {meta.label}
        </div>
        <p className="mt-1 text-[11px] text-stone-300">
          {ok
            ? '新的政策配置已在势力中生效；'
            : '本次提案未通过审批，当前政策维持原样；'}
          下一次可再提议时间：<span className="text-amber-200/95">{nextText}</span>。
        </p>
      </div>
    );
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[138] bg-black/70"
        onClick={onClose}
        role="presentation"
        aria-hidden
      />
      <div
        className="fixed left-1/2 top-1/2 z-[139] w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-amber-700/55 bg-stone-900 p-4 shadow-2xl ring-1 ring-stone-950/80"
        role="dialog"
        aria-modal="true"
        aria-labelledby="policy-remonstrance-title"
      >
        <div className="mb-3 flex items-start justify-between gap-2 border-b border-stone-700/70 pb-2">
          <h2 id="policy-remonstrance-title" className="text-sm font-bold text-amber-200">
            谏言 · {meta.label}
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
          <p className="text-[11px] text-stone-400">{meta.summary}</p>

          <div className="rounded-lg border border-stone-600/70 bg-stone-950 px-2.5 py-2">
            <div className="text-[11px] font-semibold text-amber-500/95">提议新配置</div>
            <div className="mt-2">{renderForm()}</div>
          </div>

          <div className="rounded-lg border border-stone-600/70 bg-stone-950 px-2.5 py-2">
            <div className="text-[11px] font-semibold text-amber-500/95">AI 君主同意率（预览）</div>
            <p className="mt-1 text-[11px] text-stone-300">
              基准倾向约 <strong className="text-amber-200/95">{pct(base)}</strong>
              {Number.isFinite(minR) && Number.isFinite(maxR) ? (
                <>
                  {' '}
                  ；掷骰后抽检大致区间 <strong className="text-amber-200/95">{pct(minR)}</strong>～
                  <strong className="text-amber-200/95">{pct(maxR)}</strong>
                </>
              ) : null}
              。
            </p>
            {approvalPreview?.saturated ? (
              <p className="mt-1 text-[10px] text-amber-400/90">
                当前势力占城较多，君主在政策类谏言上的倾向已按规制略作收敛。
              </p>
            ) : null}
            {approvalPreview?.note ? (
              <p className="mt-1 text-[10px] text-stone-500">{approvalPreview.note}</p>
            ) : null}
          </div>

          {recruitFeeInfo && (recruitFeeInfo.san0Band || recruitFeeInfo.openCostSilver > 0) ? (
            <div className="rounded-lg border border-stone-600/70 bg-stone-950 px-2.5 py-2">
              <div className="text-[11px] font-semibold text-amber-500/95">招贤一次性开启费</div>
              <p className="mt-1 text-[11px] text-stone-300">
                {recruitFeeInfo.san0Band ? (
                  <>
                    本势力开启后将额外可抽 <span className="text-amber-200/95">san_0 · {recruitFeeInfo.san0Band}xxx</span> 段。
                  </>
                ) : (
                  <>本势力暂无可追加段（提交可能无实际效果）。</>
                )}
              </p>
              <p className="mt-1 text-[11px] text-stone-300">
                {recruitFeeInfo.openCostSilver > 0 ? (
                  <>
                    开启费用：<span className="text-amber-200/95">💰 {recruitFeeInfo.openCostSilver}</span> ·
                    势力储备：<span className={recruitFeeInfo.insufficient ? 'text-red-400/90' : 'text-amber-100/95'}>💰 {recruitFeeInfo.reserveSilver}</span>
                    （审批通过后从势力池扣除；驳回不扣）
                  </>
                ) : (
                  <>本势力开启 <span className="text-emerald-300/90">免费</span>（无须扣费）</>
                )}
              </p>
              {recruitFeeInfo.insufficient ? (
                <p className="mt-1 text-[10px] text-red-400/90">
                  势力储备不足以支付一次性开启费，无法提交本次谏言。
                </p>
              ) : null}
              {!isRecruitOpening && draftConfig.enabled ? (
                <p className="mt-1 text-[10px] text-stone-500">
                  当前已开启招贤，再次「开启」无效果且不扣费；可改提交「关闭」。
                </p>
              ) : null}
              {!draftConfig.enabled ? (
                <p className="mt-1 text-[10px] text-stone-500">
                  关闭招贤不产生费用；下次再开启仍按上述费用收取。
                </p>
              ) : null}
            </div>
          ) : null}

          {cooldownActive ? (
            <p className="text-[10px] text-amber-500/95">
              本类目仍在冷却期内（未到下一次可提议时间，{
                nextEligibleAt
                  ? new Date(nextEligibleAt).toLocaleString('zh-CN', { hour12: false })
                  : '—'
              }）。
            </p>
          ) : null}

          {error ? <p className="text-[11px] text-red-400/95">{error}</p> : null}
          {renderResultBox()}
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-stone-700/60 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-stone-600 bg-stone-800 px-3 py-1.5 text-xs font-medium text-stone-200 hover:bg-stone-700"
          >
            关闭
          </button>
          {!result ? (
            <button
              type="button"
              disabled={submitting || cooldownActive || !!recruitFeeInfo?.insufficient}
              onClick={onSubmit}
              className="rounded-lg border border-amber-700/60 bg-amber-950/35 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? '提交中…' : '提交谏言'}
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}
