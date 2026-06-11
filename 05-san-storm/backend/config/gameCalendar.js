/**
 * 游戏自然日 / 日切口径：固定东八区（北京时间），不读 CRON_TZ 或进程本地时区。
 * 与道路日配额、俸禄、势力储备 00:00、大司空决选等同源。
 */

const GAME_CALENDAR_TZ = 'Asia/Shanghai';
const GAME_CALENDAR_MYSQL_OFFSET = '+08:00';
const MS_PER_HOUR = 60 * 60 * 1000;
const GAME_CALENDAR_OFFSET_MS = 8 * MS_PER_HOUR;

function cronScheduleOptions() {
  return { timezone: GAME_CALENDAR_TZ };
}

/** MySQL session 初始化（连接池每条连接执行一次；使 CURDATE() / NOW() 按东八区） */
const INIT_SESSION_TIME_ZONE_SQL = `SET time_zone = '${GAME_CALENDAR_MYSQL_OFFSET}'`;

/**
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} db
 * @returns {Promise<string|null>} YYYY-MM-DD
 */
async function queryGameCalendarDateYmd(db) {
  const [rows] = await db.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS d");
  return rows[0]?.d ? String(rows[0].d).slice(0, 10) : null;
}

/**
 * 东八区 CURDATE() 偏移 N 天（N=1 → 昨日 YYYY-MM-DD）
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} db
 * @param {number} daysAgo
 */
async function queryGameCalendarDateOffsetYmd(db, daysAgo = 1) {
  const n = Math.max(0, Math.floor(Number(daysAgo) || 0));
  const [rows] = await db.query(
    "SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL ? DAY), '%Y-%m-%d') AS d",
    [n],
  );
  return rows[0]?.d ? String(rows[0].d).slice(0, 10) : null;
}

/** 东八区当前自然小时的整点 ms（供 AI 君主 hourly 调度） */
function gameCalendarHourStartMs(nowMs = Date.now()) {
  const shifted = nowMs + GAME_CALENDAR_OFFSET_MS;
  return shifted - (shifted % MS_PER_HOUR) - GAME_CALENDAR_OFFSET_MS;
}

/** 东八区小时 key：YYYY-MM-DDTHH */
function gameCalendarHourKeyOfMs(nowMs = Date.now()) {
  const shifted = nowMs + GAME_CALENDAR_OFFSET_MS;
  const d = new Date(shifted);
  const Y = d.getUTCFullYear();
  const M = String(d.getUTCMonth() + 1).padStart(2, '0');
  const D = String(d.getUTCDate()).padStart(2, '0');
  const H = String(d.getUTCHours()).padStart(2, '0');
  return `${Y}-${M}-${D}T${H}`;
}

module.exports = {
  GAME_CALENDAR_TZ,
  GAME_CALENDAR_MYSQL_OFFSET,
  MS_PER_HOUR,
  cronScheduleOptions,
  INIT_SESSION_TIME_ZONE_SQL,
  queryGameCalendarDateYmd,
  queryGameCalendarDateOffsetYmd,
  gameCalendarHourStartMs,
  gameCalendarHourKeyOfMs,
};
