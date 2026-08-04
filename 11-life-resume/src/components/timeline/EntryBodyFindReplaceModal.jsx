import { useEffect, useMemo, useState } from 'react';
import {
  FIND_QUERY_MAX_CHINESE,
  FIND_QUERY_MAX_OTHER,
  analyzeFindQuery,
  countMatches,
} from '@/utils/entryBodyFindReplace';

/**
 * 正文搜索与替换（仅本人 · 当前系列 · 含草稿）
 * 搜索不区分大小写；替换文字按输入原样写入。
 */
export default function EntryBodyFindReplaceModal({
  open,
  seriesName,
  entries = [],
  onClose,
  onSearch,
  onReplace,
  replacing = false,
}) {
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setFind('');
    setReplace('');
    setError('');
  }, [open]);

  const analysis = useMemo(() => analyzeFindQuery(find), [find]);

  const preview = useMemo(() => {
    if (!analysis.ok) return { entryCount: 0, occurrenceCount: 0 };
    let entryCount = 0;
    let occurrenceCount = 0;
    for (const entry of entries) {
      const count = countMatches(entry.body, find);
      if (count > 0) {
        entryCount += 1;
        occurrenceCount += count;
      }
    }
    return { entryCount, occurrenceCount };
  }, [analysis.ok, entries, find]);

  if (!open) return null;

  const findError = find ? (analysis.ok ? '' : analysis.error) : '';
  const canSearch = analysis.ok && !replacing;
  const canReplace = analysis.ok && replace.length > 0 && !replacing;
  const chineseCount = analysis.chineseCount ?? 0;
  const otherCount = analysis.otherCount ?? 0;

  const handleSearch = () => {
    if (!analysis.ok) {
      setError(analysis.error);
      return;
    }
    setError('');
    onSearch?.(find);
  };

  const handleReplace = () => {
    if (!analysis.ok) {
      setError(analysis.error);
      return;
    }
    if (!replace) {
      setError('请输入替换后的文字');
      return;
    }
    if (preview.occurrenceCount === 0) {
      setError('当前系列没有匹配的正文，无需替换');
      return;
    }
    const ok = window.confirm(
      `将当前系列 ${preview.entryCount} 条片段中的 ${preview.occurrenceCount} 处「${find}」替换为「${replace}」。替换后不可撤销，确定继续？`
    );
    if (!ok) return;
    setError('');
    onReplace?.(find, replace);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/40"
        aria-hidden="true"
        onClick={replacing ? undefined : onClose}
      />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200">
        <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">正文搜索 / 替换</h2>
          <button
            type="button"
            className="text-slate-500 hover:text-slate-800 disabled:opacity-50"
            onClick={onClose}
            disabled={replacing}
          >
            关闭
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <p className="text-sm text-slate-600">
            范围：<span className="font-medium text-slate-800">{seriesName}</span> 系列的全部片段（含草稿），
            共 {entries.length} 条。只在正文中查找，不含标题与标签。
          </p>

          <div className="space-y-1">
            <label htmlFor="body-find-input" className="block text-sm font-medium text-slate-700">
              搜索文字（不区分大小写）
            </label>
            <input
              id="body-find-input"
              type="text"
              value={find}
              onChange={(e) => {
                setFind(e.target.value);
                setError('');
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
              placeholder="最多 5 个中文字 / 10 个英文字符"
              autoFocus
            />
            <p className="text-xs text-slate-500 tabular-nums">
              中文 {chineseCount}/{FIND_QUERY_MAX_CHINESE} · 其他 {otherCount}/{FIND_QUERY_MAX_OTHER}
              {analysis.ok && (
                <span className="ml-2 text-slate-600">
                  命中 {preview.entryCount} 条 · {preview.occurrenceCount} 处
                </span>
              )}
            </p>
            {findError && <p className="text-xs text-red-600">{findError}</p>}
          </div>

          <div className="space-y-1">
            <label htmlFor="body-replace-input" className="block text-sm font-medium text-slate-700">
              替换为（区分大小写，按输入原样写入）
            </label>
            <input
              id="body-replace-input"
              type="text"
              value={replace}
              onChange={(e) => {
                setReplace(e.target.value);
                setError('');
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
              placeholder="仅搜索时可留空"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="border-t border-slate-100 px-5 py-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="flex-1 min-w-[100px] rounded-lg border border-slate-300 py-2.5 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            onClick={handleSearch}
            disabled={!canSearch}
          >
            仅搜索
          </button>
          <button
            type="button"
            className="flex-1 min-w-[120px] rounded-lg bg-indigo-600 text-white py-2.5 hover:bg-indigo-700 disabled:opacity-60"
            onClick={handleReplace}
            disabled={!canReplace}
          >
            {replacing ? '替换中…' : '全部替换'}
          </button>
        </div>
      </div>
    </div>
  );
}
