/**
 * 成就手动领取：条件已满足时由玩家在目录点击领取 → 发卡 + rewards
 *
 * @see docs/20-data-layer/25-2-ACHIEVEMENT_SYSTEM.md
 */

const { pool } = require('../database/connection');
const { evaluateUnlockCondition } = require('../../shared/utils/unlockConditionEvaluator.js');
const { grantUniqueTitleOrAchievementCard } = require('./uniqueCardGrantService');
const {
  ensureAchievementProgressRow,
  loadAchievementProgress,
  saveAchievementProgress,
} = require('./achievementProgressStore');
const { buildPlayerProgressSnapshot } = require('./playerProgressSnapshotService');
const { executeRewards } = require('./rewardService');
const {
  chainLevelNum,
  buildAchievementChainIndex,
  isAchievementChainPrerequisiteMet,
  resolveAchievementClaimStatus,
} = require('../utils/achievementEligibility');
const {
  rewardsJsonToRewardString,
  parseRewardsJson,
} = require('./achievementUnlockService');

function markChainCompleted(progress, chainId, chainLevel) {
  const cid = String(chainId || '').trim();
  const lv = chainLevelNum(chainLevel);
  if (!cid || lv < 1) return;
  if (!progress.chains || typeof progress.chains !== 'object') {
    progress.chains = {};
  }
  const prev = progress.chains[cid]?.maxCompletedLevel ?? progress.chains[cid]?.max_completed_level ?? 0;
  const next = Math.max(chainLevelNum(prev), lv);
  progress.chains[cid] = { maxCompletedLevel: next };
}

/**
 * @param {string} playerId
 * @param {string} achievementId
 * @returns {Promise<{ ok: false, status: number, error: string } | { ok: true, data: object }>}
 */
async function claimPlayerAchievement(playerId, achievementId) {
  const pid = String(playerId || '').trim();
  const achId = String(achievementId || '').trim();
  if (!pid || !achId) {
    return { ok: false, status: 400, error: '缺少玩家或成就 ID' };
  }

  const [playerRows] = await pool.query(
    'SELECT player_id, faction_id FROM players WHERE player_id = ? LIMIT 1',
    [pid],
  );
  if (!playerRows.length) {
    return { ok: false, status: 404, error: '玩家不存在' };
  }
  const factionId = playerRows[0].faction_id || null;

  const [configRows] = await pool.query(
    `SELECT achievement_id, achievement_name, chain_id, chain_level,
            unlock_conditions, rewards
     FROM config_achievements
     WHERE achievement_id = ?
     LIMIT 1`,
    [achId],
  );
  if (!configRows.length) {
    return { ok: false, status: 404, error: '成就不存在' };
  }
  const row = configRows[0];

  const snapshot = await buildPlayerProgressSnapshot(pid);

  const [ownedRows] = await pool.query(
    `SELECT DISTINCT card_id AS achievement_id
     FROM player_cards
     WHERE player_id = ? AND card_type = 'achievement'`,
    [pid],
  );
  const ownedSet = new Set(ownedRows.map((r) => r.achievement_id));

  const [allConfigRows] = await pool.query(
    `SELECT achievement_id, chain_id, chain_level FROM config_achievements`,
  );
  const chainIndex = buildAchievementChainIndex(allConfigRows);

  const status = resolveAchievementClaimStatus(row, snapshot, ownedSet, chainIndex);
  if (status === 'owned') {
    return { ok: false, status: 400, error: '该成就已领取' };
  }
  if (status === 'locked') {
    if (!isAchievementChainPrerequisiteMet(chainIndex, row.chain_id, row.chain_level, ownedSet)) {
      return { ok: false, status: 400, error: '请先领取同链前置成就' };
    }
    const evalResult = evaluateUnlockCondition(row.unlock_conditions, snapshot, { kind: 'achievement' });
    if (!evalResult.ok) {
      return { ok: false, status: 400, error: '成就条件尚未达成' };
    }
    return { ok: false, status: 400, error: '成就条件尚未达成' };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const details = [];
    const grant = await grantUniqueTitleOrAchievementCard(conn, {
      playerId: pid,
      cardId: achId,
      details,
    });

    if (grant.discarded) {
      await conn.rollback();
      return { ok: false, status: 400, error: '该成就已领取' };
    }
    if (!grant.granted) {
      await conn.rollback();
      return { ok: false, status: 500, error: '成就发卡失败' };
    }

    await ensureAchievementProgressRow(conn, pid);
    const progress = await loadAchievementProgress(conn, pid);
    markChainCompleted(progress, row.chain_id, row.chain_level);
    await saveAchievementProgress(conn, pid, progress);

    await conn.commit();

    const rewardsObj = parseRewardsJson(row.rewards);
    const rewardString = rewardsJsonToRewardString(rewardsObj);
    let rewardDetails = [];
    if (rewardString) {
      try {
        const rewardOut = await executeRewards(pid, rewardString, 1, factionId);
        rewardDetails = rewardOut?.details || [];
      } catch (rewardErr) {
        console.error(
          `[achievementClaim] rewards failed ${achId} player=${pid}:`,
          rewardErr?.message || rewardErr,
        );
        return {
          ok: false,
          status: 500,
          error: '成就卡已发放，但奖励发放失败，请联系客服',
        };
      }
    }

    return {
      ok: true,
      data: {
        achievementId: achId,
        achievementName: grant.cardName || row.achievement_name || achId,
        instanceId: grant.instanceId,
        chainId: row.chain_id || null,
        chainLevel: chainLevelNum(row.chain_level) || null,
        rewards: rewardsObj,
        rewardDetails,
      },
    };
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      /* ignore */
    }
    console.error('[achievementClaim] failed', pid, achId, err?.message || err);
    return { ok: false, status: 500, error: '领取失败' };
  } finally {
    conn.release();
  }
}

module.exports = {
  claimPlayerAchievement,
};
