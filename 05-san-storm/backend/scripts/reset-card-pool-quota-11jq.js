/**
 * 本地开发：重置指定玩家当前半天窗卡池额度，保留传奇保底计数
 * 用法: node scripts/reset-card-pool-quota-11jq.js [playerId]
 */
const { pool } = require('../database/connection');

const HALF_DAY_START_SQL =
  "IF(HOUR(NOW()) >= 12, CONCAT(CURDATE(), ' 12:00:00'), IF(HOUR(NOW()) >= 8, CONCAT(CURDATE(), ' 08:00:00'), CONCAT(DATE_SUB(CURDATE(), INTERVAL 1 DAY), ' 12:00:00')))";

async function getHalfDayUsage(connection, playerId) {
  const [rows] = await connection.query(
    `SELECT pool_type,
       COALESCE(SUM(CASE WHEN quota_weight IS NOT NULL THEN quota_weight ELSE 0 END), 0) AS weighted,
       COUNT(DISTINCT CASE WHEN quota_weight IS NULL THEN DATE_FORMAT(drawn_at, '%Y-%m-%d %H:%i:%s') END) AS legacy
     FROM temp_card_pool_draws
     WHERE player_id = ? AND drawn_at >= ${HALF_DAY_START_SQL}
     GROUP BY pool_type`,
    [playerId],
  );
  const out = { character: 0, troop: 0 };
  for (const r of rows) {
    out[r.pool_type] = Number(r.weighted || 0) + Number(r.legacy || 0);
  }
  return out;
}

async function getPityCounts(connection, playerId) {
  const out = { character: 0, troop: 0 };
  for (const poolType of ['character', 'troop']) {
    const [rows] = await connection.query(
      `SELECT pity_count FROM temp_card_pool_draws
       WHERE player_id = ? AND pool_type = ?
       ORDER BY id DESC LIMIT 1`,
      [playerId, poolType],
    );
    out[poolType] = rows.length ? Math.max(0, Math.floor(Number(rows[0].pity_count) || 0)) : 0;
  }
  return out;
}

async function seedPityAnchor(connection, playerId, poolType, pityCount) {
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await connection.query(
    `INSERT INTO temp_card_pool_draws
     (player_id, pool_type, rarity, card_id, compensated, echo_choice_status, pity_count, drawn_at, expires_at, quota_weight)
     VALUES (?, ?, 'common', NULL, 1, 'none', ?, NOW(), ?, 0)`,
    [playerId, poolType, pityCount, expiresAt],
  );
}

async function main() {
  const playerId = process.argv[2] || '11JQ';

  const connection = await pool.getConnection();
  try {
    const [players] = await connection.query(
      'SELECT player_id, silver, food FROM players WHERE player_id = ?',
      [playerId],
    );
    if (!players.length) {
      console.error(`玩家 ${playerId} 不存在`);
      process.exit(1);
    }

    const before = await getHalfDayUsage(connection, playerId);
    const pityBefore = await getPityCounts(connection, playerId);
    console.log('重置前本半天窗额度已用:', before);
    console.log('重置前传奇保底:', pityBefore);
    console.log('玩家资源:', { silver: players[0].silver, food: players[0].food });

    const [pending] = await connection.query(
      `SELECT id, pool_type, card_id FROM temp_card_pool_draws
       WHERE player_id = ? AND echo_choice_status = 'pending'`,
      [playerId],
    );
    if (pending.length) {
      console.log(`清除 ${pending.length} 条 pending 残影选择`);
    }

    await connection.beginTransaction();

    await connection.query(
      `DELETE FROM temp_card_pool_draws
       WHERE player_id = ? AND drawn_at >= ${HALF_DAY_START_SQL}`,
      [playerId],
    );

    for (const poolType of ['character', 'troop']) {
      await seedPityAnchor(connection, playerId, poolType, pityBefore[poolType]);
    }

    await connection.commit();

    const after = await getHalfDayUsage(connection, playerId);
    const pityAfter = await getPityCounts(connection, playerId);
    console.log('重置后本半天窗额度已用:', after);
    console.log('重置后传奇保底:', pityAfter);
    console.log(`OK: ${playerId} 将领/部队卡池本窗额度已恢复 10/10，可再次十连`);
  } catch (err) {
    await connection.rollback();
    console.error(err);
    process.exit(1);
  } finally {
    connection.release();
    await pool.end();
  }
}

main();
