/**
 * One Line posts: create / edit once / soft-delete / today / feed.
 */

const crypto = require('crypto');
const { query } = require('../database/connection');
const { httpError } = require('../lib/httpError');
const { dayKeyFromDate, expiresAtFrom, toMysqlDateTimeUtc } = require('../lib/dayKey');
const { assertPostBody, assertStampId } = require('../lib/postBody');
const { assertFlagId } = require('../lib/profileRules');
const { requireActiveUser } = require('./userService');

const FEED_DEFAULT_LIMIT = 20;
const FEED_MAX_LIMIT = 50;

function toIso(value) {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function rowToPost(row, { includeDeleted = false, includeResonatedByMe = false } = {}) {
  if (!row) return null;
  const post = {
    id: row.id,
    userId: row.user_id,
    body: row.body,
    flagId: row.flag_id,
    stampId: row.stamp_id,
    resonanceCount: Number(row.resonance_count) || 0,
    editUsed: Boolean(row.edit_used),
    dayKey: row.day_key,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    expiresAt: toIso(row.expires_at),
  };
  if (includeDeleted) {
    post.deletedAt = toIso(row.deleted_at);
    if (row.hidden_at !== undefined) {
      post.hiddenAt = toIso(row.hidden_at);
    }
  }
  if (includeResonatedByMe || row.resonated_by_me !== undefined) {
    post.resonatedByMe = Boolean(row.resonated_by_me);
  }
  if (row.nick_name !== undefined) {
    post.author = {
      id: row.user_id,
      nickName: row.nick_name,
      flagId: row.flag_id,
      gender: row.gender,
      avatarId: row.avatar_id,
    };
  }
  return post;
}

function requireCompleteProfile(user) {
  if (!user.nick_name || !user.flag_id || !user.gender || !user.avatar_id) {
    throw httpError(400, '请先完善昵称、国旗与 Avatar', 'PROFILE_INCOMPLETE');
  }
}

async function getPostRowForAuthor(postId, userId) {
  const rows = await query(
    `SELECT id, user_id, body, flag_id, stamp_id, resonance_count, edit_used,
            day_key, created_at, updated_at, expires_at, deleted_at, hidden_at
     FROM posts WHERE id = ? LIMIT 1`,
    [postId]
  );
  const row = rows[0];
  if (!row || row.deleted_at) {
    throw httpError(404, '帖子不存在', 'POST_NOT_FOUND');
  }
  if (row.user_id !== userId) {
    throw httpError(403, '仅作者可操作', 'FORBIDDEN');
  }
  return row;
}

async function createPost(userId, bodyIn) {
  const user = await requireActiveUser(userId);
  requireCompleteProfile(user);

  const body = assertPostBody(bodyIn && bodyIn.body);
  const stampId = assertStampId(bodyIn && bodyIn.stampId);
  const flagId = assertFlagId(user.flag_id);
  const dayKey = dayKeyFromDate();
  const id = crypto.randomUUID();
  const now = new Date();
  const createdSql = toMysqlDateTimeUtc(now);
  const expiresSql = toMysqlDateTimeUtc(expiresAtFrom(now));

  try {
    await query(
      `INSERT INTO posts
         (id, user_id, body, flag_id, stamp_id, resonance_count, edit_used,
          day_key, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`,
      [id, userId, body, flagId, stampId, dayKey, createdSql, expiresSql]
    );
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      throw httpError(409, '今日已发过一句（含已删除）', 'DAY_QUOTA');
    }
    throw err;
  }

  const rows = await query(
    `SELECT id, user_id, body, flag_id, stamp_id, resonance_count, edit_used,
            day_key, created_at, updated_at, expires_at, deleted_at
     FROM posts WHERE id = ? LIMIT 1`,
    [id]
  );
  return rowToPost(rows[0]);
}

async function patchPost(userId, postId, bodyIn) {
  await requireActiveUser(userId);
  const row = await getPostRowForAuthor(postId, userId);

  if (row.edit_used) {
    throw httpError(409, '本条已用过编辑次数', 'EDIT_USED');
  }

  if (!bodyIn || typeof bodyIn !== 'object') {
    throw httpError(400, '请求体无效', 'BAD_BODY');
  }

  let nextBody = row.body;
  let nextStamp = row.stamp_id;
  let touched = false;

  if (bodyIn.body !== undefined) {
    nextBody = assertPostBody(bodyIn.body);
    touched = true;
  }
  if (bodyIn.stampId !== undefined) {
    nextStamp = assertStampId(bodyIn.stampId);
    touched = true;
  }
  if (!touched) {
    throw httpError(400, '无有效字段', 'BAD_BODY');
  }

  await query(
    `UPDATE posts SET body = ?, stamp_id = ?, edit_used = 1
     WHERE id = ? AND user_id = ? AND deleted_at IS NULL AND edit_used = 0`,
    [nextBody, nextStamp, postId, userId]
  );

  const rows = await query(
    `SELECT id, user_id, body, flag_id, stamp_id, resonance_count, edit_used,
            day_key, created_at, updated_at, expires_at, deleted_at
     FROM posts WHERE id = ? LIMIT 1`,
    [postId]
  );
  return rowToPost(rows[0]);
}

async function deletePost(userId, postId) {
  await requireActiveUser(userId);
  await getPostRowForAuthor(postId, userId);
  await query(
    `UPDATE posts SET deleted_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    [postId, userId]
  );
  return { deleted: true };
}

/** Today's row for author (including soft-deleted) so UI knows the day slot is used. */
async function getTodayMine(userId) {
  await requireActiveUser(userId);
  const dayKey = dayKeyFromDate();
  const rows = await query(
    `SELECT id, user_id, body, flag_id, stamp_id, resonance_count, edit_used,
            day_key, created_at, updated_at, expires_at, deleted_at, hidden_at
     FROM posts WHERE user_id = ? AND day_key = ? LIMIT 1`,
    [userId, dayKey]
  );
  const row = rows[0];
  return {
    dayKey,
    canPost: !row,
    post: row ? rowToPost(row, { includeDeleted: true }) : null,
  };
}

function encodeCursor(createdAt, id) {
  const iso = toIso(createdAt);
  return Buffer.from(`${iso}|${id}`, 'utf8').toString('base64url');
}

function decodeCursor(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw !== 'string') {
    throw httpError(400, 'cursor 无效', 'BAD_CURSOR');
  }
  try {
    const text = Buffer.from(raw, 'base64url').toString('utf8');
    const idx = text.lastIndexOf('|');
    if (idx <= 0) throw new Error('bad');
    const createdAt = text.slice(0, idx);
    const id = text.slice(idx + 1);
    if (!createdAt || !id) throw new Error('bad');
    return { createdAt, id };
  } catch {
    throw httpError(400, 'cursor 无效', 'BAD_CURSOR');
  }
}

/**
 * @param {object} queryIn
 * @param {{ viewerUserId?: string|null }} [opts]
 */
async function getFeed(queryIn = {}, opts = {}) {
  const scope = queryIn.scope === 'flag' ? 'flag' : 'all';
  let limit = parseInt(queryIn.limit, 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = FEED_DEFAULT_LIMIT;
  limit = Math.min(limit, FEED_MAX_LIMIT);

  const cursor = decodeCursor(queryIn.cursor);
  const viewerUserId = opts.viewerUserId || null;

  const params = [];
  let sql = `
    SELECT p.id, p.user_id, p.body, p.flag_id, p.stamp_id, p.resonance_count, p.edit_used,
           p.day_key, p.created_at, p.updated_at, p.expires_at, p.deleted_at,
           u.nick_name, u.gender, u.avatar_id`;

  if (viewerUserId) {
    sql += `,
           (r.user_id IS NOT NULL) AS resonated_by_me
    FROM posts p
    INNER JOIN users u ON u.id = p.user_id AND u.status = 'active' AND u.deleted_at IS NULL
    LEFT JOIN resonances r ON r.post_id = p.id AND r.user_id = ?`;
    params.push(viewerUserId);
  } else {
    sql += `,
           0 AS resonated_by_me
    FROM posts p
    INNER JOIN users u ON u.id = p.user_id AND u.status = 'active' AND u.deleted_at IS NULL`;
  }

  sql += `
    WHERE p.deleted_at IS NULL
      AND p.hidden_at IS NULL
      AND p.expires_at > UTC_TIMESTAMP()`;

  if (viewerUserId) {
    sql += `
      AND NOT EXISTS (
        SELECT 1 FROM blocks b
        WHERE (b.blocker_id = ? AND b.blocked_id = p.user_id)
           OR (b.blocker_id = p.user_id AND b.blocked_id = ?)
      )`;
    params.push(viewerUserId, viewerUserId);
  }

  if (scope === 'flag') {
    if (!queryIn.flagId) {
      throw httpError(400, 'scope=flag 时须提供 flagId', 'BAD_FLAG');
    }
    const flagId = assertFlagId(queryIn.flagId);
    if (flagId === 'private') {
      throw httpError(400, 'Private 不可用于国旗筛选', 'BAD_FLAG');
    }
    sql += ` AND p.flag_id = ?`;
    params.push(flagId);
  }

  if (cursor) {
    sql += ` AND (p.created_at < ? OR (p.created_at = ? AND p.id < ?))`;
    params.push(new Date(cursor.createdAt), new Date(cursor.createdAt), cursor.id);
  }

  sql += ` ORDER BY p.created_at DESC, p.id DESC LIMIT ?`;
  params.push(limit + 1);

  const rows = await query(sql, params);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const items = page.map((r) => rowToPost(r, { includeResonatedByMe: true }));
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.created_at, last.id) : null;

  return { scope, items, nextCursor };
}

module.exports = {
  createPost,
  patchPost,
  deletePost,
  getTodayMine,
  getFeed,
  rowToPost,
};
