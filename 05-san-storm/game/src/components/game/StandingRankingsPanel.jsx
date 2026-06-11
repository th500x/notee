/**
 * 常驻排行榜面板（总体 / 战役）
 *
 * @description 入口在左下角、**口谕（`KingEdictPanel`，`bottom-44`）** 下方、通信面板「聊天」按钮上方；与活动榜 RankingPanel 分离。
 * 配色与 Tab 区固定高度与 CommPanel（战报/传书/聊天）对齐，避免透明难读与切换跳动。
 * @see docs/10-core-system/18-4-RANKING_SYSTEM.md
 * 视觉与 CommPanel 一致，见 18-4-RANKING_SYSTEM.md / 32-5-PLAYER_CORNER.md
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { rankingsAPI } from '@/services/rankingsApi';
import { campaignAPI } from '@/services/campaignApi';
import { useRegisterMapCornerEntryHandler } from '@/contexts/MapCornerPlayerEntryActionsContext';
import { useMapCornerCompactViewport } from '@/hooks/useMapCornerCompactViewport';
import {
  MAP_CORNER_ENTRY_ROW_CLASS,
  mapCornerEntryRowBoxStyle,
} from '@/components/game/mapCornerEntryUi';
import { formatCampaignDisplayName } from '@shared/utils/campaignDisplayName';

const SEASON = 'san_1';
const REFRESH_MS = 5 * 60 * 1000;

/** 与 CommPanel 战报 Tab 一致：固定内容区高度，切换 Tab 外框不跳动 */
const RANK_TAB_BODY_CLASS =
  'flex flex-col h-96 min-h-96 max-h-96 w-full shrink-0 overflow-hidden';
const RANK_TAB_SCROLL_CLASS =
  'flex-1 min-h-0 basis-0 overflow-y-auto overflow-x-auto';
/** 顶栏槽：总体为排序下拉 / 战役为战役下拉，统一 min-height */
const RANK_TOP_SLOT_CLASS =
  'shrink-0 min-h-[4.5rem] border-b border-amber-700/20 px-2 py-2 flex flex-col justify-center gap-1';
/** 底部「我的排名」槽：两 Tab 同高，避免页脚高低变化（随正文字号略增高） */
const RANK_FOOTER_SLOT_CLASS =
  'shrink-0 min-h-[6.25rem] border-t border-amber-700/20 px-2 py-2 bg-gray-950 flex flex-col justify-start';

function readGameServerId() {
  try {
    const u = JSON.parse(localStorage.getItem('gameUser') || 'null');
    return u?.serverId ? String(u.serverId) : null;
  } catch {
    return null;
  }
}

function formatInt(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return Math.round(v).toLocaleString('zh-CN');
}

const GRADE_TEXT = {
  S: 'text-amber-400 font-bold',
  A: 'text-orange-400 font-semibold',
  B: 'text-emerald-500',
  C: 'text-gray-400',
  D: 'text-red-400/90',
};

/** 与 GET /api/rankings/overall?sort= 一致 */
const OVERALL_SORT_OPTIONS = [
  { value: 'avg', label: '场均评分' },
  { value: 'wins', label: '胜场' },
  { value: 'reputation', label: '声望' },
  { value: 'events', label: '黄巾徽章' },
];

const OVERALL_SORT_LABEL = {
  avg: '场均',
  wins: '胜场',
  reputation: '声望',
  events: '徽章',
};

function overallBadgeCount(row) {
  if (row == null) return 0;
  const v = row.badgeCount ?? row.eventsCompleted;
  return Number(v) || 0;
}

function overallMetricHeadClass(metric, activeSort) {
  return `text-right tabular-nums text-sm ${activeSort === metric ? 'text-amber-300 font-semibold' : 'text-amber-200/80 font-semibold'}`;
}

function overallMetricCellClass(metric, activeSort) {
  return `text-right tabular-nums text-sm ${activeSort === metric ? 'text-amber-300 font-semibold' : 'text-amber-200/80'}`;
}

export default function StandingRankingsPanel({ visible, playerId }) {
  const [open, setOpen] = useState(false);
  const [mainTab, setMainTab] = useState('overall');
  const [overallSort, setOverallSort] = useState('avg');
  const [overallData, setOverallData] = useState(null);
  const [campaignData, setCampaignData] = useState(null);
  const [definitions, setDefinitions] = useState([]);
  const [campaignId, setCampaignId] = useState('');
  const [loadingOverall, setLoadingOverall] = useState(false);
  const [loadingCampaign, setLoadingCampaign] = useState(false);
  const [errorOverall, setErrorOverall] = useState(null);
  const [errorCampaign, setErrorCampaign] = useState(null);
  const timerRef = useRef(null);

  const loadOverall = useCallback(async () => {
    if (!playerId) return;
    const serverId = readGameServerId();
    setLoadingOverall(true);
    setErrorOverall(null);
    const res = await rankingsAPI.getOverall({
      limit: 30,
      playerId,
      serverId: serverId || undefined,
      sort: overallSort,
    });
    setLoadingOverall(false);
    if (res.success) setOverallData(res.data);
    else setErrorOverall(res.error || '加载失败');
  }, [playerId, overallSort]);

  const loadCampaign = useCallback(async () => {
    if (!playerId || !campaignId) return;
    const serverId = readGameServerId();
    setLoadingCampaign(true);
    setErrorCampaign(null);
    const res = await rankingsAPI.getCampaign({
      campaignId,
      limit: 30,
      playerId,
      serverId: serverId || undefined,
    });
    setLoadingCampaign(false);
    if (res.success) setCampaignData(res.data);
    else setErrorCampaign(res.error || '加载失败');
  }, [playerId, campaignId]);

  const loadDefinitions = useCallback(async () => {
    const res = await campaignAPI.getDefinitions(SEASON);
    if (res.success && Array.isArray(res.definitions)) {
      setDefinitions(res.definitions);
      setCampaignId((prev) => {
        if (prev && res.definitions.some((d) => d.campaign_id === prev)) return prev;
        return res.definitions[0]?.campaign_id || '';
      });
    }
  }, []);

  useEffect(() => {
    if (!open || !visible || !playerId) {
      if (timerRef.current) clearInterval(timerRef.current);
      return undefined;
    }
    if (mainTab === 'overall') {
      loadOverall();
      timerRef.current = setInterval(loadOverall, REFRESH_MS);
    } else {
      loadDefinitions();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open, visible, playerId, mainTab, loadOverall, loadDefinitions]);

  useEffect(() => {
    if (!open || !visible || mainTab !== 'campaign' || !campaignId || !playerId) return undefined;
    loadCampaign();
    const id = setInterval(loadCampaign, REFRESH_MS);
    return () => clearInterval(id);
  }, [open, visible, mainTab, campaignId, playerId, loadCampaign]);

  useEffect(() => {
    if (!visible) setOpen(false);
  }, [visible]);

  const compactViewport = useMapCornerCompactViewport();
  const openPanel = useCallback(() => {
    setOpen(true);
  }, []);
  useRegisterMapCornerEntryHandler('rank', visible && playerId ? openPanel : null);

  if (!visible || !playerId) return null;

  return (
    <>
      {!compactViewport ? (
        <button
          type="button"
          onClick={openPanel}
          style={mapCornerEntryRowBoxStyle}
          className={`fixed bottom-32 left-2 z-40 justify-start text-amber-300 ${MAP_CORNER_ENTRY_ROW_CLASS}`}
        >
          <span className="block w-full min-w-0 truncate text-left">🏆 排行</span>
        </button>
      ) : null}

      {open && (
        <div
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-3 bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="standing-rank-title"
          onClick={() => setOpen(false)}
        >
          {/* 与 CommPanel 展开态一致：bg-gray-900/95 + amber 边框，避免半透明看不清 */}
          <div
            className="w-[min(100%,24rem)] sm:w-[400px] flex flex-col rounded-lg shadow-lg overflow-hidden border border-amber-700/40 bg-gray-900/95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-1 px-2 py-2 bg-amber-800/80 shrink-0 border-b border-amber-700/30">
              <div className="flex items-center gap-1 min-w-0 flex-1 flex-wrap">
                <span id="standing-rank-title" className="text-sm font-bold text-amber-100 shrink-0 mr-0.5">
                  排行榜
                </span>
                <button
                  type="button"
                  onClick={() => setMainTab('overall')}
                  className={`px-2.5 py-1.5 rounded text-sm font-medium transition-colors shrink-0 ${
                    mainTab === 'overall'
                      ? 'bg-amber-600 text-white'
                      : 'text-amber-200/70 hover:text-amber-200'
                  }`}
                >
                  总体排名
                </button>
                <button
                  type="button"
                  onClick={() => setMainTab('campaign')}
                  className={`px-2.5 py-1.5 rounded text-sm font-medium transition-colors shrink-0 ${
                    mainTab === 'campaign'
                      ? 'bg-amber-600 text-white'
                      : 'text-amber-200/70 hover:text-amber-200'
                  }`}
                >
                  战役排名
                </button>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-1.5 py-1 text-amber-200/50 hover:text-amber-200 text-sm shrink-0"
              >
                ✕
              </button>
            </div>

            <div className={RANK_TAB_BODY_CLASS}>
              <div className={RANK_TOP_SLOT_CLASS}>
                {mainTab === 'overall' ? (
                  <>
                    <label className="block text-xs text-amber-200/70 mb-0.5">排行依据（主排序）</label>
                    <select
                      value={overallSort}
                      onChange={(e) => setOverallSort(e.target.value)}
                      className="w-full text-sm leading-snug bg-gray-800 border border-amber-700/40 rounded px-2 py-2 text-amber-100"
                    >
                      {OVERALL_SORT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <label className="block text-xs text-amber-200/70 mb-0.5">战役</label>
                    <select
                      value={campaignId}
                      onChange={(e) => setCampaignId(e.target.value)}
                      className="w-full text-sm leading-snug bg-gray-800 border border-amber-700/40 rounded px-2 py-2 text-amber-100"
                    >
                      {definitions.length === 0 && <option value="">加载中…</option>}
                      {definitions.map((d) => (
                        <option key={d.campaign_id} value={d.campaign_id}>
                          {formatCampaignDisplayName(d)}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              <div className={`${RANK_TAB_SCROLL_CLASS} px-2 py-1.5 bg-gray-950`}>
                {mainTab === 'overall' && (
                  <>
                    {loadingOverall && !overallData && (
                      <p className="text-sm text-amber-200/50 py-4 text-center">加载中…</p>
                    )}
                    {errorOverall && <p className="text-sm text-red-400/90 py-2">{errorOverall}</p>}
                    {overallData && (() => {
                      const activeSort = overallData.sort || overallSort;
                      return (
                        <div className="space-y-2">
                          <div className="overflow-x-auto -mx-0.5 px-0.5">
                            <div className="min-w-[20.5rem] grid grid-cols-[1.5rem_minmax(0,1fr)_3rem_3rem_3rem_3rem] gap-x-1 border-b border-amber-700/25 pb-1.5">
                              <span className="text-sm text-amber-200/90 font-semibold">#</span>
                              <span className="text-sm text-amber-200/90 font-semibold">玩家 / 势力</span>
                              <span className={overallMetricHeadClass('avg', activeSort)}>场均</span>
                              <span className={overallMetricHeadClass('wins', activeSort)}>胜场</span>
                              <span className={overallMetricHeadClass('reputation', activeSort)}>声望</span>
                              <span className={overallMetricHeadClass('events', activeSort)}>徽章</span>
                            </div>
                            {overallData.rankings?.map((row) => (
                              <div
                                key={row.playerId}
                                className="min-w-[20.5rem] grid grid-cols-[1.5rem_minmax(0,1fr)_3rem_3rem_3rem_3rem] gap-x-1 text-sm text-amber-100 border-b border-amber-800/40 pb-1.5"
                              >
                                <span className="tabular-nums text-amber-300 text-sm">
                                  {row.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank - 1] : row.rank}
                                </span>
                                <div className="min-w-0">
                                  <div className="truncate font-medium text-sm">{row.name}</div>
                                  <div className="truncate text-sm text-amber-200/65">
                                    {row.factionName || '—'}
                                  </div>
                                </div>
                                <span className={overallMetricCellClass('avg', activeSort)}>
                                  {formatInt(row.avgBattleScore)}
                                </span>
                                <span className={overallMetricCellClass('wins', activeSort)}>
                                  {formatInt(row.wins)}
                                </span>
                                <span className={overallMetricCellClass('reputation', activeSort)}>
                                  {formatInt(row.reputation)}
                                </span>
                                <span className={overallMetricCellClass('events', activeSort)}>
                                  {formatInt(overallBadgeCount(row))}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}

                {mainTab === 'campaign' && (
                  <>
                    {loadingCampaign && !campaignData && (
                      <p className="text-sm text-amber-200/50 py-4 text-center">加载中…</p>
                    )}
                    {errorCampaign && <p className="text-sm text-red-400/90 py-2">{errorCampaign}</p>}
                    {campaignData && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-[1.5rem_1fr_auto_auto] gap-x-1.5 text-sm text-amber-200/90 font-semibold border-b border-amber-700/25 pb-1.5">
                          <span>#</span>
                          <span>玩家</span>
                          <span className="text-right tabular-nums">分</span>
                          <span className="text-center w-7">档</span>
                        </div>
                        {campaignData.rankings?.map((row) => (
                          <div
                            key={row.playerId}
                            className="grid grid-cols-[1.5rem_1fr_auto_auto] gap-x-1.5 text-sm text-amber-100 border-b border-amber-800/40 pb-1.5"
                          >
                            <span className="tabular-nums text-amber-300 text-sm">
                              {row.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank - 1] : row.rank}
                            </span>
                            <div className="min-w-0">
                              <div className="truncate font-medium text-sm">{row.name}</div>
                              <div className="truncate text-sm text-amber-200/65">{row.factionName}</div>
                            </div>
                            <span className="text-right tabular-nums text-sm">{formatInt(row.bestScore)}</span>
                            <span
                              className={`text-center w-7 text-sm ${GRADE_TEXT[row.grade] || 'text-amber-200'}`}
                            >
                              {row.grade}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className={RANK_FOOTER_SLOT_CLASS}>
                <div className="text-sm text-amber-300 mb-1 font-semibold">我的排名</div>
                {mainTab === 'overall' && (
                  <>
                    {loadingOverall && !overallData && (
                      <p className="text-sm text-amber-200/45">加载中…</p>
                    )}
                    {overallData?.myRanking && !overallData.myRanking.eligible && (
                      <div className="text-sm text-amber-100/95 leading-snug">
                        <span className="text-amber-200 font-medium">{overallData.myRanking.name}</span>
                        <span className="text-amber-200/70 ml-1">
                          场次不足（需 ≥{overallData.minBattles} 场，当前{' '}
                          {formatInt(overallData.myRanking.totalBattles)}）
                        </span>
                        <div className="text-xs text-amber-200/65 mt-1 break-keep">
                          胜场 {formatInt(overallData.myRanking.wins)} · 声望{' '}
                          {formatInt(overallData.myRanking.reputation)} · 徽章{' '}
                          {formatInt(overallBadgeCount(overallData.myRanking))}
                        </div>
                      </div>
                    )}
                    {overallData?.myRanking?.eligible && (
                      <div className="text-sm text-amber-100/95 leading-snug space-y-1">
                        <div className="text-sm text-amber-200/70">
                          当前依据：
                          <span className="text-amber-300/90">
                            {OVERALL_SORT_LABEL[overallData.sort || overallSort] || '场均'}
                          </span>
                          {' · '}
                          参与排行 {formatInt(overallData.totalRankedPlayers)} 人
                        </div>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 items-baseline text-sm">
                          <span>
                            第 <strong className="text-amber-200">{overallData.myRanking.rank}</strong> 名
                          </span>
                          <span className="tabular-nums text-xs text-amber-200/65 break-keep">
                            场均 {formatInt(overallData.myRanking.avgBattleScore)} · 胜场{' '}
                            {formatInt(overallData.myRanking.wins)} · 声望{' '}
                            {formatInt(overallData.myRanking.reputation)} · 徽章{' '}
                            {formatInt(overallBadgeCount(overallData.myRanking))}
                          </span>
                        </div>
                      </div>
                    )}
                    {!loadingOverall && overallData && !overallData.myRanking && (
                      <p className="text-sm text-amber-200/45">—</p>
                    )}
                  </>
                )}
                {mainTab === 'campaign' && (
                  <>
                    {loadingCampaign && !campaignData && (
                      <p className="text-sm text-amber-200/45">加载中…</p>
                    )}
                    {campaignData?.myRanking?.challenged === false && (
                      <p className="text-sm text-amber-200/85">未挑战该战役</p>
                    )}
                    {campaignData?.myRanking?.challenged && (
                      <div className="text-sm text-amber-100/95 flex flex-wrap gap-x-2 gap-y-1 items-center leading-snug">
                        <span>
                          第 <strong className="text-amber-200">{campaignData.myRanking.rank}</strong> 名
                        </span>
                        <span className="tabular-nums text-sm">{formatInt(campaignData.myRanking.bestScore)} 分</span>
                        <span className={`text-sm ${GRADE_TEXT[campaignData.myRanking.grade] || ''}`}>
                          {campaignData.myRanking.grade}
                        </span>
                        <span className="text-xs text-amber-200/65">
                          共 {formatInt(campaignData.totalRankedPlayers)} 人上榜
                        </span>
                      </div>
                    )}
                    {!loadingCampaign && campaignData && !campaignData.myRanking && (
                      <p className="text-sm text-amber-200/45">—</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
