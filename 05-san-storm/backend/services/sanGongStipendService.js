/**
 * 三公府 · 互动 · 封赏 · 俸禄：按势力国力档位（supplyTier S～D，与 11-1 / factionSupplyTierService 一致）每日领取银两与粮草。
 */

const { pool } = require('../database/connection');
const factionOverviewService = require('./factionOverviewService');
const statisticsDeltaService = require('./statisticsDeltaService');

/** 国力档位 → 银两基准系数（粮草 = 本次银两 × 5，同一随机因子） */
const SILVER_COEFFICIENT_BY_TIER = {
  S: 300,
  A: 240,
  B: 180,
  C: 120,
  D: 60,
};

const MAX_CLAIMS_PER_CALENDAR_DAY = 1;

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
 * 本次俸禄百分比：在 **80～120（含）** 整数上均匀随机，再按 `floor(coeff × pct / 100)` 发银两，
 * 使 S 档银两必在 **240～360**、粮草在 **1200～1800**（粮草恒为银两 ×5）。
 * @returns {number} 80..120
 */
function randomStipendPercentInclusive() {
  return 80 + Math.floor(Math.random() * 41);
}

/**
 * @param {string} tier
 * @returns {{ silver: number, food: number } | null}
 */
function rollStipendAmountsForTier(tier) {
  const t = String(tier || '').toUpperCase();
  const coeff = SILVER_COEFFICIENT_BY_TIER[t];
  if (coeff == null) return null;
  const pct = randomStipendPercentInclusive();
  const silver = Math.floor((coeff * pct) / 100);
  const food = silver * 5;
  return { silver, food };
}

/**
 * @param {string} playerId
 * @returns {Promise<{
 *   claimedToday: boolean,
 *   remainingToday: number,
 *   maxPerDay: number,
 *   supplyTier: string | null,
 *   canClaim: boolean,
 *   blockReason: string | null,
 * }>}
 */
async function getStipendStatus(playerId) {
  const pid = String(playerId || '').trim();
  const maxPerDay = MAX_CLAIMS_PER_CALENDAR_DAY;
  if (!pid) {
    return {
      claimedToday: false,
      remainingToday: maxPerDay,
      maxPerDay,
      supplyTier: null,
      canClaim: false,
      blockReason: '缺少玩家',
    };
  }

  let claimedToday = false;
  let stipendDateSchemaOk = true;
  try {
    await pool.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [pid]);
    const [rows] = await pool.query(
      'SELECT san_gong_stipend_claim_date FROM player_events WHERE player_id = ?',
      [pid],
    );
    const [dr] = await pool.query('SELECT CURDATE() AS d');
    const todayStr = mysqlDateToYmd(dr[0].d);
    const stored = mysqlDateToYmd(rows[0]?.san_gong_stipend_claim_date);
    claimedToday = !!(stored && stored === todayStr);
  } catch (e) {
    const msg = e?.message || String(e);
    if (/Unknown column ['`]san_gong_stipend_claim_date/i.test(msg)) {
      stipendDateSchemaOk = false;
      claimedToday = false;
    } else {
      throw e;
    }
  }

  const overview = await factionOverviewService.getFactionOverviewForPlayer(pid);
  const supplyTier =
    overview && overview.data && !overview.notFound ? overview.data.supplyTier ?? null : null;

  let blockReason = null;
  if (!stipendDateSchemaOk) {
    blockReason =
      '俸禄数据未就绪：请在服务器执行迁移 `player-events-add-san-gong-stipend-claim-date.sql`（或本地 `node scripts/apply-pending-local-ddl.js`）后重试';
  } else if (overview?.notFound) blockReason = '玩家不存在';
  else if (!overview?.data?.factionId) blockReason = '无势力归属，无法领取俸禄';
  else if (supplyTier == null) blockReason = '势力国力未达最低档位（D），暂不可领取俸禄';
  else if (claimedToday) blockReason = '今日俸禄已领取';

  const canClaim = !blockReason;

  return {
    claimedToday,
    remainingToday: claimedToday ? 0 : maxPerDay,
    maxPerDay,
    supplyTier,
    canClaim,
    blockReason,
  };
}

/**
 * @param {string} playerId
 * @returns {Promise<
 *   | { ok: true; silver: number; food: number; supplyTier: string }
 *   | { ok: false; status: number; error: string }
 * >}
 */
async function claimStipend(playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) return { ok: false, status: 400, error: '缺少 playerId' };

  const overview = await factionOverviewService.getFactionOverviewForPlayer(pid);
  if (overview?.notFound) return { ok: false, status: 404, error: '玩家不存在' };
  if (!overview?.data?.factionId) return { ok: false, status: 400, error: '无势力归属，无法领取俸禄' };
  const supplyTier = overview.data.supplyTier;
  if (supplyTier == null) {
    return { ok: false, status: 400, error: '势力国力未达最低档位（D），暂不可领取俸禄' };
  }

  const rolled = rollStipendAmountsForTier(supplyTier);
  if (!rolled || rolled.silver < 1) return { ok: false, status: 500, error: '俸禄结算异常' };
  const { silver, food } = rolled;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [dr] = await conn.query('SELECT CURDATE() AS d');
    const todayStr = mysqlDateToYmd(dr[0].d);

    let [peRows] = await conn.query(
      'SELECT san_gong_stipend_claim_date FROM player_events WHERE player_id = ? FOR UPDATE',
      [pid],
    );
    if (!peRows.length) {
      await conn.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [pid]);
      [peRows] = await conn.query(
        'SELECT san_gong_stipend_claim_date FROM player_events WHERE player_id = ? FOR UPDATE',
        [pid],
      );
    }
    const stored = mysqlDateToYmd(peRows[0]?.san_gong_stipend_claim_date);
    if (stored && stored === todayStr) {
      await conn.rollback();
      return { ok: false, status: 400, error: '今日俸禄已领取' };
    }

    await conn.query('UPDATE players SET silver = silver + ?, food = food + ? WHERE player_id = ?', [
      silver,
      food,
      pid,
    ]);
    await conn.query(`UPDATE player_events SET san_gong_stipend_claim_date = ? WHERE player_id = ?`, [
      todayStr,
      pid,
    ]);

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    const msg = e?.message || String(e);
    if (/Unknown column ['`]san_gong_stipend_claim_date/i.test(msg)) {
      return {
        ok: false,
        status: 503,
        error: '数据库缺少俸禄领取日列。请在 backend 目录执行 node scripts/apply-pending-local-ddl.js',
      };
    }
    console.error('[sanGongStipendService] claimStipend', e);
    return { ok: false, status: 500, error: '俸禄发放失败' };
  } finally {
    conn.release();
  }

  await statisticsDeltaService.recordEarned(pid, {
    ...(silver > 0 ? { silver } : {}),
    ...(food > 0 ? { food } : {}),
  });

  return { ok: true, silver, food, supplyTier };
}

module.exports = {
  getStipendStatus,
  claimStipend,
  rollStipendAmountsForTier,
  SILVER_COEFFICIENT_BY_TIER,
  MAX_CLAIMS_PER_CALENDAR_DAY,
};
