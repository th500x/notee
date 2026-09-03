/** CommPanel 三 Tab 共享布局常量（原 CommPanel.jsx） */

export const COMM_TABS = [
  { id: 'battle', icon: '📜', label: '战报' },
  { id: 'text',   icon: '📮', label: '传书' },
  { id: 'chat',   icon: '💬', label: '聊天' },
];

export const BATTLE_FILTERS = [
  { id: 'all',       label: '全部' },
  { id: 'win',       label: '胜利' },
  { id: 'lose',      label: '失败' },
  { id: 'favorited', label: '⭐收藏' },
];

export const COMM_TAB_BODY_CLASS =
  'flex flex-col h-96 min-h-96 max-h-96 w-full shrink-0 overflow-hidden';
export const COMM_TAB_SCROLL_CLASS =
  'flex-1 min-h-0 basis-0 overflow-y-auto overflow-x-hidden';
export const COMM_TAB_TOP_SLOT_CLASS =
  'shrink-0 min-h-[3.5rem] border-b border-amber-700/20 px-1 py-1 flex flex-col justify-center gap-1';
export const COMM_TAB_BOTTOM_SLOT_CLASS =
  'shrink-0 flex flex-col border-t border-amber-700/20 px-1.5 pb-1 pt-1 gap-0.5';

/** 相对时间格式化 */
export function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN');
}
