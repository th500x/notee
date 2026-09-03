/**
 * 称号/成就里程碑统一触发入口（阶段 A 底座；业务钩子在阶段 B/C 挂载）
 *
 * @see docs/00/20-data-layer/25-1-TITLE_SYSTEM.md
 * @see docs/00/20-data-layer/25-2-ACHIEVEMENT_SYSTEM.md §9
 */

const { pool } = require('../database/connection');
const { buildPlayerProgressSnapshot } = require('./playerProgressSnapshotService');
const { tryUnlockTitles } = require('./titleUnlockService');
const { syncAchievementProgress } = require('./achievementUnlockService');
const { enqueueMilestonePendingToast } = require('./milestonePendingToastStore');

/**
 * @param {string} playerId
 * @param {string} [reason] - 日志用：battle_win / silver_earn / event_complete 等
 * @param {*} [externalConnection] - 可选：复用外层事务 connection
 * @returns {Promise<{
 *   reason: string,
 *   titles: { newlyGranted: object[], discarded: object[] },
 *   achievements: { newlyGranted: object[], discarded: object[] },
 * }>}
 */
async function postPlayerMilestoneCheck(playerId, reason = 'manual', externalConnection = null) {
  const pid = String(playerId || '').trim();
  if (!pid) {
    return {
      reason,
      titles: { newlyGranted: [], discarded: [] },
      achievements: { newlyGranted: [], discarded: [] },
    };
  }

  const ownConnection = !externalConnection;
  const connection = externalConnection || await pool.getConnection();

  try {
    if (ownConnection) await connection.beginTransaction();

    const snapshot = await buildPlayerProgressSnapshot(pid, connection);
    const titles = await tryUnlockTitles(pid, snapshot, connection);
    await syncAchievementProgress(pid, snapshot, connection);

    if (ownConnection) await connection.commit();

    if (titles.newlyGranted.length) {
      console.log(
        `[milestoneUnlock] player=${pid} reason=${reason} titles=${titles.newlyGranted.length}`,
      );
      try {
        await enqueueMilestonePendingToast(pool, pid, {
          reason,
          titles: titles.newlyGranted,
          achievements: [],
        });
      } catch (toastErr) {
        console.warn(
          `[milestoneUnlock] pending toast enqueue failed player=${pid}:`,
          toastErr?.message || toastErr,
        );
      }
    }

    return {
      reason,
      titles: {
        newlyGranted: titles.newlyGranted,
        discarded: titles.discarded,
      },
      achievements: {
        newlyGranted: [],
        discarded: [],
      },
    };
  } catch (err) {
    if (ownConnection) {
      try {
        await connection.rollback();
      } catch {
        /* ignore */
      }
    }
    throw err;
  } finally {
    if (ownConnection) connection.release();
  }
}

module.exports = {
  postPlayerMilestoneCheck,
};
