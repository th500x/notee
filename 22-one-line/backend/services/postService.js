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

/** Feed sort: new (default) · hot_day · hot_week */
const FEED_SORTS = new Set(['new', 'hot_day', 'hot_week']);

function assertFeedSort(raw) {
  if (raw == null || raw === '') return 'new';
  if (typeof raw !== 'string' || !FEED_SORTS.has(raw)) {
    throw httpError(400, 'sort 无效', 'BAD_SORT');
  }
  return raw;
}

function isHotSort(sort) {
  return sort === 'hot_day' || sort === 'hot_week';
}

function encodeCursor({ sort, resonanceCount, createdAt, id }) {
  const iso = toIso(createdAt);
  if (isHotSort(sort)) {
    return Buffer.from(`h|${Number(resonanceCount) || 0}|${iso}|${id}`, 'utf8').toString(
      'base64url'
    );
  }
  return Buffer.from(`n|${iso}|${id}`, 'utf8').toString('base64url');
}

/**
 * Cursor shapes:
 * - `n|{iso}|{id}` — time feed (also accepts legacy `{iso}|{id}`)
 * - `h|{resonanceCount}|{iso}|{id}` — hot feed
 */
function decodeCursor(raw, sort) {
  if (raw == null || raw === '') return null;
  if (typeof raw !== 'string') {
    throw httpError(400, 'cursor 无效', 'BAD_CURSOR');
  }
  try {
    const text = Buffer.from(raw, 'base64url').toString('utf8');
    const parts = text.split('|');
    if (parts[0] === 'h') {
      if (!isHotSort(sort)) throw new Error('sort mismatch');
      const resonanceCount = Number(parts[1]);
      const createdAt = parts[2];
      const id = parts[3];
      if (!Number.isFinite(resonanceCount) || !createdAt || !id) throw new Error('bad');
      return { kind: 'hot', resonanceCount, createdAt, id };
    }
    if (parts[0] === 'n') {
      if (isHotSort(sort)) throw new Error('sort mismatch');
      const createdAt = parts[1];
      const id = parts[2];
      if (!createdAt || !id) throw new Error('bad');
      return { kind: 'new', createdAt, id };
    }
    // Legacy time cursor: `{iso}|{id}`
    if (isHotSort(sort)) throw new Error('sort mismatch');
    const idx = text.lastIndexOf('|');
    if (idx <= 0) throw new Error('bad');
    const createdAt = text.slice(0, idx);
    const id = text.slice(idx + 1);
    if (!createdAt || !id) throw new Error('bad');
    return { kind: 'new', createdAt, id };
  } catch {
    throw httpError(400, 'cursor 无效', 'BAD_CURSOR');
  }
}

/**
 * @param {object} queryIn
 * @param {{ viewerUserId?: string|null }} [opts]
 */
const STAMP_COUNTRY_IDS = new Set(['th', 'my', 'vn', 'id', 'cn', 'kr', 'jp']);
/** Product series ids — keep in sync with app StampSeries. */
const STAMP_SERIES_IDS = new Set(['all', 'region', 'scenery', 'treasure']);
const REGION_COUNTRY_PREFIXES = [...STAMP_COUNTRY_IDS].map((c) => `${c}_`);

function assertStampCountry(raw) {
  if (typeof raw !== 'string' || !STAMP_COUNTRY_IDS.has(raw)) {
    throw httpError(400, 'stampCountry 无效', 'BAD_STAMP_COUNTRY');
  }
  return raw;
}

function assertStampSeries(raw) {
  if (raw == null || raw === '') return 'region';
  if (typeof raw !== 'string' || !STAMP_SERIES_IDS.has(raw)) {
    throw httpError(400, 'stampSeries 无效', 'BAD_STAMP_SERIES');
  }
  return raw;
}

async function getFeed(queryIn = {}, opts = {}) {
  const scopeRaw = typeof queryIn.scope === 'string' ? queryIn.scope : 'all';
  const scope =
    scopeRaw === 'flag' || scopeRaw === 'stamp' ? scopeRaw : 'all';
  const sort = assertFeedSort(queryIn.sort);
  let limit = parseInt(queryIn.limit, 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = FEED_DEFAULT_LIMIT;
  limit = Math.min(limit, FEED_MAX_LIMIT);

  const cursor = decodeCursor(queryIn.cursor, sort);
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

  if (sort === 'hot_day') {
    sql += ` AND p.day_key = ?`;
    params.push(dayKeyFromDate());
  } else if (sort === 'hot_week') {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    sql += ` AND p.created_at >= ?`;
    params.push(toMysqlDateTimeUtc(since));
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

  if (scope === 'stamp') {
    const stampSeries = assertStampSeries(queryIn.stampSeries);
    sql += ` AND p.stamp_id IS NOT NULL`;

    if (stampSeries === 'all') {
      // Any series — no further stamp filters.
    } else if (stampSeries === 'region') {
      if (queryIn.stampCountry != null && queryIn.stampCountry !== '') {
        const country = assertStampCountry(queryIn.stampCountry);
        if (queryIn.stampId != null && queryIn.stampId !== '') {
          const stampId = assertStampId(queryIn.stampId);
          if (!stampId.startsWith(`${country}_`)) {
            throw httpError(400, 'stampId 与 stampCountry 不匹配', 'BAD_STAMP');
          }
          sql += ` AND p.stamp_id = ?`;
          params.push(stampId);
        } else {
          sql += ` AND p.stamp_id LIKE ?`;
          params.push(`${country}_%`);
        }
      } else {
        // Whole Region series (all countries).
        sql += ` AND (${REGION_COUNTRY_PREFIXES.map(() => 'p.stamp_id LIKE ?').join(' OR ')})`;
        REGION_COUNTRY_PREFIXES.forEach((p) => params.push(`${p}%`));
      }
    } else {
      // Reserved non-region series: id prefix = series id (e.g. scenery_fuji).
      if (queryIn.stampId != null && queryIn.stampId !== '') {
        const stampId = assertStampId(queryIn.stampId);
        if (!stampId.startsWith(`${stampSeries}_`)) {
          throw httpError(400, 'stampId 与 stampSeries 不匹配', 'BAD_STAMP');
        }
        sql += ` AND p.stamp_id = ?`;
        params.push(stampId);
      } else {
        sql += ` AND p.stamp_id LIKE ?`;
        params.push(`${stampSeries}_%`);
      }
    }
  }

  if (cursor) {
    if (cursor.kind === 'hot') {
      sql += ` AND (
        p.resonance_count < ?
        OR (p.resonance_count = ? AND p.created_at < ?)
        OR (p.resonance_count = ? AND p.created_at = ? AND p.id < ?)
      )`;
      const at = new Date(cursor.createdAt);
      params.push(
        cursor.resonanceCount,
        cursor.resonanceCount,
        at,
        cursor.resonanceCount,
        at,
        cursor.id
      );
    } else {
      sql += ` AND (p.created_at < ? OR (p.created_at = ? AND p.id < ?))`;
      params.push(new Date(cursor.createdAt), new Date(cursor.createdAt), cursor.id);
    }
  }

  if (isHotSort(sort)) {
    sql += ` ORDER BY p.resonance_count DESC, p.created_at DESC, p.id DESC LIMIT ?`;
  } else {
    sql += ` ORDER BY p.created_at DESC, p.id DESC LIMIT ?`;
  }
  params.push(limit + 1);

  const rows = await query(sql, params);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const items = page.map((r) => rowToPost(r, { includeResonatedByMe: true }));
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          sort,
          resonanceCount: last.resonance_count,
          createdAt: last.created_at,
          id: last.id,
        })
      : null;

  return { scope, sort, items, nextCursor };
}

module.exports = {
  createPost,
  patchPost,
  deletePost,
  getTodayMine,
  getFeed,
  rowToPost,
};
