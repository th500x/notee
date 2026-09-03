/**
 * 真三日报 · digest 快照只读（32-6 §9）
 * 生成 cron 后续实装；本模块仅读 daily_report_digests。
 */

const { pool } = require('../database/connection');

function mysqlDateToYmd(val) {
  if (val == null) return null;
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/**
 * @param {string} serverId
 * @param {string} digestDateYmd YYYY-MM-DD
 * @returns {Promise<object|null>}
 */
async function getDigestPayload(serverId, digestDateYmd) {
  const sid = String(serverId || '').trim() || 'default';
  const dateYmd = String(digestDateYmd || '').slice(0, 10);
  if (!dateYmd) return null;
  try {
    const [rows] = await pool.query(
      `SELECT payload_json FROM daily_report_digests
       WHERE digest_date = ? AND server_id = ?
       LIMIT 1`,
      [dateYmd, sid],
    );
    const raw = rows[0]?.payload_json;
    if (raw == null) return null;
    if (typeof raw === 'object') return raw;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  } catch (e) {
    if (/doesn't exist|Unknown table/i.test(e?.message || '')) return null;
    throw e;
  }
}

/**
 * 昨日自然日 digest（相对 MySQL CURDATE）
 * @param {string} serverId
 */
async function getYesterdayDigestPayload(serverId) {
  const [dr] = await pool.query('SELECT DATE_SUB(CURDATE(), INTERVAL 1 DAY) AS y');
  const ymd = mysqlDateToYmd(dr[0]?.y);
  if (!ymd) return null;
  return getDigestPayload(serverId, ymd);
}

module.exports = {
  getDigestPayload,
  getYesterdayDigestPayload,
  mysqlDateToYmd,
};
