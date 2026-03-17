/**
 * 游戏主页面
 * 
 * @description 移动端优先布局：TopStatusBar(56px) + 主内容区 + BottomTabNav(64px)
 *              activeTab=null 时显示大地图（背景图）
 * @route /san_1/game
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayerProvider } from '@/contexts/PlayerContext';
import TopStatusBar from '@/components/game/TopStatusBar';
import BottomTabNav from '@/components/game/BottomTabNav';
import PersonalSidebar from '@/components/game/PersonalSidebar';
import LineupTab from '@/components/game/tabs/LineupTab';
import PlaceholderTab from '@/components/game/tabs/PlaceholderTab';
import WorldMap from '@/components/game/WorldMap';

export default function GamePage({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState(null); // null = 大地图视图
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  // 关闭当前Tab → 返回大地图
  const handleCloseToMap = () => {
    setActiveTab(null);
  };

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
    <PlayerProvider playerId={user?.id}>
      {/* 全屏覆盖，脱离父级布局 */}
      <div className="fixed inset-0 z-[100] bg-gray-100">
        {/* 顶部状态栏 */}
        <TopStatusBar
          activeTab={activeTab}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        {/* 主内容区 */}
        <main
          className="overflow-y-auto absolute left-0 right-0"
          style={{
            top: '56px',
            bottom: '64px'
          }}
        >
          {activeTab === null ? (
            <WorldMap />
          ) : (
            renderTabContent()
          )}
        </main>

        {/* 底部Tab导航 */}
        <BottomTabNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* 个人中心侧边栏 */}
        <PersonalSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLogout={handleLogout}
        />
      </div>
    </PlayerProvider>
  );
}
