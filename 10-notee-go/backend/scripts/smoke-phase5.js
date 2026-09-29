/**
 * Phase 5 smoke: TTL soft-delete + previous-month board freeze.
 * Usage: node scripts/smoke-phase5.js
 */

const { query, pool } = require('../database/connection');
const { purgeExpiredPosts } = require('../services/ttlService');
const { freezeMonth, getBoard } = require('../services/boardService');
const { previousMonthKey, monthKeyFromDate } = require('../lib/dayKey');
const crypto = require('crypto');

async function main() {
  const prev = previousMonthKey();
  const userId = crypto.randomUUID();
  const postId = crypto.randomUUID();
  const dayKey = `${prev}-15`;

  await query(
    `INSERT INTO users (id, device_key_hash, nick_name, flag_id, gender, avatar_id, status)
     VALUES (?, ?, 'SMOKE', 'th', 'male', 'm01', 'active')`,
    [userId, crypto.createHash('sha256').update(userId).digest('hex')]
  );

  await query(
    `INSERT INTO posts
       (id, user_id, body, flag_id, stamp_id, resonance_count, edit_used,
        day_key, created_at, expires_at)
     VALUES (?, ?, 'phase5 board smoke', 'th', NULL, 9, 0, ?, UTC_TIMESTAMP(), DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY))`,
    [postId, userId, dayKey]
  );

  const ttl = await purgeExpiredPosts();
  const rows = await query(
    `SELECT deleted_at IS NOT NULL AS gone FROM posts WHERE id = ?`,
    [postId]
  );
  // expired post was soft-deleted — revive for board ranking (board selects non-deleted)
  await query(`UPDATE posts SET deleted_at = NULL WHERE id = ?`, [postId]);

  // clear any prior freeze for prev month from earlier smokes
  await query(`DELETE FROM monthly_board WHERE month_key = ?`, [prev]);
  await query(`DELETE FROM monthly_board_meta WHERE month_key = ?`, [prev]);

  const frozen = await freezeMonth(prev);
  const board = await getBoard(prev);
  const live = await getBoard(monthKeyFromDate());
  const again = await freezeMonth(prev);

  const ok =
    ttl.purged >= 1 &&
    Number(rows[0].gone) === 1 &&
    frozen.frozen === true &&
    board.source === 'frozen' &&
    board.items.some((i) => i.postId === postId && i.resonanceCount === 9) &&
    live.source === 'live' &&
    again.frozen === false;

  console.log(
    JSON.stringify(
      {
        ok,
        prev,
        ttlPurged: ttl.purged,
        wasSoftDeleted: Number(rows[0].gone) === 1,
        frozen,
        boardCount: board.items.length,
        onBoard: board.items.some((i) => i.postId === postId),
        liveSource: live.source,
        idempotentFreeze: again.frozen === false,
      },
      null,
      2
    )
  );

  await pool.end();
  process.exit(ok ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  try {
    await pool.end();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
