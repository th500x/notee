/**
 * Monthly board: live Top 30 for current UTC+7 month; frozen snapshot for past months.
 */

const { query, transaction } = require('../database/connection');
const { httpError } = require('../lib/httpError');
const {
  assertMonthKey,
  monthKeyFromDate,
  previousMonthKey,
} = require('../lib/dayKey');

const BOARD_SIZE = 30;

function toIso(value) {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function rowToBoardItem(row) {
  return {
    rank: Number(row.rank_no),
    postId: row.post_id,
    userId: row.user_id,
    body: row.body,
    nickName: row.nick_name,
    flagId: row.flag_id,
    stampId: row.stamp_id,
    resonanceCount: Number(row.resonance_count) || 0,
    postedAt: toIso(row.posted_at),
    frozenAt: row.frozen_at != null ? toIso(row.frozen_at) : null,
  };
}

/**
 * Candidate posts for a UTC+7 month (day_key prefix).
 * Excludes user-deleted / mod-hidden; Private flag still ranks (display Private).
 */
async function selectTopPostsForMonth(monthKey, limit = BOARD_SIZE) {
  const dayPrefix = `${monthKey}-%`;
  return query(
    `SELECT p.id AS post_id, p.user_id, p.body, p.flag_id, p.stamp_id,
            p.resonance_count, p.created_at AS posted_at,
            u.nick_name
     FROM posts p
     INNER JOIN users u ON u.id = p.user_id AND u.status = 'active' AND u.deleted_at IS NULL
     WHERE p.day_key LIKE ?
       AND p.deleted_at IS NULL
       AND p.hidden_at IS NULL
     ORDER BY p.resonance_count DESC, p.created_at ASC, p.id ASC
     LIMIT ?`,
    [dayPrefix, limit]
  );
}

async function listFrozenBoard(monthKey) {
  const rows = await query(
    `SELECT month_key, rank_no, post_id, user_id, body, nick_name, flag_id,
            stamp_id, resonance_count, posted_at, frozen_at
     FROM monthly_board
     WHERE month_key = ?
     ORDER BY rank_no ASC`,
    [monthKey]
  );
  return rows.map(rowToBoardItem);
}

async function isMonthFrozen(monthKey) {
  const rows = await query(
    `SELECT item_count FROM monthly_board_meta WHERE month_key = ? LIMIT 1`,
    [monthKey]
  );
  return rows[0] || null;
}

/**
 * Idempotent freeze of a completed month into monthly_board.
 * @returns {{ monthKey, count, frozen: boolean }}
 */
async function freezeMonth(monthKeyRaw) {
  const monthKey = assertMonthKey(monthKeyRaw);
  const current = monthKeyFromDate();
  if (monthKey >= current) {
    throw httpError(400, '只能固化已结束的自然月', 'MONTH_NOT_CLOSED');
  }

  const already = await isMonthFrozen(monthKey);
  if (already) {
    return { monthKey, count: Number(already.item_count) || 0, frozen: false };
  }

  const tops = await selectTopPostsForMonth(monthKey, BOARD_SIZE);

  await transaction(async (conn) => {
    const [metaRows] = await conn.execute(
      `SELECT item_count FROM monthly_board_meta WHERE month_key = ? LIMIT 1`,
      [monthKey]
    );
    if (metaRows[0]) return;

    let rank = 1;
    for (const row of tops) {
      await conn.execute(
        `INSERT INTO monthly_board
           (month_key, rank_no, post_id, user_id, body, nick_name, flag_id,
            stamp_id, resonance_count, posted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          monthKey,
          rank,
          row.post_id,
          row.user_id,
          row.body,
          row.nick_name,
          row.flag_id,
          row.stamp_id,
          row.resonance_count,
          row.posted_at,
        ]
      );
      rank += 1;
    }

    await conn.execute(
      `INSERT INTO monthly_board_meta (month_key, item_count) VALUES (?, ?)`,
      [monthKey, tops.length]
    );
  });

  const meta = await isMonthFrozen(monthKey);
  return {
    monthKey,
    count: meta ? Number(meta.item_count) || 0 : tops.length,
    frozen: true,
  };
}

async function getBoard(monthQuery) {
  const current = monthKeyFromDate();
  const monthKey = monthQuery ? assertMonthKey(monthQuery) : current;

  if (monthKey > current) {
    throw httpError(400, '不能查询未来月份', 'BAD_MONTH');
  }

  if (monthKey === current) {
    const rows = await selectTopPostsForMonth(monthKey, BOARD_SIZE);
    const items = rows.map((row, i) =>
      rowToBoardItem({
        ...row,
        rank_no: i + 1,
        frozen_at: null,
      })
    );
    return { monthKey, source: 'live', items };
  }

  await freezeMonth(monthKey);
  const items = await listFrozenBoard(monthKey);
  return { monthKey, source: 'frozen', items };
}

/** Daily catch-up: freeze previous UTC+7 month if missing. */
async function freezePreviousMonthIfNeeded() {
  return freezeMonth(previousMonthKey());
}

module.exports = {
  BOARD_SIZE,
  getBoard,
  freezeMonth,
  freezePreviousMonthIfNeeded,
  selectTopPostsForMonth,
};
