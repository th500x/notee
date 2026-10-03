/**
 * eth_week_signals 读写。
 */

const { query } = require('../../database/connection');
const { ETH_WEEK_BIAS } = require('../../constants/ethSubscribe');
const { formatWeekSignalRow } = require('./weekSignalFormat');
const { toNumberOrNull } = require('./formatSignal');

const WEEK_ID_RE = /^(\d{4})-W(\d{2})$/;

function parseWeekIdParts(weekId) {
  const match = String(weekId || '').trim().match(WEEK_ID_RE);
  if (!match) return null;
  const year = Number(match[1]);
  const weekNumber = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 53) {
    return null;
  }
  return { year, weekNumber };
}

/** ISO 周：含 1 月 4 日的那周为 W01；返回该周周一 00:00 UTC ms */
function isoWeekOpenTimeMs(year, weekNumber) {
  const jan4 = Date.UTC(year, 0, 4);
  const day = new Date(jan4).getUTCDay() || 7;
  const mondayWeek1 = jan4 - (day - 1) * 86400000;
  return mondayWeek1 + (weekNumber - 1) * 7 * 86400000;
}

function normalizeBias(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === ETH_WEEK_BIAS.LONG || raw === 'long') return ETH_WEEK_BIAS.LONG;
  if (raw === ETH_WEEK_BIAS.SHORT || raw === 'short') return ETH_WEEK_BIAS.SHORT;
  if (raw === ETH_WEEK_BIAS.NEUTRAL || raw === 'neutral') return ETH_WEEK_BIAS.NEUTRAL;
  return null;
}

function normalizeBadge(value) {
  if (value == null || value === '') return null;
  const raw = String(value).trim().toLowerCase();
  if (raw === 'buy' || raw === 'sell') return raw;
  return null;
}

function normalizeWeekSignalInput(body) {
  const weekId = String(body && body.weekId ? body.weekId : '').trim();
  const parts = parseWeekIdParts(weekId);
  if (!parts) {
    const err = new Error('weekId 无效');
    err.code = 'BAD_WEEK_ID';
    err.status = 400;
    throw err;
  }
  const bias = normalizeBias(body.bias);
  if (!bias) {
    const err = new Error('bias 须为 long / short / neutral');
    err.code = 'BAD_WEEK_BIAS';
    err.status = 400;
    throw err;
  }
  const openFromBody = Number(body.weekOpenTime);
  const weekOpenTime = Number.isFinite(openFromBody) && openFromBody > 0
    ? openFromBody
    : isoWeekOpenTimeMs(parts.year, parts.weekNumber);
  return {
    weekId,
    weekOpenTime,
    bias,
    personalRating: toNumberOrNull(body.personalRating),
    t0Must: normalizeBadge(body.t0Must),
    t1Recommend: normalizeBadge(body.t1Recommend),
    ethWeekAvg: toNumberOrNull(body.ethWeekAvg),
  };
}

function shouldStoreWeekSignal(input) {
  if (input.bias === ETH_WEEK_BIAS.LONG || input.bias === ETH_WEEK_BIAS.SHORT) return true;
  if (input.t0Must || input.t1Recommend) return true;
  return false;
}

async function getWeekSignalById(weekId) {
  const rows = await query(
    `SELECT week_id, week_open_time, bias, personal_rating, t0_must, t1_recommend, eth_week_avg, broadcast_done
     FROM eth_week_signals
     WHERE week_id = ?
     LIMIT 1`,
    [String(weekId || '').trim()]
  );
  return rows[0] || null;
}

async function upsertWeekSignal(body) {
  const input = normalizeWeekSignalInput(body);
  if (!shouldStoreWeekSignal(input)) {
    return { stored: false, reason: 'NO_SIGNAL', weekId: input.weekId };
  }
  const existing = await getWeekSignalById(input.weekId);
  await query(
    `INSERT INTO eth_week_signals
      (week_id, week_open_time, bias, personal_rating, t0_must, t1_recommend, eth_week_avg)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       week_open_time = VALUES(week_open_time),
       bias = VALUES(bias),
       personal_rating = VALUES(personal_rating),
       t0_must = VALUES(t0_must),
       t1_recommend = VALUES(t1_recommend),
       eth_week_avg = VALUES(eth_week_avg)`,
    [
      input.weekId,
      input.weekOpenTime,
      input.bias,
      input.personalRating,
      input.t0Must,
      input.t1Recommend,
      input.ethWeekAvg,
    ]
  );
  const row = await getWeekSignalById(input.weekId);
  return {
    stored: true,
    alreadyBroadcast: Boolean(existing && Number(existing.broadcast_done) === 1),
    signal: formatWeekSignalRow(row),
    row,
  };
}

async function markWeekBroadcastDone(weekId) {
  await query('UPDATE eth_week_signals SET broadcast_done = 1 WHERE week_id = ?', [
    String(weekId || '').trim(),
  ]);
}

async function listRecentWeekSignalsForAccount(accountId, limit = 40) {
  const cap = Math.min(Math.max(Number(limit) || 40, 1), 100);
  const rows = await query(
    `SELECT
       w.week_id,
       w.week_open_time,
       w.bias,
       w.personal_rating,
       w.t0_must,
       w.t1_recommend,
       w.eth_week_avg,
       t.id AS trade_id
     FROM eth_week_signals w
     LEFT JOIN eth_ma_trade_logs t
       ON t.signal_source = 'week' AND t.week_id = w.week_id AND t.account_id = ?
     ORDER BY w.week_open_time DESC
     LIMIT ?`,
    [accountId, cap]
  );
  return rows.map((row) => formatWeekSignalRow(row, { hasTrade: Boolean(row.trade_id) }));
}

module.exports = {
  parseWeekIdParts,
  isoWeekOpenTimeMs,
  normalizeWeekSignalInput,
  shouldStoreWeekSignal,
  getWeekSignalById,
  upsertWeekSignal,
  markWeekBroadcastDone,
  listRecentWeekSignalsForAccount,
};
