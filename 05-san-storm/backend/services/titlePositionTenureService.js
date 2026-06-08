/**
 * 官职任职天数累计（称号 position_tenure 条件）
 *
 * @see docs/00-base/04-2-DATA_TERM_DICTIONARY.md §7.1
 */

const { pool } = require('../database/connection');
const {
  ensureTitleProgressRow,
  loadTitleProgress,
  saveTitleProgress,
} = require('./titleProgressStore');
const { runPlayerMilestoneCheckSafe } = require('./milestoneHookHelper');

function mysqlDateToYmd(d) {
  if (!d) return null;
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return String(d).slice(0, 10);
}

/**
 * 为当前官职品阶累计 1 个任职日（幂等：同日不重复）
 *
 * @param {string} playerId
 * @param {number|string} positionLevel
 * @param {string} calendarDate YYYY-MM-DD
 * @param {*} [connection]
 * @returns {Promise<boolean>} 是否写入了新一天
 */
async function accrueOneTenureDay(playerId, positionLevel, calendarDate, connection = null) {
  const pid = String(playerId || '').trim();
  const lv = Math.trunc(Number(positionLevel));
  const today = String(calendarDate || '').slice(0, 10);
  if (!pid || !Number.isFinite(lv) || lv < 1 || !today) return false;

  const ownConn = !connection;
  const conn = connection || (await pool.getConnection());
  try {
    await ensureTitleProgressRow(conn, pid);
    const progress = await loadTitleProgress(conn, pid);
    if (progress.tenureLastAccruedDate && progress.tenureLastAccruedDate >= today) {
      return false;
    }
    if (ownConn) await conn.beginTransaction();
    const key = String(lv);
    progress.tenureByPositionLevel[key] = (progress.tenureByPositionLevel[key] || 0) + 1;
    progress.tenureLastAccruedDate = today;
    await saveTitleProgress(conn, pid, progress);
    if (ownConn) await conn.commit();
    return true;
  } catch (err) {
    if (ownConn) {
      try {
        await conn.rollback();
      } catch {
        /* ignore */
      }
    }
    throw err;
  } finally {
    if (ownConn) conn.release();
  }
}

/**
 * 00:00 日切：为所有在任官职玩家累计任职天数并尝试称号解锁
 */
async function runDailyPositionTenureTick() {
  const [dr] = await pool.query('SELECT CURDATE() AS d');
  const today = mysqlDateToYmd(dr[0].d);
  const [rows] = await pool.query(
    'SELECT player_id, position_level FROM players WHERE position_level IS NOT NULL',
  );

  let accrued = 0;
  let milestoneChecks = 0;
  for (const row of rows) {
    try {
      const changed = await accrueOneTenureDay(row.player_id, row.position_level, today);
      if (!changed) continue;
      accrued += 1;
      await runPlayerMilestoneCheckSafe(row.player_id, 'position_tenure_daily');
      milestoneChecks += 1;
    } catch (err) {
      console.error(
        `[titleTenure] daily accrue failed player=${row.player_id}:`,
        err?.message || err,
      );
    }
  }
  return { ok: true, date: today, playersWithPosition: rows.length, accrued, milestoneChecks };
}

module.exports = {
  accrueOneTenureDay,
  runDailyPositionTenureTick,
  mysqlDateToYmd,
};
