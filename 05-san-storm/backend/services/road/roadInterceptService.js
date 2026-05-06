/**
 * 道路遭遇 · 守门开关
 *
 * @description
 *   把原 `roadEncounterService.js` 中 `setIntercept` 抽出。
 *   行为零变动；事务、幂等、银两扣减、错误码路径与原实现完全一致。
 *
 * @module services/road/roadInterceptService
 */

const { pool } = require('../../database/connection');
const statisticsDeltaService = require('../statisticsDeltaService');
const { INTERCEPT_COST_SILVER, buildPlayerRoadSnapshot } = require('./roadShared');

/**
 * @param {string} playerId
 * @param {boolean} enable
 * @param {string} [clientRequestId]
 */
async function setIntercept(playerId, enable, clientRequestId) {
  const pid = String(playerId || '').trim();
  if (!pid) return { ok: false, status: 400, error: '缺少 playerId' };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT player_id, silver, road_intercept, road_jun_id, road_position_x, road_position_y,
              road_updated_at, road_last_request_id
         FROM players WHERE player_id = ? FOR UPDATE`,
      [pid],
    );
    const player = rows[0];
    if (!player) {
      await conn.rollback();
      return { ok: false, status: 404, error: '玩家不存在' };
    }

    const reqId = clientRequestId ? String(clientRequestId).trim() : '';
    if (reqId && player.road_last_request_id === reqId) {
      await conn.commit();
      return { ok: true, data: { ...buildPlayerRoadSnapshot(player), silver: Number(player.silver) || 0, costSilver: 0, idempotent: true } };
    }

    const want = enable ? 1 : 0;
    const cur = player.road_intercept ? 1 : 0;
    let cost = 0;

    if (want === 1 && cur === 0) {
      const silver = Number(player.silver) || 0;
      if (silver < INTERCEPT_COST_SILVER) {
        await conn.rollback();
        return { ok: false, status: 409, error: `开启开战模式需 ${INTERCEPT_COST_SILVER} 银两` };
      }
      cost = INTERCEPT_COST_SILVER;
      await conn.query(
        `UPDATE players
            SET silver = silver - ?,
                road_intercept = 1,
                road_updated_at = NOW(),
                road_last_request_id = ?
          WHERE player_id = ?`,
        [INTERCEPT_COST_SILVER, reqId || null, pid],
      );
    } else if (want === 0 && cur === 1) {
      await conn.query(
        `UPDATE players
            SET road_intercept = 0,
                road_updated_at = NOW(),
                road_last_request_id = ?
          WHERE player_id = ?`,
        [reqId || null, pid],
      );
    } else {
      await conn.query(
        `UPDATE players SET road_last_request_id = ? WHERE player_id = ?`,
        [reqId || null, pid],
      );
    }

    const [after] = await conn.query(
      `SELECT silver, road_intercept, road_jun_id, road_position_x, road_position_y, road_updated_at
         FROM players WHERE player_id = ?`,
      [pid],
    );
    await conn.commit();

    if (cost > 0) {
      try { await statisticsDeltaService.incrementSpent(pid, { silver: cost }); } catch (_) {}
    }

    return {
      ok: true,
      data: {
        ...buildPlayerRoadSnapshot(after[0]),
        silver: Number(after[0].silver) || 0,
        costSilver: cost,
        idempotent: false,
      },
    };
  } catch (e) {
    try { await conn.rollback(); } catch (_) {}
    if (/Unknown column/i.test(e.message || '')) {
      return { ok: false, status: 503, error: '数据库缺少道路状态列；请在 backend 目录执行 `node scripts/apply-pending-local-ddl.js` 应用 add-players-road-state.sql' };
    }
    console.error('[roadEncounterService] setIntercept', e);
    return { ok: false, status: 500, error: e.message || '设置开战模式失败' };
  } finally {
    conn.release();
  }
}

module.exports = { setIntercept };
