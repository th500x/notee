/**
 * 游戏主页面
 * 
 * @description 移动端优先布局：TopStatusBar（窄屏约 4.5rem 双行 / sm+ 56px）+ 主内容区 + BottomTabNav(64px)
 *              activeTab=null 时显示大地图（背景图）
 * @route /san_1/game
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayerProvider, usePlayerContext } from '@/contexts/PlayerContext';
import { StrategicMapNavigationProvider } from '@/contexts/StrategicMapNavigationContext';
import TopStatusBar from '@/components/game/TopStatusBar';
import AnnouncementBar from '@/components/game/AnnouncementBar';
import RankingPanel from '@/components/game/RankingPanel';
import BottomTabNav from '@/components/game/BottomTabNav';
import PersonalSidebar from '@/components/game/PersonalSidebar';
import CommPanel from '@/components/game/CommPanel';
import StandingRankingsPanel from '@/components/game/StandingRankingsPanel';
import CardPoolEntry from '@/components/game/CardPoolEntry';
import CardPoolDrawer from '@/components/game/CardPoolDrawer';
import CampaignCenterPanel from '@/components/game/CampaignCenterPanel';
import AttrRerollDrawer from '@/components/game/AttrRerollDrawer';
import { useCardPool } from '@/hooks/useCardPool';
import { loadSharedData } from '@/services/dataService';
import LineupTab from '@/components/game/tabs/LineupTab';
import MainCityTab from '@/components/game/tabs/MainCityTab';
import FactionTab from '@/components/game/tabs/FactionTab';
import PlaceholderTab from '@/components/game/tabs/PlaceholderTab';
import WorldMap from '@/components/game/WorldMap';
import JunCountyQuadPreviewPanel from '@/components/game/JunCountyQuadPreviewPanel';
import UpdateNoticePanel from '@/components/game/UpdateNoticePanel';
import { getActiveUpdateNotice } from '@/data/texts/updateAnnouncements';
import { shouldShowUpdateNotice, dismissUpdateNotice } from '@/utils/updateNoticeLogic';

export default function GamePage({ user, onLogout }) {
  return (
    <PlayerProvider playerId={user?.id}>
      <StrategicMapNavigationProvider>
        <GamePageInner onLogout={onLogout} />
      </StrategicMapNavigationProvider>
    </PlayerProvider>
  );
}

function GamePageInner({ onLogout }) {
  const { player, refresh } = usePlayerContext();
  const playerId = player?.player_id;

  const [activeTab, setActiveTab] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [eventBusy, setEventBusy] = useState(false);
  const [openPool, setOpenPool] = useState(null); // 'troop' | 'character' | null
  const [openReroll, setOpenReroll] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [junQuadPreviewOpen, setJunQuadPreviewOpen] = useState(false);
  const [skillsMap, setSkillsMap] = useState({});
  const navigate = useNavigate();

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

  const hideCardPools = !!(activeUpdateNotice && updateNoticeOpen);

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
    switch (activeTab) {
      case 'lineup':
        return (
          <LineupTab
            onClose={handleCloseToMap}
            onOpenAttributeReroll={() => setOpenReroll(true)}
          />
        );
      case 'city':
        return <MainCityTab onClose={handleCloseToMap} />;
      case 'faction':
        return <FactionTab onClose={handleCloseToMap} />;
      case 'map':
        return <PlaceholderTab tabId={activeTab} onClose={handleCloseToMap} />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* 全屏覆盖，脱离父级布局 */}
      <div className="fixed inset-0 z-[100] bg-gray-100">
        <TopStatusBar
          activeTab={activeTab}
          onOpenSidebar={() => setSidebarOpen(true)}
          onOpenCampaignCenter={() => setCampaignOpen(true)}
        />

        {activeTab === null && !eventBusy && (
          <div className="absolute top-[4.5rem] sm:top-14 left-0 right-0 z-40 px-3 pt-1 pointer-events-none">
            <AnnouncementBar />
            <RankingPanel />
            {activeUpdateNotice && updateNoticeOpen && (
              <UpdateNoticePanel notice={activeUpdateNotice} onClose={handleDismissUpdateNotice} />
            )}
            {!hideCardPools && (
              <CardPoolEntry
                troopRemaining={cardPool.status?.troop?.remainingDraws ?? '?'}
                charRemaining={cardPool.status?.character?.remainingDraws ?? '?'}
                dailyLimit={cardPool.status?.troop?.dailyLimit ?? 5}
                onOpenPool={setOpenPool}
                drawerOpen={!!openPool}
              />
            )}
          </div>
        )}

        <main
          className={`overflow-y-auto absolute left-0 right-0 top-[4.5rem] sm:top-14 ${
            eventBusy ? 'bottom-0' : 'bottom-16'
          }`}
        >
          {activeTab === null ? (
            <WorldMap onEventBusyChange={setEventBusy} />
          ) : (
            renderTabContent()
          )}
        </main>

        {!eventBusy && (
          <BottomTabNav activeTab={activeTab} onTabChange={setActiveTab} />
        )}

        <PersonalSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLogout={handleLogout}
        />

        <StandingRankingsPanel visible={activeTab === null && !eventBusy} playerId={playerId} />
        <CommPanel visible={activeTab === null && !eventBusy} />
      </div>

      {/* 卡池抽屉（渲染在 pointer-events-none 容器外面） */}
      {openPool && (
        <CardPoolDrawer
          poolType={openPool}
          status={cardPool.status}
          loading={cardPool.loading}
          drawResult={cardPool.drawResult}
          error={cardPool.error}
          skillsMap={skillsMap}
          factionId={player?.faction_id}
          playerSilver={player?.silver}
          onDraw={async () => {
            await cardPool.draw(openPool);
            await refresh({ silent: true });
          }}
          onClearResult={cardPool.clearResult}
          onClose={() => { setOpenPool(null); cardPool.clearResult(); }}
          onRefreshStatus={cardPool.loadStatus}
        />
      )}

      {/* 属性随机抽屉 */}
      {openReroll && playerId && (
        <AttrRerollDrawer
          playerId={playerId}
          playerName={player?.character_name}
          skillsMap={skillsMap}
          onClose={() => {
            setOpenReroll(false);
            refresh();
          }}
          onConfirm={() => refresh()}
        />
      )}

        {playerId && (
        <CampaignCenterPanel
          playerId={playerId}
          open={campaignOpen}
          onClose={() => setCampaignOpen(false)}
          onClaimed={refresh}
        />
      )}

      {activeTab === null && !eventBusy && (
        <button
          type="button"
          className="fixed bottom-20 right-3 z-[95] px-3 py-2 rounded-lg text-xs font-medium shadow-lg bg-amber-700/90 hover:bg-amber-600 text-white border border-amber-500/50"
          onClick={() => setJunQuadPreviewOpen(true)}
        >
          郡象限测试
        </button>
      )}

      {junQuadPreviewOpen && (
        <JunCountyQuadPreviewPanel onClose={() => setJunQuadPreviewOpen(false)} />
      )}
    </>
  );
}
