/**
 * 成就进度同步（仅写 metrics；发卡改由 achievementClaimService 手动领取）
 *
 * @see docs/20-data-layer/25-2-ACHIEVEMENT_SYSTEM.md §1、§6、§9
 */

const {
  ensureAchievementProgressRow,
  loadAchievementProgress,
  saveAchievementProgress,
  syncAchievementProgressMetrics,
} = require('./achievementProgressStore');

/**
 * @param {unknown} raw
 * @returns {object}
 */
function parseRewardsJson(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * 成就 rewards JSON → rewardService 奖励串
 *
 * @param {unknown} raw
 * @returns {string}
 */
function rewardsJsonToRewardString(raw) {
  const obj = parseRewardsJson(raw);
  const parts = [];
  if (Array.isArray(obj.grant_card_ids)) {
    for (const cardId of obj.grant_card_ids) {
      if (cardId) parts.push(String(cardId));
    }
  }
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'grant_card_ids') continue;
    const n = Number(val);
    if (Number.isFinite(n) && n !== 0) parts.push(`${key}:${Math.round(n)}`);
  }
  return parts.join(';');
}

/**
 * 钩子仅刷新 achievement_progress.metrics（不自动发卡）
 *
 * @param {*} connection
 * @param {string} playerId
 * @param {object} snapshot
 * @returns {Promise<{ progress: object }>}
 */
async function syncAchievementProgress(playerId, snapshot, connection) {
  const pid = String(playerId || '').trim();
  await ensureAchievementProgressRow(connection, pid);
  const progress = syncAchievementProgressMetrics(
    await loadAchievementProgress(connection, pid),
    snapshot,
  );
  await saveAchievementProgress(connection, pid, progress);
  return { progress };
}

module.exports = {
  syncAchievementProgress,
  rewardsJsonToRewardString,
  parseRewardsJson,
};
