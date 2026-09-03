/**
 * 大城/中城「三公府」全屏：官职 · 互动 · 军团 · 朝政（横屏四象限同序；竖屏 Tab 同序）
 * 势力公告（谕旨/文书/战事）见大地图底栏「势力」Tab · 公告象限。
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
import SanGongFuChaoZhengPanel from '@/components/game/SanGongFuChaoZhengPanel';
import SanGongFuLegionPanel from '@/components/game/SanGongFuLegionPanel';
import SanGongFuFactionWarDrawer from '@/components/game/SanGongFuFactionWarDrawer';
import SanGongFuFactionPolicyDrawer from '@/components/game/SanGongFuFactionPolicyDrawer';
const MAIN_TABS = [
  { id: 'position', label: '官职' },
  { id: 'interaction', label: '互动' },
  { id: 'legion', label: '军团' },
  { id: 'court', label: '朝政' },
];

/** 与 `SanGongTributePanel` 朝贡说明条同源样式（border / 背景 / 标题琥珀色 + 正文 text-[10px] text-stone-400） */
const POSITION_REROLL_HINT_BOX = (
  <div className="mb-2 shrink-0 rounded-lg border border-amber-900/25 bg-stone-900/40 px-2 py-2">
    <div className="text-xs font-semibold text-amber-500/95">说明</div>
    <p className="mt-1 break-words text-[10px] leading-snug text-stone-400">
      官职属性重随请进入上阵编组界面-点击官职卡牌-点击属性重随按钮
    </p>
  </div>
);

const PEER_SWITCH_POLL_MS = 1000;

function formatRemainingMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function PromotionListBody({
  loading,
  error,
  notice,
  positions,
  sameLevelPositions,
  peerSwitchCooldown,
  playerReputation,
  promotingId,
  onPromote,
  onSwitch,
  /** 与 SanGongFuPanel 一致：宽≥768 且宽>高时为横屏象限布局 */
  layoutLandscape,
}) {
  const [detailRow, setDetailRow] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const peerCdMs = useMemo(() => {
    const at = peerSwitchCooldown?.nextEligibleAt
      ? new Date(peerSwitchCooldown.nextEligibleAt).getTime()
      : null;
    if (!Number.isFinite(at) || at <= nowTick) return 0;
    return at - nowTick;
  }, [peerSwitchCooldown?.nextEligibleAt, nowTick]);

  const peerCdActive = peerCdMs > 0;

  useEffect(() => {
    if (!peerCdActive) return undefined;
    const id = window.setInterval(() => setNowTick(Date.now()), PEER_SWITCH_POLL_MS);
    return () => window.clearInterval(id);
  }, [peerCdActive]);

  const detailSubtitle = useMemo(() => {
    if (!detailRow) return null;
    const need = detailRow.requirementReputation;
    const holder = detailRow.occupiedByCharacterName;
    const isSwitch = detailRow.actionKind === 'switch';
    const can = isSwitch
      ? detailRow.canSwitch && !promotingId
      : detailRow.canPromote && !promotingId;
    if (can) return null;
    return (
      <>
        {isSwitch && peerCdActive ? (
          <div className="text-amber-500/90">
            切换冷却中（{formatRemainingMs(peerCdMs)}）
          </div>
        ) : null}
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
          <div className="text-stone-500">{isSwitch ? '声望不足，无法切换' : '声望不足，无法晋级'}</div>
        ) : null}
      </>
    );
  }, [detailRow, playerReputation, promotingId, peerCdActive, peerCdMs]);

  if (loading) {
    return <p className="py-6 text-center text-sm text-stone-500">加载中…</p>;
  }
  if (error) {
    return <p className="py-6 text-center text-sm text-red-400/90">{error}</p>;
  }
  const hasPromoteRows = positions && positions.length > 0;
  const hasPeerRows = sameLevelPositions && sameLevelPositions.length > 0;

  if (notice && !hasPromoteRows && !hasPeerRows) {
    return <p className="py-6 text-center text-sm text-amber-400/90">{notice}</p>;
  }
  const openDetail = (row, actionKind) => setDetailRow({ ...row, actionKind });

  const renderTiles = (rows, actionKind) =>
    (rows || []).map((row) => {
      const pos = row.position;
      return (
        <div
          key={`${actionKind}-${row.positionId}`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openDetail(row, actionKind);
            }
          }}
          style={{ width: 128, height: 192 }}
          className="cursor-pointer overflow-hidden rounded-lg border-2 border-stone-700/60 transition-colors hover:border-amber-700/50 active:scale-[0.98]"
          onClick={() => openDetail(row, actionKind)}
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

  const promoteTiles = renderTiles(positions, 'promote');
  const peerTiles = renderTiles(sameLevelPositions, 'switch');

  const detailIsSwitch = detailRow?.actionKind === 'switch';
  const detailCanClick = detailIsSwitch
    ? detailRow?.canSwitch && !promotingId
    : detailRow?.canPromote && !promotingId;
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
                const handler = detailIsSwitch ? onSwitch : onPromote;
                const ok = await handler(detailRow.positionId);
                if (ok) setDetailRow(null);
              }}
              className={`w-full rounded-lg border py-2 text-sm font-bold transition-colors ${
                detailCanClick
                  ? 'border-amber-700/50 bg-amber-900/50 text-amber-300 hover:bg-amber-800/50'
                  : 'cursor-not-allowed border-stone-600 bg-stone-800/60 text-stone-500 opacity-50'
              }`}
            >
              {promotingId === detailRow.positionId
                ? '处理中…'
                : detailIsSwitch
                  ? '切换担任'
                  : '晋级'}
            </button>
          }
        >
          <LineupDetailCardScale>
            <PositionCard position={detailRow.position} showDetails />
          </LineupDetailCardScale>
        </LineupCardDetailPanel>
      </div>
    ) : null;

  const hasPromote = hasPromoteRows;
  const hasPeer = hasPeerRows;

  const listMain = (
    <>
      {POSITION_REROLL_HINT_BOX}
      {notice && hasPeer && !hasPromote ? (
        <p className="mb-2 text-center text-xs text-amber-400/80">{notice}</p>
      ) : null}
      {!hasPromote && !hasPeer ? (
        <p className="py-6 text-center text-sm text-stone-500">
          {notice || '暂无可展示官职'}
        </p>
      ) : null}
      {hasPromote ? (
        <div className="mb-3">
          <div className="mb-2 text-xs font-semibold text-amber-500/95">晋级（下一品阶）</div>
          <div className="flex flex-wrap gap-2">{promoteTiles}</div>
        </div>
      ) : null}
      {hasPeer ? (
        <div>
          <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-xs font-semibold text-amber-500/95">同级切换</span>
            {peerCdActive ? (
              <span className="text-[10px] text-amber-500/90">
                冷却中（{formatRemainingMs(peerCdMs)}）
              </span>
            ) : (
              <span className="text-[10px] text-stone-500">空席可切换 · 每日限 1 次（24h CD）</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">{peerTiles}</div>
        </div>
      ) : null}
    </>
  );

  if (layoutLandscape) {
    return (
      <div className="flex h-full min-h-0 flex-col pb-2">
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5">
          {listMain}
        </div>
        {detailOverlay}
      </div>
    );
  }

  return (
    <div className="pb-4">
      {listMain}
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
  const [factionWarDrawerOpen, setFactionWarDrawerOpen] = useState(false);
  const [factionPolicyDrawerOpen, setFactionPolicyDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!player?.playerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await playerAPI.getSanGongFuPromotions(player.playerId);
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
  }, [player?.playerId]);

  useEffect(() => {
    load();
  }, [load]);

  const onPromote = useCallback(
    async (positionId) => {
      if (!player?.playerId || !positionId) return false;
      setPromotingId(positionId);
      setError(null);
      try {
        const res = await playerAPI.promoteSanGongFu(player.playerId, positionId);
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
    [player?.playerId, refresh, load, onPromoted],
  );

  const onSwitchPeer = useCallback(
    async (positionId) => {
      if (!player?.playerId || !positionId) return false;
      setPromotingId(positionId);
      setError(null);
      try {
        const res = await playerAPI.switchSanGongFuPeerPosition(player.playerId, positionId);
        if (res.success && res.data) {
          onPromoted?.(res.data);
          await refresh({ silent: true });
          await load();
          return true;
        }
        setError(res.error || '切换失败');
        return false;
      } catch (e) {
        setError(e?.message || '切换失败');
        return false;
      } finally {
        setPromotingId(null);
      }
    },
    [player?.playerId, refresh, load, onPromoted],
  );

  const notice = payload?.notice;
  const positions = payload?.positions || [];
  const sameLevelPositions = payload?.sameLevelPositions || [];
  const peerSwitchCooldown = payload?.peerSwitchCooldown || null;
  const playerReputation = payload?.playerReputation ?? 0;
  /** 与晋升接口同源，避免档案字段滞后；口径同卡牌「品阶 Lv」（数字越小品阶越高） */
  const playerPositionLevel =
    payload?.playerPositionLevel ?? player?.positionLevel;

  const promotionBody = (
    <PromotionListBody
      loading={loading}
      error={error}
      notice={notice}
      positions={positions}
      sameLevelPositions={sameLevelPositions}
      peerSwitchCooldown={peerSwitchCooldown}
      playerReputation={playerReputation}
      promotingId={promotingId}
      onPromote={onPromote}
      onSwitch={onSwitchPeer}
      layoutLandscape={isLandscape}
    />
  );

  /** 横屏四象限已同时展示四分区，不再用 Tab 切换；象限标题即分区名 */
  const courtBody = (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto">
      <div className="shrink-0 rounded-lg border border-amber-900/20 bg-stone-950/30 p-1">
        <SanGongTributePanel />
      </div>
      {sanGongFuCardPool?.onOpenPool ? (
        <SanGongFuFengShangPanel
          onOpenPool={sanGongFuCardPool.onOpenPool}
          drawerOpen={!!sanGongFuCardPool.drawerOpen}
          troopRemaining={sanGongFuCardPool.troopRemaining ?? '?'}
          charRemaining={sanGongFuCardPool.charRemaining ?? '?'}
          itemRemaining={sanGongFuCardPool.itemRemaining ?? '?'}
          dailyLimit={sanGongFuCardPool.dailyLimit ?? 2}
          playerId={player?.playerId}
          onAfterStipendClaim={() => refresh({ silent: true })}
        />
      ) : (
        <div className="shrink-0 rounded-lg border border-stone-700/40 bg-stone-900/30 px-2 py-2 text-center">
          <div className="text-[10px] font-semibold text-stone-500">封赏</div>
          <p className="mt-1 text-[10px] text-stone-600">卡池入口未连接（需从游戏主壳注入）</p>
        </div>
      )}
    </div>
  );

  const chaoZhengBody = (
    <SanGongFuChaoZhengPanel
      playerId={player?.playerId}
      positionLevel={playerPositionLevel}
      factionWarDrawerOpen={factionWarDrawerOpen}
      onOpenFactionWars={() => setFactionWarDrawerOpen(true)}
      factionPolicyDrawerOpen={factionPolicyDrawerOpen}
      onOpenFactionPolicies={() => setFactionPolicyDrawerOpen(true)}
    />
  );

  const legionBody = (
    <SanGongFuLegionPanel positionLevel={playerPositionLevel} />
  );

  const landscapeCells = [
    { id: 'sg-q1', title: '官职 · 晋级', content: promotionBody },
    { id: 'sg-q2', title: '互动', content: courtBody },
    { id: 'sg-q3', title: '军团', content: legionBody },
    { id: 'sg-q4', title: '朝政', content: chaoZhengBody },
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
            ) : activeTab === 'interaction' ? (
              courtBody
            ) : activeTab === 'legion' ? (
              legionBody
            ) : (
              chaoZhengBody
            )}
          </div>
        )}
      </div>

      {player?.playerId ? (
        <SanGongFuFactionWarDrawer
          playerId={player.playerId}
          factionId={player.factionId ?? null}
          player={player}
          open={factionWarDrawerOpen}
          onClose={() => setFactionWarDrawerOpen(false)}
          onWarEnded={() => refresh({ silent: true })}
        />
      ) : null}

      {player?.playerId ? (
        <SanGongFuFactionPolicyDrawer
          factionId={player.factionId ?? null}
          player={player}
          open={factionPolicyDrawerOpen}
          onClose={() => setFactionPolicyDrawerOpen(false)}
        />
      ) : null}
    </div>
  );
}
