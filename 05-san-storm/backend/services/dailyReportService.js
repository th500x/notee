/**
 * 真三日报 · 签到与面板数据（32-6）
 */

const { pool } = require('../database/connection');
const statisticsDeltaService = require('./statisticsDeltaService');
const {
  CHECKIN_CYCLE_MAX,
  INTRO_VIDEO_URL,
  resolveCheckinReward,
} = require('../config/dailyReportCheckin');
const {
  getYesterdayDigestPayload,
  mysqlDateToYmd,
} = require('./dailyReportDigestReadService');
const { listSan1OfficialsSnapshot } = require('./dailyReportOfficialsService');

function clampCycle(n) {
  const v = Math.floor(Number(n)) || 1;
  return Math.max(1, Math.min(CHECKIN_CYCLE_MAX, v));
}

function nextCycleAfterClaim(current) {
  const c = clampCycle(current);
  return c >= CHECKIN_CYCLE_MAX ? 1 : c + 1;
}

/**
 * @param {string|null|undefined} storedDateYmd
 * @param {string} todayYmd
 */
function canCheckInToday(storedDateYmd, todayYmd) {
  if (!todayYmd) return false;
  if (!storedDateYmd) return true;
  return storedDateYmd < todayYmd;
}

async function loadPlayerCheckinRow(playerId, connection = null) {
  const db = connection || pool;
  const [rows] = await db.query(
    `SELECT daily_report_checkin_date, daily_report_checkin_cycle
     FROM players WHERE player_id = ? LIMIT 1`,
    [playerId],
  );
  return rows[0] || null;
}

async function getPlayerServerId(playerId, connection = null) {
  const db = connection || pool;
  try {
    const [rows] = await db.query('SELECT serverId FROM accounts WHERE id = ? LIMIT 1', [playerId]);
    const sid = rows[0]?.serverId;
    return sid != null && String(sid).trim() ? String(sid).trim() : 'default';
  } catch (e) {
    if (/Unknown column/i.test(e?.message || '')) {
      return 'default';
    }
    throw e;
  }
}

/**
 * @param {string} playerId
 */
async function buildCheckinSection(playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) {
    return {
      cycleDay: 1,
      cycleMax: CHECKIN_CYCLE_MAX,
      canCheckIn: false,
      checkedInToday: false,
      rewardPreview: resolveCheckinReward(1),
      blockReason: '未登录',
    };
  }

  let row;
  try {
    row = await loadPlayerCheckinRow(pid);
  } catch (e) {
    if (/Unknown column ['`]daily_report_checkin/i.test(e?.message || '')) {
      return {
        cycleDay: 1,
        cycleMax: CHECKIN_CYCLE_MAX,
        canCheckIn: false,
        checkedInToday: false,
        rewardPreview: resolveCheckinReward(1),
        blockReason:
          '签到数据未就绪：请执行迁移 add-players-daily-report-checkin.sql（或 node scripts/apply-pending-local-ddl.js）',
      };
    }
    throw e;
  }

  if (!row) {
    return {
      cycleDay: 1,
      cycleMax: CHECKIN_CYCLE_MAX,
      canCheckIn: false,
      checkedInToday: false,
      rewardPreview: resolveCheckinReward(1),
      blockReason: '玩家不存在',
    };
  }

  const [dr] = await pool.query('SELECT CURDATE() AS d');
  const todayStr = mysqlDateToYmd(dr[0]?.d);
  const stored = mysqlDateToYmd(row.daily_report_checkin_date);
  const cycleDay = clampCycle(row.daily_report_checkin_cycle);
  const checkedInToday = !!(stored && stored === todayStr);
  const canCheckIn = canCheckInToday(stored, todayStr);

  return {
    cycleDay,
    cycleMax: CHECKIN_CYCLE_MAX,
    canCheckIn,
    checkedInToday,
    rewardPreview: resolveCheckinReward(cycleDay),
    blockReason: canCheckIn ? null : checkedInToday ? '今日已签到' : null,
  };
}

/**
 * @param {string} playerId
 */
async function getDailyReport(playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) {
    return { ok: false, status: 400, error: '未登录' };
  }

  const checkIn = await buildCheckinSection(pid);
  const serverId = await getPlayerServerId(pid);
  const digest = await getYesterdayDigestPayload(serverId);
  const officials = await listSan1OfficialsSnapshot();

  return {
    ok: true,
    data: {
      checkIn,
      digest: digest || null,
      officials,
      introVideoUrl: INTRO_VIDEO_URL,
      serverId,
    },
  };
}

/**
 * @param {string} playerId
 */
async function claimDailyCheckIn(playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) return { ok: false, status: 400, error: '未登录' };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let row;
    try {
      const [rows] = await conn.query(
        `SELECT daily_report_checkin_date, daily_report_checkin_cycle, silver
         FROM players WHERE player_id = ? FOR UPDATE`,
        [pid],
      );
      row = rows[0];
    } catch (e) {
      if (/Unknown column ['`]daily_report_checkin/i.test(e?.message || '')) {
        await conn.rollback();
        return {
          ok: false,
          status: 503,
          error:
            '签到数据未就绪：请执行迁移 add-players-daily-report-checkin.sql（或 node scripts/apply-pending-local-ddl.js）',
        };
      }
      throw e;
    }

    if (!row) {
      await conn.rollback();
      return { ok: false, status: 404, error: '玩家不存在' };
    }

    const [dr] = await conn.query('SELECT CURDATE() AS d');
    const todayStr = mysqlDateToYmd(dr[0]?.d);
    const stored = mysqlDateToYmd(row.daily_report_checkin_date);
    if (!canCheckInToday(stored, todayStr)) {
      await conn.rollback();
      return { ok: false, status: 400, error: stored === todayStr ? '今日已签到' : '当前不可签到' };
    }

    const cycleDay = clampCycle(row.daily_report_checkin_cycle);
    const reward = resolveCheckinReward(cycleDay);
    const silverGrant = Math.max(0, Math.floor(Number(reward.silver) || 0));
    const nextCycle = nextCycleAfterClaim(cycleDay);

    if (silverGrant > 0) {
      await conn.query('UPDATE players SET silver = silver + ? WHERE player_id = ?', [
        silverGrant,
        pid,
      ]);
    }

    await conn.query(
      `UPDATE players SET daily_report_checkin_date = ?, daily_report_checkin_cycle = ?
       WHERE player_id = ?`,
      [todayStr, nextCycle, pid],
    );

    await conn.commit();

    if (silverGrant > 0) {
      await statisticsDeltaService.recordEarned(pid, { silver: silverGrant });
    }

    const [bal] = await pool.query('SELECT silver FROM players WHERE player_id = ?', [pid]);

    return {
      ok: true,
      data: {
        granted: { silver: silverGrant, food: 0 },
        cycleDayClaimed: cycleDay,
        nextCycleDay: nextCycle,
        silverBalance: Number(bal[0]?.silver) || 0,
        checkIn: {
          cycleDay: nextCycle,
          cycleMax: CHECKIN_CYCLE_MAX,
          canCheckIn: false,
          checkedInToday: true,
          rewardPreview: resolveCheckinReward(nextCycle),
          blockReason: '今日已签到',
        },
      },
    };
  } catch (e) {
    await conn.rollback();
    console.error('[dailyReport] claimDailyCheckIn', e);
    return { ok: false, status: 500, error: '签到失败' };
  } finally {
    conn.release();
  }
}

/**
 * 红点：今日是否尚未签到
 * @param {string} playerId
 * @returns {Promise<boolean>}
 */
async function hasCheckinNotifyDot(playerId) {
  const section = await buildCheckinSection(playerId);
  return !!section.canCheckIn;
}

module.exports = {
  getDailyReport,
  claimDailyCheckIn,
  hasCheckinNotifyDot,
  buildCheckinSection,
};
