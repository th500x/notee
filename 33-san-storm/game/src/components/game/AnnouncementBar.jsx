/**
 * 游戏公告栏
 * 
 * @description 紧贴顶部状态栏下方，宽度对齐资源区到设置按钮
 * - 登录/刷新时自动展开
 * - 当次会话内记住折叠状态
 * - 半透明深色背景，金色文字
 */

import { useState } from 'react';
import { getLatestAnnouncement } from '@/data/texts/announcements';

export default function AnnouncementBar() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('ann_collapsed') === '1'; } catch { return false; }
  });
  const announcement = getLatestAnnouncement();

  const toggleCollapse = (val) => {
    setCollapsed(val);
    try { localStorage.setItem('ann_collapsed', val ? '1' : '0'); } catch {}
  };

  if (!announcement) return null;

  return (
    <div className="pointer-events-auto">
      <div className="overflow-hidden rounded-lg border border-amber-700/40 bg-black/60 backdrop-blur-sm">
        {/* 折叠状态：只显示一行 */}
        {collapsed ? (
          <button
            onClick={() => toggleCollapse(false)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-amber-300/80 hover:text-amber-200 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <span>📢</span>
              <span className="truncate">{announcement.title}</span>
            </span>
            <span className="flex-shrink-0 ml-2 text-[10px] text-amber-400/60">▼ 展开</span>
          </button>
        ) : (
          /* 展开状态：完整公告 */
          <div className="px-3 py-2">
            {/* 标题行 + 折叠按钮 */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">📢</span>
                <span className="text-xs font-bold text-amber-300">{announcement.title}</span>
                <span className="text-[10px] text-amber-500/60">{announcement.date}</span>
              </div>
              <button
                onClick={() => toggleCollapse(true)}
                className="flex-shrink-0 ml-2 text-[10px] text-amber-400/60 hover:text-amber-300 transition-colors"
              >
                ▲ 收起
              </button>
            </div>
            {/* 公告正文 */}
            <p className="text-xs text-amber-100/80 leading-relaxed whitespace-pre-line">
              {announcement.content}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
