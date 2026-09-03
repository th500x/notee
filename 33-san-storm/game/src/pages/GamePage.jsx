/**
 * 游戏主页面
 * 
 * @description 移动端优先布局：TopStatusBar（窄屏约 4.5rem 双行 / sm+ 56px）+ 主内容区 + BottomTabNav(64px)
 *              activeTab=null 时显示大地图（颍川战略格网）
 * @route /san_1/game
 */

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayerProvider, usePlayerContext } from '@/contexts/PlayerContext';
import { StrategicMapNavigationProvider } from '@/contexts/StrategicMapNavigationContext';
import { MapHudVisibilityProvider, useMapHudVisibility } from '@/contexts/MapHudVisibilityContext';
import TopStatusBar from '@/components/game/TopStatusBar';
import { useSeasonSettlement } from '@/hooks/useSeasonSettlement';
import AnnouncementBar from '@/components/game/AnnouncementBar';
import RankingPanel from '@/components/game/RankingPanel';
import WorldMapStrategicMiniMapDock from '@/components/game/WorldMapStrategicMiniMapDock';
import BottomTabNav from '@/components/game/BottomTabNav';
import PersonalSidebar from '@/components/game/PersonalSidebar';
import GrantedTitleRevealFlow from '@/components/game/GrantedTitleRevealFlow';
import ChunkLoadFallback from '@/components/game/ChunkLoadFallback';
import { useCardPool } from '@/hooks/useCardPool';
import { loadSharedData } from '@/services/dataService';
import { useFactionBulletinUnread } from '@/hooks/useFactionBulletinUnread';
import { useClaimableAchievementNotify } from '@/hooks/useClaimableAchievementNotify';
import { useDailyReportCheckinNotify } from '@/hooks/useDailyReportCheckinNotify';
import { isGameIntroCompletedForPlayer, markGameIntroCompletedForPlayer } from '@/utils/gameIntroFlags';
import {
  destroyBgmService,
  ensureDefaultBgmScene,
  initBgmService,
  syncBgmEnabledFromStorage,
} from '@/services/bgmService';
import { MapCornerPlayerEntryActionsProvider } from '@/contexts/MapCornerPlayerEntryActionsContext';

const GameIntroOverlay = lazy(() => import('@/components/tutorial/GameIntroOverlay'));
const WorldMap = lazy(() => import('@/components/game/WorldMap'));
const LineupTab = lazy(() => import('@/components/game/tabs/LineupTab'));
const MainCityTab = lazy(() => import('@/components/game/tabs/MainCityTab'));
const FactionTab = lazy(() => import('@/components/game/tabs/FactionTab'));
const CommPanel = lazy(() => import('@/components/game/CommPanel'));
const StandingRankingsPanel = lazy(() => import('@/components/game/StandingRankingsPanel'));
const CardPoolDrawer = lazy(() => import('@/components/game/CardPoolDrawer'));
const ItemCardPoolDrawer = lazy(() => import('@/components/game/ItemCardPoolDrawer'));
const AttrRerollDrawer = lazy(() => import('@/components/game/AttrRerollDrawer'));
const DailyReportPanel = lazy(() => import('@/components/game/DailyReportPanel'));
const SeasonSettlementPortal = lazy(() => import('@/components/game/SeasonSettlementPortal'));

export default function GamePage({ user, onLogout }) {
  return (
    <PlayerProvider playerId={user?.id}>
      <StrategicMapNavigationProvider>
        <MapHudVisibilityProvider>
          <GamePageInner onLogout={onLogout} accountId={user?.id} />
        </MapHudVisibilityProvider>
      </StrategicMapNavigationProvider>
    </PlayerProvider>
  );
}

function GamePageInner({ onLogout, accountId }) {
  const { player, refresh, milestoneUnlockPending, clearMilestoneUnlockPending } =
    usePlayerContext();
  const { mapHudButtonsVisible, toggleMapHudButtons } = useMapHudVisibility();
  const playerId = player?.playerId;
  const factionBulletinUnread = useFactionBulletinUnread(playerId);
  const claimableAchievementNotify = useClaimableAchievementNotify(playerId);
  /** 与创角清 localStorage 的 id 一致；profile 加载前即可决定是否展示特色介绍 */
  const gameIntroStorageId = accountId || player?.playerId;

  const [activeTab, setActiveTab] = useState(null);
  const dailyReportNotifyDot = useDailyReportCheckinNotify(playerId, activeTab === null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [worldMapEventBusy, setWorldMapEventBusy] = useState(false);
  const eventBusy = worldMapEventBusy;

  /** `WorldMap` 卸载后不会再上报 busy；若此前为 true，会永远挡住底栏与部分浮层 */
  useEffect(() => {
    if (activeTab !== null) setWorldMapEventBusy(false);
  }, [activeTab]);

  useEffect(() => {
    initBgmService();
    syncBgmEnabledFromStorage();
    ensureDefaultBgmScene();
    return () => destroyBgmService();
  }, []);
  const [openPool, setOpenPool] = useState(null); // 'troop' | 'character' | 'item' | null
  const [openReroll, setOpenReroll] = useState(false);
  const [dailyReportOpen, setDailyReportOpen] = useState(false);
  const [seasonModalOpen, setSeasonModalOpen] = useState(false);
  // 赛季结算状态（顶栏入口/封档横幅/发放弹窗共用，单源轮询）
  const { status: seasonStatus, phase: seasonPhase, refresh: refreshSeason } = useSeasonSettlement(
    playerId,
    activeTab === null,
  );
  const seasonClaimPending = seasonPhase === 'apply_pending';
  /** 首屏拉取结算状态完成前暂不自动开教程事件，避免盖住待领取弹窗 */
  const seasonStatusPending = Boolean(playerId) && seasonStatus == null;
  const suppressExploreForSeason = seasonClaimPending || seasonStatusPending;
  const [skillsMap, setSkillsMap] = useState({});
  const navigate = useNavigate();

  /** 每位账号首次进大地图：特色九宫格；结束前阻塞教程链 IDLE 自动开局（首帧即按 localStorage 判定，避免教程抢先弹） */
  const [gameIntroOpen, setGameIntroOpen] = useState(() => {
    if (!accountId || typeof window === 'undefined') return false;
    return !isGameIntroCompletedForPlayer(accountId);
  });

  useEffect(() => {
    if (!gameIntroStorageId) {
      setGameIntroOpen(false);
      return;
    }
    setGameIntroOpen(!isGameIntroCompletedForPlayer(gameIntroStorageId));
  }, [gameIntroStorageId]);

  const handleGameIntroComplete = useCallback(() => {
    markGameIntroCompletedForPlayer(gameIntroStorageId);
    setGameIntroOpen(false);
  }, [gameIntroStorageId]);

  // 加载技能映射表（卡牌显示需要）
  useEffect(() => {
    loadSharedData('skills').then(data => {
      if (data?.skills) {
        const map = {};
        data.skills.forEach(s => { map[s.id] = s; });
        setSkillsMap(map);
      }
    }).catch(() => {});
  }, []);

  // 卡池 hook
  const cardPool = useCardPool(playerId);
  useEffect(() => {
    if (playerId) {
      cardPool.loadStatus();
    }
  }, [playerId]);

  const handleCloseToMap = () => setActiveTab(null);

  const handleLogout = () => {
    setSidebarOpen(false);
    onLogout?.();
    navigate('/san_1');
  };

  const renderTabContent = () => {
    const tabFallback = <ChunkLoadFallback label="页面加载中…" />;
    switch (activeTab) {
      case 'lineup':
        return (
          <Suspense fallback={tabFallback}>
            <LineupTab
              onClose={handleCloseToMap}
              onOpenAttributeReroll={() => setOpenReroll(true)}
            />
          </Suspense>
        );
      case 'city':
        return (
          <Suspense fallback={tabFallback}>
            <MainCityTab onClose={handleCloseToMap} />
          </Suspense>
        );
      case 'faction':
        return (
          <Suspense fallback={tabFallback}>
            <FactionTab onClose={handleCloseToMap} />
          </Suspense>
        );
      default:
        return null;
    }
  };

  return (
    <MapCornerPlayerEntryActionsProvider>
      {/* 全屏覆盖，脱离父级布局 */}
      <div className="fixed inset-0 z-[100] bg-stone-950">
        <TopStatusBar
          activeTab={activeTab}
          onOpenSidebar={() => setSidebarOpen(true)}
          mapHudButtonsVisible={mapHudButtonsVisible}
          onToggleMapHudButtons={toggleMapHudButtons}
          personalCenterNotifyDot={claimableAchievementNotify}
          onOpenDailyReport={() => setDailyReportOpen(true)}
          dailyReportNotifyDot={dailyReportNotifyDot}
          seasonSettlementEntryVisible={seasonPhase === 'window_open'}
          onOpenSeasonSettlement={() => setSeasonModalOpen(true)}
        />

        <main
          className={`absolute left-0 right-0 top-[4.5rem] sm:top-14 flex flex-col ${
            activeTab === null ? 'overflow-hidden' : 'overflow-y-auto'
          } ${
            eventBusy
              ? 'bottom-0'
              : 'bottom-[calc(4rem+env(safe-area-inset-bottom,0px))]'
          }`}
        >
          {/* 战略格网层：切底栏 Tab 时仅隐藏、不卸载，避免 tilePx/滚动/merged 重载导致比例跳变 */}
          <div
            className={`flex min-h-0 flex-1 flex-col ${activeTab !== null ? 'hidden' : ''}`}
            aria-hidden={activeTab !== null ? true : undefined}
          >
            <div className="pointer-events-none z-40 flex shrink-0 flex-col gap-1.5 px-3 pt-1 pb-1">
              <AnnouncementBar />
              <RankingPanel />
            </div>
            {/* pr-3：与上方公告/排行栏容器 px-3 右缘对齐，避免缩略图坞贴出屏边 */}
            <div className="flex min-h-0 flex-1 flex-row overflow-hidden pr-3">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <Suspense fallback={<ChunkLoadFallback label="大地图加载中…" />}>
                  <WorldMap
                    blockTutorialAutoplay={gameIntroOpen || suppressExploreForSeason}
                    suppressExploreUi={seasonClaimPending}
                    mapLayerVisible={activeTab === null}
                    onEventBusyChange={setWorldMapEventBusy}
                    sanGongFuCardPool={{
                      onOpenPool: setOpenPool,
                      drawerOpen: !!openPool,
                      troopRemaining: cardPool.status?.troop?.remainingDraws ?? '?',
                      charRemaining: cardPool.status?.character?.remainingDraws ?? '?',
                      itemRemaining: cardPool.status?.item?.remainingDraws ?? '?',
                      dailyLimit: cardPool.status?.troop?.dailyLimit ?? 2,
                    }}
                  />
                </Suspense>
              </div>
              <WorldMapStrategicMiniMapDock />
            </div>
          </div>
          {activeTab !== null ? (
            <div className="min-h-0 flex-1 overflow-y-auto">{renderTabContent()}</div>
          ) : null}
        </main>

        {!eventBusy && (
          <BottomTabNav
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabNotifyDots={{
              faction: factionBulletinUnread,
            }}
          />
        )}

        <PersonalSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLogout={handleLogout}
          claimableAchievementNotify={claimableAchievementNotify}
        />

        <Suspense fallback={null}>
          <DailyReportPanel
            open={dailyReportOpen}
            onClose={() => setDailyReportOpen(false)}
            playerId={playerId}
          />
        </Suspense>

        <GrantedTitleRevealFlow
          grants={milestoneUnlockPending?.titles}
          onComplete={clearMilestoneUnlockPending}
        />

        <StandingRankingsPanel
          visible={activeTab === null && !eventBusy && mapHudButtonsVisible}
          playerId={playerId}
        />
        <CommPanel visible={activeTab === null && !eventBusy && mapHudButtonsVisible} />
      </div>

      {/* 卡池抽屉（渲染在 pointer-events-none 容器外面） */}
      {openPool === 'item' ? (
        <Suspense fallback={null}>
          <ItemCardPoolDrawer
            status={cardPool.status}
            loading={cardPool.loading}
            drawResult={cardPool.drawResult}
            error={cardPool.error}
            playerSilver={player?.silver}
            onDraw={async (_poolSeason, drawMode = 'batch') => {
              const res = await cardPool.draw('item', null, drawMode);
              if (res?.success) {
                await refresh({ silent: true });
              }
            }}
            onClearResult={cardPool.clearResult}
            onClose={() => {
              setOpenPool(null);
              cardPool.clearResult();
            }}
            onRefreshStatus={cardPool.loadStatus}
          />
        </Suspense>
      ) : openPool ? (
        <Suspense fallback={null}>
          <CardPoolDrawer
            poolType={openPool}
            status={cardPool.status}
            loading={cardPool.loading}
            choiceLoading={cardPool.choiceLoading}
            drawResult={cardPool.drawResult}
            echoChoiceError={cardPool.echoChoiceError}
            error={cardPool.error}
            skillsMap={skillsMap}
            factionId={player?.factionId}
            playerSilver={player?.silver}
            onDraw={async (poolSeason, drawMode = 'batch') => {
              const res = await cardPool.draw(openPool, poolSeason, drawMode);
              if (
                res?.success &&
                (drawMode === 'batch' || drawMode === 'badge_batch' || !res?.echoChoiceRequired)
              ) {
                await refresh({ silent: true });
              }
            }}
            onResolveEchoChoice={cardPool.resolveEchoChoice}
            onAfterEchoChoice={async () => {
              await refresh({ silent: true });
            }}
            onClearResult={cardPool.clearResult}
            onResumePendingEcho={cardPool.resumePendingEcho}
            onClose={() => { setOpenPool(null); cardPool.clearResult(); }}
            onRefreshStatus={cardPool.loadStatus}
          />
        </Suspense>
      ) : null}

      {openReroll && playerId ? (
        <Suspense fallback={null}>
          <AttrRerollDrawer
            playerId={playerId}
            playerName={player?.characterName}
            skillsMap={skillsMap}
            onClose={() => {
              setOpenReroll(false);
              refresh();
            }}
            onConfirm={() => refresh()}
          />
        </Suspense>
      ) : null}

      {gameIntroOpen && gameIntroStorageId ? (
        <Suspense fallback={null}>
          <GameIntroOverlay onComplete={handleGameIntroComplete} />
        </Suspense>
      ) : null}

      {playerId ? (
        <Suspense fallback={null}>
          <SeasonSettlementPortal
            playerId={playerId}
            status={seasonStatus}
            modalOpen={seasonModalOpen}
            onModalOpenChange={setSeasonModalOpen}
            onRefresh={refreshSeason}
          />
        </Suspense>
      ) : null}
      </MapCornerPlayerEntryActionsProvider>
  );
}
