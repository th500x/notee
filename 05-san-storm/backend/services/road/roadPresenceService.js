/**
 * 道路遭遇 · 状态查询（自身 / 郡内他人 / 守方遇袭轮询）
 *
 * @description
 *   把原 `roadEncounterService.js` 中三个"无写库 / 仅查库 + 一次性提示读即清"接口抽出，
 *   行为零变动：
 *     - `getSelfRoadState`：自身道路位置 + `pendingRoadNotice`（事务内 SELECT FOR UPDATE → UPDATE 清空）
 *     - `getRoadPresence`：郡内在线他人 + 当前 pending/fighting 锁格清单
 *     - `getPendingDefenderEncounter`：守方轮询自身是否处于 fighting 道路战；附带摘 stale fighting
 *
 * @module services/road/roadPresenceService
 */

const { pool } = require('../../database/connection');
const { DEFAULT_ONLINE_MS } = require('../../utils/playerActivity');
const {
  buildPlayerRoadSnapshot,
  ROAD_DEFENDER_ALERT_SEC,
  STALE_FIGHT_SQL_MIN,
} = require('./roadShared');

async function getSelfRoadState(playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) return { ok: false, status: 400, error: '缺少 playerId' };
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT road_jun_id, road_position_x, road_position_y, road_intercept, road_updated_at,
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
 * 郡内在线他人位置 + 当前道路占格清单。
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
              p.road_intercept AS roadIntercept,
              p.road_updated_at AS roadUpdatedAt
         FROM players p
         INNER JOIN accounts a ON a.id = p.player_id
        WHERE p.road_jun_id = ?
          AND p.road_position_x IS NOT NULL
          AND p.road_position_y IS NOT NULL
          AND p.player_id <> ?
          AND GREATEST(COALESCE(UNIX_TIMESTAMP(p.last_active_at), 0),
                       COALESCE(UNIX_TIMESTAMP(a.lastActiveAt), 0))
              > UNIX_TIMESTAMP(NOW()) - ?`,
      [j, caller || '', thresholdSec],
    );

    const [locks] = await pool.query(
      `SELECT encounter_id AS encounterId,
              position_x AS positionX,
              position_y AS positionY,
              status,
              attacker_player_id AS attackerPlayerId,
              defender_player_id AS defenderPlayerId,
              started_at AS startedAt
         FROM road_encounters
        WHERE season = ? AND jun_id = ? AND status IN ('pending','fighting')`,
      [s, j],
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
          roadIntercept: r.roadIntercept ? 1 : 0,
          roadUpdatedAt: r.roadUpdatedAt || null,
        })),
        lockedCells: locks.map((r) => ({
          encounterId: r.encounterId,
          positionX: Number(r.positionX),
          positionY: Number(r.positionY),
          status: r.status,
          attackerPlayerId: r.attackerPlayerId,
          defenderPlayerId: r.defenderPlayerId,
          startedAt: r.startedAt || null,
        })),
      },
    };
  } catch (e) {
    if (/road_encounters/i.test(e.message || '') && /doesn't exist/i.test(e.message || '')) {
      return { ok: false, status: 503, error: '数据库缺少 road_encounters 表；请执行 create-road-encounters.sql' };
    }
    if (/Unknown column/i.test(e.message || '')) {
      return { ok: false, status: 503, error: '数据库缺少道路状态列；请执行 add-players-road-state.sql' };
    }
    throw e;
  }
}

/**
 * 若当前用户为某条 fighting 遭遇的防守方且立点与交战格一致，返回遇袭摘要（否则 encounter=null）。
 *
 * @param {string} defenderPlayerId
 */
async function getPendingDefenderEncounter(defenderPlayerId) {
  const pid = String(defenderPlayerId || '').trim();
  if (!pid) return { ok: false, status: 400, error: '缺少 playerId' };
  try {
    // 与 `resolveStaleRoadEncountersAtCell` 同阈值：守方轮询也能摘掉「永不结束」的 fighting，避免 UI 永久遇袭
    await pool.query(
      `UPDATE road_encounters e
          SET e.status = 'cancelled', e.ended_at = NOW()
        WHERE e.status = 'fighting'
          AND e.battle_id IS NULL
          AND e.started_at IS NOT NULL
          AND e.started_at < DATE_SUB(NOW(), INTERVAL ${STALE_FIGHT_SQL_MIN} MINUTE)
          AND (e.attacker_player_id = ? OR e.defender_player_id = ?)`,
      [pid, pid],
    );
    const [rows] = await pool.query(
      `SELECT e.encounter_id AS encounterId,
              e.attacker_player_id AS attackerPlayerId,
              e.started_at AS startedAt,
              pa.character_name AS attackerName
         FROM road_encounters e
         INNER JOIN players pd ON pd.player_id = e.defender_player_id
         LEFT JOIN players pa ON pa.player_id = e.attacker_player_id
        WHERE e.defender_player_id = ?
          AND e.status = 'fighting'
          AND pd.road_jun_id = e.jun_id
          AND pd.road_position_x = e.position_x
          AND pd.road_position_y = e.position_y
        ORDER BY e.started_at DESC
        LIMIT 1`,
      [pid],
    );
    if (!rows.length) {
      return { ok: true, data: { encounter: null } };
    }
    const r = rows[0];
    const startedMs = r.startedAt ? new Date(r.startedAt).getTime() : Date.now();
    const elapsedSec = Math.max(0, (Date.now() - startedMs) / 1000);
    const remainingSeconds = Math.max(0, Math.ceil(ROAD_DEFENDER_ALERT_SEC - elapsedSec));
    return {
      ok: true,
      data: {
        encounter: {
          encounterId: r.encounterId,
          attackerPlayerId: r.attackerPlayerId,
          attackerName: r.attackerName || '敌方',
          waitSeconds: ROAD_DEFENDER_ALERT_SEC,
          remainingSeconds,
        },
      },
    };
  } catch (e) {
    if (/road_encounters/i.test(e.message || '') && /doesn't exist/i.test(e.message || '')) {
      return { ok: false, status: 503, error: '数据库缺少 road_encounters 表；请执行 create-road-encounters.sql' };
    }
    console.error('[roadEncounterService] getPendingDefenderEncounter', e);
    return { ok: false, status: 500, error: e.message || '查询道路遇袭失败' };
  }
}

module.exports = {
  getSelfRoadState,
  getRoadPresence,
  getPendingDefenderEncounter,
};
