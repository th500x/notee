/**
 * 成就/称号解锁待展示 Toast 队列（存于 achievement_progress.pendingToast）
 * 事件结算等已内联展示的 reason 不入队。
 */

const {
  ensureAchievementProgressRow,
  loadAchievementProgress,
  saveAchievementProgress,
} = require('./achievementProgressStore');

/** @type {Set<string>} */
const SKIP_ENQUEUE_REASONS = new Set([
  'event_complete',
  'premium_activate',
  'premium_already_active',
  'manual',
]);

function normalizePendingToast(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { titles: [], achievements: [] };
  }
  const titles = Array.isArray(raw.titles) ? raw.titles : [];
  const achievements = Array.isArray(raw.achievements) ? raw.achievements : [];
  return { titles, achievements };
}

function dedupeToastItems(items, idKey) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    if (!item || typeof item !== 'object') continue;
    const id = String(item[idKey] || item.name || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

/**
 * @param {*} connection
 * @param {string} playerId
 * @param {{ reason?: string, titles?: object[], achievements?: object[] }} payload
 */
async function enqueueMilestonePendingToast(connection, playerId, payload) {
  const pid = String(playerId || '').trim();
  const reason = String(payload?.reason || '').trim();
  if (!pid) return;
  if (reason && SKIP_ENQUEUE_REASONS.has(reason)) return;

  const titles = payload?.titles?.newlyGranted || payload?.titles || [];
  const achievements = payload?.achievements?.newlyGranted || payload?.achievements || [];
  if (!titles.length && !achievements.length) return;

  await ensureAchievementProgressRow(connection, pid);
  const progress = await loadAchievementProgress(connection, pid);
  const pending = normalizePendingToast(progress.pendingToast);
  pending.titles = dedupeToastItems([...pending.titles, ...titles], 'titleId');
  pending.achievements = dedupeToastItems(
    [...pending.achievements, ...achievements],
    'achievementId',
  );
  progress.pendingToast = pending;
  await saveAchievementProgress(connection, pid, progress);
}

/**
 * 读取并清空待展示队列
 *
 * @param {*} connection
 * @param {string} playerId
 * @returns {Promise<{ titles: object[], achievements: object[] }|null>}
 */
async function drainMilestonePendingToast(connection, playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) return null;

  await ensureAchievementProgressRow(connection, pid);
  const progress = await loadAchievementProgress(connection, pid);
  const pending = normalizePendingToast(progress.pendingToast);
  if (!pending.titles.length && !pending.achievements.length) return null;

  delete progress.pendingToast;
  await saveAchievementProgress(connection, pid, progress);
  return pending;
}

module.exports = {
  SKIP_ENQUEUE_REASONS,
  enqueueMilestonePendingToast,
  drainMilestonePendingToast,
};
