/**
 * Resonance (共鸣): one per (post, user); self allowed; blocked pairs forbidden.
 */

const { transaction } = require('../database/connection');
const { httpError } = require('../lib/httpError');
const { requireActiveUser } = require('./userService');
const { assertNotBlocked } = require('./blockService');

async function requireLivePostForUpdate(conn, postId) {
  const [rows] = await conn.execute(
    `SELECT p.id, p.user_id, p.resonance_count
     FROM posts p
     INNER JOIN users u ON u.id = p.user_id AND u.status = 'active' AND u.deleted_at IS NULL
     WHERE p.id = ?
       AND p.deleted_at IS NULL
       AND p.hidden_at IS NULL
       AND p.expires_at > UTC_TIMESTAMP()
     LIMIT 1
     FOR UPDATE`,
    [postId]
  );
  const row = rows[0];
  if (!row) {
    throw httpError(404, '帖子不存在或已过期', 'POST_NOT_FOUND');
  }
  return row;
}

/**
 * Idempotent add. Self-resonance allowed.
 * @returns {{ postId, resonanceCount, resonatedByMe }}
 */
async function addResonance(userId, postId) {
  await requireActiveUser(userId);

  return transaction(async (conn) => {
    const post = await requireLivePostForUpdate(conn, postId);
    await assertNotBlocked(userId, post.user_id);

    try {
      await conn.execute(
        `INSERT INTO resonances (post_id, user_id) VALUES (?, ?)`,
        [postId, userId]
      );
      await conn.execute(
        `UPDATE posts SET resonance_count = resonance_count + 1 WHERE id = ?`,
        [postId]
      );
      return {
        postId,
        resonanceCount: Number(post.resonance_count) + 1,
        resonatedByMe: true,
      };
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        return {
          postId,
          resonanceCount: Number(post.resonance_count) || 0,
          resonatedByMe: true,
        };
      }
      throw err;
    }
  });
}

/**
 * Idempotent remove.
 */
async function removeResonance(userId, postId) {
  await requireActiveUser(userId);

  return transaction(async (conn) => {
    const post = await requireLivePostForUpdate(conn, postId);

    const [result] = await conn.execute(
      `DELETE FROM resonances WHERE post_id = ? AND user_id = ?`,
      [postId, userId]
    );

    if (result.affectedRows > 0) {
      await conn.execute(
        `UPDATE posts
         SET resonance_count = GREATEST(CAST(resonance_count AS SIGNED) - 1, 0)
         WHERE id = ?`,
        [postId]
      );
      return {
        postId,
        resonanceCount: Math.max(Number(post.resonance_count) - 1, 0),
        resonatedByMe: false,
      };
    }

    return {
      postId,
      resonanceCount: Number(post.resonance_count) || 0,
      resonatedByMe: false,
    };
  });
}

module.exports = {
  addResonance,
  removeResonance,
};
