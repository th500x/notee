/**
 * 官员谏言 · 上供银两（扣玩家银 → 势力 pool 入账 + 官员贡献）
 *
 * @see 12-1-POSITION_SYSTEM.md §9.4
 */

const { httpError } = require('../utils/httpError');
const factionReserveService = require('./factionReserveService');
const statisticsDeltaService = require('./statisticsDeltaService');
const {
  normalizeTributeSilver,
  tributeContributionGrant,
} = require('../../shared/utils/remonstranceTributeSilver.cjs');

/**
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {{ playerId: string, factionId: string, tributeSilver: number }} input
 * @returns {Promise<{ tributeSilver: number, contributionGranted: number }>}
 */
async function applyRemonstranceTributeOnConnection(conn, input) {
  const playerId = String(input?.playerId || '').trim();
  const factionId = String(input?.factionId || '').trim();
  const amount = normalizeTributeSilver(input?.tributeSilver);
  if (amount == null) {
    throw httpError(400, '上供银两须为 100 的整数倍（0 表示不上供）', 'TRIBUTE_SILVER_INVALID');
  }
  if (amount === 0) {
    return { tributeSilver: 0, contributionGranted: 0 };
  }
  if (!playerId || !factionId) {
    throw httpError(400, '缺少 playerId 或 factionId', 'TRIBUTE_MISSING_CONTEXT');
  }

  const [rows] = await conn.query(
    'SELECT silver, faction_id FROM players WHERE player_id = ? FOR UPDATE',
    [playerId],
  );
  if (!rows.length) {
    throw httpError(404, '玩家不存在', 'PLAYER_NOT_FOUND');
  }
  const row = rows[0];
  if (String(row.faction_id || '').trim() !== factionId) {
    throw httpError(403, '玩家势力与谏言目标不符', 'TRIBUTE_FACTION_MISMATCH');
  }
  const balance = Math.max(0, Math.floor(Number(row.silver) || 0));
  if (balance < amount) {
    throw httpError(
      400,
      `个人银两不足以支付上供（需 ${amount}，当前 ${balance}）`,
      'INSUFFICIENT_PLAYER_SILVER',
    );
  }

  const contributionGranted = tributeContributionGrant(amount);
  await conn.query(
    'UPDATE players SET silver = GREATEST(0, silver - ?), contribution = contribution + ? WHERE player_id = ?',
    [amount, contributionGranted, playerId],
  );
  await factionReserveService.creditPoolOnConnection(
    conn,
    factionId,
    { silver: amount, food: 0 },
    { ledgerCategory: factionReserveService.CATEGORY.REMONSTRANCE_TRIBUTE },
  );
  await statisticsDeltaService.applyResourceDelta(
    playerId,
    { silver: -amount, contribution: contributionGranted },
    conn,
  );

  return { tributeSilver: amount, contributionGranted };
}

/**
 * 独立事务扣上供（0 银则 no-op）。供战事/政策谏言路由复用。
 *
 * @param {import('mysql2/promise').Pool} dbPool
 * @param {{ playerId: string, factionId: string, tributeSilver: number }} input
 */
async function applyRemonstranceTributeStandalone(dbPool, input) {
  const amount = normalizeTributeSilver(input?.tributeSilver);
  if (!amount) {
    return { tributeSilver: 0, contributionGranted: 0 };
  }
  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await applyRemonstranceTributeOnConnection(conn, input);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      /* ignore */
    }
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * 审批前校验（不扣款）
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').PoolConnection} db
 */
async function assertPlayerCanAffordTribute(db, playerId, tributeSilver) {
  const amount = normalizeTributeSilver(tributeSilver);
  if (amount == null) {
    throw httpError(400, '上供银两须为 100 的整数倍（0 表示不上供）', 'TRIBUTE_SILVER_INVALID');
  }
  if (amount === 0) return;
  const pid = String(playerId || '').trim();
  if (!pid) {
    throw httpError(400, '缺少 playerId', 'TRIBUTE_MISSING_PLAYER');
  }
  const [rows] = await db.query('SELECT silver FROM players WHERE player_id = ?', [pid]);
  if (!rows.length) {
    throw httpError(404, '玩家不存在', 'PLAYER_NOT_FOUND');
  }
  const balance = Math.max(0, Math.floor(Number(rows[0].silver) || 0));
  if (balance < amount) {
    throw httpError(
      400,
      `个人银两不足以支付上供（需 ${amount}，当前 ${balance}）`,
      'INSUFFICIENT_PLAYER_SILVER',
    );
  }
}

module.exports = {
  applyRemonstranceTributeOnConnection,
  applyRemonstranceTributeStandalone,
  assertPlayerCanAffordTribute,
  normalizeTributeSilver,
};
