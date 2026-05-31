/**
 * 势力 Tab ·「外交」— 战事摘要（17-2 wars_pvp）
 * 数据：`warAPI.listWars({ factionId, status: pending|active })`，与大地图浮层分立。
 */

import { useCallback, useEffect, useState } from 'react';
import { warAPI } from '@/services/warApi';
import { SectionTitle, Line } from '@/components/game/faction/FactionInfoPanel';

const STATUS_LABEL = {
  pending: '待发兵',
  active: '交战中',
};

function describeWar(war, factionId) {
  const isAttacker = war.attackerFactionId === factionId;
  const role = isAttacker ? '我方攻方' : '我方守方';
  const status = STATUS_LABEL[war.status] || war.status;
  const city = war.targetCityName || war.targetCityId || '—';
  return { role, status, city };
}

export default function FactionWarDynamicsSection({ factionId }) {
  const [wars, setWars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!factionId) {
      setWars([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await warAPI.listWars({
        factionId,
        status: ['pending', 'active'],
        limit: 30,
      });
      if (res.success && Array.isArray(res.wars)) {
        setWars(res.wars);
      } else {
        setError(typeof res.error === 'string' ? res.error : '加载失败');
        setWars([]);
      }
    } catch (e) {
      setError(e?.message || '加载失败');
      setWars([]);
    } finally {
      setLoading(false);
    }
  }, [factionId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!factionId) return undefined;
    const t = window.setInterval(() => {
      load();
    }, 45_000);
    return () => window.clearInterval(t);
  }, [factionId, load]);

  if (!factionId) {
    return (
      <div>
        <SectionTitle>战事</SectionTitle>
        <Line>无</Line>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <SectionTitle>战事</SectionTitle>
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border border-amber-500 border-t-transparent"
            aria-hidden
          />
          加载中…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SectionTitle>战事</SectionTitle>
        <p className="text-xs text-red-400/90">{error}</p>
      </div>
    );
  }

  if (!wars.length) {
    return (
      <div>
        <SectionTitle>战事</SectionTitle>
        <Line>无</Line>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <SectionTitle>战事</SectionTitle>
      <div className="flex flex-col gap-2.5">
        {wars.map((war) => {
          const { city, status, role } = describeWar(war, factionId);
          return (
            <div
              key={war.pvpWarId}
              className="border-b border-stone-700/40 pb-2 last:border-b-0 last:pb-0"
            >
              <Line>
                <span className="text-stone-500">目标：</span>
                {city}
              </Line>
              <Line>
                <span className="text-stone-500">态势：</span>
                {status} · {role}
              </Line>
              <Line>
                <span className="text-stone-500">士气：</span>
                攻方 {war.attackerWarMorale ?? '—'} / 守方 {war.defenderWarMorale ?? '—'}
              </Line>
            </div>
          );
        })}
      </div>
    </div>
  );
}
