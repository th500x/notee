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
import TabNotifyDot from '@/components/game/TabNotifyDot';
import { setBgmEnabled } from '@/services/bgmService';
import { readBgmEnabled } from '@/utils/bgmUserPref';
import {
  UI_USER_SCALE_OPTIONS,
  readUiUserScale,
  writeUiUserScale,
  isUiFontDprBumpActive,
} from '@/utils/uiDisplayScale';

const MENU_ITEMS = [
  { id: 'mechanics', icon: '📜', label: '机制' },
  { id: 'stats', icon: '📊', label: '统计' },
  { id: 'titles', icon: '🎖️', label: '称号' },
  { id: 'achievements', icon: '🏆', label: '成就' },
  { id: 'team', icon: '👥', label: '团队' },
];

export default function PersonalSidebar({
  open,
  onClose,
  onLogout,
  claimableAchievementNotify = false,
}) {
  const { player } = usePlayerContext();
  const [subView, setSubView] = useState(null); // null | 'team' | 'stats' | 'mechanics'
  const [catalogModal, setCatalogModal] = useState(null); // null | 'titles' | 'achievements'
  const teamPanelRef = useRef(null);
  const [bgmOn, setBgmOn] = useState(() => readBgmEnabled());
  const [uiUserScale, setUiUserScale] = useState(() => readUiUserScale());
  const [uiDprBumpActive, setUiDprBumpActive] = useState(() => isUiFontDprBumpActive());

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
    } else {
      setBgmOn(readBgmEnabled());
      setUiUserScale(readUiUserScale());
      setUiDprBumpActive(isUiFontDprBumpActive());
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
    }
  };

  const handleBgmToggle = () => {
    const next = !bgmOn;
    setBgmOn(next);
    setBgmEnabled(next);
  };

  const handleUiScalePick = (scale) => {
    setUiUserScale(scale);
    writeUiUserScale(scale);
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
              {MENU_ITEMS.map((item) => {
                const showAchNotify =
                  item.id === 'achievements' && claimableAchievementNotify;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleMenuClick(item.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 transition-colors"
                    aria-label={
                      showAchNotify ? `${item.label}，有可领取成就` : item.label
                    }
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span
                      className={`relative inline-flex text-gray-800 font-medium ${
                        showAchNotify ? 'pt-1 pr-1' : ''
                      }`}
                    >
                      {item.label}
                      {showAchNotify ? <TabNotifyDot /> : null}
                    </span>
                  </button>
                );
              })}
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl" aria-hidden>🎵</span>
                  <span className="text-gray-800 font-medium">音乐</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={bgmOn}
                  aria-label={bgmOn ? '音乐已开启，点击关闭' : '音乐已关闭，点击开启'}
                  onClick={handleBgmToggle}
                  className={`shrink-0 min-w-[4.5rem] rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    bgmOn
                      ? 'bg-amber-700 text-white hover:bg-amber-800'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  {bgmOn ? '开' : '关'}
                </button>
              </div>
              <div className="px-4 py-3 border-t border-gray-100">
                <div className="flex items-center gap-3 min-w-0 mb-2">
                  <span className="text-xl" aria-hidden>🔍</span>
                  <div className="min-w-0">
                    <div className="text-gray-800 font-medium">界面缩放</div>
                    <div className="text-xs text-gray-500 leading-snug mt-0.5">
                      整页同比放大，框与字一起变大
                      {uiDprBumpActive ? '；当前屏幕已自动略增字号' : ''}
                    </div>
                  </div>
                </div>
                <div
                  className="flex rounded-lg border border-gray-200 overflow-hidden"
                  role="radiogroup"
                  aria-label="界面缩放比例"
                >
                  {UI_USER_SCALE_OPTIONS.map((opt) => {
                    const active = uiUserScale === opt.value;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => handleUiScalePick(opt.value)}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${
                          active
                            ? 'bg-amber-700 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
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

    </>
  );
}
