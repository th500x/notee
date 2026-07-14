/**
 * 道路遭遇 · Stale / 幽灵清理
 *
 * @description
 *   把原 `roadEncounterService.js` 中两个清理函数抽出，被 `moveAlongRoad` 与守方轮询复用：
 *     - `resolveStaleRoadEncountersAtCell`：交战格无人立站 / 长期无 battle_id 的占格行 → cancelled / resolved；
 *     - `resolveAbandonedRoadFightOnCellIfOpponentOffline`：对手长时间不活跃且无 battle_id → 解锁，避免攻方永久 409。
 *
 *   两者都接受**外部传入的事务连接**（`conn`），不在本文件创建连接 / 提交，行为零变动。
 *
 * @module services/road/roadStaleCleanup
 */

const { isPlayerRecentlyActive, DEFAULT_ONLINE_MS } = require('../../utils/playerActivity');
const { toInt, STALE_FIGHT_SQL_MIN } = require('./roadShared');

/**
 * 交战格「幽灵」：`road_encounters` 仍为 pending/fighting，但攻防未同时立于该格坐标（断线、未结算、旧数据等）。
 * 若不清理，第三者或守方会被「非本场不可闯入 / 守方禁离格」误伤。本事务内直接 resolved。
 *
 * @param {*} conn 事务连接（`getConnection`）
 */
async function resolveStaleRoadEncountersAtCell(conn, season, junId, px, py) {
  const s = String(season || '').trim();
  const j = String(junId || '').trim();
  const x = toInt(px);
  const y = toInt(py);
  if (!s || !j || x == null || y == null) return;
  await conn.query(
    `UPDATE road_encounters e
        SET e.status = 'cancelled', e.ended_at = NOW()
      WHERE e.season = ? AND e.jun_id = ?
        AND e.position_x = ? AND e.position_y = ?
        AND e.status = 'fighting'
        AND e.battle_id IS NULL
        AND e.started_at IS NOT NULL
        AND e.started_at < DATE_SUB(NOW(), INTERVAL ${STALE_FIGHT_SQL_MIN} MINUTE)`,
    [s, j, x, y],
  );
  await conn.query(
    `UPDATE road_encounters e
        SET e.status = 'resolved', e.ended_at = NOW()
      WHERE e.season = ? AND e.jun_id = ?
        AND e.position_x = ? AND e.position_y = ?
        AND e.status IN ('pending','fighting')
        AND NOT (
          EXISTS (
            SELECT 1 FROM players pa
            WHERE pa.player_id = e.attacker_player_id
              AND pa.road_jun_id = e.jun_id
              AND pa.road_position_x = e.position_x
              AND pa.road_position_y = e.position_y
          )
          AND EXISTS (
            SELECT 1 FROM players pd
            WHERE pd.player_id = e.defender_player_id
              AND pd.road_jun_id = e.jun_id
              AND pd.road_position_x = e.position_x
              AND pd.road_position_y = e.position_y
          )
        )`,
    [s, j, x, y],
  );
}

/**
 * 交战格上对手久未活跃且尚未写入 battle_id：视为无法完成本场，解锁避免攻方永久 409。
 */
async function resolveAbandonedRoadFightOnCellIfOpponentOffline(conn, season, junId, px, py, moverId) {
  const s = String(season || '').trim();
  const j = String(junId || '').trim();
  const x = toInt(px);
  const y = toInt(py);
  const mid = String(moverId || '').trim();
  if (!s || !j || x == null || y == null || !mid) return;
  // eslint-disable-next-line no-unused-vars -- 保留原 service 的 dead let，便于将来按 sec 阈值再筛
  const sec = Math.ceil(DEFAULT_ONLINE_MS / 1000);
  const [frows] = await conn.query(
    `SELECT encounter_id, attacker_player_id, defender_player_id, battle_id
       FROM road_encounters
      WHERE season = ? AND jun_id = ? AND position_x = ? AND position_y = ?
        AND status = 'fighting'
        AND (attacker_player_id = ? OR defender_player_id = ?)
      FOR UPDATE`,
    [s, j, x, y, mid, mid],
  );
  for (const fr of frows) {
    const bid = fr.battle_id != null ? String(fr.battle_id).trim() : '';
    if (bid) continue;
    const att = String(fr.attacker_player_id || '').trim();
    const def = String(fr.defender_player_id || '').trim();
    const opp = mid === att ? def : att;
    if (!opp) continue;
    // eslint-disable-next-line no-await-in-loop
    if (await isPlayerRecentlyActive(opp)) continue;
    // eslint-disable-next-line no-await-in-loop
    await conn.query(`UPDATE road_encounters SET status = 'resolved', ended_at = NOW() WHERE encounter_id = ?`, [
      fr.encounter_id,
    ]);
  }
}

module.exports = {
  resolveStaleRoadEncountersAtCell,
  resolveAbandonedRoadFightOnCellIfOpponentOffline,
};
