import { useState, useEffect, useCallback } from 'react';
import * as api from '../utils/apiClient';
import { normalizeTaxSheet, emptyTaxRow } from '../utils/taxSheetModel';
import { TaxRentTab } from '../components/tax/TaxRentTab';

/**
 * 税费单主页面：ROOM + 税费字段表；底部「添加条目」「保存到服务器」
 */
export default function TaxSheetPage({ project, onBack, onSaved, onProjectSynced }) {
  const [sheet, setSheet] = useState(() => normalizeTaxSheet(project?.taxSheet));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!project?.id || !onProjectSynced) return undefined;
    (async () => {
      setError('');
      try {
        const res = await api.getProject(project.id);
        if (cancelled) return;
        if (res?.success && res.project) {
          const nextSheet = normalizeTaxSheet(res.project.taxSheet);
          setSheet(nextSheet);
          onProjectSynced(res.project);
          return;
        }
        throw new Error(res?.error || '拉取项目详情失败');
      } catch (e1) {
        try {
          const listRes = await api.getProjects();
          if (cancelled) return;
          const fromList = listRes?.projects?.find((p) => p.id === project.id);
          if (fromList?.taxSheet) {
            setSheet(normalizeTaxSheet(fromList.taxSheet));
            onProjectSynced(fromList);
            return;
          }
        } catch (e2) {
          console.warn('[TaxSheetPage] 列表回退也失败', e2);
        }
        setError(`无法同步最新税费数据（${e1?.message || e1}）。`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project?.id, onProjectSynced]);

  useEffect(() => {
    setSheet(normalizeTaxSheet(project?.taxSheet));
  }, [project?.id]);

  const handleSave = useCallback(async () => {
    setError('');
    setSaving(true);
    try {
      await api.updateTaxSheet(project.id, sheet);
      try {
        const fresh = await api.getProject(project.id);
        if (fresh?.success && fresh.project) {
          setSheet(normalizeTaxSheet(fresh.project.taxSheet));
          if (onProjectSynced) onProjectSynced(fresh.project);
        }
      } catch (e) {
        console.warn('[TaxSheetPage] 保存后刷新详情失败', e);
      }
      if (onSaved) await onSaved();
      alert('已保存。');
    } catch (e) {
      setError(e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [sheet, project?.id, onSaved, onProjectSynced]);

  const handleAddRow = useCallback(() => {
    setSheet((prev) => ({
      ...prev,
      rows: [...prev.rows, emptyTaxRow()]
    }));
  }, []);

  const sourceLabel =
    sheet.sourceAccountingProjectName ||
    project?.taxSheet?.sourceAccountingProjectName ||
    sheet.sourceAccountingProjectId ||
    '';

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium flex items-center gap-2"
        >
          <span>←</span>
          <span>返回项目列表</span>
        </button>
        <div className="flex-1 min-w-[200px]">
          <h2 className="text-2xl font-bold text-gray-900">{project.name}</h2>
          {project.description ? (
            <p className="text-sm text-gray-600 mt-1">{project.description}</p>
          ) : null}
          <p className="text-xs text-gray-500 mt-1">Tax · Admin · ROOM 列与来源账目单一致</p>
        </div>
      </div>

      <TaxRentTab sheet={sheet} setSheet={setSheet} sourceLabel={sourceLabel} />

      {error ? (
        <div className="w-full min-w-0 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      ) : null}

      <div className="grid w-full min-w-0 gap-3 grid-cols-2">
        <button
          type="button"
          onClick={handleAddRow}
          disabled={saving}
          className="min-w-0 py-3 px-3 sm:px-4 bg-slate-700 text-white rounded-lg hover:bg-slate-800 font-medium disabled:opacity-50 text-sm sm:text-base text-center"
        >
          添加条目
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="min-w-0 py-3 px-3 sm:px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 text-sm sm:text-base text-center"
        >
          {saving ? '保存中…' : '保存到服务器'}
        </button>
      </div>
    </div>
  );
}
