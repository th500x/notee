/**
 * 三公府 · 封赏 · 礼盒：消耗贡献兑换传奇宝物（4xxx 编号段）
 */

const { pool } = require('../database/connection');
const configService = require('./configService');
const statisticsDeltaService = require('./statisticsDeltaService');
const { grantSpecificCardsOnConnection } = require('./rewardService');

const GIFT_BOX_DATE_COLUMN = 'san_gong_gift_box_date';
const CONTRIBUTION_COST = 50;
const LEGENDARY_TREASURE_REGEXP = '_treasure_4[0-9]{3}$';

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
 * @param {string|null} todayStr
 */
function readClaimedToday(peRow, todayStr) {
  if (!peRow || !todayStr) return false;
  const stored = mysqlDateToYmd(peRow[GIFT_BOX_DATE_COLUMN]);
  return !!(stored && stored === todayStr);
}

/**
 * @param {string} treasureId
 */
function isLegendaryTreasureId(treasureId) {
  return new RegExp(`${LEGENDARY_TREASURE_REGEXP}$`).test(String(treasureId || '').trim());
}

async function loadLegendaryTreasures() {
  return configService.getTreasures({ rarity: 'legendary' });
}

/**
 * @param {string} playerId
 * @param {import('mysql2/promise').PoolConnection|null} [conn]
 */
async function loadGiftBoxContext(playerId, conn = null) {
  const pid = String(playerId || '').trim();
  if (!pid) return { ok: false, status: 400, error: '缺少 playerId' };

  const db = conn || pool;
  const [pRows] = await db.query(
    'SELECT contribution, faction_id FROM players WHERE player_id = ? LIMIT 1',
    [pid],
  );
  if (!pRows.length) return { ok: false, status: 404, error: '玩家不存在' };

  const contribution = Math.max(0, Math.floor(Number(pRows[0].contribution) || 0));
  const factionId = String(pRows[0].faction_id || '').trim();

  let peRow = {};
  let todayStr = null;
  let schemaOk = true;
  try {
    await db.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [pid]);
    const [dr] = await db.query('SELECT CURDATE() AS d');
    todayStr = mysqlDateToYmd(dr[0].d);
    const [peRows] = await db.query(
      `SELECT ${GIFT_BOX_DATE_COLUMN} FROM player_events WHERE player_id = ? LIMIT 1`,
      [pid],
    );
    peRow = peRows[0] || {};
  } catch (e) {
    const msg = e?.message || String(e);
    if (/Unknown column ['`]san_gong_gift_box_date/i.test(msg)) {
      schemaOk = false;
    } else {
      throw e;
    }
  }

  const claimedToday = schemaOk && todayStr ? readClaimedToday(peRow, todayStr) : false;
  const treasures = await loadLegendaryTreasures();

  let blockReason = null;
  if (!schemaOk) {
    blockReason = '礼盒数据未就绪：请执行迁移 player-events-add-san-gong-gift-box-date.sql';
  } else if (claimedToday) {
    blockReason = '今日礼盒已兑换';
  } else if (contribution < CONTRIBUTION_COST) {
    blockReason = `贡献不足（需 ${CONTRIBUTION_COST}，当前 ${contribution}）`;
  } else if (!treasures.length) {
    blockReason = '暂无可兑换的传奇宝物';
  }

  const canRedeem = schemaOk && !claimedToday && contribution >= CONTRIBUTION_COST && treasures.length > 0;

  return {
    ok: true,
    data: {
      contribution,
      contributionCost: CONTRIBUTION_COST,
      claimedToday,
      remainingToday: claimedToday ? 0 : 1,
      maxPerDay: 1,
      canRedeem,
      blockReason,
      treasures,
      schemaOk,
      factionId,
    },
  };
}

/**
 * @param {string} playerId
 */
async function getGiftBoxPreview(playerId) {
  const out = await loadGiftBoxContext(playerId);
  if (!out.ok) return out;
  return { ok: true, data: out.data };
}

/**
 * @param {string} playerId
 * @param {string} treasureIdRaw
 */
async function submitGiftBoxRedemption(playerId, treasureIdRaw) {
  const pid = String(playerId || '').trim();
  const treasureId = String(treasureIdRaw || '').trim();
  if (!pid) return { ok: false, status: 400, error: '缺少 playerId' };
  if (!treasureId) return { ok: false, status: 400, error: '请选择宝物' };
  if (!isLegendaryTreasureId(treasureId)) {
    return { ok: false, status: 400, error: '仅可兑换传奇稀有度宝物（4xxx 编号）' };
  }

  const cfg = await configService.getTreasureById(treasureId);
  if (!cfg) return { ok: false, status: 404, error: '宝物不存在' };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [dr] = await conn.query('SELECT CURDATE() AS d');
    const todayStr = mysqlDateToYmd(dr[0].d);

    await conn.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [pid]);
    const [peLocked] = await conn.query(
      `SELECT ${GIFT_BOX_DATE_COLUMN} FROM player_events WHERE player_id = ? FOR UPDATE`,
      [pid],
    );
    const pe = peLocked[0] || {};
    if (readClaimedToday(pe, todayStr)) {
      await conn.rollback();
      return { ok: false, status: 400, error: '今日礼盒已兑换' };
    }

    const ctxOut = await loadGiftBoxContext(pid, conn);
    if (!ctxOut.ok) {
      await conn.rollback();
      return { ok: false, status: ctxOut.status || 400, error: ctxOut.error };
    }
    if (!ctxOut.data.canRedeem) {
      await conn.rollback();
      return {
        ok: false,
        status: 400,
        error: ctxOut.data.blockReason || '当前不可兑换',
      };
    }

    const eligible = ctxOut.data.treasures.some((t) => t.id === treasureId);
    if (!eligible) {
      await conn.rollback();
      return { ok: false, status: 400, error: '该宝物不在礼盒兑换列表中' };
    }

    const [pLock] = await conn.query(
      'SELECT contribution, faction_id FROM players WHERE player_id = ? FOR UPDATE',
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

    const factionId = String(pLock[0].faction_id || ctxOut.data.factionId || '').trim();
    const grantDetails = [];
    await grantSpecificCardsOnConnection(conn, pid, factionId, [treasureId], grantDetails);
    const granted = grantDetails.find((d) => d.cardType === 'treasure' && d.cardId === treasureId);
    if (!granted) {
      await conn.rollback();
      return { ok: false, status: 500, error: '宝物发放失败' };
    }

    await conn.query(
      'UPDATE players SET contribution = GREATEST(0, contribution - ?) WHERE player_id = ?',
      [CONTRIBUTION_COST, pid],
    );
    await conn.query(
      `UPDATE player_events SET ${GIFT_BOX_DATE_COLUMN} = ? WHERE player_id = ?`,
      [todayStr, pid],
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
        treasureId,
        treasureName: cfg.name || treasureId,
        rarity: cfg.rarity || 'legendary',
        contributionSpent: CONTRIBUTION_COST,
        contributionAfter: contribution - CONTRIBUTION_COST,
        instanceId: granted.instanceId,
        specialEffectDesc: cfg.specialEffectDesc || null,
      },
    };
  } catch (e) {
    await conn.rollback();
    const msg = e?.message || String(e);
    if (/Unknown column ['`]san_gong_gift_box_date/i.test(msg)) {
      return {
        ok: false,
        status: 503,
        error: '数据库缺少礼盒日限列。请在 backend 目录执行 node scripts/apply-pending-local-ddl.js',
      };
    }
    console.error('[sanGongGiftBoxService] submitGiftBoxRedemption', e);
    return { ok: false, status: 500, error: '礼盒兑换失败' };
  } finally {
    conn.release();
  }
}

module.exports = {
  getGiftBoxPreview,
  submitGiftBoxRedemption,
  CONTRIBUTION_COST,
  GIFT_BOX_DATE_COLUMN,
};
