/**
 * 个人中心内「统计」子页：与团队子页同风格（顶栏 + 可滚动正文）
 */

import { useEffect, useState } from 'react';
import { playerAPI } from '@/services/playerApi';

function formatInt(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return Math.round(v).toLocaleString('zh-CN');
}

/** player_statistics 表时长字段按秒计（见库设计） */
function formatDurationSeconds(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  if (s < 60) return `${s} 秒`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} 分`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (rm === 0) return `${h} 小时`;
  return `${h} 小时 ${rm} 分`;
}

function StatRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm text-gray-800">
      <span className="text-gray-600 shrink-0">{label}</span>
      <span className="tabular-nums text-right font-medium text-gray-900 break-all">{value}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-bold text-amber-900/90 mb-2">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export default function PersonalSidebarStatsPanel({ playerId, onBack }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

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
        const res = await playerAPI.getStatistics(playerId);
        if (cancelled) return;
        if (!res.success) {
          setError(res.error || '加载失败');
          setStats(null);
          return;
        }
        setStats(res.data);
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

  const winRateText =
    stats == null
      ? '—'
      : `${Number(stats.winRate).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      <div className="px-4 py-3 border-b border-amber-200/80 bg-amber-50/90 flex items-center gap-2 sticky top-0 z-10">
        <button
          type="button"
          onClick={onBack}
          className="text-amber-900 font-medium text-sm hover:text-amber-700"
        >
          ← 返回
        </button>
        <span className="text-gray-800 font-bold text-sm">统计</span>
      </div>

      <div className="px-4 py-3 text-sm text-gray-700">
        {loading && <p className="text-xs text-gray-500">加载中…</p>}
        {!loading && error && (
          <p className="text-xs text-red-600">{error}</p>
        )}
        {!loading && !error && stats && (
          <div className="space-y-4">
            <Section title="战斗">
              <StatRow label="总战斗次数" value={formatInt(stats.totalBattles)} />
              <StatRow label="胜 / 负 / 平" value={`${formatInt(stats.wins)} / ${formatInt(stats.losses)} / ${formatInt(stats.draws)}`} />
              <StatRow label="胜率" value={winRateText} />
              <StatRow label="累计造成杀伤（兵）" value={formatInt(stats.totalDamageDealt)} />
              <StatRow label="累计承受损失（兵）" value={formatInt(stats.totalDamageTaken)} />
              <StatRow label="累计击杀（部队数）" value={formatInt(stats.totalKills)} />
              <StatRow label="活动积分（累计）" value={formatInt(stats.totalBattleScore)} />
              <StatRow label="完成探索事件（累计）" value={formatInt(stats.totalEventsCompleted)} />
            </Section>

            <Section title="游戏时长">
              <StatRow label="总时长" value={formatDurationSeconds(stats.totalPlaytime)} />
              <StatRow label="今日" value={formatDurationSeconds(stats.todayPlaytime)} />
              <StatRow label="本周" value={formatDurationSeconds(stats.weekPlaytime)} />
              <StatRow label="本月" value={formatDurationSeconds(stats.monthPlaytime)} />
            </Section>

            <Section title="银两与粮草">
              <StatRow label="累计获得银两" value={formatInt(stats.totalGoldEarned)} />
              <StatRow label="累计消耗银两" value={formatInt(stats.totalGoldSpent)} />
              <StatRow label="累计获得粮草" value={formatInt(stats.totalFoodEarned)} />
              <StatRow label="累计消耗粮草" value={formatInt(stats.totalFoodSpent)} />
            </Section>

            <Section title="贡献与声望">
              <StatRow label="累计获得贡献" value={formatInt(stats.totalContributionEarned)} />
              <StatRow label="累计消耗贡献" value={formatInt(stats.totalContributionSpent)} />
              <StatRow label="累计获得声望" value={formatInt(stats.totalReputationEarned)} />
            </Section>

            <p className="text-[11px] text-gray-400 pt-1">
              数据来自服务端 player_statistics 表。银两/粮草/贡献的累计获得与累计消耗由后端统一写入（与 players 资源变动一致）；游戏时长仍依赖会话统计接入。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
