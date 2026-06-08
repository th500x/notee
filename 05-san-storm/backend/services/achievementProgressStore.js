/**
 * player_progress.achievement_progress JSON 读写（v1）
 *
 * @see docs/20-data-layer/25-2-ACHIEVEMENT_SYSTEM.md §1 方案 A
 */

const ACHIEVEMENT_PROGRESS_VERSION = 1;

/**
 * @returns {{ v: number, metrics: object, chains: object }}
 */
function emptyAchievementProgress() {
  return {
    v: ACHIEVEMENT_PROGRESS_VERSION,
    metrics: {},
    chains: {},
    seasonKey: null,
  };
}

/**
 * @param {unknown} raw
 * @returns {{ v: number, metrics: object, chains: object }}
 */
function normalizeAchievementProgress(raw) {
  if (raw == null || raw === '') return emptyAchievementProgress();
  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return emptyAchievementProgress();
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return emptyAchievementProgress();
  }
  const seasonKey = obj.seasonKey ?? obj.season_key ?? null;
  const pendingToast = obj.pendingToast ?? obj.pending_toast ?? undefined;
  const normalized = {
    v: Number(obj.v) || ACHIEVEMENT_PROGRESS_VERSION,
    metrics: obj.metrics && typeof obj.metrics === 'object' ? { ...obj.metrics } : {},
    chains: obj.chains && typeof obj.chains === 'object' ? { ...obj.chains } : {},
    seasonKey: seasonKey ? String(seasonKey).trim() : null,
  };
  if (pendingToast != null) normalized.pendingToast = pendingToast;
  return normalized;
}

/**
 * 方案 A：账号赛季变更时清零 metrics/chains（保留 pendingToast）
 *
 * @param {*} connection
 * @param {string} playerId
 * @param {string|null|undefined} accountSeasonKey 如 san_0_m1/san_1
 * @returns {Promise<boolean>} 是否执行了重置
 */
async function alignAchievementProgressSeason(connection, playerId, accountSeasonKey) {
  const pid = String(playerId || '').trim();
  const seasonKey = accountSeasonKey ? String(accountSeasonKey).trim() : null;
  if (!pid || !seasonKey) return false;

  await ensureAchievementProgressRow(connection, pid);
  const progress = await loadAchievementProgress(connection, pid);
  if (progress.seasonKey === seasonKey) return false;

  const pendingToast = progress.pendingToast;
  const reset = emptyAchievementProgress();
  reset.seasonKey = seasonKey;
  if (pendingToast != null) reset.pendingToast = pendingToast;
  await saveAchievementProgress(connection, pid, reset);
  return true;
}

/**
 * 用最新快照刷新 metrics（供目录进度展示；权威统计仍以 player_statistics 为准）
 *
 * @param {object} progress
 * @param {object} snapshot
 */
function syncAchievementProgressMetrics(progress, snapshot) {
  const metrics = snapshot?.metrics;
  if (!metrics || typeof metrics !== 'object') return progress;
  progress.metrics = {
    win_battles: Number(metrics.win_battles) || 0,
    total_silver_earned: Number(metrics.total_silver_earned) || 0,
    legendary_characters_collected: Number(metrics.legendary_characters_collected) || 0,
    total_events_completed: Number(metrics.total_events_completed) || 0,
  };
  return progress;
}

/**
 * @param {*} connection
 * @param {string} playerId
 * @returns {Promise<{ v: number, metrics: object, chains: object }>}
 */
async function loadAchievementProgress(connection, playerId) {
  const pid = String(playerId || '').trim();
  const [rows] = await connection.query(
    'SELECT achievement_progress FROM player_progress WHERE player_id = ? LIMIT 1',
    [pid],
  );
  return normalizeAchievementProgress(rows[0]?.achievement_progress);
}

/**
 * @param {*} connection
 * @param {string} playerId
 * @param {object} progress
 */
async function saveAchievementProgress(connection, playerId, progress) {
  const pid = String(playerId || '').trim();
  const payload = normalizeAchievementProgress(progress);
  await connection.query(
    'UPDATE player_progress SET achievement_progress = ? WHERE player_id = ?',
    [JSON.stringify(payload), pid],
  );
}

/**
 * @param {*} connection
 * @param {string} playerId
 */
async function ensureAchievementProgressRow(connection, playerId) {
  const pid = String(playerId || '').trim();
  await connection.query('INSERT IGNORE INTO player_progress (player_id) VALUES (?)', [pid]);
}

module.exports = {
  ACHIEVEMENT_PROGRESS_VERSION,
  emptyAchievementProgress,
  normalizeAchievementProgress,
  syncAchievementProgressMetrics,
  loadAchievementProgress,
  saveAchievementProgress,
  ensureAchievementProgressRow,
  alignAchievementProgressSeason,
};
