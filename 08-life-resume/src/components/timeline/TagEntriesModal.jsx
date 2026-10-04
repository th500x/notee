import { useEffect, useMemo } from 'react';
import { filterEntriesByTag } from '@shared/utils/lifeResumeEntryTags.js';
import TimelineEntryCard from '@/components/timeline/TimelineEntryCard';

function compareTimelineOrder(a, b) {
  return (a.timelineSortKey || 0) - (b.timelineSortKey || 0) || a.id - b.id;
}

/**
 * 按标签平铺片段（时间序，不按年分组、无收起展开）。
 * 关闭：点遮罩 / 右上角「关闭」/ Escape（与轨迹预览弹窗一致，兼顾触控与鼠标）。
 */
export default function TagEntriesModal({
  open,
  tagLabel,
  entries,
  isOwner,
  accountId,
  profileDisplayName,
  onClose,
  onEdit,
  onDelete,
}) {
  const list = useMemo(() => {
    if (!open || !tagLabel) return [];
    return filterEntriesByTag(entries, tagLabel).sort(compareTimelineOrder);
  }, [open, tagLabel, entries]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !tagLabel) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/40" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tag-entries-modal-title"
        className="relative w-full sm:max-w-2xl max-h-[92vh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200"
      >
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between gap-3">
          <h2 id="tag-entries-modal-title" className="text-lg font-semibold text-slate-900 truncate">
            标签「{tagLabel}」
            <span className="ml-2 text-sm font-normal text-slate-500 tabular-nums">{list.length} 条</span>
          </h2>
          <button
            type="button"
            className="shrink-0 text-slate-500 hover:text-slate-800 px-2 py-1"
            onClick={onClose}
          >
            关闭
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-4">
          {list.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">暂无该标签的片段</p>
          ) : (
            list.map((entry) => (
              <TimelineEntryCard
                key={entry.id}
                entry={entry}
                isOwner={isOwner}
                accountId={accountId}
                profileDisplayName={profileDisplayName}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
