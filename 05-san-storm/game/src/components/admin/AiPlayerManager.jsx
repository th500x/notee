/**
 * 管理端：AI 玩家管理面板
 *
 * 功能：
 *   1. 行为总开关状态（只读展示；由 .env AI_PLAYER_BEHAVIOR_ENABLED 控制，改后需重启后端）
 *   2. 各势力 AI 人数控制（设精确目标，多退少补）
 *   3. 势力级休眠/唤醒（不删档）
 *   4. 立即唤起一名在岗 AI 跑一轮（便于观察/验收）
 *
 * 页面由 AdminPageGate（主站管理员 JWT）保护。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAiPlayerStatus,
  setFactionCount,
  setFactionActive,
  runSampleAi,
} from './aiPlayerAdminApi';

const SECTION = 'rounded-lg border border-gray-200 bg-white p-4 space-y-3 shadow-sm';
const INPUT = 'w-24 rounded border border-gray-300 px-2 py-1 text-sm';
const BTN = 'rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed';

export default function AiPlayerManager() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState(null);
  const [targets, setTargets] = useState({});

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await fetchAiPlayerStatus();
    setLoading(false);
    if (res?.success) {
      setStatus(res);
      const t = {};
      for (const f of res.factions || []) t[f.factionId] = f.total;
      setTargets(t);
    } else {
      setResult({ error: res?.error || '加载失败' });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = useCallback(async (key, fn, label) => {
    setBusy(key);
    setResult(null);
    try {
      const res = await fn();
      if (res?.success) {
        setResult({ ok: `${label}成功` });
        await refresh();
      } else {
        setResult({ error: `${label}失败：${res?.error || '未知错误'}` });
      }
      return res;
    } catch (e) {
      setResult({ error: `${label}异常：${e.message}` });
      return null;
    } finally {
      setBusy('');
    }
  }, [refresh]);

  const runtime = status?.runtime;
  const scheduler = status?.scheduler;
  const behaviorOn = !!runtime?.behaviorEnabled;

  const totalAi = useMemo(
    () => (status?.factions || []).reduce((s, f) => s + (f.total || 0), 0),
    [status],
  );
  const totalActive = useMemo(
    () => (status?.factions || []).reduce((s, f) => s + (f.active || 0), 0),
    [status],
  );

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI 玩家管理</h1>
          <p className="text-sm text-gray-600 mt-1">
            服务器 {status?.serverId || '—'} · 赛季 {status?.campaignSeason || '—'} · 共 {totalAi} 名 AI（在岗 {totalActive}）
          </p>
        </div>
        <button type="button" className={`${BTN} bg-gray-100 hover:bg-gray-200 text-gray-800`} onClick={refresh} disabled={loading}>
          {loading ? '刷新中…' : '刷新'}
        </button>
      </div>

      {result && (
        <div className={`rounded-md px-3 py-2 text-sm ${result.error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {result.error || result.ok}
        </div>
      )}

      {/* 1. 行为总开关状态（只读，由 .env 控制） + 调度实况 */}
      <div className={SECTION}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">行为总开关</h2>
          <span className={`text-sm font-medium ${behaviorOn ? 'text-emerald-600' : 'text-gray-500'}`}>
            {behaviorOn ? '● 运行中' : '○ 已停用'}
          </span>
        </div>
        <p className="text-xs text-gray-500">
          由后端 <code>.env</code> 的 <code>AI_PLAYER_BEHAVIOR_ENABLED</code> 控制（<code>1</code> 开 / <code>0</code> 关）。
          本页只读展示；修改后需<strong>重启后端</strong>生效。并发上限由 <code>AI_PLAYER_MAX_CONCURRENT</code> 控制。
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-sm">
          <Stat label="并发上限" value={runtime?.maxConcurrent ?? '—'} />
          <Stat label="窗口(分钟)" value={runtime?.windowMinutes ?? '—'} />
          <Stat label="本窗口计划" value={scheduler?.registered ? scheduler.planned : '—'} />
          <Stat label="正在执行" value={scheduler?.registered ? scheduler.running : '—'} />
        </div>
      </div>

      {/* 2. 各势力人数 + 休眠 */}
      <div className={SECTION}>
        <h2 className="text-lg font-semibold text-gray-900">各势力 AI 人数</h2>
        <p className="text-xs text-gray-500">
          设定目标人数后点「应用」：少则按 elite 基线补齐，多则删除多余（先删已休眠/较新者）。休眠不删档，仅暂停被调度。
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">势力</th>
                <th className="py-2 pr-4">总数</th>
                <th className="py-2 pr-4">在岗</th>
                <th className="py-2 pr-4">目标人数</th>
                <th className="py-2 pr-4">操作</th>
              </tr>
            </thead>
            <tbody>
              {(status?.factions || []).map((f) => {
                const key = `count-${f.factionId}`;
                const sleepKey = `sleep-${f.factionId}`;
                const allActive = f.total > 0 && f.active === f.total;
                return (
                  <tr key={f.factionId} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <div className="font-medium text-gray-900">{f.factionName || f.factionId}</div>
                      <div className="text-xs text-gray-400">{f.factionId}{f.whitelisted ? '' : ' · 非白名单'}</div>
                    </td>
                    <td className="py-2 pr-4">{f.total}</td>
                    <td className="py-2 pr-4">{f.active}</td>
                    <td className="py-2 pr-4">
                      <input
                        type="number"
                        min={0}
                        max={500}
                        className={INPUT}
                        value={targets[f.factionId] ?? ''}
                        onChange={(e) => setTargets((prev) => ({ ...prev, [f.factionId]: e.target.value }))}
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={`${BTN} bg-blue-600 hover:bg-blue-700 text-white`}
                          disabled={busy === key || String(targets[f.factionId]) === String(f.total)}
                          onClick={() => run(key, () => setFactionCount(f.factionId, Number(targets[f.factionId])), `设置 ${f.factionName || f.factionId} 人数`)}
                        >
                          应用
                        </button>
                        <button
                          type="button"
                          className={`${BTN} ${allActive ? 'bg-amber-100 hover:bg-amber-200 text-amber-800' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'}`}
                          disabled={busy === sleepKey || f.total === 0}
                          onClick={() => run(sleepKey, () => setFactionActive(f.factionId, !allActive), allActive ? `休眠 ${f.factionName || f.factionId}` : `唤醒 ${f.factionName || f.factionId}`)}
                        >
                          {allActive ? '休眠' : '唤醒'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. 工具 */}
      <div className={SECTION}>
        <h2 className="text-lg font-semibold text-gray-900">调试工具</h2>
        <p className="text-xs text-gray-500">立即唤起一名随机在岗 AI 跑一轮（移动/攻城/抽卡/匪寨/探索），用于观察或验收；与定时调度互不影响。</p>
        <button
          type="button"
          className={`${BTN} bg-violet-600 hover:bg-violet-700 text-white`}
          disabled={busy === 'run-sample'}
          onClick={async () => {
            setBusy('run-sample');
            setResult(null);
            try {
              const res = await runSampleAi();
              if (res?.success) {
                const s = res.summary || {};
                setResult({ ok: `已唤起 ${res.playerId}：攻城 ${s.siegeBattles} · 抽卡 ${s.gachaDraws} · 匪寨胜 ${s.banditWins} · 探索 ${s.explored}` });
              } else {
                setResult({ error: `唤起失败：${res?.error || '未知错误'}` });
              }
            } catch (e) {
              setResult({ error: `唤起异常：${e.message}` });
            } finally {
              setBusy('');
              refresh();
            }
          }}
        >
          {busy === 'run-sample' ? '执行中…' : '立即唤起一名 AI'}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-base font-semibold text-gray-900">{value}</div>
    </div>
  );
}
