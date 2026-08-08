/**
 * Post reports — enqueue for operator (SQL / later admin UI).
 */

const crypto = require('crypto');
const { query } = require('../database/connection');
const { httpError } = require('../lib/httpError');
const { assertReportReason } = require('../lib/reportReasons');
const { requireActiveUser } = require('./userService');

async function reportPost(reporterId, postId, reasonRaw) {
  await requireActiveUser(reporterId);
  const reason = assertReportReason(reasonRaw);

  const posts = await query(
    `SELECT p.id, p.user_id, p.deleted_at, p.hidden_at
     FROM posts p
     WHERE p.id = ? LIMIT 1`,
    [postId]
  );
  const post = posts[0];
  if (!post || post.deleted_at) {
    throw httpError(404, '帖子不存在', 'POST_NOT_FOUND');
  }
  if (post.user_id === reporterId) {
    throw httpError(400, '不能举报自己的帖子', 'BAD_REPORT');
  }

  const id = crypto.randomUUID();
  try {
    await query(
      `INSERT INTO reports (id, post_id, reporter_id, reason, status)
       VALUES (?, ?, ?, ?, 'open')`,
      [id, postId, reporterId, reason]
    );
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      throw httpError(409, '已举报过该帖', 'ALREADY_REPORTED');
    }
    throw err;
  }

  return {
    id,
    postId,
    reason,
    status: 'open',
  };
}

module.exports = {
  reportPost,
};
