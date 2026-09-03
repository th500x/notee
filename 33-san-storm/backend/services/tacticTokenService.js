/**
 * 兵符 `item_tactic_token` 扣减 / 退还（攻城开战、匪寨攻打、探索开链、**编组探险派遣** 同源道具）。
 */

const { pool } = require('../database/connection');

const TACTIC_TOKEN_ITEM_ID = 'item_tactic_token';
/** 攻城 / 攻大本营每场开战消耗 */
const TACTIC_TOKEN_COST_PER_SIEGE_BATTLE = 1;

function parseItemsJson(raw) {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw);
      return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return { ...raw };
  return {};
}

function countTacticTokens(items) {
  return Math.max(0, Math.floor(Number(items?.[TACTIC_TOKEN_ITEM_ID]) || 0));
}

/**
 * @param {string} playerId
 * @param {import('mysql2/promise').PoolConnection|null} [conn]
 * @returns {Promise<number>}
 */
async function getTacticTokenCount(playerId, conn = null) {
  const runner = conn || pool;
  const pid = String(playerId || '').trim();
  if (!pid) return 0;
  const [rows] = await runner.query('SELECT items FROM players WHERE player_id = ? LIMIT 1', [pid]);
  if (!rows[0]) return 0;
  return countTacticTokens(parseItemsJson(rows[0].items));
}

/**
 * 扣减兵符（默认 1）。须在调用方事务内时传入 `conn`（并对 `players` 行加锁）。
 * @returns {Promise<boolean>}
 */
async function tryConsumeTacticTokenOnce(playerId, conn = null, amount = TACTIC_TOKEN_COST_PER_SIEGE_BATTLE) {
  const pid = String(playerId || '').trim();
  const n = Math.max(1, Math.floor(Number(amount)) || 1);
  if (!pid) return false;

  const ownConn = !conn;
  const runner = conn || (await pool.getConnection());
  try {
    if (ownConn) await runner.beginTransaction();
    const [rows] = await runner.query('SELECT items FROM players WHERE player_id = ? FOR UPDATE', [pid]);
    if (!rows[0]) {
      if (ownConn) await runner.rollback();
      return false;
    }
    const items = parseItemsJson(rows[0].items);
    const have = countTacticTokens(items);
    if (have < n) {
      if (ownConn) await runner.rollback();
      return false;
    }
    items[TACTIC_TOKEN_ITEM_ID] = have - n;
    if (items[TACTIC_TOKEN_ITEM_ID] <= 0) delete items[TACTIC_TOKEN_ITEM_ID];
    await runner.query('UPDATE players SET items = ? WHERE player_id = ?', [JSON.stringify(items), pid]);
    if (ownConn) await runner.commit();
    return true;
  } catch (e) {
    if (ownConn) {
      try {
        await runner.rollback();
      } catch {
        /* ignore */
      }
    }
    throw e;
  } finally {
    if (ownConn) runner.release();
  }
}

/**
 * 退还兵符（默认 1）；开战握手失败回滚用。
 */
async function refundTacticTokenOnce(playerId, conn = null, amount = TACTIC_TOKEN_COST_PER_SIEGE_BATTLE) {
  const pid = String(playerId || '').trim();
  const n = Math.max(1, Math.floor(Number(amount)) || 1);
  if (!pid) return;

  const ownConn = !conn;
  const runner = conn || (await pool.getConnection());
  try {
    if (ownConn) await runner.beginTransaction();
    const [rows] = await runner.query('SELECT items FROM players WHERE player_id = ? FOR UPDATE', [pid]);
    if (!rows[0]) {
      if (ownConn) await runner.rollback();
      return;
    }
    const items = parseItemsJson(rows[0].items);
    const have = countTacticTokens(items);
    items[TACTIC_TOKEN_ITEM_ID] = have + n;
    await runner.query('UPDATE players SET items = ? WHERE player_id = ?', [JSON.stringify(items), pid]);
    if (ownConn) await runner.commit();
  } catch (e) {
    if (ownConn) {
      try {
        await runner.rollback();
      } catch {
        /* ignore */
      }
    }
    throw e;
  } finally {
    if (ownConn) runner.release();
  }
}

module.exports = {
  TACTIC_TOKEN_ITEM_ID,
  TACTIC_TOKEN_COST_PER_SIEGE_BATTLE,
  parseItemsJson,
  countTacticTokens,
  getTacticTokenCount,
  tryConsumeTacticTokenOnce,
  refundTacticTokenOnce,
};
