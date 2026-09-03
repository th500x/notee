/**
 * 三公府 · 封赏 · 银粮兑换（玩家 ↔ 势力 pool）
 */

const { pool } = require('../database/connection');
const factionOverviewService = require('./factionOverviewService');
const factionReserveService = require('./factionReserveService');
const statisticsDeltaService = require('./statisticsDeltaService');
const { SILVER_COEFFICIENT_BY_TIER } = require('./stipendTierCoefficients');
const { loadPositionStipendBonusesForPlayer } = require('../../shared/utils/positionStipendBonuses.cjs');
const {
  PACK_IDS,
  PACK_META,
  normalizePackId,
  computeExchangeBase,
  evaluatePackExchange,
  poolImbalanceRatio,
} = require('../../shared/utils/sanGongResourceExchange.cjs');

const PACK_DATE_COLUMNS = Object.freeze({
  silver_food_a: 'san_gong_exchange_silver_food_a_date',
  silver_food_b: 'san_gong_exchange_silver_food_b_date',
  food_silver_a: 'san_gong_exchange_food_silver_a_date',
  food_silver_b: 'san_gong_exchange_food_silver_b_date',
});

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
 * @param {object|null|undefined} peRow
 * @param {string} todayStr
 */
function readPackClaimedToday(peRow, packId, todayStr) {
  const col = PACK_DATE_COLUMNS[packId];
  if (!col || !peRow) return false;
  const stored = mysqlDateToYmd(peRow[col]);
  return !!(stored && stored === todayStr);
}

/**
 * @param {string} playerId
 * @param {import('mysql2/promise').PoolConnection|null} [conn]
 */
async function loadExchangeContext(playerId, conn = null) {
  const pid = String(playerId || '').trim();
  if (!pid) return { ok: false, status: 400, error: '缺少 playerId' };

  const overview = await factionOverviewService.getFactionOverviewForPlayer(pid);
  if (overview?.notFound) return { ok: false, status: 404, error: '玩家不存在' };
  if (!overview?.data?.factionId) {
    return { ok: false, status: 400, error: '无势力归属，无法兑换' };
  }

  const supplyTier = overview.data.supplyTier ?? null;
  if (supplyTier == null) {
    return { ok: false, status: 400, error: '势力国力未达最低档位（D），暂不可兑换' };
  }

  const tierKey = String(supplyTier).toUpperCase();
  const tierCoeff = SILVER_COEFFICIENT_BY_TIER[tierKey];
  const positionStipend = await loadPositionStipendBonusesForPlayer(conn || pool, pid);
  const base = computeExchangeBase(tierCoeff, positionStipend.resourceMultiplier);
  if (!base) {
    return { ok: false, status: 400, error: '兑换基数异常，请确认官职与国力档位' };
  }

  const db = conn || pool;
  const [pRows] = await db.query(
    'SELECT silver, food, faction_id FROM players WHERE player_id = ? LIMIT 1',
    [pid],
  );
  if (!pRows.length) return { ok: false, status: 404, error: '玩家不存在' };
  const playerRow = pRows[0];
  if (String(playerRow.faction_id || '').trim() !== String(overview.data.factionId).trim()) {
    return { ok: false, status: 400, error: '玩家势力不一致' };
  }

  const factionId = String(overview.data.factionId).trim();
  const poolBal = await factionReserveService.getPoolBalance(db, factionId, {
    forUpdate: !!conn,
  });

  let peRow = {};
  let todayStr = null;
  let schemaOk = true;
  try {
    await db.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [pid]);
    const [dr] = await db.query('SELECT CURDATE() AS d');
    todayStr = mysqlDateToYmd(dr[0].d);
    const cols = Object.values(PACK_DATE_COLUMNS).join(', ');
    const [peRows] = await db.query(
      `SELECT ${cols} FROM player_events WHERE player_id = ? LIMIT 1`,
      [pid],
    );
    peRow = peRows[0] || {};
  } catch (e) {
    const msg = e?.message || String(e);
    if (/Unknown column ['`]san_gong_exchange_/i.test(msg)) {
      schemaOk = false;
    } else {
      throw e;
    }
  }

  const ctx = {
    baseSilver: base.baseSilver,
    baseFood: base.baseFood,
    poolSilver: poolBal.silver,
    poolFood: poolBal.food,
  };

  const imbalanceR = poolImbalanceRatio(poolBal.silver, poolBal.food);

  const packs = PACK_IDS.map((packId) => {
    const meta = PACK_META[packId];
    const claimedToday = schemaOk && todayStr ? readPackClaimedToday(peRow, packId, todayStr) : false;
    const ev = evaluatePackExchange(packId, ctx, {
      playerSilver: playerRow.silver,
      playerFood: playerRow.food,
      poolSilver: poolBal.silver,
      poolFood: poolBal.food,
      claimedToday,
    });
    let blockReason = ev.blockReason;
    if (!schemaOk) {
      blockReason =
        '兑换数据未就绪：请执行迁移 player-events-add-san-gong-resource-exchange-daily.sql';
    }
    return {
      packId,
      ...meta,
      ...ev.amounts,
      canExchange: schemaOk && ev.canExchange,
      blockReason,
      claimedToday,
      remainingToday: claimedToday ? 0 : 1,
      maxPerDay: 1,
    };
  });

  return {
    ok: true,
    data: {
      supplyTier: tierKey,
      tierCoeff,
      resourceMultiplier: positionStipend.resourceMultiplier,
      baseSilver: base.baseSilver,
      baseFood: base.baseFood,
      poolSilver: poolBal.silver,
      poolFood: poolBal.food,
      imbalanceR,
      playerSilver: Math.max(0, Math.floor(Number(playerRow.silver) || 0)),
      playerFood: Math.max(0, Math.floor(Number(playerRow.food) || 0)),
      factionId,
      packs,
      schemaOk,
    },
  };
}

/**
 * @param {string} playerId
 */
async function getExchangePreview(playerId) {
  const out = await loadExchangeContext(playerId);
  if (!out.ok) return out;
  return { ok: true, data: out.data };
}

/**
 * @param {string} playerId
 * @param {string} packIdRaw
 */
async function submitExchange(playerId, packIdRaw) {
  const pid = String(playerId || '').trim();
  const packId = normalizePackId(packIdRaw);
  if (!pid) return { ok: false, status: 400, error: '缺少 playerId' };
  if (!packId) return { ok: false, status: 400, error: '无效的兑换包' };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [dr] = await conn.query('SELECT CURDATE() AS d');
    const todayStr = mysqlDateToYmd(dr[0].d);

    await conn.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [pid]);
    const dateCol = PACK_DATE_COLUMNS[packId];
    const [peRows] = await conn.query(
      `SELECT ${dateCol} FROM player_events WHERE player_id = ? FOR UPDATE`,
      [pid],
    );
    if (!peRows.length) {
      await conn.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [pid]);
    }
    const [peLocked] = await conn.query(
      `SELECT ${dateCol} FROM player_events WHERE player_id = ? FOR UPDATE`,
      [pid],
    );
    const pe = peLocked[0] || {};
    if (readPackClaimedToday(pe, packId, todayStr)) {
      await conn.rollback();
      return { ok: false, status: 400, error: '今日该兑换包已使用' };
    }

    const ctxOut = await loadExchangeContext(pid, conn);
    if (!ctxOut.ok) {
      await conn.rollback();
      return { ok: false, status: ctxOut.status || 400, error: ctxOut.error };
    }

    const packPreview = ctxOut.data.packs.find((p) => p.packId === packId);
    if (!packPreview?.canExchange) {
      await conn.rollback();
      return {
        ok: false,
        status: 400,
        error: packPreview?.blockReason || '当前不可兑换',
      };
    }

    const { paySilver, payFood, receiveSilver, receiveFood } = packPreview;

    const [pLock] = await conn.query(
      'SELECT silver, food, faction_id FROM players WHERE player_id = ? FOR UPDATE',
      [pid],
    );
    if (!pLock.length) {
      await conn.rollback();
      return { ok: false, status: 404, error: '玩家不存在' };
    }
    const factionId = String(pLock[0].faction_id || ctxOut.data.factionId || '').trim();
    if (!factionId) {
      await conn.rollback();
      return { ok: false, status: 400, error: '无势力归属' };
    }

    const playerSilver = Math.max(0, Math.floor(Number(pLock[0].silver) || 0));
    const playerFood = Math.max(0, Math.floor(Number(pLock[0].food) || 0));
    if (paySilver > 0 && playerSilver < paySilver) {
      await conn.rollback();
      return { ok: false, status: 400, error: '个人银两不足' };
    }
    if (payFood > 0 && playerFood < payFood) {
      await conn.rollback();
      return { ok: false, status: 400, error: '个人粮草不足' };
    }

    if (paySilver > 0 || payFood > 0) {
      await factionReserveService.creditPoolOnConnection(
        conn,
        factionId,
        { silver: paySilver, food: payFood },
        { ledgerCategory: factionReserveService.CATEGORY.RESOURCE_EXCHANGE_DEPOSIT },
      );
    }

    try {
      await factionReserveService.deductPoolOnConnection(
        conn,
        factionId,
        { silver: receiveSilver, food: receiveFood },
        {
          errorCode: 'INSUFFICIENT_FACTION_RESERVES',
          errorPrefix: '[resourceExchange]',
          ledgerCategory: factionReserveService.CATEGORY.RESOURCE_EXCHANGE_PAYOUT,
        },
      );
    } catch (e) {
      await conn.rollback();
      if (e.code === 'INSUFFICIENT_FACTION_RESERVES') {
        return { ok: false, status: 400, error: e.message || '势力储备不足' };
      }
      throw e;
    }

    const playerSets = [];
    const playerParams = [];
    if (paySilver > 0) {
      playerSets.push('silver = GREATEST(0, silver - ?)');
      playerParams.push(paySilver);
    }
    if (payFood > 0) {
      playerSets.push('food = GREATEST(0, food - ?)');
      playerParams.push(payFood);
    }
    if (receiveSilver > 0) {
      playerSets.push('silver = silver + ?');
      playerParams.push(receiveSilver);
    }
    if (receiveFood > 0) {
      playerSets.push('food = food + ?');
      playerParams.push(receiveFood);
    }
    if (playerSets.length) {
      playerParams.push(pid);
      await conn.query(`UPDATE players SET ${playerSets.join(', ')} WHERE player_id = ?`, playerParams);
    }

    await conn.query(`UPDATE player_events SET ${dateCol} = ? WHERE player_id = ?`, [todayStr, pid]);

    const statDelta = {};
    if (receiveSilver > 0) statDelta.silver = receiveSilver;
    if (receiveFood > 0) statDelta.food = receiveFood;
    if (paySilver > 0) statDelta.silver = (statDelta.silver || 0) - paySilver;
    if (payFood > 0) statDelta.food = (statDelta.food || 0) - payFood;
    if (Object.keys(statDelta).length) {
      await statisticsDeltaService.applyResourceDelta(pid, statDelta, conn);
    }

    await conn.commit();

    return {
      ok: true,
      data: {
        packId,
        paySilver,
        payFood,
        receiveSilver,
        receiveFood,
        poolSilverAfter: ctxOut.data.poolSilver - receiveSilver + paySilver,
        poolFoodAfter: ctxOut.data.poolFood - receiveFood + payFood,
      },
    };
  } catch (e) {
    await conn.rollback();
    const msg = e?.message || String(e);
    if (/Unknown column ['`]san_gong_exchange_/i.test(msg)) {
      return {
        ok: false,
        status: 503,
        error: '数据库缺少兑换日限列。请在 backend 目录执行 node scripts/apply-pending-local-ddl.js',
      };
    }
    console.error('[sanGongResourceExchangeService] submitExchange', e);
    return { ok: false, status: 500, error: '兑换失败' };
  } finally {
    conn.release();
  }
}

module.exports = {
  getExchangePreview,
  submitExchange,
  PACK_DATE_COLUMNS,
};
