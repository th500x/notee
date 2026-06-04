/**
 * 个人中心 · 成就目录内容（由 PersonalCatalogModal 承载）
 */

import { useEffect, useState } from 'react';
import { playerAPI } from '@/services/playerApi';

const COLUMNS = [
  { key: 'achievementName', label: '成就' },
  { key: 'unlockConditionsDesc', label: '解锁条件' },
  { key: 'attributeBonus', label: '属性加成' },
  { key: 'specialEffectDesc', label: '特殊效果' },
  { key: 'rewards', label: '奖励' },
  { key: 'displayEffect', label: '特效' },
  { key: 'owned', label: '获取' },
];

function cellValue(row, key) {
  if (key === 'owned') {
    return row.owned ? (
      <span title="已获取">✅</span>
    ) : (
      <span title="未获取">❌</span>
    );
  }
  return row[key] ?? '—';
}

export default function PersonalSidebarAchievementsPanel({ playerId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [achievements, setAchievements] = useState([]);

  useEffect(() => {
    if (!playerId) {
      setLoading(false);
      setError('未登录');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await playerAPI.getAchievementCatalog(playerId);
        if (cancelled) return;
        if (!res.success) {
          setError(res.error || '加载失败');
          setAchievements([]);
          return;
        }
        setAchievements(res.data?.achievements || []);
      } catch (e) {
        if (!cancelled) setError(e?.message || '网络错误');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  return (
    <div className="px-3 py-3 sm:px-4 sm:py-4">
      {loading && <p className="text-sm text-gray-500 py-6 text-center">加载中…</p>}
      {!loading && error && <p className="text-sm text-red-600 py-6 text-center">{error}</p>}
      {!loading && !error && achievements.length === 0 && (
        <p className="text-sm text-gray-500 py-6 text-center">暂无成就配置</p>
      )}
      {!loading && !error && achievements.length > 0 && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[720px] text-sm border-collapse">
            <thead>
              <tr className="bg-amber-100/80 text-amber-950">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="px-2.5 py-2.5 text-left font-semibold border-b border-amber-200/60 whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {achievements.map((row) => (
                <tr key={row.achievementId} className="border-b border-gray-100 even:bg-gray-50/50">
                  {COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className={`px-2.5 py-2.5 text-gray-800 ${
                        col.key === 'achievementName' ? 'font-medium text-gray-900 whitespace-nowrap' : ''
                      } ${col.key === 'owned' ? 'text-center whitespace-nowrap' : ''}`}
                    >
                      {cellValue(row, col.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
