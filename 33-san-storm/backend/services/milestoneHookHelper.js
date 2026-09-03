/**
 * 业务钩子调用 postPlayerMilestoneCheck 的统一包装（吞错不打断主流程）
 */

const { postPlayerMilestoneCheck } = require('./milestoneUnlockOrchestrator');

/**
 * @param {string} playerId
 * @param {string} reason
 */
async function runPlayerMilestoneCheckSafe(playerId, reason) {
  const pid = String(playerId || '').trim();
  if (!pid) return null;
  try {
    return await postPlayerMilestoneCheck(pid, reason);
  } catch (err) {
    console.error(`[milestoneHook] ${reason} failed player=${pid}:`, err?.message || err);
    return null;
  }
}

module.exports = {
  runPlayerMilestoneCheckSafe,
};
