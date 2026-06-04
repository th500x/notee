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
import TopStatusBar from '@/components/game/TopStatusBar';
import AnnouncementBar from '@/components/game/AnnouncementBar';
import RankingPanel from '@/components/game/RankingPanel';
import BottomTabNav from '@/components/game/BottomTabNav';
import PersonalSidebar from '@/components/game/PersonalSidebar';
import ChunkLoadFallback from '@/components/game/ChunkLoadFallback';
import RoadEncounterDefenseRoot from '@/components/game/RoadEncounterDefenseRoot';
import UpdateNoticeFullScreenOverlay from '@/components/game/UpdateNoticeFullScreenOverlay';
import { useCardPool } from '@/hooks/useCardPool';
import { loadSharedData } from '@/services/dataService';
import { getActiveUpdateNotice } from '@/data/texts/updateAnnouncements';
import { shouldShowUpdateNotice, dismissUpdateNotice } from '@/utils/updateNoticeLogic';
import { useFactionBulletinUnread } from '@/hooks/useFactionBulletinUnread';
import { isGameIntroCompletedForPlayer, markGameIntroCompletedForPlayer } from '@/utils/gameIntroFlags';

const GameIntroOverlay = lazy(() => import('@/components/tutorial/GameIntroOverlay'));
const WorldMap = lazy(() => import('@/components/game/WorldMap'));
const LineupTab = lazy(() => import('@/components/game/tabs/LineupTab'));
const MainCityTab = lazy(() => import('@/components/game/tabs/MainCityTab'));
const FactionTab = lazy(() => import('@/components/game/tabs/FactionTab'));
const WorldMapTab = lazy(() => import('@/components/game/tabs/WorldMapTab'));
const CommPanel = lazy(() => import('@/components/game/CommPanel'));
const StandingRankingsPanel = lazy(() => import('@/components/game/StandingRankingsPanel'));
const KingEdictPanel = lazy(() => import('@/components/game/KingEdictPanel'));
const CardPoolDrawer = lazy(() => import('@/components/game/CardPoolDrawer'));
const CampaignCenterPanel = lazy(() => import('@/components/game/CampaignCenterPanel'));
const AttrRerollDrawer = lazy(() => import('@/components/game/AttrRerollDrawer'));
const JunCountyQuadPreviewPanel = lazy(() => import('@/components/game/JunCountyQuadPreviewPanel'));

export default function GamePage({ user, onLogout }) {
  return (
    <PlayerProvider playerId={user?.id}>
      <StrategicMapNavigationProvider>
        <GamePageInner onLogout={onLogout} accountId={user?.id} />
      </StrategicMapNavigationProvider>
    </PlayerProvider>
  );
}

function GamePageInner({ onLogout, accountId }) {
  const { player, refresh } = usePlayerContext();
  const playerId = player?.playerId;
  const factionBulletinUnread = useFactionBulletinUnread(playerId);
  /** 与创角清 localStorage 的 id 一致；profile 加载前即可决定是否展示特色介绍 */
  const gameIntroStorageId = accountId || player?.playerId;

  const [activeTab, setActiveTab] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [worldMapEventBusy, setWorldMapEventBusy] = useState(false);
  const [roadDefenseLayerBusy, setRoadDefenseLayerBusy] = useState(false);
  const eventBusy = worldMapEventBusy || roadDefenseLayerBusy;

  /** `WorldMap` 卸载后不会再上报 busy；若此前为 true，会永远挡住底栏与部分浮层 */
  useEffect(() => {
    if (activeTab !== null) setWorldMapEventBusy(false);
  }, [activeTab]);
  const [openPool, setOpenPool] = useState(null); // 'troop' | 'character' | null
  const [openReroll, setOpenReroll] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [junQuadPreviewOpen, setJunQuadPreviewOpen] = useState(false);
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

  const activeUpdateNotice = getActiveUpdateNotice();
  const [updateNoticeOpen, setUpdateNoticeOpen] = useState(() => {
    const n = getActiveUpdateNotice();
    return !!(n && shouldShowUpdateNotice(n));
  });

  const handleDismissUpdateNotice = useCallback(() => {
    const n = getActiveUpdateNotice();
    if (n) dismissUpdateNotice(n);
    setUpdateNoticeOpen(false);
  }, []);

  const recheckUpdateNoticeOpen = useCallback(() => {
    const n = getActiveUpdateNotice();
    if (n && shouldShowUpdateNotice(n)) setUpdateNoticeOpen(true);
  }, []);

  // 从子 Tab 回到大地图、或浏览器页签回到前台且当前在大地图时，按存储规则再次尝试弹出（含「同 id 正文已变更」）
  useEffect(() => {
    if (activeTab !== null) return;
    recheckUpdateNoticeOpen();
  }, [activeTab, recheckUpdateNoticeOpen]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      if (activeTab !== null) return;
      recheckUpdateNoticeOpen();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [activeTab, recheckUpdateNoticeOpen]);

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
      case 'map':
        return (
          <Suspense fallback={tabFallback}>
            <WorldMapTab onClose={handleCloseToMap} />
          </Suspense>
        );
      default:
        return null;
    }
  };

  return (
    <RoadEncounterDefenseRoot onBusyChange={setRoadDefenseLayerBusy}>
      {/* 全屏覆盖，脱离父级布局 */}
      <div className="fixed inset-0 z-[100] bg-stone-950">
        <TopStatusBar
          activeTab={activeTab}
          onOpenSidebar={() => setSidebarOpen(true)}
          onOpenCampaignCenter={() => setCampaignOpen(true)}
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
          {activeTab === null ? (
            <div className="flex min-h-0 flex-1 flex-col">
              {/* 与 eventBusy 勿用两套分支挂 WorldMap：否则 busy 切换会卸载/重挂大地图，merged 重拉 →「大地图加载中」与格网交替闪烁 */}
              {/* 公告/排行条不因 eventBusy 隐藏：否则 busy 结束时顶栏突然出现，大地图 event_hint（portal 锚点）与路点错位 */}
              <div className="pointer-events-none z-40 flex shrink-0 flex-col gap-1.5 px-3 pt-1 pb-1">
                <AnnouncementBar />
                <RankingPanel />
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <Suspense fallback={<ChunkLoadFallback label="大地图加载中…" />}>
                  <WorldMap
                    blockTutorialAutoplay={
                      gameIntroOpen || (!!activeUpdateNotice && updateNoticeOpen)
                    }
                    onEventBusyChange={setWorldMapEventBusy}
                    sanGongFuCardPool={{
                      onOpenPool: setOpenPool,
                      drawerOpen: !!openPool,
                      troopRemaining: cardPool.status?.troop?.remainingDraws ?? '?',
                      charRemaining: cardPool.status?.character?.remainingDraws ?? '?',
                      dailyLimit: cardPool.status?.troop?.dailyLimit ?? 10,
                    }}
                  />
                </Suspense>
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">{renderTabContent()}</div>
          )}
        </main>

        {!eventBusy && (
          <BottomTabNav
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabNotifyDots={{ faction: factionBulletinUnread }}
          />
        )}

        <PersonalSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLogout={handleLogout}
        />

        <KingEdictPanel
          visible={activeTab === null && !eventBusy}
          playerId={playerId}
          factionId={player?.factionId}
        />
        <StandingRankingsPanel visible={activeTab === null && !eventBusy} playerId={playerId} />
        <CommPanel visible={activeTab === null && !eventBusy} />
      </div>

      {/* 卡池抽屉（渲染在 pointer-events-none 容器外面） */}
      {openPool ? (
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
            onDraw={async (poolSeason) => {
              const res = await cardPool.draw(openPool, poolSeason);
              if (!res?.echoChoiceRequired) {
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

      {playerId ? (
        <Suspense fallback={null}>
          <CampaignCenterPanel
            playerId={playerId}
            open={campaignOpen}
            onClose={() => setCampaignOpen(false)}
            onClaimed={refresh}
          />
        </Suspense>
      ) : null}

      {activeTab === null && !eventBusy && (
        <button
          type="button"
          className="fixed bottom-20 right-3 z-[95] px-3 py-2 rounded-lg text-xs font-medium shadow-lg bg-amber-700/90 hover:bg-amber-600 text-white border border-amber-500/50"
          onClick={() => setJunQuadPreviewOpen(true)}
        >
          郡象限测试
        </button>
      )}

      {junQuadPreviewOpen ? (
        <Suspense fallback={null}>
          <JunCountyQuadPreviewPanel onClose={() => setJunQuadPreviewOpen(false)} />
        </Suspense>
      ) : null}

      {activeTab === null &&
        activeUpdateNotice &&
        updateNoticeOpen &&
        !gameIntroOpen && (
          <UpdateNoticeFullScreenOverlay
            notice={activeUpdateNotice}
            onDismiss={handleDismissUpdateNotice}
          />
        )}

      {gameIntroOpen && gameIntroStorageId ? (
        <Suspense fallback={null}>
          <GameIntroOverlay onComplete={handleGameIntroComplete} />
        </Suspense>
      ) : null}
    </RoadEncounterDefenseRoot>
  );
}
