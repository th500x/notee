import { useState, useEffect, useCallback } from 'react';
import * as api from '../utils/apiClient';
import {
  normalizeAccountingSheet,
  withComputedMonthlySummary,
  rolloverAccountingWindowFromToday,
  emptyRentRow
} from '../utils/accountingSheetModel';
import { AccountingRentTab } from '../components/accounting/AccountingRentTab';
import { AccountingExpenseTab } from '../components/accounting/AccountingExpenseTab';
import { AccountingSummaryTab } from '../components/accounting/AccountingSummaryTab';

const TABS = [
  { id: 'rent', label: '租金记录' },
  { id: 'expense', label: '支出记录' },
  { id: 'summary', label: '收支账目' }
];

/**
 * 账目单主页面：三 Tab + 添加条目（租金）/ 保存 / 切换当月。
 */
export default function AccountingSheetPage({ project, onBack, onSaved, onProjectSynced }) {
  const [activeTab, setActiveTab] = useState('rent');
  const [sheet, setSheet] = useState(() => normalizeAccountingSheet(project?.accountingSheet));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  /** 进入页面时拉取最新账目：列表快照/内存态可能落后于 DB（脚本导入等） */
  useEffect(() => {
    let cancelled = false;
    if (!project?.id || !onProjectSynced) return undefined;
    (async () => {
      setError('');
      const applyFresh = (freshProject) => {
        if (cancelled || !freshProject) return;
        const nextSheet = normalizeAccountingSheet(freshProject.accountingSheet);
        setSheet(nextSheet);
        onProjectSynced(freshProject);
      };
      try {
        const res = await api.getProject(project.id);
        if (cancelled) return;
        if (res?.success && res.project) {
          applyFresh(res.project);
          return;
        }
        throw new Error(res?.error || '拉取项目详情失败');
      } catch (e1) {
        try {
          const listRes = await api.getProjects();
          if (cancelled) return;
          const fromList = listRes?.projects?.find((p) => p.id === project.id);
          if (fromList?.accountingSheet) {
            applyFresh(fromList);
            return;
          }
        } catch (e2) {
          console.warn('[AccountingSheetPage] 列表回退也失败', e2);
        }
        const msg = e1?.message || String(e1);
        setError(`无法同步最新账目数据（${msg}）。请确认已管理员登录且后端已开启 JWT 或本地 DEV_SKIP。`);
        console.warn('[AccountingSheetPage] 同步失败', e1);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project?.id, onProjectSynced]);

  /** 仅切换项目时从 props 重置；勿在 version 变化时整表覆盖，否则异步列表刷新会用旧快照冲掉本地未保存编辑（表现为输入被清空）。 */
  useEffect(() => {
    setSheet(normalizeAccountingSheet(project?.accountingSheet));
  }, [project?.id]);

  const handleSave = useCallback(async () => {
    setError('');
    setSaving(true);
    try {
      const payload = withComputedMonthlySummary(sheet);
      await api.updateAccountingSheet(project.id, payload);
      try {
        const fresh = await api.getProject(project.id);
        if (fresh?.success && fresh.project) {
          setSheet(normalizeAccountingSheet(fresh.project.accountingSheet));
          if (onProjectSynced) onProjectSynced(fresh.project);
        }
      } catch (e) {
        console.warn('[AccountingSheetPage] 保存后刷新详情失败', e);
      }
      if (onSaved) await onSaved();
      alert('已保存。');
    } catch (e) {
      setError(e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [sheet, project?.id, onSaved, onProjectSynced]);

  const handleRolloverMonth = () => {
    const ok = window.confirm(
      '将按「今天」所在自然月对齐双月窗口：更早一月列移出视野；左列收编为原右月数据，右列复制左列各格且仅清空「交租」日期。未保存的修改会随本地状态一起被重排，是否继续？'
    );
    if (!ok) return;
    setSheet((prev) => rolloverAccountingWindowFromToday(prev));
  };

  const handleAddRentRow = useCallback(() => {
    setSheet((prev) => ({
      ...prev,
      rentRows: [...prev.rentRows, emptyRentRow(prev.monthKeys)]
    }));
  }, []);

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
          <p className="text-xs text-gray-500 mt-1">
            Accounting · Admin · 双月窗口 · SETTLE = IN − OUT（自动）
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.id
                ? 'bg-blue-600 text-white shadow'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'rent' ? <AccountingRentTab sheet={sheet} setSheet={setSheet} /> : null}
      {activeTab === 'expense' ? <AccountingExpenseTab sheet={sheet} setSheet={setSheet} /> : null}
      {activeTab === 'summary' ? <AccountingSummaryTab sheet={sheet} /> : null}

      {error ? (
        <div className="w-full min-w-0 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      ) : null}

      <div
        className={`grid w-full min-w-0 gap-3 ${activeTab === 'rent' ? 'grid-cols-3' : 'grid-cols-2'}`}
      >
        {activeTab === 'rent' ? (
          <button
            type="button"
            onClick={handleAddRentRow}
            disabled={saving}
            className="min-w-0 py-3 px-3 sm:px-4 bg-slate-700 text-white rounded-lg hover:bg-slate-800 font-medium disabled:opacity-50 text-sm sm:text-base text-center"
          >
            添加条目
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="min-w-0 py-3 px-3 sm:px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 text-sm sm:text-base text-center"
        >
          {saving ? '保存中…' : '保存到服务器'}
        </button>
        <button
          type="button"
          onClick={handleRolloverMonth}
          disabled={saving}
          className="min-w-0 py-3 px-3 sm:px-6 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium disabled:opacity-50 text-sm sm:text-base text-center"
        >
          切换当月
        </button>
      </div>
    </div>
  );
}
