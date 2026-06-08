/**
 * 活动排行榜面板
 * 
 * @description 紧贴公告栏下方，与公告栏同宽同风格
 * - 仅当最新公告配置了 ranking 字段时显示
 * - 登录/刷新时自动展开（与公告栏独立控制）
 * - 每5分钟自动刷新排名数据（折叠状态下不刷新）
 * - 活动未开始显示倒计时，已结束显示最终排名定格
 * 
 * @see docs/30-frontend/32-3-ANNOUNCEMENTS.md §4
 * @see docs/30-frontend/32-3-ANNOUNCEMENTS.md §4 活动排名
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getLatestAnnouncement } from '@/data/texts/announcements';
import { rankingsAPI } from '@/services/rankingsApi';

/** 计算剩余时间的可读文本 */
function formatTimeRemaining(endTime) {
  const now = new Date();
  const end = new Date(endTime);
  const diff = end - now;
  if (diff <= 0) return null;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}天${hours}小时`;
  if (hours > 0) return `${hours}小时${minutes}分钟`;
  return `${minutes}分钟`;
}

/** 计算活动状态 */
function getActivityStatus(ranking) {
  const now = new Date();
  const start = new Date(ranking.startTime);
  const end = new Date(ranking.endTime);

  if (now < start) return 'upcoming';
  if (now > end) return 'ended';
  return 'active';
}

/** 根据排名匹配奖品 */
function getRewardForRank(rank, rewards) {
  if (!rewards || !rank) return null;
  for (const r of rewards) {
    if (rank >= r.rankRange[0] && rank <= r.rankRange[1]) {
      return r.prizes;
    }
  }
  return null;
}

/** 格式化奖品显示 */
function formatPrizes(prizes) {
  if (!prizes) return '';
  if (typeof prizes === 'string') return prizes;
  const parts = [];
  if (prizes.silver) parts.push(`💰${prizes.silver}`);
  if (prizes.food) parts.push(`🌾${prizes.food}`);
  if (prizes.contribution) parts.push(`🤝${prizes.contribution}`);
  if (prizes.badge) parts.push(`🎖️×${prizes.badge}`);
  return parts.join(' ');
}

export default function RankingPanel() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('ranking_collapsed') === '1'; } catch { return false; }
  });

  const toggleCollapse = (val) => {
    setCollapsed(val);
    try { localStorage.setItem('ranking_collapsed', val ? '1' : '0'); } catch {}
  };

  const [rankingData, setRankingData] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const timerRef = useRef(null);

  const announcement = getLatestAnnouncement();
  const ranking = announcement?.ranking;

  // 从后端获取排名数据
  const fetchRankingData = useCallback(async () => {
    if (!ranking) return;

    const status = getActivityStatus(ranking);
    if (status === 'upcoming') {
      setRankingData(null);
      setLastRefresh(new Date());
      return;
    }

    // 获取当前登录玩家ID
    const gameUser = JSON.parse(localStorage.getItem('gameUser') || 'null');
    const playerId = gameUser?.playerId || gameUser?.id || null;

    const result = await rankingsAPI.getRankings(announcement.id, {
      limit: ranking.displayCount || 10,
      playerId,
    });

    if (result.success) {
      setRankingData(result.data);
    }
    setLastRefresh(new Date());
  }, [ranking, announcement?.id]);

  // 初始加载 + 定时刷新（仅展开状态）
  useEffect(() => {
    if (!ranking) return;

    fetchRankingData();

    // 展开状态下每5分钟刷新
    if (!collapsed) {
      const interval = ranking.refreshInterval || 300000;
      timerRef.current = setInterval(fetchRankingData, interval);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [ranking, collapsed, fetchRankingData]);

  // 展开时如果距上次刷新 > 1分钟，立即刷新
  const handleExpand = () => {
    toggleCollapse(false);
    if (lastRefresh && Date.now() - lastRefresh.getTime() > 60000) {
      fetchRankingData();
    }
  };

  // 无排行榜配置则不渲染
  if (!ranking) return null;

  const status = getActivityStatus(ranking);
  const myReward = rankingData ? getRewardForRank(rankingData.myRanking?.rank, ranking.rewards) : null;

  // 折叠状态
  if (collapsed) {
    return (
      <div className="pointer-events-auto">
        <button
          onClick={handleExpand}
          className="flex w-full items-center justify-between rounded-lg border border-amber-700/40 bg-black/60 px-3 py-1.5 text-xs text-amber-300/80 backdrop-blur-sm transition-colors hover:text-amber-200"
        >
          <span className="flex items-center gap-1.5">
            <span>🏆</span>
            <span className="truncate">{ranking.title}</span>
            {rankingData?.myRanking && status !== 'upcoming' && (
              <span className="text-amber-200/70">
                📍第{rankingData.myRanking.rank}名 {rankingData.myRanking.totalScore.toLocaleString()}分
              </span>
            )}
          </span>
          <span className="flex-shrink-0 ml-2 text-[10px] text-amber-400/60">▼ 展开</span>
        </button>
      </div>
    );
  }

  // 展开状态
  return (
    <div className="pointer-events-auto">
      <div className="overflow-hidden rounded-lg border border-amber-700/40 bg-black/60 backdrop-blur-sm">
        {/* 标题行 */}
        <div className="flex items-center justify-between px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">🏆</span>
            <span className="text-xs font-bold text-amber-300">{ranking.title}</span>
          </div>
          <button
            onClick={() => toggleCollapse(true)}
            className="flex-shrink-0 ml-2 text-[10px] text-amber-400/60 hover:text-amber-300 transition-colors"
          >
            ▲ 收起
          </button>
        </div>

        {/* 我的排名摘要 + 剩余时间 */}
        <div className="px-3 pb-1.5">
          {rankingData?.myRanking && status !== 'upcoming' ? (
            <p className="text-xs text-amber-100/80">
              {`📍第${rankingData.myRanking.rank}名 ${rankingData.myRanking.totalScore.toLocaleString()}分`}
            </p>
          ) : null}
          {status === 'active' && (
            <p className="text-[10px] text-amber-400/60 mt-0.5">
              剩余时间：{formatTimeRemaining(ranking.endTime) || '即将结束'}
            </p>
          )}
          {status === 'upcoming' && (
            <p className="text-[10px] text-amber-400/60 mt-0.5">
              活动将于 {formatTimeRemaining(ranking.startTime)} 后开始
            </p>
          )}
          {status === 'ended' && (
            <p className="text-[10px] text-red-400/80 mt-0.5">活动已结束（最终排名）</p>
          )}
          {/* 四项积分明细 */}
          {rankingData?.myRanking && status !== 'upcoming' && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1.5 pt-1.5 border-t border-amber-700/20">
              <span className="text-[10px] text-amber-100/60">⚔️ 战斗：{((rankingData.myRanking.battleScore ?? 0) * (ranking.scoreWeights?.battleScore ?? 0.2)).toLocaleString()}</span>
              <span className="text-[10px] text-amber-100/60">📜 事件：{((rankingData.myRanking.eventsCompleted ?? 0) * (ranking.scoreWeights?.events ?? 300)).toLocaleString()}</span>
              <span className="text-[10px] text-amber-100/60">🎖️ 声望：{((rankingData.myRanking.reputation ?? 0) * (ranking.scoreWeights?.reputation ?? 60)).toLocaleString()}</span>
              <span className="text-[10px] text-amber-100/60">🤝 贡献：{((rankingData.myRanking.contribution ?? 0) * (ranking.scoreWeights?.contribution ?? ranking.scoreWeights?.reputation ?? 60)).toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* 排名列表 */}
        {rankingData && status !== 'upcoming' && (
          <>
            <div className="border-t border-amber-700/30 mx-3" />
            <div className="px-3 py-1.5 space-y-1">
              {rankingData.rankings.map((item) => (
                <div key={item.rank} className="flex items-center justify-between text-xs">
                  <span className="text-amber-200 font-bold w-6 text-center">{item.rank}</span>
                  <span className="flex-1 text-amber-100/80 ml-2 truncate">{item.name}</span>
                  <span className="text-amber-200/70 ml-2">{item.totalScore.toLocaleString()}分</span>
                </div>
              ))}
            </div>

            {/* 我的排名 */}
            {rankingData.myRanking && (
              <>
                <div className="border-t border-amber-700/30 mx-3" />
                <div className="px-3 py-1.5 bg-amber-700/20">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-amber-300">
                      📍 我的排名：第{rankingData.myRanking.rank}名
                    </span>
                    <span className="text-amber-200 font-bold">
                      {rankingData.myRanking.totalScore.toLocaleString()}分
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* 奖池信息 */}
            {ranking.rewards && ranking.rewards.length > 0 && (
              <>
                <div className="border-t border-amber-700/30 mx-3" />
                <div className="px-3 py-1.5 space-y-0.5">
                  <p className="text-[11px] text-amber-300 font-bold">🎁 奖池：</p>
                  {ranking.rewards.map((r, i) => (
                    <p key={i} className="text-[10px] text-amber-100/70">
                      第{r.rankRange[0]}{r.rankRange[0] !== r.rankRange[1] ? `-${r.rankRange[1]}` : ''}名：{formatPrizes(r.prizes)}
                    </p>
                  ))}
                  {myReward && (
                    <p className="text-[10px] text-amber-300 mt-0.5">
                      📍 当前可获得：{formatPrizes(myReward)}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* 底部信息 */}
            <div className="border-t border-amber-700/30 mx-3" />
            <div className="px-3 py-1 text-center">
              <span className="text-[10px] text-amber-500/50">
                参与玩家：{rankingData.totalParticipants}人
                {lastRefresh && ` | 上次刷新：${Math.floor((Date.now() - lastRefresh.getTime()) / 60000)}分钟前`}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
