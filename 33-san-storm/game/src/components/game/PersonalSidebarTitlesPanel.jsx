/**
 * 个人中心 · 称号目录内容（由 PersonalCatalogModal 承载）
 */

import { useEffect, useState } from 'react';
import { playerAPI } from '@/services/playerApi';

const COLUMNS = [
  { key: 'titleName', label: '称号' },
  { key: 'unlockConditionsDesc', label: '解锁条件' },
  { key: 'attributeBonus', label: '属性加成' },
  { key: 'specialEffectDesc', label: '特效' },
  { key: 'owned', label: '获取' },
];

export default function PersonalSidebarTitlesPanel({ playerId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [titles, setTitles] = useState([]);

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
        const res = await playerAPI.getTitleCatalog(playerId);
        if (cancelled) return;
        if (!res.success) {
          setError(res.error || '加载失败');
          setTitles([]);
          return;
        }
        setTitles(res.data?.titles || []);
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
      {!loading && !error && titles.length === 0 && (
        <p className="text-sm text-gray-500 py-6 text-center">暂无称号配置</p>
      )}
      {!loading && !error && titles.length > 0 && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-amber-100/80 text-amber-950">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-2.5 text-left font-semibold border-b border-amber-200/60"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {titles.map((row) => (
                <tr key={row.titleId} className="border-b border-gray-100 even:bg-gray-50/50">
                  <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                    {row.titleName}
                  </td>
                  <td className="px-3 py-2.5 text-gray-700">{row.unlockConditionsDesc}</td>
                  <td className="px-3 py-2.5 text-gray-800 whitespace-nowrap">
                    {row.attributeBonus}
                  </td>
                  <td className="px-3 py-2.5 text-gray-700">{row.specialEffectDesc}</td>
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                    {row.owned ? (
                      <span title="已获取">✅</span>
                    ) : (
                      <span title="未获取">❌</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
