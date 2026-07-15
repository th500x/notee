/**
 * 三公府 · 互动 · 封赏 · 俸禄：按势力国力档位（supplyTier S～D）每日领取银两与粮草；
 * 叠加当前官职 position_bonuses（声望/贡献固定整数、银粮 ×resource 倍数）。
 */

const { pool } = require('../database/connection');
const factionOverviewService = require('./factionOverviewService');
const statisticsDeltaService = require('./statisticsDeltaService');
const factionPolicyService = require('./factionPolicyService');
const {
  applyStipendResourceMultiplier,
  loadPositionStipendBonusesForPlayer,
} = require('../../shared/utils/positionStipendBonuses.cjs');
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
  const positionStipend = await loadPositionStipendBonusesForPlayer(pool, pid);

  return {
    claimedToday,
    remainingToday: claimedToday ? 0 : maxPerDay,
    maxPerDay,
    supplyTier,
    canClaim,
    blockReason,
    positionStipend,
  };
}

/**
 * 君主大司空传书俸禄：与 claimStipend 同公式，但不占用 san_gong_stipend_claim_date
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {string} playerId
 * @param {string} supplyTier
 * @returns {Promise<{ ok: true, silver: number, food: number, reputationGrant: number, contributionGrant: number } | { ok: false, error: string }>}
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

  const positionStipend = await loadPositionStipendBonusesForPlayer(connection, pid);
  const { silver, food } = applyStipendResourceMultiplier(
    rolled.silver,
    rolled.food,
    positionStipend.resourceMultiplier,
  );
  const { reputationGrant, contributionGrant } = positionStipend;

  const playerSets = ['silver = silver + ?', 'food = food + ?'];
  const playerParams = [silver, food];
  if (reputationGrant > 0) {
    playerSets.push('reputation = reputation + ?');
    playerParams.push(reputationGrant);
  }
  if (contributionGrant > 0) {
    playerSets.push('contribution = GREATEST(0, contribution + ?)');
    playerParams.push(contributionGrant);
  }
  playerParams.push(pid);
  await connection.query(
    `UPDATE players SET ${playerSets.join(', ')} WHERE player_id = ?`,
    playerParams,
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
    reputationGrant,
    contributionGrant,
    resourceMultiplier: positionStipend.resourceMultiplier,
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
  const positionStipend = await loadPositionStipendBonusesForPlayer(pool, pid);
  const baseSilver = rolled.silver;
  const baseFood = rolled.food;
  const { silver: appliedSilver, food: appliedFood } = applyStipendResourceMultiplier(
    baseSilver,
    baseFood,
    positionStipend.resourceMultiplier,
  );
  let silver = appliedSilver;
  let food = appliedFood;
  const { reputationGrant, contributionGrant } = positionStipend;

  // 11-3 §3.1 粮饷加成 Bonus 的运行结果（在 try 内填值；外部统计与返回体也要引用）
  let bonusSilver = 0;
  let bonusFood = 0;
  let bonusPctApplied = 0;

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

    // 11-3 §3.1 粮饷加成 Bonus：在 claimStipend 同事务挂 5%~50% 追加 Bonus，
    // 自势力池（faction_reserve · pool）扣；池不足时 **仅 Bonus 不发**（基础 B 照常入账，符合 §3.1 O1）。
    // Bonus 基数 B 取 §8.4.2.2 第 2 步「官职 resource 倍数」applied 后 写入玩家的 (silver, food) — 即本函数的 silver/food。
    try {
      const eff = await factionPolicyService.getEffectiveRationBonus(overview.data.factionId);
      bonusPctApplied = Number(eff.bonusPct) || 0;
      if (bonusPctApplied > 0) {
        const wantSilver = Math.floor((silver * bonusPctApplied) / 100);
        const wantFood = Math.floor((food * bonusPctApplied) / 100);
        if (wantSilver > 0 || wantFood > 0) {
          const bal = await factionReserveService.getPoolBalance(conn, overview.data.factionId, {
            forUpdate: true,
          });
          const rs = bal.silver;
          const rf = bal.food;
          if (rs >= wantSilver && rf >= wantFood) {
            await factionReserveService.deductPoolOnConnection(conn, overview.data.factionId, {
              silver: wantSilver,
              food: wantFood,
            });
            await factionReserveService.addUsageOnConnection(
              conn,
              overview.data.factionId,
              factionReserveService.CATEGORY.STIPEND_BONUS,
              { silver: wantSilver, food: wantFood },
            );
            bonusSilver = wantSilver;
            bonusFood = wantFood;
          } else {
            // 池不足：仅 Bonus 不发，基础俸禄继续入账（不抛错、不消费政策 CD）
            console.log(
              `[stipendBonus] insufficient reserves faction=${overview.data.factionId} ` +
                `want=${wantSilver}/${wantFood} have=${rs}/${rf} → bonus dropped`,
            );
          }
        }
      }
    } catch (bonusErr) {
      // Bonus 计算或扣减出错不能拖垮主流程；记日志即可，仍按基础 B 入账
      console.error('[stipendBonus] failed to apply ration_bonus (basic stipend unaffected):', bonusErr);
    }

    const totalSilver = silver + bonusSilver;
    const totalFood = food + bonusFood;
    const playerSets = ['silver = silver + ?', 'food = food + ?'];
    const playerParams = [totalSilver, totalFood];
    if (reputationGrant > 0) {
      playerSets.push('reputation = reputation + ?');
      playerParams.push(reputationGrant);
    }
    if (contributionGrant > 0) {
      playerSets.push('contribution = GREATEST(0, contribution + ?)');
      playerParams.push(contributionGrant);
    }
    playerParams.push(pid);
    await conn.query(
      `UPDATE players SET ${playerSets.join(', ')} WHERE player_id = ?`,
      playerParams,
    );
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

  // 统计：银粮入账 player_statistics；俸禄声望/贡献仅改 players，不计活动榜/大司空日榜 earned（32-3 §4 · 26-1 §7.2）
  const finalSilver = silver + (bonusSilver || 0);
  const finalFood = food + (bonusFood || 0);
  await statisticsDeltaService.recordEarned(pid, {
    ...(finalSilver > 0 ? { silver: finalSilver } : {}),
    ...(finalFood > 0 ? { food: finalFood } : {}),
  });

  return {
    ok: true,
    silver: finalSilver,
    food: finalFood,
    supplyTier,
    /** 本次 80～120 随机百分比（展示用） */
    rollPercent: rolled.rollPercent,
    tierCoeff: rolled.tierCoeff,
    /** 随机后的基础俸禄 B（官职倍数前） */
    baseSilver,
    baseFood,
    /** 官职 resource 倍数 applied 后、粮饷政策 Bonus 前 */
    appliedSilver,
    appliedFood,
    /** 政策 Bonus 实际入账（池不足时为 0；用于前端显示「俸禄 + Bonus」） */
    rationBonus: {
      bonusPctApplied: bonusPctApplied || 0,
      bonusSilver: bonusSilver || 0,
      bonusFood: bonusFood || 0,
      /** 政策上配置的 pct（若 pool 不足导致未发，仍能让 UI 提示玩家） */
      attemptedPct: bonusPctApplied || 0,
    },
    resourceMultiplier: positionStipend.resourceMultiplier,
    reputationGranted: reputationGrant,
    contributionGranted: contributionGrant,
  };
}

module.exports = {
  getStipendStatus,
  claimStipend,
  grantKingStipendBonusOnConnection,
  rollStipendAmountsForTier,
  SILVER_COEFFICIENT_BY_TIER,
  MAX_CLAIMS_PER_CALENDAR_DAY,
};
