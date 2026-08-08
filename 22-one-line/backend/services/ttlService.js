/**
 * Soft-delete expired posts (expires_at < now).
 * Monthly board keeps its own snapshot — expired ranked posts still appear on board.
 */

const { pool } = require('../database/connection');

/**
 * @returns {{ purged: number }}
 */
async function purgeExpiredPosts() {
  const [result] = await pool.execute(
    `UPDATE posts
     SET deleted_at = UTC_TIMESTAMP()
     WHERE deleted_at IS NULL
       AND expires_at < UTC_TIMESTAMP()`
  );
  return { purged: Number(result.affectedRows) || 0 };
}

module.exports = {
  purgeExpiredPosts,
};
