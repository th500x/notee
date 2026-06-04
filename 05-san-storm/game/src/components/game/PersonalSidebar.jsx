/**
 * 个人中心侧边栏
 *
 * @description 从右侧滑入的个人中心面板
 */

import { useEffect, useState, useRef } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import PersonalSidebarTeamPanel from '@/components/game/PersonalSidebarTeamPanel';
import PersonalSidebarStatsPanel from '@/components/game/PersonalSidebarStatsPanel';
import PersonalSidebarMechanicsPanel from '@/components/game/PersonalSidebarMechanicsPanel';
import PersonalCatalogModal from '@/components/game/PersonalCatalogModal';
import PersonalSidebarTitlesPanel from '@/components/game/PersonalSidebarTitlesPanel';
import PersonalSidebarAchievementsPanel from '@/components/game/PersonalSidebarAchievementsPanel';
import AncientModal from '@/components/common/AncientModal';

const MENU_ITEMS = [
  { id: 'mechanics', icon: '📜', label: '机制' },
  { id: 'stats', icon: '📊', label: '统计' },
  { id: 'titles', icon: '🎖️', label: '称号' },
  { id: 'achievements', icon: '🏆', label: '成就' },
  { id: 'settings', icon: '⚙️', label: '设置' },
  { id: 'team', icon: '👥', label: '团队' },
];

export default function PersonalSidebar({ open, onClose, onLogout }) {
  const { player } = usePlayerContext();
  const [subView, setSubView] = useState(null); // null | 'team' | 'stats' | 'mechanics'
  const [catalogModal, setCatalogModal] = useState(null); // null | 'titles' | 'achievements'
  const teamPanelRef = useRef(null);
  const [stubNoticeOpen, setStubNoticeOpen] = useState(false);

  // ESC：团队详情 → 团队列表 → 主菜单；统计/机制子页 → 主菜单 → 关侧边栏
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      if (catalogModal) {
        setCatalogModal(null);
        return;
      }
      if (subView === 'team') {
        const handled = teamPanelRef.current?.handleEscape?.();
        if (handled) return;
        setSubView(null);
        return;
      }
      if (subView) {
        setSubView(null);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, subView, catalogModal]);

  // 关闭抽屉时重置子页与弹窗
  useEffect(() => {
    if (!open) {
      setSubView(null);
      setCatalogModal(null);
    }
  }, [open]);

  // 阻止背景滚动
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleMenuClick = (id) => {
    if (id === 'team') {
      setSubView('team');
      return;
    }
    if (id === 'stats') {
      setSubView('stats');
      return;
    }
    if (id === 'mechanics') {
      setSubView('mechanics');
      return;
    }
    if (id === 'titles') {
      setCatalogModal('titles');
      return;
    }
    if (id === 'achievements') {
      setCatalogModal('achievements');
      return;
    }
    if (id === 'settings') {
      setStubNoticeOpen(true);
      return;
    }
    setStubNoticeOpen(true);
  };

  return (
    <>
      {/* 遮罩 */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] transition-opacity"
          onClick={onClose}
        />
      )}

      {/* 侧边栏 */}
      <div
        className={`fixed top-0 right-0 bottom-0 w-[300px] max-w-[80vw] bg-white z-[70] shadow-2xl
        flex flex-col h-full max-h-[100dvh]
        transform transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* 头部 */}
        <div className="flex shrink-0 items-center justify-between px-4 py-4 bg-amber-800 text-white">
          <span className="text-lg font-bold">个人中心</span>
          <button onClick={onClose} className="text-xl hover:text-yellow-300 transition-colors" type="button">
            ✕
          </button>
        </div>

        {subView === 'team' ? (
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <PersonalSidebarTeamPanel ref={teamPanelRef} onBack={() => setSubView(null)} />
          </div>
        ) : subView === 'stats' ? (
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <PersonalSidebarStatsPanel playerId={player?.playerId} onBack={() => setSubView(null)} />
          </div>
        ) : subView === 'mechanics' ? (
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <PersonalSidebarMechanicsPanel onBack={() => setSubView(null)} />
          </div>
        ) : (
          <>
            {/* 玩家信息 */}
            {player && (
              <div className="shrink-0 px-4 py-4 border-b border-gray-200 bg-amber-50">
                <div className="flex items-center gap-3">
                  {player.avatar && (
                    <img
                      src={`${import.meta.env.BASE_URL}${player.avatar}`}
                      alt="头像"
                      className="w-12 h-12 rounded-full object-cover border-2 border-amber-600"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-gray-900 truncate">{player.characterName}</div>
                    <div className="text-sm text-gray-600 truncate" title={player.playerId}>
                      用户ID：{player.playerId || '—'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 菜单列表 */}
            <div className="flex-1 min-h-0 overflow-y-auto py-2">
              {MENU_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleMenuClick(item.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 transition-colors"
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-gray-800 font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* 底部退出 */}
        <div className="shrink-0 p-4 border-t border-gray-200 bg-white">
          <button
            type="button"
            onClick={onLogout}
            className="w-full py-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
          >
            🚪 退出登录
          </button>
        </div>
      </div>

      <PersonalCatalogModal
        open={catalogModal === 'titles'}
        title="称号"
        icon="🎖️"
        onClose={() => setCatalogModal(null)}
      >
        <PersonalSidebarTitlesPanel playerId={player?.playerId} />
      </PersonalCatalogModal>

      <PersonalCatalogModal
        open={catalogModal === 'achievements'}
        title="成就"
        icon="🏆"
        onClose={() => setCatalogModal(null)}
      >
        <PersonalSidebarAchievementsPanel playerId={player?.playerId} />
      </PersonalCatalogModal>

      <AncientModal
        isOpen={stubNoticeOpen}
        type="info"
        title="提示"
        confirmText="确定"
        onConfirm={() => setStubNoticeOpen(false)}
        onClose={() => setStubNoticeOpen(false)}
      >
        <p className="text-center text-gray-800 text-sm">⚠️ 尚未实装</p>
      </AncientModal>
    </>
  );
}
