/**
 * 真三日报 · 签到与面板数据（32-6）
 */

const { pool } = require('../database/connection');
const {
  CHECKIN_CYCLE_MAX,
  INTRO_VIDEO_URL,
} = require('../config/dailyReportCheckin');
const {
  assertCheckinRewardsString,
  assertCheckinParsedRewards,
  summarizeCheckinGrantDetails,
} = require('../../shared/utils/dailyReportCheckinRewards.cjs');
const {
  parseRewardString,
  executeRewardsOnConnection,
} = require('./rewardService');
const {
  getRewardsStringForCycleDay,
  buildRewardsByDayPayload,
  loadItemNamesForConfig,
} = require('./dailyReportCheckinRewardsLoader');
const {
  getYesterdayDigestPayload,
  mysqlDateToYmd,
} = require('./dailyReportDigestReadService');
const { listSan1OfficialsSnapshot } = require('./dailyReportOfficialsService');
const {
  resolveDailyCheckinExtraBonuses,
} = require('./factionGameplayBonusService');

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

function rewardPreviewForCycleDay(cycleDay, rewardsByDay) {
  const row = rewardsByDay.find((r) => r.cycleDay === cycleDay);
  return {
    rewards: row?.rewards ?? getRewardsStringForCycleDay(cycleDay),
    displayShort: row?.displayShort ?? '—',
    label: row?.label ?? null,
  };
}

async function loadPlayerCheckinRow(playerId, connection = null) {
  const db = connection || pool;
  const [rows] = await db.query(
    `SELECT daily_report_checkin_date, daily_report_checkin_cycle, faction_id
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
 * @param {object[]} rewardsByDay
 */
async function buildCheckinSection(playerId, rewardsByDay) {
  const pid = String(playerId || '').trim();
  const base = {
    cycleMax: CHECKIN_CYCLE_MAX,
    rewardsByDay,
  };

  if (!pid) {
    return {
      ...base,
      cycleDay: 1,
      canCheckIn: false,
      checkedInToday: false,
      rewardPreview: rewardPreviewForCycleDay(1, rewardsByDay),
      blockReason: '未登录',
    };
  }

  let row;
  try {
    row = await loadPlayerCheckinRow(pid);
  } catch (e) {
    if (/Unknown column ['`]daily_report_checkin/i.test(e?.message || '')) {
      return {
        ...base,
        cycleDay: 1,
        canCheckIn: false,
        checkedInToday: false,
        rewardPreview: rewardPreviewForCycleDay(1, rewardsByDay),
        blockReason:
          '签到数据未就绪：请执行迁移 add-players-daily-report-checkin.sql（或 node scripts/apply-pending-local-ddl.js）',
      };
    }
    throw e;
  }

  if (!row) {
    return {
      ...base,
      cycleDay: 1,
      canCheckIn: false,
      checkedInToday: false,
      rewardPreview: rewardPreviewForCycleDay(1, rewardsByDay),
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
    ...base,
    cycleDay,
    canCheckIn,
    checkedInToday,
    rewardPreview: rewardPreviewForCycleDay(cycleDay, rewardsByDay),
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

  let itemNameById = {};
  try {
    itemNameById = await loadItemNamesForConfig();
  } catch (e) {
    console.error('[dailyReport] loadItemNamesForConfig', e);
    return { ok: false, status: 503, error: e.message || '签到奖励配置未就绪' };
  }

  let rewardsByDay;
  try {
    rewardsByDay = buildRewardsByDayPayload(itemNameById);
  } catch (e) {
    console.error('[dailyReport] buildRewardsByDayPayload', e);
    return { ok: false, status: 503, error: e.message || '签到奖励配置无效' };
  }

  const checkIn = await buildCheckinSection(pid, rewardsByDay);
  const playerRow = await loadPlayerCheckinRow(pid);
  const extraBonus = await resolveDailyCheckinExtraBonuses(
    pool,
    pid,
    playerRow?.faction_id,
    itemNameById,
  );
  if (extraBonus.displayShort || extraBonus.rewards) {
    checkIn.factionBonus = {
      rewards: extraBonus.factionRewards,
      displayShort: extraBonus.displayShort,
    };
    checkIn.positionBonus = {
      silver: extraBonus.positionSilver,
    };
    checkIn.extraBonus = {
      rewards: extraBonus.rewards,
      displayShort: extraBonus.displayShort,
      factionRewards: extraBonus.factionRewards,
      positionSilver: extraBonus.positionSilver,
    };
    checkIn.rewardsByDay = (checkIn.rewardsByDay || []).map((day) => ({
      ...day,
      factionBonusDisplayShort: extraBonus.displayShort,
      factionBonusRewards: extraBonus.rewards,
    }));
  }

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
        `SELECT daily_report_checkin_date, daily_report_checkin_cycle, silver, food, faction_id
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
    let rewardStr;
    try {
      rewardStr = getRewardsStringForCycleDay(cycleDay);
      assertCheckinRewardsString(rewardStr);
      assertCheckinParsedRewards(parseRewardString(rewardStr));
    } catch (e) {
      await conn.rollback();
      console.error('[dailyReport] invalid checkin reward config', { cycleDay, error: e.message });
      return { ok: false, status: 503, error: '签到奖励配置无效' };
    }

    const factionId = row.faction_id ? String(row.faction_id) : '';
    const extraBonus = await resolveDailyCheckinExtraBonuses(conn, pid, factionId);
    const rewardParts = [rewardStr];
    if (extraBonus.rewards) rewardParts.push(extraBonus.rewards);
    const grantRewardStr = rewardParts.join(';');
    try {
      if (extraBonus.rewards) {
        assertCheckinRewardsString(extraBonus.rewards);
        assertCheckinParsedRewards(parseRewardString(extraBonus.rewards));
      }
    } catch (e) {
      await conn.rollback();
      console.error('[dailyReport] invalid checkin extra bonus', {
        factionId,
        rewards: extraBonus.rewards,
        error: e.message,
      });
      return { ok: false, status: 503, error: '签到额外加成配置无效' };
    }

    const grantResult = await executeRewardsOnConnection(
      conn,
      pid,
      grantRewardStr,
      1,
      factionId,
      { expandPresets: false },
    );

    const nextCycle = nextCycleAfterClaim(cycleDay);
    await conn.query(
      `UPDATE players SET daily_report_checkin_date = ?, daily_report_checkin_cycle = ?
       WHERE player_id = ?`,
      [todayStr, nextCycle, pid],
    );

    await conn.commit();

    const granted = summarizeCheckinGrantDetails(grantResult.details);
    const itemNameById = await loadItemNamesForConfig();
    const rewardsByDay = buildRewardsByDayPayload(itemNameById);
    const checkIn = await buildCheckinSection(pid, rewardsByDay);
    const extraBonusNamed = await resolveDailyCheckinExtraBonuses(
      pool,
      pid,
      factionId,
      itemNameById,
    );
    if (extraBonusNamed.displayShort || extraBonusNamed.rewards) {
      checkIn.factionBonus = {
        rewards: extraBonusNamed.factionRewards,
        displayShort: extraBonusNamed.displayShort,
      };
      checkIn.positionBonus = {
        silver: extraBonusNamed.positionSilver,
      };
      checkIn.extraBonus = {
        rewards: extraBonusNamed.rewards,
        displayShort: extraBonusNamed.displayShort,
        factionRewards: extraBonusNamed.factionRewards,
        positionSilver: extraBonusNamed.positionSilver,
      };
      checkIn.rewardsByDay = (checkIn.rewardsByDay || []).map((day) => ({
        ...day,
        factionBonusDisplayShort: extraBonusNamed.displayShort,
        factionBonusRewards: extraBonusNamed.rewards,
      }));
    }

    const [bal] = await pool.query('SELECT silver, food FROM players WHERE player_id = ?', [pid]);

    return {
      ok: true,
      data: {
        granted,
        cycleDayClaimed: cycleDay,
        nextCycleDay: nextCycle,
        silverBalance: Number(bal[0]?.silver) || 0,
        foodBalance: Number(bal[0]?.food) || 0,
        checkIn,
        factionBonusGranted: extraBonusNamed.factionRewards
          ? {
              rewards: extraBonusNamed.factionRewards,
              displayShort: extraBonusNamed.displayShort,
            }
          : null,
        positionBonusGranted:
          extraBonusNamed.positionSilver > 0
            ? { silver: extraBonusNamed.positionSilver }
            : null,
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
  try {
    const itemNameById = await loadItemNamesForConfig();
    const rewardsByDay = buildRewardsByDayPayload(itemNameById);
    const section = await buildCheckinSection(playerId, rewardsByDay);
    return !!section.canCheckIn;
  } catch {
    return false;
  }
}

module.exports = {
  getDailyReport,
  claimDailyCheckIn,
  hasCheckinNotifyDot,
  buildCheckinSection,
};
