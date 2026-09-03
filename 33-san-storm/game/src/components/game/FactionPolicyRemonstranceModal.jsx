/**
 * 势力政策 · 谏言决算 Modal（11-3 §7）
 *
 * 提交后：1s 禀报动画（`CeremonyBounceOverlay`）→ 口谕式君主批复（`KingEdictVerdictDialog`）。
 *
 * @see docs/01-jun-exploration/10-core-system/11-3-FACTION_POLICY_SYSTEM.md §7 · 32-5-PLAYER_CORNER.md §4
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { factionPolicyAPI } from '@/services/factionPolicyApi';
import { loadSharedData } from '@/services/dataService';
import {
  POLICY_CATEGORY_META,
  readPolicyProposalDraft,
} from '@/constants/factionPolicyLabels';
import { computeLocalPolicyApprovalPreview } from '@/utils/policyApprovalPreviewClient';
import { awaitWithMinDuration } from '@/utils/remonstranceDeliberation';
import { buildPolicyRemonstranceVerdictLine } from '@/data/texts/kingPolicyRemonstranceLines';
import CeremonyBounceOverlay from '@/components/game/CeremonyBounceOverlay';
import KingEdictVerdictDialog from '@/components/game/KingEdictVerdictDialog';
import RemonstranceTributeSilverSection from '@/components/game/RemonstranceTributeSilverSection';

const pct = (x) => (Number.isFinite(x) ? `${Math.round(Number(x) * 100)}%` : '—');

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   factionId: string,
 *   category: string,
 *   currentConfig: object|null,
 *   lastOutcome?: string|null,
 *   cooldownActive: boolean,
 *   nextEligibleAt: string|null,
 *   approvalPreview?: object|null,
 *   recruitMapping?: object|null,
 *   factionReserves?: object|null,
 *   playerSilver?: number,
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
  lastOutcome,
  cooldownActive,
  nextEligibleAt,
  approvalPreview,
  recruitMapping,
  factionReserves,
  playerSilver = 0,
  currentApproved,
  onSubmitted,
}) {
  const meta = POLICY_CATEGORY_META[category];
  /** @type {'form'|'deliberating'|'verdict'} */
  const [phase, setPhase] = useState('form');
  const [draftConfig, setDraftConfig] = useState(() =>
    readPolicyProposalDraft(category, currentConfig),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [verdictPayload, setVerdictPayload] = useState(null);
  const [speechStyle, setSpeechStyle] = useState('benevolent');
  const [courtesyName, setCourtesyName] = useState('君主');
  const [draftApprovalPreview, setDraftApprovalPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [tributeSilver, setTributeSilver] = useState(0);
  const previewSeqRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    setPhase('form');
    setDraftConfig(readPolicyProposalDraft(category, currentConfig));
    setError(null);
    setVerdictPayload(null);
    setSubmitting(false);
    setDraftApprovalPreview(null);
    setTributeSilver(0);
  }, [open, category]);

  useEffect(() => {
    if (!open || phase !== 'form') return;
    setDraftConfig(readPolicyProposalDraft(category, currentConfig));
  }, [open, category, currentConfig, phase]);

  useEffect(() => {
    if (!open || !factionId) return undefined;
    let cancelled = false;
    loadSharedData('ai-kings')
      .then((data) => {
        if (cancelled) return;
        const row = Array.isArray(data?.kings)
          ? data.kings.find((k) => k.factionId === factionId)
          : null;
        const style = row?.speechStyle;
        setSpeechStyle(typeof style === 'string' && style ? style : 'benevolent');
        const courtesy =
          typeof row?.courtesyName === 'string' && row.courtesyName.trim()
            ? row.courtesyName.trim()
            : typeof row?.characterName === 'string' && row.characterName.trim()
              ? row.characterName.trim()
              : '君主';
        setCourtesyName(courtesy);
      })
      .catch(() => {
        if (!cancelled) {
          setSpeechStyle('benevolent');
          setCourtesyName('君主');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, factionId]);

  const localApprovalPreview = useMemo(
    () =>
      computeLocalPolicyApprovalPreview({
        category,
        draftConfig,
        currentConfig,
        lastOutcome,
        recruitMapping,
        panelApprovalPreview: approvalPreview,
      }),
    [category, draftConfig, currentConfig, lastOutcome, recruitMapping, approvalPreview],
  );

  useEffect(() => {
    if (!open || phase !== 'form' || !factionId || !category) return undefined;
    const seq = ++previewSeqRef.current;
    setPreviewLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await factionPolicyAPI.previewApproval({
          factionId,
          category,
          config: draftConfig,
          tributeSilver,
        });
        if (seq !== previewSeqRef.current) return;
        if (res?.success && res.data) {
          setDraftApprovalPreview({ ...res.data, previewSource: 'remote' });
        } else {
          setDraftApprovalPreview(null);
        }
      } catch {
        if (seq === previewSeqRef.current) setDraftApprovalPreview(null);
      } finally {
        if (seq === previewSeqRef.current) setPreviewLoading(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [open, phase, factionId, category, draftConfig, tributeSilver]);

  const effectivePreview = draftApprovalPreview || localApprovalPreview;
  const base = effectivePreview?.base;
  const minR = effectivePreview?.minRate;
  const maxR = effectivePreview?.maxRate;

  const valueLabel = useMemo(() => {
    if (!meta) return '';
    return meta.valueLabel(draftConfig[meta.valueKey]);
  }, [meta, draftConfig]);

  const isRecruitOpening = useMemo(() => {
    if (category !== 'recruit') return false;
    return !!draftConfig.enabled && !currentApproved;
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

  const tributeUnaffordable =
    tributeSilver > 0 && Math.max(0, Math.floor(Number(playerSilver) || 0)) < tributeSilver;

  const formatNextEligibleFootnote = useCallback((nextAt, approved, tribute) => {
    const nextText = nextAt
      ? new Date(nextAt).toLocaleString('zh-CN', { hour12: false })
      : '—';
    if (approved) {
      const tributeNote =
        tribute?.tributeSilver > 0
          ? `上供 ${tribute.tributeSilver} 银已划入势力储备${
              tribute.contributionGranted > 0 ? `，贡献 +${tribute.contributionGranted}` : ''
            }。`
          : '';
      return `${tributeNote}新政策已在势力中生效。下一次可谏言：${nextText}。`;
    }
    const tributeNote =
      tribute?.tributeSilver > 0
        ? `上供 ${tribute.tributeSilver} 银已划入势力储备${
            tribute.contributionGranted > 0 ? `，贡献 +${tribute.contributionGranted}` : ''
          }。`
        : '';
    return `本次提案未通过，当前政策维持原样。${tributeNote}下一次可谏言：${nextText}。`;
  }, []);

  const onSubmit = async () => {
    if (!meta || submitting || cooldownActive || phase !== 'form') return;
    if (recruitFeeInfo?.insufficient || tributeUnaffordable) return;
    setSubmitting(true);
    setError(null);
    setPhase('deliberating');
    try {
      const { result: res } = await awaitWithMinDuration(
        factionPolicyAPI.submitLongTermProposal({
          factionId,
          category,
          config: draftConfig,
          tributeSilver,
        }),
      );
      if (res && res.success && res.data) {
        const approved = !!res.data.approved;
        const nextAt = res.data.policy?.nextEligibleAt;
        const line = buildPolicyRemonstranceVerdictLine({
          approved,
          policyLabel: meta.label,
          speechStyle,
          seed: `${category}|${approved}|${res.data.proposalId || ''}`,
        });
        setVerdictPayload({
          approved,
          line,
          footnote: formatNextEligibleFootnote(nextAt, approved, res.data.tribute),
          raw: res.data,
        });
        onSubmitted?.(res.data);
        setPhase('verdict');
      } else {
        setPhase('form');
        setError((res && res.error) || '提案失败');
      }
    } catch (e) {
      setPhase('form');
      setError(e?.message || '提案失败');
    } finally {
      setSubmitting(false);
    }
  };

  const onVerdictClose = useCallback(() => {
    setVerdictPayload(null);
    setPhase('form');
    onClose();
  }, [onClose]);

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
              disabled={submitting || cooldownActive}
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
      case 'toggle':
        return null;
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
                  disabled={submitting || cooldownActive}
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

  return (
    <>
      {phase === 'form' ? (
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

              {meta.formKind !== 'toggle' ? (
                <div className="rounded-lg border border-stone-600/70 bg-stone-950 px-2.5 py-2">
                  <div className="text-[11px] font-semibold text-amber-500/95">提议新配置</div>
                  <div className="mt-2">{renderForm()}</div>
                </div>
              ) : (
                <p className="text-[11px] text-stone-300">
                  本次谏言：
                  <span className="font-semibold text-amber-200/95">{valueLabel}</span>
                </p>
              )}

              <RemonstranceTributeSilverSection
                tributeSilver={tributeSilver}
                onTributeSilverChange={setTributeSilver}
                playerSilver={playerSilver}
                disabled={submitting || cooldownActive}
              />

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
                  ) : previewLoading ? (
                    <> · 计算中…</>
                  ) : null}
                  。
                </p>
                {effectivePreview?.boostedUnconditionalBenefit ? (
                  <p className="mt-1 text-[10px] text-emerald-400/90">
                    本提案对势力发展有利且无储备扣费，明君倾向保底约 90%（仍掷骰，非必过）。
                  </p>
                ) : null}
                {effectivePreview?.saturated ? (
                  <p className="mt-1 text-[10px] text-amber-400/90">
                    当前势力占城较多，君主在政策类谏言上的倾向已按规制略作收敛。
                  </p>
                ) : null}
                {effectivePreview?.note ? (
                  <p className="mt-1 text-[10px] text-stone-500">{effectivePreview.note}</p>
                ) : null}
              </div>

              {recruitFeeInfo && (recruitFeeInfo.san0Band || recruitFeeInfo.openCostSilver > 0) ? (
                <div className="rounded-lg border border-stone-600/70 bg-stone-950 px-2.5 py-2">
                  <div className="text-[11px] font-semibold text-amber-500/95">招贤一次性开启费</div>
                  <p className="mt-1 text-[11px] text-stone-300">
                    {recruitFeeInfo.san0Band ? (
                      <>
                        本势力开启后将额外可抽{' '}
                        <span className="text-amber-200/95">san_0 · {recruitFeeInfo.san0Band}xxx</span> 段。
                      </>
                    ) : (
                      <>本势力暂无可追加段（提交可能无实际效果）。</>
                    )}
                  </p>
                  <p className="mt-1 text-[11px] text-stone-300">
                    {recruitFeeInfo.openCostSilver > 0 ? (
                      <>
                        开启费用：<span className="text-amber-200/95">💰 {recruitFeeInfo.openCostSilver}</span> ·
                        势力储备：
                        <span
                          className={
                            recruitFeeInfo.insufficient ? 'text-red-400/90' : 'text-amber-100/95'
                          }
                        >
                          💰 {recruitFeeInfo.reserveSilver}
                        </span>
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
                  {!draftConfig.enabled ? (
                    <p className="mt-1 text-[10px] text-stone-500">
                      关闭招贤不产生费用；下次再开启仍按上述费用收取。
                    </p>
                  ) : null}
                </div>
              ) : null}

              {cooldownActive ? (
                <p className="text-[10px] text-amber-500/95">
                  本类目仍在冷却期内（未到下一次可提议时间，
                  {nextEligibleAt
                    ? new Date(nextEligibleAt).toLocaleString('zh-CN', { hour12: false })
                    : '—'}
                  ）。
                </p>
              ) : null}

              {error ? <p className="text-[11px] text-red-400/95">{error}</p> : null}
            </div>

            <div className="mt-4 flex justify-end gap-2 border-t border-stone-700/60 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-stone-600 bg-stone-800 px-3 py-1.5 text-xs font-medium text-stone-200 hover:bg-stone-700"
              >
                关闭
              </button>
              <button
                type="button"
                disabled={submitting || cooldownActive || !!recruitFeeInfo?.insufficient || tributeUnaffordable}
                onClick={onSubmit}
                className="rounded-lg border border-amber-700/60 bg-amber-950/35 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? '提交中…' : '提交谏言'}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {phase === 'deliberating' ? (
        <CeremonyBounceOverlay
          icon="📜"
          title="禀报君主"
          subtitle="谏章呈御，候旨中……"
        />
      ) : null}

      {phase === 'verdict' && verdictPayload ? (
        <KingEdictVerdictDialog
          open
          onClose={onVerdictClose}
          courtesyName={courtesyName}
          line={verdictPayload.line}
          approved={verdictPayload.approved}
          footnote={verdictPayload.footnote}
        />
      ) : null}
    </>
  );
}
