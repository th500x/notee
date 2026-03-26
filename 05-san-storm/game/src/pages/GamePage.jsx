/**
 * 游戏主页面
 * 
 * @description 移动端优先布局：TopStatusBar(56px) + 主内容区 + BottomTabNav(64px)
 *              activeTab=null 时显示大地图（背景图）
 * @route /san_1/game
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayerProvider, usePlayerContext } from '@/contexts/PlayerContext';
import TopStatusBar from '@/components/game/TopStatusBar';
import AnnouncementBar from '@/components/game/AnnouncementBar';
import RankingPanel from '@/components/game/RankingPanel';
import BottomTabNav from '@/components/game/BottomTabNav';
import PersonalSidebar from '@/components/game/PersonalSidebar';
import CommPanel from '@/components/game/CommPanel';
import CardPoolEntry from '@/components/game/CardPoolEntry';
import CardPoolDrawer from '@/components/game/CardPoolDrawer';
import { useCardPool } from '@/hooks/useCardPool';
import { loadSharedData } from '@/services/dataService';
import LineupTab from '@/components/game/tabs/LineupTab';
import PlaceholderTab from '@/components/game/tabs/PlaceholderTab';
import WorldMap from '@/components/game/WorldMap';

export default function GamePage({ user, onLogout }) {
  return (
    <PlayerProvider playerId={user?.id}>
      <GamePageInner onLogout={onLogout} />
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
  const [skillsMap, setSkillsMap] = useState({});
  const navigate = useNavigate();

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
    if (playerId) cardPool.loadStatus();
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
        return <LineupTab onClose={handleCloseToMap} />;
      case 'faction':
      case 'city':
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
        />

        {activeTab === null && (
          <div className="absolute top-14 left-0 right-0 z-40 px-3 pt-1 pointer-events-none">
            <AnnouncementBar />
            <RankingPanel />
            <CardPoolEntry
              troopRemaining={cardPool.status?.troop?.remainingDraws ?? '?'}
              charRemaining={cardPool.status?.character?.remainingDraws ?? '?'}
              dailyLimit={cardPool.status?.troop?.dailyLimit ?? 5}
              onOpenPool={setOpenPool}
            />
          </div>
        )}

        <main
          className="overflow-y-auto absolute left-0 right-0"
          style={{ top: '56px', bottom: eventBusy ? '0px' : '64px' }}
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
          onDraw={async () => { await cardPool.draw(openPool); refresh(); }}
          onClearResult={cardPool.clearResult}
          onClose={() => { setOpenPool(null); cardPool.clearResult(); }}
          onRefreshStatus={cardPool.loadStatus}
        />
      )}
    </>
  );
}
