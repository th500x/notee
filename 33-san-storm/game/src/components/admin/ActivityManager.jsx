/**
 * 活动管理：已结束活动的 Top30 排名导出与检索
 * @see docs/01-jun-exploration/30-frontend/30-1-ACTIVITY_RANKING_ADMIN.md
 */

import { useState, useMemo, useEffect } from 'react';
import { getAllAnnouncements } from '@/data/texts/announcements';
import { rankingsAPI } from '@/services/rankingsApi';
import { useAdminToast } from '@/components/admin/useAdminToast';

const LS_KEY = 'san_storm_activity_ranking_export_v1';

function loadCacheMap() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return typeof o === 'object' && o ? o : {};
  } catch {
    return {};
  }
}

function saveCacheEntry(eventId, payload) {
  const map = loadCacheMap();
  map[eventId] = payload;
  localStorage.setItem(LS_KEY, JSON.stringify(map));
}

/** 与 RankingPanel 一致的四项加权分 */
function weightedParts(item, ranking) {
  const w = ranking?.scoreWeights || {};
  const repW = w.reputation ?? 60;
  const contribW = w.contribution ?? repW;
  return {
    combat: (item.battleScore ?? 0) * (w.battleScore ?? 0.2),
    events: (item.eventsCompleted ?? 0) * (w.events ?? 120),
    rep: (item.reputation ?? 0) * repW,
    contrib: (item.contribution ?? 0) * contribW,
  };
}

/** 含排行榜配置的公告（已结束优先展示；未结束也可加载预览） */
function announcementsWithRanking() {
  const now = Date.now();
  return getAllAnnouncements()
    .filter((a) => a?.ranking?.endTime)
    .map((a) => ({
      ...a,
      _ended: new Date(a.ranking.endTime).getTime() < now,
    }))
    .sort((a, b) => Number(b._ended) - Number(a._ended) || new Date(b.ranking.endTime) - new Date(a.ranking.endTime));
}

export default function ActivityManager() {
  const { showToast, Toast } = useAdminToast();
  const [options] = useState(() => announcementsWithRanking());
  const [eventId, setEventId] = useState(() => options[0]?.id || '');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [cacheHint, setCacheHint] = useState(null);

  const selected = useMemo(
    () => options.find((a) => a.id === eventId),
    [options, eventId]
  );

  useEffect(() => {
    if (!eventId) {
      setRows([]);
      setMeta(null);
      setCacheHint(null);
      return;
    }
    const map = loadCacheMap();
    const c = map[eventId];
    if (c?.rows?.length) {
      setRows(c.rows);
      setMeta(c.meta || null);
      setCacheHint(c.savedAt || null);
    } else {
      setRows([]);
      setMeta(null);
      setCacheHint(null);
    }
  }, [eventId]);

  const handleLoadServer = async () => {
    if (!selected) return;
    setLoading(true);
    setError('');
    try {
      const result = await rankingsAPI.getRankings(selected.id, { limit: 30 });
      if (!result.success) {
        setError(result.error || '加载失败');
        showToast(result.error || '加载失败', 'error');
        return;
      }
      const { rankings, totalParticipants, updatedAt } = result.data;
      const enriched = (rankings || []).map((item) => {
        const p = weightedParts(item, selected.ranking);
        return {
          rank: item.rank,
          playerId: item.playerId,
          name: item.name,
          totalScore: item.totalScore,
          ...p,
        };
      });
      setRows(enriched);
      setMeta({
        eventId: selected.id,
        rankingTitle: selected.ranking?.title,
        announcementTitle: selected.title,
        totalParticipants,
        updatedAt,
      });
      const payload = {
        savedAt: new Date().toISOString(),
        meta: {
          eventId: selected.id,
          rankingTitle: selected.ranking?.title,
          announcementTitle: selected.title,
          totalParticipants,
          updatedAt,
        },
        rows: enriched,
      };
      saveCacheEntry(selected.id, payload);
      setCacheHint(payload.savedAt);
      showToast(`已加载并缓存 ${enriched.length} 条`);
    } catch (e) {
      console.error(e);
      setError('网络错误');
      showToast('网络错误', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        String(r.playerId).toLowerCase().includes(q) ||
        String(r.name || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const downloadCsv = () => {
    if (!rows.length || !selected) {
      showToast('请先加载数据', 'info');
      return;
    }
    const r = selected.ranking;
    const header = [
      '排名',
      '玩家ID',
      '角色名',
      '总分',
      '战斗(加权)',
      '事件(加权)',
      '声望(加权)',
      '贡献(加权)',
      '活动标题',
      '公告ID',
    ];
    const lines = rows.map((row) =>
      [
        row.rank,
        row.playerId,
        `"${String(row.name).replace(/"/g, '""')}"`,
        row.totalScore,
        Math.round(row.combat),
        Math.round(row.events),
        Math.round(row.rep),
        Math.round(row.contrib),
        `"${(r?.title || '').replace(/"/g, '""')}"`,
        selected.id,
      ].join(',')
    );
    const bom = '\uFEFF';
    const csv = bom + [header.join(','), ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-ranking-${selected.id}-top30.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已下载 CSV');
  };

  return (
    <>
      <Toast />
      <div className="max-w-6xl mx-auto space-y-8 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">活动管理</h1>
            <p className="text-sm text-gray-600 mt-1">
              活动排名 Top30 · announcements.js · temp_event_ranking
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>
        )}

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[240px] flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">活动（含排行榜）</label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
              >
                {options.length === 0 && (
                  <option value="">暂无含排行榜配置的公告（见 announcements.js）</option>
                )}
                {options.map((a) => (
                  <option key={a.id} value={a.id}>
                    🏆 {a.ranking?.title || a.title} · {a._ended ? '已结束' : '进行中'} · {a.id}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={loading || !eventId}
              onClick={handleLoadServer}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '加载中…' : '从服务器加载 Top30'}
            </button>
            <button
              type="button"
              onClick={downloadCsv}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
            >
              导出 CSV
            </button>
          </div>
          {cacheHint && (
            <p className="text-xs text-gray-500">
              本地缓存时间：{new Date(cacheHint).toLocaleString()}
            </p>
          )}
          {meta && (
            <p className="text-sm text-gray-600">
              {meta.rankingTitle && <span className="font-medium">{meta.rankingTitle}</span>}
              {meta.totalParticipants != null && (
                <span className="ml-2">参与人数：{meta.totalParticipants}</span>
              )}
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900">排名明细</h2>
            <input
              type="search"
              placeholder="按玩家ID或角色名筛选…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-full max-w-xs"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">名次</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">玩家ID</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">角色名</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">总分</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">⚔️ 战斗</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">📜 事件</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">🎖️ 声望</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">🤝 贡献</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filtered.map((row, i) => (
                  <tr key={`${row.playerId}-${row.rank}`} className={i % 2 ? 'bg-gray-50' : ''}>
                    <td className="px-3 py-2 font-mono">{row.rank}</td>
                    <td className="px-3 py-2 font-mono font-medium">{row.playerId}</td>
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {Number(row.totalScore).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {Math.round(row.combat).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {Math.round(row.events).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {Math.round(row.rep).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {Math.round(row.contrib).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">
              请选择活动并点击「从服务器加载」，或等待配置已结束的排行榜公告。
            </p>
          )}
          {rows.length > 0 && filtered.length === 0 && (
            <p className="text-sm text-amber-700 text-center py-4">无匹配筛选结果</p>
          )}
        </div>
      </div>
    </>
  );
}
