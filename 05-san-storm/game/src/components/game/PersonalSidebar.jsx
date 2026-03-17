/**
 * 个人中心侧边栏
 * 
 * @description 从右侧滑入的个人中心面板
 */

import { useEffect } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';

const MENU_ITEMS = [
  { id: 'stats',       icon: '📊', label: '统计数据' },
  { id: 'titles',      icon: '🎖️', label: '称号' },
  { id: 'achievements', icon: '🏆', label: '成就' },
  { id: 'settings',    icon: '⚙️', label: '设置' },
  { id: 'help',        icon: '📖', label: '帮助' },
];

export default function PersonalSidebar({ open, onClose, onLogout }) {
  const { player } = usePlayerContext();

  // ESC关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // 阻止背景滚动
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const handleMenuClick = (id) => {
    // 暂时所有功能都提示尚未实装
    alert('⚠️ 尚未实装');
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
      <div className={`fixed top-0 right-0 bottom-0 w-[300px] max-w-[80vw] bg-white z-[70] shadow-2xl
        transform transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-4 bg-amber-800 text-white">
          <span className="text-lg font-bold">个人中心</span>
          <button onClick={onClose} className="text-xl hover:text-yellow-300 transition-colors">✕</button>
        </div>

        {/* 玩家信息 */}
        {player && (
          <div className="px-4 py-4 border-b border-gray-200 bg-amber-50">
            <div className="flex items-center gap-3">
              {player.avatar && (
                <img
                  src={`${import.meta.env.BASE_URL}${player.avatar}`}
                  alt="头像"
                  className="w-12 h-12 rounded-full object-cover border-2 border-amber-600"
                />
              )}
              <div>
                <div className="font-bold text-gray-900">{player.character_name}</div>
                <div className="text-sm text-gray-600">
                  {player.faction_name} · {player.current_position_name || '无官职'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 菜单列表 */}
        <div className="py-2">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => handleMenuClick(item.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 transition-colors"
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-gray-800 font-medium">{item.label}</span>
            </button>
          ))}
        </div>

        {/* 底部退出 */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <button
            onClick={onLogout}
            className="w-full py-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
          >
            🚪 退出登录
          </button>
        </div>
      </div>
    </>
  );
}
