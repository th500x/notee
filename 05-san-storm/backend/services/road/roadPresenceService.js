/**
 * 战略道路 · 状态查询（自身 / 郡内他人）
 *
 * @description
 *     - `getSelfRoadState`：自身道路位置 + `pendingRoadNotice`（事务内 SELECT FOR UPDATE → UPDATE 清空）
 *     - `getRoadPresence`：郡内在线他人位置（供大地图展示他人棋子）
 *
 *   道路同格遭遇战已归档（`_archive/dao-lu-yu-di/`）：不再有交战格锁与守方遇袭轮询。
 *
 * @module services/road/roadPresenceService
 */

const { pool } = require('../../database/connection');
const { DEFAULT_ONLINE_MS } = require('../../utils/playerActivity');
const { normalizeMapDisplayEffect } = require('../../../shared/utils/mapDisplayEffect.cjs');
const { buildPlayerRoadSnapshot } = require('./roadShared');

async function getSelfRoadState(playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) return { ok: false, status: 400, error: '缺少 playerId' };
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT road_jun_id, road_position_x, road_position_y, road_updated_at,
              food, silver,
              road_reserve_date, road_reserve_used,
              road_move_free_date, road_move_free_used,
              road_client_notice
         FROM players WHERE player_id = ? FOR UPDATE`,
      [pid],
    );
    if (!rows.length) {
      await conn.rollback();
      return { ok: false, status: 404, error: '玩家不存在' };
    }
    const r = rows[0];
    let pendingRoadNotice = null;
    const rawNotice = r.road_client_notice != null ? String(r.road_client_notice).trim() : '';
    if (rawNotice) {
      pendingRoadNotice = rawNotice;
      await conn.query(`UPDATE players SET road_client_notice = NULL WHERE player_id = ?`, [pid]);
    }
    await conn.commit();

    return {
      ok: true,
      data: {
        ...buildPlayerRoadSnapshot(r),
        food: Number(r.food) || 0,
        silver: Number(r.silver) || 0,
        roadReserveDate: r.road_reserve_date || null,
        roadReserveUsed: Number(r.road_reserve_used) || 0,
        roadMoveFreeDate: r.road_move_free_date || null,
        roadMoveFreeUsed: Number(r.road_move_free_used) || 0,
        pendingRoadNotice: pendingRoadNotice || undefined,
      },
    };
  } catch (e) {
    try {
      await conn.rollback();
    } catch (_) {}
    if (/Unknown column/i.test(e.message || '')) {
      return { ok: false, status: 503, error: '数据库缺少道路状态列；请执行 add-players-road-state.sql' };
    }
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * 郡内在线他人位置。
 *
 * @param {string} season
 * @param {string} junId
 * @param {string} callerPlayerId  不把自己列入「他人」
 */
async function getRoadPresence(season, junId, callerPlayerId) {
  const s = String(season || '').trim();
  const j = String(junId || '').trim();
  const caller = String(callerPlayerId || '').trim();
  if (!s || !j) return { ok: false, status: 400, error: '缺少 season / junId' };

  const thresholdSec = Math.ceil(DEFAULT_ONLINE_MS / 1000);

  try {
    const [others] = await pool.query(
      `SELECT p.player_id AS playerId,
              p.character_name AS characterName,
              p.faction_id AS factionId,
              p.faction_name AS factionName,
              p.avatar AS avatar,
              p.road_jun_id AS roadJunId,
              p.road_position_x AS roadPositionX,
              p.road_position_y AS roadPositionY,
              p.road_updated_at AS roadUpdatedAt,
              ca.display_effect AS mapDisplayEffectRaw
         FROM players p
         INNER JOIN accounts a ON a.id = p.player_id
         LEFT JOIN player_cards pc
           ON pc.player_id = p.player_id
          AND pc.card_type = 'achievement'
          AND pc.is_equipped = TRUE
          AND pc.equipped_by = 'player'
          AND pc.equipped_slot = 'achievement'
         LEFT JOIN config_achievements ca ON ca.achievement_id = pc.card_id
        WHERE p.road_jun_id = ?
          AND p.road_position_x IS NOT NULL
          AND p.road_position_y IS NOT NULL
          AND p.player_id <> ?
          AND GREATEST(COALESCE(UNIX_TIMESTAMP(p.last_active_at), 0),
                       COALESCE(UNIX_TIMESTAMP(a.lastActiveAt), 0))
              > UNIX_TIMESTAMP(NOW()) - ?`,
      [j, caller || '', thresholdSec],
    );

    return {
      ok: true,
      data: {
        season: s,
        junId: j,
        thresholdMs: DEFAULT_ONLINE_MS,
        others: others.map((r) => ({
          playerId: r.playerId,
          characterName: r.characterName,
          factionId: r.factionId,
          factionName: r.factionName,
          avatar: r.avatar || null,
          roadPositionX: Number(r.roadPositionX),
          roadPositionY: Number(r.roadPositionY),
          roadUpdatedAt: r.roadUpdatedAt || null,
          mapDisplayEffect: normalizeMapDisplayEffect(r.mapDisplayEffectRaw),
        })),
      },
    };
  } catch (e) {
    if (/Unknown column/i.test(e.message || '')) {
      return { ok: false, status: 503, error: '数据库缺少道路状态列；请执行 add-players-road-state.sql' };
    }
    throw e;
  }
}

module.exports = {
  getSelfRoadState,
  getRoadPresence,
};
