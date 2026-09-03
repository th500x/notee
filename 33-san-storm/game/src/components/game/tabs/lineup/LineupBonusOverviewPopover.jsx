/**
 * 编组「加成一览」浮层 — 样式对齐势力 Tab「日活跃榜」popover。
 */

import { createPortal } from 'react-dom';
import { SOURCE_LABELS } from '@/utils/lineupCombatBonusOverview';

function fmtPctSuffix(frac) {
  const n = Number(frac) || 0;
  if (!n) return null;
  return `+${(n * 100).toFixed(0)}%`;
}

function Section({ title, children }) {
  return (
    <section className="mb-2.5 last:mb-0">
      <div className="mb-1 text-[10px] font-semibold text-amber-400/90">{title}</div>
      {children}
    </section>
  );
}

function EmptyLine({ text = '无' }) {
  return <p className="text-[10px] leading-snug text-stone-500">{text}</p>;
}

function SourceLine({ sourceType, sourceName, right }) {
  const typeLabel = SOURCE_LABELS[sourceType] || sourceType;
  return (
    <li className="flex items-baseline justify-between gap-2 rounded border border-stone-800/80 bg-stone-900/40 px-2 py-1 text-[11px]">
      <span className="min-w-0 text-stone-300">
        <span className="mr-1 text-stone-500">{typeLabel}</span>
        {sourceName}
      </span>
      <span className="shrink-0 tabular-nums text-amber-300/95">{right}</span>
    </li>
  );
}

/**
 * @param {{ open: boolean, anchorRect: DOMRect|null, overview: object|null, onClose: () => void }} props
 */
export default function LineupBonusOverviewPopover({ open, anchorRect, overview, onClose }) {
  if (!open || typeof document === 'undefined' || !anchorRect || !overview) return null;

  const pad = 8;
  const panelW = Math.min(300, window.innerWidth - pad * 2);
  let left = anchorRect.right - panelW;
  left = Math.max(pad, Math.min(left, window.innerWidth - panelW - pad));
  const maxH = Math.min(420, window.innerHeight * 0.6);
  let top = anchorRect.bottom + 6;
  if (top + maxH > window.innerHeight - pad) {
    top = Math.max(pad, anchorRect.top - maxH - 6);
  }

  const { maxTroops, troopFlat, troopTypeBonuses, attributes, specialNotes } = overview;
  const troopTypeRows = troopTypeBonuses?.rows || [];
  const troopTypeTitle = troopTypeBonuses?.titleParts?.length
    ? `兵种加成 （${troopTypeBonuses.titleParts.join('+')}）`
    : '兵种加成';

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[130] cursor-default bg-black/40"
        aria-label="关闭加成一览"
        onClick={onClose}
      />
      <div
        className="fixed z-[131] overflow-y-auto rounded-lg border border-amber-900/50 bg-stone-950/95 p-3 shadow-xl"
        style={{ left, top, width: panelW, maxHeight: maxH }}
        role="dialog"
        aria-label="加成一览"
      >
        <div className="mb-2 text-[11px] font-semibold text-amber-400/95">加成一览</div>

        <Section title="兵力上限">
          {maxTroops.breakdown.length === 0 && maxTroops.troopCaps.length === 0 ? (
            <EmptyLine text="无额外兵力上限加成" />
          ) : (
            <>
              {maxTroops.breakdown.length > 0 && (
                <ul className="mb-1.5 list-none space-y-1 pl-0">
                  {maxTroops.breakdown.map((r) => (
                    <SourceLine
                      key={`${r.sourceType}-${r.sourceName}-${r.value}`}
                      sourceType={r.sourceType}
                      sourceName={r.sourceName}
                      right={`+${r.value}`}
                    />
                  ))}
                </ul>
              )}
              {maxTroops.totalBonus > 0 && (
                <p className="mb-1.5 text-[10px] text-stone-400">
                  合计 <span className="text-amber-300">+{maxTroops.totalBonus}</span>
                  （叠在每支上阵部队上）
                </p>
              )}
              {maxTroops.troopCaps.length > 0 && (
                <ul className="list-none space-y-1 pl-0">
                  {maxTroops.troopCaps.map((t) => (
                    <li
                      key={t.name}
                      className="rounded border border-stone-800/60 bg-stone-900/30 px-2 py-1 text-[10px] text-stone-400"
                    >
                      <span className="text-stone-300">{t.name}</span>
                      {' · '}
                      基础 {t.base}
                      {t.bonus > 0 ? ` +${t.bonus}` : ''}
                      {' = '}
                      <span className="text-amber-300/90">{t.total}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Section>

        <Section title="部队平加（攻防速移）">
          {troopFlat.length === 0 ? (
            <EmptyLine text="无" />
          ) : (
            <ul className="list-none space-y-1.5 pl-0">
              {troopFlat.map((row) => (
                <li key={row.field}>
                  <div className="mb-0.5 flex justify-between text-[11px]">
                    <span className="text-stone-300">{row.label}</span>
                    <span className="tabular-nums text-amber-300">+{row.total}</span>
                  </div>
                  <ul className="list-none space-y-1 pl-0">
                    {row.parts.map((p) => (
                      <SourceLine
                        key={`${row.field}-${p.sourceType}-${p.sourceName}`}
                        sourceType={p.sourceType}
                        sourceName={p.sourceName}
                        right={`+${p.value}`}
                      />
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={troopTypeTitle}>
          {troopTypeRows.length === 0 ? (
            <EmptyLine text="无" />
          ) : (
            <ul className="list-none space-y-0.5 pl-0 text-[11px] leading-snug text-stone-200">
              {troopTypeRows.map((r) => (
                <li key={r.key}>
                  {r.label}
                  <span className="text-amber-300">{fmtPctSuffix(r.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="将领属性加成">
          {attributes.length === 0 ? (
            <EmptyLine text="无（称号/成就/宝物/装备卡等汇总）" />
          ) : (
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {attributes.map((a) => (
                <span
                  key={a.key}
                  className="rounded border border-stone-700/70 bg-stone-900/50 px-1.5 py-0.5 text-stone-200"
                >
                  {a.label}
                  <span className="ml-1 text-amber-300">+{a.value.toFixed(1)}</span>
                </span>
              ))}
            </div>
          )}
        </Section>

        <Section title="特殊战效">
          {specialNotes.length === 0 ? (
            <EmptyLine text="无" />
          ) : (
            <ul className="list-none space-y-1 pl-0">
              {specialNotes.map((n) => (
                <li
                  key={`${n.sourceType}-${n.sourceName}-${n.text}`}
                  className="rounded border border-stone-800/80 bg-stone-900/40 px-2 py-1 text-[10px] leading-snug text-stone-300"
                >
                  <span className="mr-1 text-stone-500">{SOURCE_LABELS[n.sourceType] || n.sourceType}</span>
                  <span className="text-stone-200">{n.sourceName}</span>
                  <div className="mt-0.5 text-green-400/90">{n.text}</div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <p className="mt-2 text-[10px] leading-snug text-stone-600">
          仅展示当前编组行已生效的战斗相关加成；技能/回响等另见卡牌与战斗内结算。
        </p>
      </div>
    </>,
    document.body,
  );
}
