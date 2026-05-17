/**
 * 三公府 · 势力战事 —「谏言决算」：展示目标城、资源消耗说明、君主同意率预览（与 `preview-approval` / remonstrance-panel 同源字段）。
 * 正式「提交谏言」写库链路可后续接 `POST /api/pvp-wars/proposals`；本窗先以确认与可读信息为主。
 */

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   targetCityName: string,
 *   proposalKind: 'pvp' | 'pve',
 *   approvalPreview: { base?: number, minRate?: number, maxRate?: number, saturated?: boolean, note?: string } | null,
 *   proposalCost: {
 *     monthOrdinal?: number,
 *     multiplierPercent?: number,
 *     reserves?: { silver?: number, food?: number },
 *     tiers?: Record<string, { silver: number, food: number, baselineSilver?: number, baselineFood?: number }>,
 *   } | null,
 *   targetCityType?: string | null,
 * }} props
 */
export default function WarRemonstranceSettlementModal({
  open,
  onClose,
  targetCityName,
  targetCityType,
  proposalKind,
  approvalPreview,
  proposalCost,
}) {
  if (!open) return null;

  const kindLabel = proposalKind === 'pvp' ? '势力 PVP 攻城' : '中立城 PVE 攻城';
  const base = approvalPreview?.base;
  const minR = approvalPreview?.minRate;
  const maxR = approvalPreview?.maxRate;
  const pct = (x) => (Number.isFinite(x) ? `${Math.round(Number(x) * 100)}%` : '—');

  const ct = String(targetCityType || '').trim();
  const tier = ct && proposalCost?.tiers?.[ct] ? proposalCost.tiers[ct] : null;
  const mult = proposalCost?.multiplierPercent;
  const mo = proposalCost?.monthOrdinal;
  const rs = proposalCost?.reserves?.silver;
  const rf = proposalCost?.reserves?.food;

  return (
    <>
      <div
        className="fixed inset-0 z-[138] bg-black/70"
        onClick={onClose}
        role="presentation"
        aria-hidden
      />
      <div
        className="fixed left-1/2 top-1/2 z-[139] w-[min(92vw,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-amber-700/55 bg-stone-900 p-4 shadow-2xl ring-1 ring-stone-950/80"
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
            <span className="font-semibold text-amber-100/95">{targetCityName || '—'}</span>
            <span className="mx-1.5 text-stone-600">·</span>
            <span className="text-stone-500">谏言类型</span>{' '}
            <span className="text-amber-200/90">{kindLabel}</span>
          </div>

          <div className="rounded-lg border border-stone-600/70 bg-stone-950 px-2.5 py-2">
            <div className="text-[11px] font-semibold text-amber-500/95">资源与谏言消耗</div>
            {Number.isFinite(mo) && Number.isFinite(mult) ? (
              <p className="mt-1.5 text-[11px] text-stone-300">
                当前游戏历第 <strong className="text-amber-200/95">{mo}</strong> 个自然月，发动倍率{' '}
                <strong className="text-amber-200/95">{mult}%</strong>（基准 × {Number(mult) / 100}）。
              </p>
            ) : null}
            {Number.isFinite(rs) && Number.isFinite(rf) ? (
              <p className="mt-1 text-[11px] text-stone-400">
                本势力池现状：银两 <span className="text-stone-200">{rs}</span> · 粮草{' '}
                <span className="text-stone-200">{rf}</span>
              </p>
            ) : null}
            {tier ? (
              <p className="mt-1.5 text-[11px] text-amber-100/90">
                本目标类型「<span className="font-mono text-[10px]">{ct}</span>」预计扣除：银两{' '}
                <strong>{tier.silver}</strong> · 粮草 <strong>{tier.food}</strong>
                {Number.isFinite(tier.baselineSilver) ? (
                  <span className="text-stone-500">
                    {' '}
                    （基准 {tier.baselineSilver} / {tier.baselineFood}）
                  </span>
                ) : null}
                ；不足则服务器拒绝落地战事。
              </p>
            ) : ct ? (
              <p className="mt-1 text-[10px] text-amber-600/90">该城类型暂无扣费档说明，仍以服务器校验为准。</p>
            ) : null}
            <p className="mt-1.5 text-[10px] text-stone-500">
              11-3 为战事期内临时政策扣费，与「发动战事」本扣分列。
            </p>
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
                当前势力占城较多，君主在战事类谏言上的倾向已按规制略作收敛。
              </p>
            ) : null}
            {approvalPreview?.note ? (
              <p className="mt-1 text-[10px] text-stone-500">{approvalPreview.note}</p>
            ) : null}
          </div>

          <p className="text-[10px] text-stone-500">
            正式发起提案时，服务器还将校验邻接关系、战略地图距离（最近 3 敌对 / 最近 3 中立）、同城战事唯一、并行战事上限等条件。
          </p>
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-stone-700/60 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-stone-600 bg-stone-800 px-3 py-1.5 text-xs font-medium text-stone-200 hover:bg-stone-700"
          >
            关闭
          </button>
        </div>
      </div>
    </>
  );
}
