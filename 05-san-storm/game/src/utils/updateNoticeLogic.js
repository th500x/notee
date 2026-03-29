/**
 * 更新公告：展示窗口与 localStorage 判定
 * @see docs/90-assets/92-2-GAME_ANNOUNCEMENTS_DESIGN.md
 */

const STORAGE_KEY = 'san1_update_notice_dismiss';

/** @param {Date} d */
export function formatLocalDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 8:00（含）之后才允许弹出；0–7 点不展示。
 * @param {Date} [now]
 */
export function isUpdateNoticeTimeAllowed(now = new Date()) {
  return now.getHours() >= 8;
}

function readDismissed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (o && typeof o.noticeId === 'string' && typeof o.dayKey === 'string') return o;
  } catch { /* ignore */ }
  return null;
}

/**
 * @param {{ id: string }} notice
 * @param {Date} [now]
 */
export function shouldShowUpdateNotice(notice, now = new Date()) {
  if (!notice?.id) return false;
  if (!isUpdateNoticeTimeAllowed(now)) return false;
  const dayKey = formatLocalDateKey(now);
  const dismissed = readDismissed();
  if (dismissed && dismissed.noticeId === notice.id && dismissed.dayKey === dayKey) return false;
  return true;
}

/**
 * @param {{ id: string }} notice
 * @param {Date} [now]
 */
export function dismissUpdateNotice(notice, now = new Date()) {
  if (!notice?.id) return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ noticeId: notice.id, dayKey: formatLocalDateKey(now) })
    );
  } catch { /* ignore */ }
}
