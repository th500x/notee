/**
 * One Line users: silent open by deviceKey hash; profile PATCH; soft delete.
 */

const crypto = require('crypto');
const { query } = require('../database/connection');
const { assertDeviceKey, hashDeviceKey } = require('../lib/deviceKey');
const { mergeProfilePatch } = require('../lib/profileRules');
const { signPlayerToken } = require('../middleware/auth');
const { httpError } = require('../lib/httpError');

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    nickName: row.nick_name,
    flagId: row.flag_id,
    gender: row.gender,
    avatarId: row.avatar_id,
    status: row.status,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

async function findUserById(id) {
  const rows = await query(
    `SELECT id, nick_name, flag_id, gender, avatar_id, status, created_at, updated_at, deleted_at
     FROM users WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function findActiveById(id) {
  const row = await findUserById(id);
  if (!row || row.status !== 'active' || row.deleted_at) {
    return null;
  }
  return row;
}

async function requireActiveUser(userId) {
  const row = await findUserById(userId);
  if (!row || row.deleted_at || row.status === 'deleted') {
    throw httpError(401, '账号已删除或不可用', 'USER_GONE');
  }
  if (row.status === 'banned') {
    throw httpError(403, '账号已封禁', 'USER_BANNED');
  }
  if (row.status !== 'active') {
    throw httpError(401, '账号已删除或不可用', 'USER_GONE');
  }
  return row;
}

/**
 * Upsert by device_key_hash. Same key → same UUID + fresh JWT.
 */
async function authAnonymous(deviceKeyRaw) {
  const deviceKey = assertDeviceKey(deviceKeyRaw);
  const hash = hashDeviceKey(deviceKey);

  const existing = await query(
    `SELECT id, nick_name, flag_id, gender, avatar_id, status, created_at, updated_at, deleted_at
     FROM users WHERE device_key_hash = ? LIMIT 1`,
    [hash]
  );

  let row = existing[0];
  if (row) {
    if (row.deleted_at || row.status === 'deleted') {
      throw httpError(401, '账号已删除或不可用', 'USER_GONE');
    }
    if (row.status === 'banned') {
      throw httpError(403, '账号已封禁', 'USER_BANNED');
    }
    if (row.status !== 'active') {
      throw httpError(401, '账号已删除或不可用', 'USER_GONE');
    }
  } else {
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO users (id, device_key_hash, status) VALUES (?, ?, 'active')`,
      [id, hash]
    );
    row = (
      await query(
        `SELECT id, nick_name, flag_id, gender, avatar_id, status, created_at, updated_at, deleted_at
         FROM users WHERE id = ? LIMIT 1`,
        [id]
      )
    )[0];
  }

  const { token, expiresAt } = signPlayerToken({ id: row.id });
  return {
    token,
    expiresAt,
    user: rowToUser(row),
  };
}

async function getMe(userId) {
  const row = await requireActiveUser(userId);
  return rowToUser(row);
}

async function patchMe(userId, body) {
  if (!body || typeof body !== 'object') {
    throw httpError(400, '请求体无效', 'BAD_BODY');
  }
  const keys = ['nickName', 'flagId', 'gender', 'avatarId'];
  if (!keys.some((k) => body[k] !== undefined)) {
    throw httpError(400, '无有效字段', 'BAD_BODY');
  }

  const current = await requireActiveUser(userId);
  const next = mergeProfilePatch(current, body);

  await query(
    `UPDATE users
     SET nick_name = ?, flag_id = ?, gender = ?, avatar_id = ?
     WHERE id = ? AND status = 'active'`,
    [next.nick_name, next.flag_id, next.gender, next.avatar_id, userId]
  );

  return getMe(userId);
}

/**
 * Soft delete: clear device_key_hash so the same device may open a new account.
 */
async function deleteMe(userId) {
  await requireActiveUser(userId);
  await query(
    `UPDATE users
     SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP, device_key_hash = NULL,
         nick_name = NULL, flag_id = NULL, gender = NULL, avatar_id = NULL
     WHERE id = ? AND status = 'active'`,
    [userId]
  );
  return { deleted: true };
}

module.exports = {
  rowToUser,
  authAnonymous,
  getMe,
  patchMe,
  deleteMe,
  requireActiveUser,
  findActiveById,
  findUserById,
};
