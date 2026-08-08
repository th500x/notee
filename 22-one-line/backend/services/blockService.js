/**
 * Blocks: mutual invisibility on Feed + no resonance either direction.
 */

const { query } = require('../database/connection');
const { httpError } = require('../lib/httpError');
const { requireActiveUser } = require('./userService');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUserId(raw) {
  if (typeof raw !== 'string' || !UUID_RE.test(raw)) {
    throw httpError(400, 'userId 无效', 'BAD_USER');
  }
  return raw;
}

async function isBlockedEitherWay(userA, userB) {
  if (!userA || !userB || userA === userB) return false;
  const rows = await query(
    `SELECT 1 AS ok FROM blocks
     WHERE (blocker_id = ? AND blocked_id = ?)
        OR (blocker_id = ? AND blocked_id = ?)
     LIMIT 1`,
    [userA, userB, userB, userA]
  );
  return rows.length > 0;
}

async function assertNotBlocked(userA, userB) {
  if (await isBlockedEitherWay(userA, userB)) {
    throw httpError(403, '双方已拉黑，无法操作', 'BLOCKED');
  }
}

async function addBlock(blockerId, blockedIdRaw) {
  await requireActiveUser(blockerId);
  const blockedId = assertUserId(blockedIdRaw);
  if (blockedId === blockerId) {
    throw httpError(400, '不能拉黑自己', 'BAD_USER');
  }

  const targets = await query(
    `SELECT id, status FROM users WHERE id = ? LIMIT 1`,
    [blockedId]
  );
  if (!targets[0]) {
    throw httpError(404, '用户不存在', 'USER_NOT_FOUND');
  }

  try {
    await query(
      `INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)`,
      [blockerId, blockedId]
    );
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return { blocked: true, userId: blockedId };
    }
    throw err;
  }
  return { blocked: true, userId: blockedId };
}

async function removeBlock(blockerId, blockedIdRaw) {
  await requireActiveUser(blockerId);
  const blockedId = assertUserId(blockedIdRaw);
  await query(
    `DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?`,
    [blockerId, blockedId]
  );
  return { blocked: false, userId: blockedId };
}

async function listBlocks(blockerId) {
  await requireActiveUser(blockerId);
  const rows = await query(
    `SELECT b.blocked_id, b.created_at, u.nick_name, u.flag_id, u.status
     FROM blocks b
     LEFT JOIN users u ON u.id = b.blocked_id
     WHERE b.blocker_id = ?
     ORDER BY b.created_at DESC`,
    [blockerId]
  );
  return {
    items: rows.map((r) => ({
      userId: r.blocked_id,
      nickName: r.nick_name || null,
      flagId: r.flag_id || null,
      status: r.status || null,
      createdAt:
        r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    })),
  };
}

module.exports = {
  isBlockedEitherWay,
  assertNotBlocked,
  addBlock,
  removeBlock,
  listBlocks,
  assertUserId,
};
