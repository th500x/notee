/**
 * 大城/中城「三公府」全屏：官职 · 朝政（朝贡 + 封赏卡池入口）· 军团/公告占位
 */

import { useCallback, useEffect, useState, useMemo } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { playerAPI } from '@/services/playerApi';
import PositionCard from '@shared/components/card/PositionCard';
import LineupDetailCardScale from '@shared/components/card/LineupDetailCardScale.jsx';
import LineupCardDetailPanel from '@shared/components/card/LineupCardDetailPanel.jsx';
import TabSubNav from '@/components/game/TabSubNav';
import QuadrantGrid from '@/components/game/QuadrantGrid';
import { TabPageCloseButton, useGameTabLandscape } from '@/components/game/TabPageCloseAffordance';
import SanGongTributePanel from '@/components/game/SanGongTributePanel';
import SanGongFuFengShangPanel from '@/components/game/SanGongFuFengShangPanel';

const MAIN_TABS = [
  { id: 'position', label: '官职' },
  { id: 'court', label: '朝政' },
  { id: 'legion', label: '军团' },
  { id: 'notice', label: '公告' },
];

function PlaceholderCell({ text }) {
  return (
    <div className="flex h-full min-h-[6rem] flex-col items-center justify-center rounded-lg bg-stone-900/40 px-2 text-center">
      <div className="text-2xl opacity-30">🏛️</div>
      <p className="mt-2 text-xs text-stone-500">{text}</p>
    </div>
  );
}

function PromotionListBody({
  loading,
  error,
  notice,
  positions,
  playerReputation,
  promotingId,
  onPromote,
  /** 与 SanGongFuPanel 一致：宽≥768 且宽>高时为横屏象限布局 */
  layoutLandscape,
}) {
  const [detailRow, setDetailRow] = useState(null);

  const detailSubtitle = useMemo(() => {
    if (!detailRow) return null;
    const need = detailRow.requirementReputation;
    const holder = detailRow.occupiedByCharacterName;
    const can = detailRow.canPromote && !promotingId;
    if (can) return null;
    return (
      <>
        {need > 0 ? (
          <div>
            需声望 ≥ {need}（当前 {playerReputation}）
          </div>
        ) : null}
        {holder ? (
          <div>
            当前担任：<span className="font-medium text-amber-400/90">{holder}</span>
          </div>
        ) : null}
        {detailRow.isSelfOccupant ? <div className="text-emerald-500/90">您已担任此官职</div> : null}
        {!detailRow.reputationOk && !holder && !detailRow.isSelfOccupant ? (
          <div className="text-stone-500">声望不足，无法晋级</div>
        ) : null}
      </>
    );
  }, [detailRow, playerReputation, promotingId]);

  if (loading) {
    return <p className="py-6 text-center text-sm text-stone-500">加载中…</p>;
  }
  if (error) {
    return <p className="py-6 text-center text-sm text-red-400/90">{error}</p>;
  }
  if (notice) {
    return <p className="py-6 text-center text-sm text-amber-400/90">{notice}</p>;
  }
  if (!positions || positions.length === 0) {
    return <p className="py-6 text-center text-sm text-stone-500">暂无可展示官职</p>;
  }

  const openDetail = (row) => setDetailRow(row);

  const tiles = positions.map((row) => {
    const pos = row.position;
    return (
      <div
        key={row.positionId}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openDetail(row);
          }
        }}
        style={{ width: 128, height: 192 }}
        className="cursor-pointer overflow-hidden rounded-lg border-2 border-stone-700/60 transition-colors hover:border-amber-700/50 active:scale-[0.98]"
        onClick={() => openDetail(row)}
      >
        <div
          style={{
            width: 256,
            transform: 'scale(0.5)',
            transformOrigin: 'top left',
          }}
        >
          <PositionCard position={pos} showDetails />
        </div>
      </div>
    );
  });

  const detailCanClick = detailRow?.canPromote && !promotingId;
  const detailOverlay =
    detailRow != null ? (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70"
        onClick={() => setDetailRow(null)}
      >
        <LineupCardDetailPanel
          onClick={(e) => e.stopPropagation()}
          title="卡牌详情"
          headerRight={
            <button
              type="button"
              onClick={() => setDetailRow(null)}
              className="text-stone-400 hover:text-white"
            >
              ✕
            </button>
          }
          subtitle={detailSubtitle}
          footer={
            <button
              type="button"
              disabled={!detailCanClick}
              onClick={async () => {
                const ok = await onPromote(detailRow.positionId);
                if (ok) setDetailRow(null);
              }}
              className={`w-full rounded-lg border py-2 text-sm font-bold transition-colors ${
                detailCanClick
                  ? 'border-amber-700/50 bg-amber-900/50 text-amber-300 hover:bg-amber-800/50'
                  : 'cursor-not-allowed border-stone-600 bg-stone-800/60 text-stone-500 opacity-50'
              }`}
            >
              {promotingId === detailRow.positionId ? '处理中…' : '晋级'}
            </button>
          }
        >
          <LineupDetailCardScale>
            <PositionCard position={detailRow.position} showDetails />
          </LineupDetailCardScale>
        </LineupCardDetailPanel>
      </div>
    ) : null;

  const tileGrid = <div className="flex flex-wrap gap-2">{tiles}</div>;

  if (layoutLandscape) {
    return (
      <div className="flex h-full min-h-0 flex-col pb-2">
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5">
          {tileGrid}
        </div>
        {detailOverlay}
      </div>
    );
  }

  return (
    <div className="pb-4">
      {tileGrid}
      {detailOverlay}
    </div>
  );
}

export default function SanGongFuPanel({
  cityName = '城池',
  onClose,
  onPromoted,
  /** 封赏区卡池：由 `GamePage` 注入 `setOpenPool` 与 `useCardPool` 状态 */
  sanGongFuCardPool,
}) {
  const { player, refresh } = usePlayerContext();
  const isLandscape = useGameTabLandscape();
  const [activeTab, setActiveTab] = useState('position');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);
  const [promotingId, setPromotingId] = useState(null);

  const load = useCallback(async () => {
    if (!player?.player_id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await playerAPI.getSanGongFuPromotions(player.player_id);
      if (res.success) {
        setPayload(res.data);
      } else {
        setError(res.error || '加载失败');
        setPayload(null);
      }
    } catch (e) {
      setError(e?.message || '加载失败');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [player?.player_id]);

  useEffect(() => {
    load();
  }, [load]);

  const onPromote = useCallback(
    async (positionId) => {
      if (!player?.player_id || !positionId) return false;
      setPromotingId(positionId);
      setError(null);
      try {
        const res = await playerAPI.promoteSanGongFu(player.player_id, positionId);
        if (res.success && res.data) {
          onPromoted?.(res.data);
          await refresh({ silent: true });
          await load();
          return true;
        }
        setError(res.error || '晋升失败');
        return false;
      } catch (e) {
        setError(e?.message || '晋升失败');
        return false;
      } finally {
        setPromotingId(null);
      }
    },
    [player?.player_id, refresh, load, onPromoted],
  );

  const notice = payload?.notice;
  const positions = payload?.positions || [];
  const playerReputation = payload?.playerReputation ?? 0;

  const promotionBody = (
    <PromotionListBody
      loading={loading}
      error={error}
      notice={notice}
      positions={positions}
      playerReputation={playerReputation}
      promotingId={promotingId}
      onPromote={onPromote}
      layoutLandscape={isLandscape}
    />
  );

  /** 横屏四象限已同时展示四分区，不再用 Tab 切换；象限标题即分区名 */
  const courtBody = (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
      {/* flex 列 + min-h-0：让子面板获得确定高度，内部 overflow-y-auto 才能滚动完整卡面 */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-amber-900/20 bg-stone-950/30 p-1">
        <SanGongTributePanel />
      </div>
      {sanGongFuCardPool?.onOpenPool ? (
        <SanGongFuFengShangPanel
          onOpenPool={sanGongFuCardPool.onOpenPool}
          drawerOpen={!!sanGongFuCardPool.drawerOpen}
          troopRemaining={sanGongFuCardPool.troopRemaining ?? '?'}
          charRemaining={sanGongFuCardPool.charRemaining ?? '?'}
          dailyLimit={sanGongFuCardPool.dailyLimit ?? 5}
        />
      ) : (
        <div className="shrink-0 rounded-lg border border-stone-700/40 bg-stone-900/30 px-2 py-2 text-center">
          <div className="text-[10px] font-semibold text-stone-500">封赏</div>
          <p className="mt-1 text-[10px] text-stone-600">卡池入口未连接（需从游戏主壳注入）</p>
        </div>
      )}
    </div>
  );

  const landscapeCells = [
    { id: 'sg-q1', title: '官职 · 晋级', content: promotionBody },
    { id: 'sg-q2', title: '朝政', content: courtBody },
    { id: 'sg-q3', title: '军团', content: <PlaceholderCell text="敬请期待" /> },
    { id: 'sg-q4', title: '公告', content: <PlaceholderCell text="敬请期待" /> },
  ];

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900">
      <div className="flex shrink-0 items-stretch border-b border-amber-900/50 bg-stone-900/90">
        <div className="min-w-0 flex-1 px-3 py-2 text-left">
          <div className="text-sm font-bold text-amber-400/95">三公府</div>
          <div className="truncate text-[10px] text-stone-500">🏯 {cityName}</div>
        </div>
        <TabPageCloseButton onClose={onClose} variant="bar" />
      </div>

      {!isLandscape ? (
        <TabSubNav
          tabs={MAIN_TABS}
          activeTabId={activeTab}
          onTabChange={(id) => setActiveTab(id)}
          hideClose
        />
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden">
        {isLandscape ? (
          <div className="h-full min-h-0 p-1">
            <QuadrantGrid cells={landscapeCells} />
          </div>
        ) : (
          <div className="h-full min-h-0 overflow-y-auto px-2 pt-2">
            {activeTab === 'position' ? (
              promotionBody
            ) : activeTab === 'court' ? (
              courtBody
            ) : (
              <PlaceholderCell text="该分区敬请期待" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
