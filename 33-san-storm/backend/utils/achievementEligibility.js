/**
 * 成就链前置与领取资格（目录展示 + 手动领取共用）
 */

const { evaluateUnlockCondition } = require('../../shared/utils/unlockConditionEvaluator.js');

function chainLevelNum(raw) {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/**
 * @param {object[]} configRows
 * @returns {Map<string, Map<number, string>>}
 */
function buildAchievementChainIndex(configRows) {
  const chainIndex = new Map();
  for (const row of configRows || []) {
    const cid = String(row.chain_id || '').trim();
    const lv = chainLevelNum(row.chain_level);
    if (!cid || lv < 1) continue;
    if (!chainIndex.has(cid)) chainIndex.set(cid, new Map());
    chainIndex.get(cid).set(lv, row.achievement_id);
  }
  return chainIndex;
}

/**
 * @param {Map<string, Map<number, string>>} chainIndex
 * @param {string|null|undefined} chainId
 * @param {number} chainLevel
 * @param {Set<string>} ownedSet
 * @returns {boolean}
 */
function isAchievementChainPrerequisiteMet(chainIndex, chainId, chainLevel, ownedSet) {
  const lv = chainLevelNum(chainLevel);
  if (lv <= 1) return true;
  const cid = String(chainId || '').trim();
  if (!cid) return true;
  const byLevel = chainIndex.get(cid);
  if (!byLevel) return false;
  const prevId = byLevel.get(lv - 1);
  return !!(prevId && ownedSet.has(prevId));
}

/**
 * @param {object} row - config_achievements 行
 * @param {object} snapshot
 * @param {Set<string>} ownedSet
 * @param {Map<string, Map<number, string>>} chainIndex
 * @returns {'owned'|'claimable'|'locked'}
 */
function resolveAchievementClaimStatus(row, snapshot, ownedSet, chainIndex) {
  const achievementId = row.achievement_id;
  if (ownedSet.has(achievementId)) return 'owned';
  if (!isAchievementChainPrerequisiteMet(chainIndex, row.chain_id, row.chain_level, ownedSet)) {
    return 'locked';
  }
  const evalResult = evaluateUnlockCondition(row.unlock_conditions, snapshot, { kind: 'achievement' });
  return evalResult.ok ? 'claimable' : 'locked';
}

module.exports = {
  chainLevelNum,
  buildAchievementChainIndex,
  isAchievementChainPrerequisiteMet,
  resolveAchievementClaimStatus,
};
