/**
 * 个人中心 · 成就目录内容（由 PersonalCatalogModal 承载）
 * 领取：条件达成后点击 🎁 手动领取（称号仍自动发放）
 */

import { useCallback, useEffect, useState } from 'react';
import { playerAPI } from '@/services/playerApi';
import { usePlayerRefresh } from '@/contexts/PlayerContext';
import { notifyAchievementNotifyRefresh } from '@/utils/achievementNotifyRefresh';
import { resolveTitleAchievementReveal } from '@/utils/cardDataTransforms';
import GrantedCardRevealOverlay from '@/components/game/GrantedCardRevealOverlay';

const COLUMNS = [
  { key: 'achievementName', label: '成就' },
  { key: 'progressLabel', label: '进度' },
  { key: 'unlockConditionsDesc', label: '解锁条件' },
  { key: 'attributeBonus', label: '属性加成' },
  { key: 'specialEffectDesc', label: '特效' },
  { key: 'rewards', label: '奖励' },
  { key: 'displayEffect', label: '光效' },
  { key: 'claimStatus', label: '获取' },
];

function ClaimStatusCell({ row, claiming, onClaim }) {
  const status = row.claimStatus || (row.owned ? 'owned' : 'locked');
  if (status === 'owned') {
    return (
      <span title="已获取" aria-label="已获取">
        ✅
      </span>
    );
  }
  if (status === 'claimable') {
    const busy = claiming === row.achievementId;
    return (
      <button
        type="button"
        className="text-lg leading-none px-1 py-0.5 rounded hover:bg-amber-100/80 disabled:opacity-50 transition-colors"
        title={busy ? '领取中…' : '点击领取成就'}
        aria-label={busy ? '领取中' : '点击领取成就'}
        disabled={busy}
        onClick={() => onClaim(row.achievementId)}
      >
        {busy ? '…' : '🎁'}
      </button>
    );
  }
  return (
    <span title="条件未达成" aria-label="条件未达成">
      ❌
    </span>
  );
}

export default function PersonalSidebarAchievementsPanel({ playerId }) {
  const refreshProfile = usePlayerRefresh();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [claimingId, setClaimingId] = useState(null);
  const [claimError, setClaimError] = useState(null);
  /** @type {null | { cardType: 'achievement', item: object }} */
  const [reveal, setReveal] = useState(null);

  const loadCatalog = useCallback(async () => {
    if (!playerId) {
      setLoading(false);
      setError('未登录');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await playerAPI.getAchievementCatalog(playerId);
      if (!res.success) {
        setError(res.error || '加载失败');
        setAchievements([]);
        return;
      }
      setAchievements(res.data?.achievements || []);
    } catch (e) {
      setError(e?.message || '网络错误');
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const handleClaim = useCallback(
    async (achievementId) => {
      if (!playerId || !achievementId || claimingId) return;
      setClaimError(null);
      setClaimingId(achievementId);
      try {
        const res = await playerAPI.claimAchievement(playerId, achievementId);
        if (!res.success) {
          setClaimError(res.error || '领取失败');
          return;
        }
        await loadCatalog();
        await refreshProfile({ silent: true });
        notifyAchievementNotifyRefresh();
        const grant = res.data || {};
        const prof = await playerAPI.getProfile(playerId);
        const freshCards = prof.success ? prof.data?.cards || [] : [];
        const resolved = resolveTitleAchievementReveal(
          {
            achievementId: grant.achievementId,
            achievementName: grant.achievementName,
            instanceId: grant.instanceId,
          },
          freshCards,
          'achievement',
        );
        if (resolved?.item) {
          setReveal({ cardType: 'achievement', item: resolved.item });
        }
      } catch (e) {
        setClaimError(e?.message || '网络错误');
      } finally {
        setClaimingId(null);
      }
    },
    [playerId, claimingId, loadCatalog, refreshProfile],
  );

  return (
    <>
    <div className="px-3 py-3 sm:px-4 sm:py-4">
      {loading && <p className="text-sm text-gray-500 py-6 text-center">加载中…</p>}
      {!loading && error && <p className="text-sm text-red-600 py-6 text-center">{error}</p>}
      {!loading && claimError && (
        <p className="text-sm text-red-600 mb-2 text-center" role="alert">
          {claimError}
        </p>
      )}
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
                      } ${col.key === 'claimStatus' ? 'text-center whitespace-nowrap' : ''}`}
                    >
                      {col.key === 'claimStatus' ? (
                        <ClaimStatusCell row={row} claiming={claimingId} onClaim={handleClaim} />
                      ) : (
                        row[col.key] ?? '—'
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    <GrantedCardRevealOverlay
      open={!!reveal}
      cardType="achievement"
      item={reveal?.item}
      headline="获得成就"
      onClose={() => setReveal(null)}
    />
    </>
  );
}
