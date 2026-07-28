/**
 * 三公府 · 封赏 · 军备：消耗贡献兑换兵符 / 玉牌（日限各 5）
 */

const { pool } = require('../database/connection');
const statisticsDeltaService = require('./statisticsDeltaService');

const ARMAMENT_DATE_COLUMN = 'san_gong_armament_date';
const ARMAMENT_TOKEN_COUNT_COLUMN = 'san_gong_armament_token_count';
const ARMAMENT_JADE_COUNT_COLUMN = 'san_gong_armament_jade_count';

const CONTRIBUTION_COST = 10;
const MAX_PER_ITEM_PER_DAY = 5;

const ITEM_TACTIC_TOKEN = 'item_tactic_token';
const ITEM_TACTIC_JADE = 'item_tactic_jade';

const OFFERINGS = Object.freeze([
  {
    offerId: 'tactic_token',
    itemId: ITEM_TACTIC_TOKEN,
    label: '兵符',
    description: '开战消耗（探索 / 攻城 / 匪寨等）',
  },
  {
    offerId: 'tactic_jade',
    itemId: ITEM_TACTIC_JADE,
    label: '玉牌',
    description: '篇章战术相关道具',
  },
]);

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

function countForOffer(peRow, todayStr, offerId) {
  if (!peRow || !todayStr) return 0;
  const stored = mysqlDateToYmd(peRow[ARMAMENT_DATE_COLUMN]);
  if (!stored || stored !== todayStr) return 0;
  if (offerId === 'tactic_token') {
    return Math.max(0, Math.floor(Number(peRow[ARMAMENT_TOKEN_COUNT_COLUMN]) || 0));
  }
  if (offerId === 'tactic_jade') {
    return Math.max(0, Math.floor(Number(peRow[ARMAMENT_JADE_COUNT_COLUMN]) || 0));
  }
  return 0;
}

function resolveOffer(offerIdRaw) {
  const id = String(offerIdRaw || '').trim();
  return OFFERINGS.find((o) => o.offerId === id) || null;
}

/**
 * @param {string} playerId
 * @param {import('mysql2/promise').PoolConnection|null} [conn]
 */
async function loadArmamentContext(playerId, conn = null) {
  const pid = String(playerId || '').trim();
  if (!pid) return { ok: false, status: 400, error: '缺少 playerId' };

  const db = conn || pool;
  const [pRows] = await db.query(
    'SELECT contribution FROM players WHERE player_id = ? LIMIT 1',
    [pid],
  );
  if (!pRows.length) return { ok: false, status: 404, error: '玩家不存在' };

  const contribution = Math.max(0, Math.floor(Number(pRows[0].contribution) || 0));

  let peRow = {};
  let todayStr = null;
  let schemaOk = true;
  try {
    await db.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [pid]);
    const [dr] = await db.query('SELECT CURDATE() AS d');
    todayStr = mysqlDateToYmd(dr[0].d);
    const [peRows] = await db.query(
      `SELECT ${ARMAMENT_DATE_COLUMN}, ${ARMAMENT_TOKEN_COUNT_COLUMN}, ${ARMAMENT_JADE_COUNT_COLUMN}
       FROM player_events WHERE player_id = ? LIMIT 1`,
      [pid],
    );
    peRow = peRows[0] || {};
  } catch (e) {
    const msg = e?.message || String(e);
    if (/Unknown column ['`]san_gong_armament_/i.test(msg)) {
      schemaOk = false;
    } else {
      throw e;
    }
  }

  const offers = OFFERINGS.map((o) => {
    const redeemedToday = countForOffer(peRow, todayStr, o.offerId);
    const remainingToday = Math.max(0, MAX_PER_ITEM_PER_DAY - redeemedToday);
    let blockReason = null;
    if (!schemaOk) {
      blockReason = '军备数据未就绪：请执行迁移 player-events-add-san-gong-armament-daily.sql';
    } else if (remainingToday <= 0) {
      blockReason = `今日${o.label}兑换已达上限（${MAX_PER_ITEM_PER_DAY}）`;
    } else if (contribution < CONTRIBUTION_COST) {
      blockReason = `贡献不足（需 ${CONTRIBUTION_COST}，当前 ${contribution}）`;
    }
    return {
      ...o,
      contributionCost: CONTRIBUTION_COST,
      redeemedToday,
      remainingToday,
      maxPerDay: MAX_PER_ITEM_PER_DAY,
      canRedeem: schemaOk && remainingToday > 0 && contribution >= CONTRIBUTION_COST,
      blockReason,
    };
  });

  const remainingTotal = offers.reduce((s, o) => s + o.remainingToday, 0);
  const maxTotal = MAX_PER_ITEM_PER_DAY * OFFERINGS.length;

  return {
    ok: true,
    data: {
      contribution,
      contributionCost: CONTRIBUTION_COST,
      maxPerItemPerDay: MAX_PER_ITEM_PER_DAY,
      remainingTotal,
      maxTotal,
      schemaOk,
      offers,
    },
  };
}

async function getArmamentPreview(playerId) {
  const out = await loadArmamentContext(playerId);
  if (!out.ok) return out;
  return { ok: true, data: out.data };
}

/**
 * @param {string} playerId
 * @param {string} offerIdRaw
 */
async function submitArmamentRedemption(playerId, offerIdRaw) {
  const pid = String(playerId || '').trim();
  const offer = resolveOffer(offerIdRaw);
  if (!pid) return { ok: false, status: 400, error: '缺少 playerId' };
  if (!offer) return { ok: false, status: 400, error: '请选择兵符或玉牌' };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [dr] = await conn.query('SELECT CURDATE() AS d');
    const todayStr = mysqlDateToYmd(dr[0].d);

    await conn.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [pid]);
    const [peLocked] = await conn.query(
      `SELECT ${ARMAMENT_DATE_COLUMN}, ${ARMAMENT_TOKEN_COUNT_COLUMN}, ${ARMAMENT_JADE_COUNT_COLUMN}
       FROM player_events WHERE player_id = ? FOR UPDATE`,
      [pid],
    );
    const pe = peLocked[0] || {};
    const redeemedToday = countForOffer(pe, todayStr, offer.offerId);
    if (redeemedToday >= MAX_PER_ITEM_PER_DAY) {
      await conn.rollback();
      return {
        ok: false,
        status: 400,
        error: `今日${offer.label}兑换已达上限（${MAX_PER_ITEM_PER_DAY}）`,
      };
    }

    const [pLock] = await conn.query(
      'SELECT contribution, items FROM players WHERE player_id = ? FOR UPDATE',
      [pid],
    );
    if (!pLock.length) {
      await conn.rollback();
      return { ok: false, status: 404, error: '玩家不存在' };
    }

    const contribution = Math.max(0, Math.floor(Number(pLock[0].contribution) || 0));
    if (contribution < CONTRIBUTION_COST) {
      await conn.rollback();
      return { ok: false, status: 400, error: `贡献不足（需 ${CONTRIBUTION_COST}）` };
    }

    let items = {};
    if (pLock[0].items) {
      items =
        typeof pLock[0].items === 'string' ? JSON.parse(pLock[0].items) : { ...pLock[0].items };
    }
    if (!items || typeof items !== 'object' || Array.isArray(items)) items = {};
    items[offer.itemId] = Math.max(0, Math.floor(Number(items[offer.itemId]) || 0)) + 1;

    const sameDay = mysqlDateToYmd(pe[ARMAMENT_DATE_COLUMN]) === todayStr;
    const nextToken =
      offer.offerId === 'tactic_token'
        ? redeemedToday + 1
        : sameDay
          ? Math.max(0, Math.floor(Number(pe[ARMAMENT_TOKEN_COUNT_COLUMN]) || 0))
          : 0;
    const nextJade =
      offer.offerId === 'tactic_jade'
        ? redeemedToday + 1
        : sameDay
          ? Math.max(0, Math.floor(Number(pe[ARMAMENT_JADE_COUNT_COLUMN]) || 0))
          : 0;

    await conn.query(
      'UPDATE players SET contribution = GREATEST(0, contribution - ?), items = ? WHERE player_id = ?',
      [CONTRIBUTION_COST, JSON.stringify(items), pid],
    );
    await conn.query(
      `UPDATE player_events
       SET ${ARMAMENT_DATE_COLUMN} = ?,
           ${ARMAMENT_TOKEN_COUNT_COLUMN} = ?,
           ${ARMAMENT_JADE_COUNT_COLUMN} = ?
       WHERE player_id = ?`,
      [todayStr, nextToken, nextJade, pid],
    );
    await statisticsDeltaService.applyResourceDelta(
      pid,
      { contribution: -CONTRIBUTION_COST },
      conn,
    );

    await conn.commit();

    return {
      ok: true,
      data: {
        offerId: offer.offerId,
        itemId: offer.itemId,
        itemName: offer.label,
        quantity: 1,
        contributionSpent: CONTRIBUTION_COST,
        contributionAfter: contribution - CONTRIBUTION_COST,
        redeemedToday: redeemedToday + 1,
        remainingToday: Math.max(0, MAX_PER_ITEM_PER_DAY - (redeemedToday + 1)),
        maxPerDay: MAX_PER_ITEM_PER_DAY,
        itemQuantityAfter: items[offer.itemId],
      },
    };
  } catch (e) {
    await conn.rollback();
    const msg = e?.message || String(e);
    if (/Unknown column ['`]san_gong_armament_/i.test(msg)) {
      return {
        ok: false,
        status: 503,
        error: '数据库缺少军备日限列。请在 backend 目录执行 node scripts/apply-pending-local-ddl.js',
      };
    }
    console.error('[sanGongArmamentService] submitArmamentRedemption', e);
    return { ok: false, status: 500, error: '军备兑换失败' };
  } finally {
    conn.release();
  }
}

module.exports = {
  getArmamentPreview,
  submitArmamentRedemption,
  CONTRIBUTION_COST,
  MAX_PER_ITEM_PER_DAY,
  OFFERINGS,
};
