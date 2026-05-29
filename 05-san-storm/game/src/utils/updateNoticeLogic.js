/**
 * 更新公告：展示窗口与 localStorage 判定
 * @see docs/30-frontend/32-3-ANNOUNCEMENTS.md（路径相对 `05-san-storm/`）
 */

const STORAGE_KEY = 'san1_update_notice_dismiss';

/**
 * 当前条正文指纹（id + 标题 + 正文），用于检测「同 id 下文案是否变更」。
 * 变更后即使用户当日已关闭过，也会再次满足展示条件（直至再次关闭）。
 */
export function getNoticeContentFingerprint(notice) {
  if (!notice?.id) return '';
  const s = `${notice.id}\n${notice.title || ''}\n${notice.content || ''}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}

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
 * @param {{ id: string, title?: string, content?: string }} notice
 * @param {Date} [now]
 */
export function shouldShowUpdateNotice(notice, now = new Date()) {
  if (!notice?.id) return false;
  if (!isUpdateNoticeTimeAllowed(now)) return false;
  const dayKey = formatLocalDateKey(now);
  const fp = getNoticeContentFingerprint(notice);
  const d = readDismissed();
  if (!d) return true;
  if (d.noticeId !== notice.id) return true;

  // 相对上次关闭时正文已变 → 再展示一次（仍受 8:00 前不弹约束）
  if (d.contentFingerprint != null && d.contentFingerprint !== fp) return true;

  // 同一逻辑日已关过 → 不再弹（旧版无指纹时无法感知正文变更，需次日或改 id）
  if (d.dayKey === dayKey) return false;

  return true;
}

/**
 * @param {{ id: string, title?: string, content?: string }} notice
 * @param {Date} [now]
 */
export function dismissUpdateNotice(notice, now = new Date()) {
  if (!notice?.id) return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        noticeId: notice.id,
        dayKey: formatLocalDateKey(now),
        contentFingerprint: getNoticeContentFingerprint(notice),
      })
    );
  } catch { /* ignore */ }
}
