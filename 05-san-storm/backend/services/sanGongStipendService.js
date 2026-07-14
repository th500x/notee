/**
 * 俸禄：按势力国力档位（supplyTier S～D）日领银两与粮草。
 * 日俸入口：君主每日传书 `grantDailyStipend`（占 `san_gong_stipend_claim_date`）。
 * 大司空传书：`grantKingStipend` 额外俸禄（不占日领额度）。
 */

const { pool } = require('../database/connection');
const factionOverviewService = require('./factionOverviewService');
const statisticsDeltaService = require('./statisticsDeltaService');
const factionPolicyService = require('./factionPolicyService');
const {
  SILVER_COEFFICIENT_BY_TIER,
  rollStipendAmountsForTier,
} = require('./stipendTierCoefficients');
const factionReserveService = require('./factionReserveService');

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
 * @param {string} playerId
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
 * 君主大司空传书俸禄：与日俸同公式，但不占用 san_gong_stipend_claim_date
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {string} playerId
 * @param {string} supplyTier
 */
async function grantKingStipendBonusOnConnection(connection, playerId, supplyTier) {
  const pid = String(playerId || '').trim();
  const tier = String(supplyTier || '').toUpperCase();
  if (!pid) return { ok: false, error: '缺少 playerId' };
  if (tier == null || SILVER_COEFFICIENT_BY_TIER[tier] == null) {
    return { ok: false, error: '势力国力未达最低档位（D），暂不可领取俸禄' };
  }

  const rolled = rollStipendAmountsForTier(tier);
  if (!rolled || rolled.silver < 1) return { ok: false, error: '俸禄结算异常' };

  const silver = rolled.silver;
  const food = rolled.food;

  await connection.query(
    'UPDATE players SET silver = silver + ?, food = food + ? WHERE player_id = ?',
    [silver, food, pid],
  );

  return {
    ok: true,
    silver,
    food,
    supplyTier: tier,
    rollPercent: rolled.rollPercent,
    tierCoeff: rolled.tierCoeff,
    baseSilver: rolled.silver,
    baseFood: rolled.food,
    appliedSilver: silver,
    appliedFood: food,
    reputationGrant: 0,
    contributionGrant: 0,
    resourceMultiplier: 1,
  };
}

/**
 * 日俸：写 san_gong_stipend_claim_date；须在调用方事务内使用。
 * 不调用 recordEarned（由 textsService / claimStipend 在 commit 后处理）。
 *
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {string} playerId
 */
async function grantDailyStipendOnConnection(connection, playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) return { ok: false, error: '缺少 playerId' };

  const overview = await factionOverviewService.getFactionOverviewForPlayer(pid);
  if (overview?.notFound) return { ok: false, error: '玩家不存在' };
  if (!overview?.data?.factionId) return { ok: false, error: '无势力归属，无法领取俸禄' };
  const supplyTier = overview.data.supplyTier;
  if (supplyTier == null) {
    return { ok: false, error: '势力国力未达最低档位（D），暂不可领取俸禄' };
  }

  const rolled = rollStipendAmountsForTier(supplyTier);
  if (!rolled || rolled.silver < 1) return { ok: false, error: '俸禄结算异常' };
  const baseSilver = rolled.silver;
  const baseFood = rolled.food;
  let silver = baseSilver;
  let food = baseFood;

  let bonusSilver = 0;
  let bonusFood = 0;
  let bonusPctApplied = 0;

  const [dr] = await connection.query('SELECT CURDATE() AS d');
  const todayStr = mysqlDateToYmd(dr[0].d);

  let [peRows] = await connection.query(
    'SELECT san_gong_stipend_claim_date FROM player_events WHERE player_id = ? FOR UPDATE',
    [pid],
  );
  if (!peRows.length) {
    await connection.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [pid]);
    [peRows] = await connection.query(
      'SELECT san_gong_stipend_claim_date FROM player_events WHERE player_id = ? FOR UPDATE',
      [pid],
    );
  }
  const stored = mysqlDateToYmd(peRows[0]?.san_gong_stipend_claim_date);
  if (stored && stored === todayStr) {
    return { ok: false, error: '今日俸禄已领取', alreadyClaimed: true };
  }

  try {
    const eff = await factionPolicyService.getEffectiveRationBonus(overview.data.factionId);
    bonusPctApplied = Number(eff.bonusPct) || 0;
    if (bonusPctApplied > 0) {
      const wantSilver = Math.floor((silver * bonusPctApplied) / 100);
      const wantFood = Math.floor((food * bonusPctApplied) / 100);
      if (wantSilver > 0 || wantFood > 0) {
        const bal = await factionReserveService.getPoolBalance(connection, overview.data.factionId, {
          forUpdate: true,
        });
        const rs = bal.silver;
        const rf = bal.food;
        if (rs >= wantSilver && rf >= wantFood) {
          await factionReserveService.deductPoolOnConnection(connection, overview.data.factionId, {
            silver: wantSilver,
            food: wantFood,
          });
          await factionReserveService.addUsageOnConnection(
            connection,
            overview.data.factionId,
            factionReserveService.CATEGORY.STIPEND_BONUS,
            { silver: wantSilver, food: wantFood },
          );
          bonusSilver = wantSilver;
          bonusFood = wantFood;
        } else {
          console.log(
            `[stipendBonus] insufficient reserves faction=${overview.data.factionId} ` +
              `want=${wantSilver}/${wantFood} have=${rs}/${rf} → bonus dropped`,
          );
        }
      }
    }
  } catch (bonusErr) {
    console.error('[stipendBonus] failed to apply ration_bonus (basic stipend unaffected):', bonusErr);
  }

  const totalSilver = silver + bonusSilver;
  const totalFood = food + bonusFood;
  await connection.query(
    'UPDATE players SET silver = silver + ?, food = food + ? WHERE player_id = ?',
    [totalSilver, totalFood, pid],
  );
  await connection.query(`UPDATE player_events SET san_gong_stipend_claim_date = ? WHERE player_id = ?`, [
    todayStr,
    pid,
  ]);

  return {
    ok: true,
    silver: totalSilver,
    food: totalFood,
    supplyTier,
    rollPercent: rolled.rollPercent,
    tierCoeff: rolled.tierCoeff,
    baseSilver,
    baseFood,
    appliedSilver: silver,
    appliedFood: food,
    rationBonus: {
      bonusPctApplied: bonusPctApplied || 0,
      bonusSilver: bonusSilver || 0,
      bonusFood: bonusFood || 0,
      attemptedPct: bonusPctApplied || 0,
    },
    resourceMultiplier: 1,
    reputationGranted: 0,
    contributionGranted: 0,
  };
}

/**
 * 独立事务领取日俸（调试/兼容；生产入口为传书 claim）。
 * @param {string} playerId
 */
async function claimStipend(playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) return { ok: false, status: 400, error: '缺少 playerId' };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await grantDailyStipendOnConnection(conn, pid);
    if (!out.ok) {
      await conn.rollback();
      const status = out.alreadyClaimed ? 400 : out.error === '玩家不存在' ? 404 : 400;
      return { ok: false, status, error: out.error };
    }
    await conn.commit();

    await statisticsDeltaService.recordEarned(pid, {
      ...(out.silver > 0 ? { silver: out.silver } : {}),
      ...(out.food > 0 ? { food: out.food } : {}),
    });

    return { ok: true, ...out };
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
}

module.exports = {
  getStipendStatus,
  claimStipend,
  grantDailyStipendOnConnection,
  grantKingStipendBonusOnConnection,
  rollStipendAmountsForTier,
  SILVER_COEFFICIENT_BY_TIER,
  MAX_CLAIMS_PER_CALENDAR_DAY,
};
