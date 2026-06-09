/**
 * 管理端：赛季关服切换运营面板
 *
 * 运营按以下次序操作（详见 19-3 §10 Phase 5）：
 *   1. 提前设结算窗口 + 目标赛季 → 玩家手动「赛季结算」按钮按 start 出现。
 *   2. 关服时刻：设服务器 maintenance（拦进游戏）→ auto-seal 实跑（封档未主动结算者）。
 *   3. 维护窗内：**先全库备份** → rollover dry-run 核对 → 勾双闸门实跑（世界重置+删档+切季）。
 *   4. 开服：设服务器 open。玩家登录→创角→领取→教程。
 *
 * 改库/执行接口须填运营口令（后端 SEASON_ROLLOVER_KEY），仅本页临时保存、不入 localStorage。
 */
import { useCallback, useEffect, useState } from 'react';
import {
  fetchOpsStatus,
  setWindow,
  setStatus,
  autoSeal,
  rollover,
} from './seasonRolloverAdminApi';

const SECTION = 'rounded-lg border border-gray-200 bg-white p-4 space-y-3 shadow-sm';
const LABEL = 'block text-sm font-medium text-gray-700';
const INPUT = 'mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm';
const BTN = 'rounded px-3 py-1.5 text-sm font-medium';

export default function SeasonRolloverManager() {
  const [serverId, setServerId] = useState('San_1_Chaos');
  // 运营口令暂时屏蔽（单运营）；保留占位以便将来启用时回填
  const [adminKey] = useState('');
  const [status, setStatusData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  // 设窗口表单（datetime-local，提交时转 'YYYY-MM-DD HH:MM:SS'）
  const [winStart, setWinStart] = useState('');
  const [winEnd, setWinEnd] = useState('');
  const [targetSeason, setTargetSeason] = useState('san_0_m2');

  // rollover 双闸门
  const [confirmDestructive, setConfirmDestructive] = useState(false);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [runAutoSeal, setRunAutoSeal] = useState(false);

  const refresh = useCallback(async () => {
    if (!serverId) return;
    const res = await fetchOpsStatus(serverId);
    if (res?.success) setStatusData(res.data);
    else setResult(res);
  }, [serverId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function run(label, fn) {
    setBusy(true);
    setResult(null);
    try {
      const res = await fn();
      setResult({ label, res });
      if (res?.success && res.data) setStatusData(res.data);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function toMysql(dtLocal) {
    if (!dtLocal) return null;
    // 'YYYY-MM-DDTHH:MM' → 'YYYY-MM-DD HH:MM:00'
    return dtLocal.replace('T', ' ') + ':00';
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">赛季关服切换 · 运营面板</h1>

      <div className={SECTION}>
        <div>
          <label className={LABEL}>服务器 ID</label>
          <input className={INPUT} value={serverId} onChange={(e) => setServerId(e.target.value)} />
        </div>
        <p className="text-xs text-gray-500">运营口令（SEASON_ROLLOVER_KEY）当前为单运营已暂时屏蔽；页面由管理员登录门禁保护，破坏性操作另有双闸门确认。</p>
        <button className={`${BTN} bg-gray-100 hover:bg-gray-200 text-gray-800`} onClick={refresh} disabled={busy}>刷新状态</button>
      </div>

      {status ? (
        <div className={SECTION}>
          <h2 className="text-sm font-semibold text-gray-800">当前状态</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-700">
            <div>服务器状态：<strong className={status.status === 'open' ? 'text-green-600' : 'text-red-600'}>{status.status}</strong></div>
            <div>当前赛季：<strong>{status.currentSeason}</strong></div>
            <div>目标赛季：<strong>{status.rolloverTargetSeason || '（未设）'}</strong></div>
            <div>结算窗口：{status.windowOpen ? <span className="text-green-600">开启中</span> : status.windowEnded ? <span className="text-amber-600">已结束</span> : '未开'}</div>
            <div>窗口开始：{status.settlementWindowStart || '—'}</div>
            <div>窗口结束：{status.settlementWindowEnd || '—'}</div>
            <div>真人账号：{status.counts?.realAccounts}</div>
            <div>players 行：{status.counts?.players}</div>
            <div>已封档(confirmed)：{status.counts?.sealedConfirmed}</div>
            <div>待发放：{status.counts?.applyPending}</div>
            <div>season_records FK→accounts：{status.preconditions?.seasonRecordsFkToAccounts ? '✅' : '❌（禁止 rollover）'}</div>
          </div>
        </div>
      ) : null}

      <div className={SECTION}>
        <h2 className="text-sm font-semibold text-gray-800">1. 设结算窗口 + 目标赛季</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={LABEL}>按钮出现时间（start）</label>
            <input className={INPUT} type="datetime-local" value={winStart} onChange={(e) => setWinStart(e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>关服时刻（end）</label>
            <input className={INPUT} type="datetime-local" value={winEnd} onChange={(e) => setWinEnd(e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>目标赛季</label>
            <input className={INPUT} value={targetSeason} onChange={(e) => setTargetSeason(e.target.value)} />
          </div>
        </div>
        <button
          className={`${BTN} bg-blue-600 hover:bg-blue-700 text-white`}
          disabled={busy}
          onClick={() => run('set-window', () => setWindow(adminKey, {
            serverId,
            settlementWindowStart: toMysql(winStart),
            settlementWindowEnd: toMysql(winEnd),
            rolloverTargetSeason: targetSeason || null,
          }))}
        >保存窗口配置</button>
      </div>

      <div className={SECTION}>
        <h2 className="text-sm font-semibold text-gray-800">2. 服务器状态（维护态拦进游戏）</h2>
        <div className="flex gap-2">
          <button className={`${BTN} bg-green-600 hover:bg-green-700 text-white`} disabled={busy} onClick={() => run('open', () => setStatus(adminKey, serverId, 'open'))}>开服 open</button>
          <button className={`${BTN} bg-amber-600 hover:bg-amber-700 text-white`} disabled={busy} onClick={() => run('maintenance', () => setStatus(adminKey, serverId, 'maintenance'))}>维护 maintenance</button>
          <button className={`${BTN} bg-gray-600 hover:bg-gray-700 text-white`} disabled={busy} onClick={() => run('closed', () => setStatus(adminKey, serverId, 'closed'))}>关闭 closed</button>
        </div>
      </div>

      <div className={SECTION}>
        <h2 className="text-sm font-semibold text-gray-800">3. 自动封档（方式2）</h2>
        <div className="flex gap-2">
          <button className={`${BTN} bg-gray-100 hover:bg-gray-200 text-gray-800`} disabled={busy} onClick={() => run('auto-seal dry-run', () => autoSeal(adminKey, serverId, true))}>试运行（dry-run）</button>
          <button className={`${BTN} bg-orange-600 hover:bg-orange-700 text-white`} disabled={busy} onClick={() => run('auto-seal 实跑', () => autoSeal(adminKey, serverId, false))}>实跑封档</button>
        </div>
      </div>

      <div className={SECTION}>
        <h2 className="text-sm font-semibold text-red-700">4. 关服切换 rollover（破坏性·不可逆）</h2>
        <p className="text-xs text-gray-500">务必先全库备份。实跑前置：FK→accounts、窗口已结束、全员已封档。</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={runAutoSeal} onChange={(e) => setRunAutoSeal(e.target.checked)} /> 同时跑自动封档（runAutoSeal）</label>
        <button className={`${BTN} bg-gray-100 hover:bg-gray-200 text-gray-800`} disabled={busy} onClick={() => run('rollover dry-run', () => rollover(adminKey, serverId, { dryRun: true, runAutoSeal, confirmDestructive: false, backupConfirmed: false }))}>试运行（dry-run）</button>
        <div className="mt-2 space-y-1 border-t pt-2">
          <label className="flex items-center gap-2 text-sm text-red-700"><input type="checkbox" checked={confirmDestructive} onChange={(e) => setConfirmDestructive(e.target.checked)} /> 我确认执行不可逆破坏性切换（confirmDestructive）</label>
          <label className="flex items-center gap-2 text-sm text-red-700"><input type="checkbox" checked={backupConfirmed} onChange={(e) => setBackupConfirmed(e.target.checked)} /> 我已完成全库备份（backupConfirmed）</label>
          <button
            className={`${BTN} bg-red-600 hover:bg-red-700 text-white disabled:opacity-40`}
            disabled={busy || !confirmDestructive || !backupConfirmed}
            onClick={() => {
              if (!window.confirm('确认实跑 rollover？将重置世界态并删除该服全部真人 players，不可逆。')) return;
              run('rollover 实跑', () => rollover(adminKey, serverId, { dryRun: false, runAutoSeal, confirmDestructive, backupConfirmed }));
            }}
          >实跑 rollover（双闸门）</button>
        </div>
      </div>

      {result ? (
        <div className={SECTION}>
          <h2 className="text-sm font-semibold text-gray-800">最近一次返回：{result.label}</h2>
          <pre className="max-h-80 overflow-auto rounded bg-gray-900 p-3 text-xs text-green-200">{JSON.stringify(result.res, null, 2)}</pre>
        </div>
      ) : null}
    </div>
  );
}
