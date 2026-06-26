import { useEffect, useMemo, useState } from 'react';
import {
  LIFE_PATH_CATEGORY_LABELS,
  LIFE_PATH_STYLE_LABELS,
  LIFE_PATH_DEFAULT_STYLE_VARIANT,
  formatPublishedLifePathDisplayText,
  getLifePathDraftVariant,
  listAvailableLifePathVariants,
  renderPublishedLifePathText,
} from '@shared/utils/lifeResumeLifePath.js';

export default function LifePathPreviewModal({
  open,
  draft,
  onClose,
  onPublish,
  onDiscardDraft,
  publishing = false,
  discarding = false,
}) {
  const availableVariants = useMemo(
    () => (draft ? listAvailableLifePathVariants(draft) : []),
    [draft]
  );

  const [selectedVariant, setSelectedVariant] = useState(LIFE_PATH_DEFAULT_STYLE_VARIANT);

  useEffect(() => {
    if (!open || !draft) return;
    const initial =
      draft.selectedVariant && availableVariants.includes(draft.selectedVariant)
        ? draft.selectedVariant
        : availableVariants[0] || LIFE_PATH_DEFAULT_STYLE_VARIANT;
    setSelectedVariant(initial);
  }, [open, draft, availableVariants]);

  if (!open || !draft) return null;

  const activeVariant =
    availableVariants.includes(selectedVariant) ? selectedVariant : availableVariants[0];
  const activeDraft = getLifePathDraftVariant(draft, activeVariant);
  if (!activeDraft) return null;

  const previewText = formatPublishedLifePathDisplayText(renderPublishedLifePathText(activeDraft));
  const nodes = [...(activeDraft.nodes || [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const busy = publishing || discarding;
  const hasBothStyles = availableVariants.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/40" aria-hidden="true" onClick={busy ? undefined : onClose} />
      <div className="relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">预览人生轨迹</h2>
          <button
            type="button"
            className="text-slate-500 hover:text-slate-800 disabled:opacity-50"
            onClick={onClose}
            disabled={busy}
          >
            关闭
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            轨迹将出现在公开卡片（悬浮或长按可见）。请勿发布含隐私的表述；私密片段内容不会自动出现在下方，但仍请自行核对。
            {hasBothStyles && ' 请先对比两种文风，再选择其一发布。'}
          </p>

          {hasBothStyles && (
            <div className="flex flex-wrap gap-2">
              {availableVariants.map((variantKey) => (
                <button
                  key={variantKey}
                  type="button"
                  disabled={busy}
                  className={
                    activeVariant === variantKey
                      ? 'rounded-full px-4 py-2 text-sm font-medium bg-indigo-600 text-white'
                      : 'rounded-full px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }
                  onClick={() => setSelectedVariant(variantKey)}
                >
                  {LIFE_PATH_STYLE_LABELS[variantKey] || variantKey}
                </button>
              ))}
            </div>
          )}

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">
              重要节点
              {hasBothStyles && (
                <span className="ml-2 text-xs font-normal text-slate-500">
                  （{LIFE_PATH_STYLE_LABELS[activeVariant]}）
                </span>
              )}
            </h3>
            <ul className="space-y-3">
              {nodes.map((node) => (
                <li
                  key={`${activeVariant}-${node.sortOrder}-${node.timeLabel}-${node.text.slice(0, 8)}`}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
                    {node.timeLabel && <span>{node.timeLabel}</span>}
                    <span className="rounded-full bg-white border border-slate-200 px-2 py-0.5">
                      {LIFE_PATH_CATEGORY_LABELS[node.category] || node.category}
                    </span>
                  </div>
                  <p className="text-sm text-slate-800 leading-relaxed">{node.text}</p>
                </li>
              ))}
            </ul>
          </section>

          {activeDraft.summaryText && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-800">总述</h3>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {activeDraft.summaryText}
              </p>
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-800">对外展示预览</h3>
            <pre className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-white border border-slate-200 rounded-lg px-3 py-3 font-sans">
              {previewText}
            </pre>
          </section>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            className="flex-1 min-w-[100px] rounded-lg border border-slate-300 py-2.5 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            onClick={onClose}
          >
            放弃
          </button>
          {onDiscardDraft && (
            <button
              type="button"
              disabled={busy}
              className="flex-1 min-w-[100px] rounded-lg border border-slate-300 py-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              onClick={onDiscardDraft}
            >
              {discarding ? '丢弃中…' : '丢弃草稿'}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            className="flex-1 min-w-[120px] rounded-lg bg-indigo-600 text-white py-2.5 hover:bg-indigo-700 disabled:opacity-60"
            onClick={() => onPublish?.(activeVariant)}
          >
            {publishing
              ? '发布中…'
              : hasBothStyles
                ? `发布「${LIFE_PATH_STYLE_LABELS[activeVariant]}」`
                : '发布轨迹'}
          </button>
        </div>
      </div>
    </div>
  );
}
