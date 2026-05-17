/**
 * 势力 Tab ·「公告」（横屏第四象限 / 竖屏子 Tab 同源）
 * 数据：GET /api/players/:playerId/faction/bulletin（按玩家所属势力）
 */

import { useCallback, useEffect, useState } from 'react';
import { playerAPI } from '@/services/playerApi';
import { SectionTitle, Line } from '@/components/game/faction/FactionInfoPanel';

export default function FactionBulletinSection({ playerId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!playerId) {
      setEntries([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await playerAPI.getFactionBulletin(playerId, { limit: 50 });
      if (res.success && Array.isArray(res.data?.entries)) {
        setEntries(res.data.entries);
      } else {
        setError(typeof res.error === 'string' ? res.error : '加载失败');
        setEntries([]);
      }
    } catch (e) {
      setError(e?.message || '加载失败');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!playerId) return undefined;
    const t = window.setInterval(load, 60_000);
    return () => window.clearInterval(t);
  }, [playerId, load]);

  if (!playerId) {
    return (
      <div>
        <SectionTitle>公告</SectionTitle>
        <Line>暂无</Line>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <SectionTitle>公告</SectionTitle>
        <Line>加载中…</Line>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SectionTitle>公告</SectionTitle>
        <p className="mt-1 text-xs text-amber-700/90">{error}</p>
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div>
        <SectionTitle>公告</SectionTitle>
        <p className="mt-1 text-xs text-stone-500">暂无公告。战事发起与结束后将自动记入此处。</p>
      </div>
    );
  }

  return (
    <div className="max-h-[min(40vh,14rem)] overflow-y-auto pr-1 text-left">
      <SectionTitle>公告</SectionTitle>
      <ul className="mt-1 space-y-2">
        {entries.map((e) => (
          <li key={e.id} className="text-xs leading-relaxed text-stone-200/95">
            {e.body}
          </li>
        ))}
      </ul>
    </div>
  );
}
