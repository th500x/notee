/**
 * 势力 Tab ·「公告」（横屏右下象限 / 竖屏子 Tab）
 * 纯展示：谕旨 · 文书 · 战事 · 外交（后一类占位）
 * 数据：GET /api/players/:playerId/san-gong-fu/bulletin（前三类）；外交待实装
 */

import { useCallback, useEffect, useState } from 'react';
import { playerAPI } from '@/services/playerApi';
import {
  computeMaxFactionBulletinId,
  markFactionBulletinsSeenUpTo,
} from '@/utils/factionBulletinReadState';
function BulletinBlock({ title, entries, emptyText, loading }) {
  return (
    <div className="shrink-0 rounded-lg border border-stone-700/40 bg-stone-900/30 px-2 py-2 text-left">
      <div className="mb-2 text-left text-[10px] font-semibold text-amber-500/90">{title}</div>
      {loading ? (
        <p className="text-[10px] text-stone-500">加载中…</p>
      ) : !entries?.length ? (
        <p className="text-[10px] leading-snug text-stone-500">{emptyText}</p>
      ) : (
        <ul className="max-h-[min(22vh,9rem)] space-y-1.5 overflow-y-auto pr-0.5 text-[10px] leading-snug text-stone-200/95">
          {entries.map((e) => (
            <li key={e.id} className="break-words border-b border-stone-800/50 pb-1.5 last:border-0 last:pb-0">
              {e.body}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * @param {{ playerId?: string|null, refreshKey?: number, markRead?: boolean }} props
 */
export default function FactionBulletinSection({ playerId, refreshKey = 0, markRead = true }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!playerId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await playerAPI.getSanGongFuBulletin(playerId, { limitPerCategory: 30 });
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error || '加载失败');
        setData(null);
      }
    } catch (e) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (!playerId) return undefined;
    const t = window.setInterval(load, 60_000);
    return () => window.clearInterval(t);
  }, [playerId, load]);

  useEffect(() => {
    if (!markRead || !playerId || loading || !data) return;
    markFactionBulletinsSeenUpTo(playerId, computeMaxFactionBulletinId(data));
  }, [markRead, playerId, loading, data]);

  if (!playerId) {
    return <p className="text-xs text-stone-500">暂无</p>;
  }

  return (
    <div className="flex max-h-[min(48vh,18rem)] min-h-0 flex-col gap-2 overflow-y-auto pr-0.5 text-left">
      {error ? (
        <div className="shrink-0 rounded border border-red-900/40 bg-red-950/30 px-2 py-1 text-[10px] text-red-300/90">
          {error}
        </div>
      ) : null}
      <BulletinBlock
        title="谕旨"
        entries={data?.edicts}
        loading={loading}
        emptyText="暂无君主谕旨。每日大司空任命后将记入此处。"
      />
      <BulletinBlock
        title="文书"
        entries={data?.documents}
        loading={loading}
        emptyText="暂无一品官员文书。可于三公府「朝政」发布（每日最多 3 条）。"
      />
      <BulletinBlock
        title="战事"
        entries={data?.wars}
        loading={loading}
        emptyText="暂无战事通知。攻防守战事发起或结束后将自动记入。"
      />
      <BulletinBlock
        title="外交"
        entries={[]}
        loading={false}
        emptyText="暂无外交关系动态。结盟、敌对与停战等实装后将记入此处。"
      />
    </div>
  );
}
