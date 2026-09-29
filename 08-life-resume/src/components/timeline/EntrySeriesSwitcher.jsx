import { useEffect, useState } from 'react';
import {
  CHRONOLOGICAL_ENTRY_SERIES_NAME,
  ENTRY_SERIES_NAME_MAX_CJK,
  MAX_CUSTOM_ENTRY_SERIES_PER_USER,
  validateEntrySeriesName,
} from '@shared/utils/lifeResumeEntrySeries.js';

export default function EntrySeriesSwitcher({ seriesList, activeEntrySeriesId, onChange }) {
  if (!seriesList?.length) return null;

  return (
    <div
      className="flex flex-wrap gap-2"
      role="tablist"
      aria-label="人生片段系列"
    >
      {seriesList.map((series) => {
        const isActive =
          (activeEntrySeriesId == null && series.id == null) ||
          Number(activeEntrySeriesId) === Number(series.id);
        return (
          <button
            key={series.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={[
              'px-3 py-1.5 rounded-full text-sm border transition-colors',
              isActive
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-300',
            ].join(' ')}
            onClick={() => onChange(series.id)}
          >
            {series.name}
          </button>
        );
      })}
    </div>
  );
}

export function NewEntrySeriesModal({ open, onClose, onCreated, createSeries }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setError('');
    setSaving(false);
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const nameCheck = validateEntrySeriesName(name);
    if (!nameCheck.ok) {
      setError(nameCheck.error);
      return;
    }
    setSaving(true);
    try {
      const res = await createSeries(nameCheck.name);
      onCreated?.(res.data);
      onClose();
    } catch (err) {
      setError(err.message || '创建失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="关闭"
        onClick={() => !saving && onClose()}
      />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-xl p-6 space-y-4"
      >
        <h3 className="text-lg font-semibold text-slate-900">新建系列</h3>
        <p className="text-sm text-slate-600">
          名称最多 {ENTRY_SERIES_NAME_MAX_CJK} 个汉字；内置「{CHRONOLOGICAL_ENTRY_SERIES_NAME}
          」不可用作自定义名。每账号最多 {MAX_CUSTOM_ENTRY_SERIES_PER_USER} 个自定义系列。
        </p>
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          value={name}
          maxLength={ENTRY_SERIES_NAME_MAX_CJK}
          placeholder="例如：游记"
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            disabled={saving}
            className="flex-1 rounded-lg border border-slate-300 py-2.5 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="flex-1 rounded-lg bg-indigo-600 text-white py-2.5 hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? '创建中…' : '创建'}
          </button>
        </div>
      </form>
    </div>
  );
}
