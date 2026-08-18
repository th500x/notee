/**
 * One Line users: silent open by deviceKey hash; explicit login id + password; profile PATCH;
 * soft delete. One row per person — signing up binds credentials to the existing silent UUID
 * instead of creating a second account (notee-go/docs/00-2-Account.md).
 */

const crypto = require('crypto');
const { query, transaction } = require('../database/connection');
const { assertDeviceKey, hashDeviceKey } = require('../lib/deviceKey');
const { mergeProfilePatch } = require('../lib/profileRules');
const {
  assertRegularLoginId,
  normalizeLoginId,
  randomLoginIdBatch,
} = require('../lib/loginId');
const { assertPassword, hashPassword, verifyPassword } = require('../lib/password');
const { signPlayerToken } = require('../middleware/auth');
const { httpError } = require('../lib/httpError');

/** Never select `password_hash` into anything that can reach a response. */
const USER_COLS = `id, login_id, nick_name, flag_id, gender, avatar_id, status,
                   created_at, updated_at, deleted_at`;

const CANDIDATES_DEFAULT = 5;
const CANDIDATES_MAX = 10;
/** Probe rounds before giving up; each round tests a batch against the taken set. */
const CANDIDATE_ROUNDS = 8;

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    loginId: row.login_id || null,
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
  const rows = await query(`SELECT ${USER_COLS} FROM users WHERE id = ? LIMIT 1`, [id]);
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
    `SELECT ${USER_COLS} FROM users WHERE device_key_hash = ? LIMIT 1`,
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
    row = (await query(`SELECT ${USER_COLS} FROM users WHERE id = ? LIMIT 1`, [id]))[0];
  }

  return signSession(row);
}

function signSession(row) {
  const { token, expiresAt } = signPlayerToken({ id: row.id });
  return { token, expiresAt, user: rowToUser(row) };
}

/** Which of these ids are already claimed (soft-deleted rows released theirs). */
async function takenLoginIds(candidates) {
  if (candidates.length === 0) return new Set();
  const placeholders = candidates.map(() => '?').join(',');
  const rows = await query(
    `SELECT login_id FROM users WHERE login_id IN (${placeholders})`,
    candidates
  );
  return new Set(rows.map((r) => r.login_id));
}

/**
 * Server-authoritative pick: generate, drop the taken ones, retry until we have enough.
 * The client never invents ids — a locally guessed pool cannot know what is claimed.
 * @param {{ count?: number, exclude?: string[], pool?: string }} opts
 * @returns {Promise<{ loginIds: string[], partial: boolean }>}
 */
async function pickLoginIdCandidates({ count, exclude = [], pool = 'regular' } = {}) {
  const parsed = parseInt(count, 10);
  const want = Math.min(Math.max(Number.isFinite(parsed) ? parsed : CANDIDATES_DEFAULT, 1), CANDIDATES_MAX);

  // Seen doubles as the "already shown this round" filter, so a refresh returns new ids.
  const seen = new Set(exclude.map(normalizeLoginId).filter(Boolean));
  const picked = [];

  for (let round = 0; round < CANDIDATE_ROUNDS && picked.length < want; round += 1) {
    const batch = randomLoginIdBatch({ size: Math.max(want * 4, 20), pool, skip: seen });
    if (batch.length === 0) break;

    const taken = await takenLoginIds(batch);
    for (const loginId of batch) {
      if (!taken.has(loginId) && picked.length < want) picked.push(loginId);
    }
  }

  if (picked.length === 0) {
    throw httpError(503, '暂时无法分配短号，请稍后重试', 'LOGIN_ID_POOL_BUSY');
  }

  return { loginIds: picked, partial: picked.length < want };
}

/**
 * Bind login id + password to the caller's existing account. One per account, forever —
 * changing it is the paid VIP rename, not this endpoint.
 */
async function registerLoginId(userId, body) {
  const loginId = assertRegularLoginId(body && body.loginId);
  const password = assertPassword(body && body.password);

  const current = await requireActiveUser(userId);
  if (current.login_id) {
    throw httpError(409, '该账号已注册过短号', 'ALREADY_REGISTERED');
  }

  const passwordHash = await hashPassword(password);
  let result;
  try {
    result = await query(
      `UPDATE users SET login_id = ?, password_hash = ?
       WHERE id = ? AND status = 'active' AND login_id IS NULL`,
      [loginId, passwordHash, userId]
    );
  } catch (err) {
    if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
      throw httpError(409, '该短号刚被占用，请返回重新选择', 'LOGIN_ID_TAKEN');
    }
    throw err;
  }

  if (result.affectedRows === 0) {
    // Lost a race on this same account (double submit) — re-read to report the real reason.
    const fresh = await requireActiveUser(userId);
    if (fresh.login_id) {
      throw httpError(409, '该账号已注册过短号', 'ALREADY_REGISTERED');
    }
    throw httpError(409, '注册未生效，请重试', 'REGISTER_FAILED');
  }

  return getMe(userId);
}

/**
 * The device belongs to whoever signed in last. Without this the silent account opened on
 * this phone would win the next `auth/anonymous` recovery (expired token, USER_GONE) and
 * quietly replace the account the user just signed into.
 */
async function bindDeviceKey(userId, deviceKeyHash) {
  await transaction(async (connection) => {
    await connection.execute(
      `UPDATE users SET device_key_hash = NULL WHERE device_key_hash = ? AND id <> ?`,
      [deviceKeyHash, userId]
    );
    await connection.execute(`UPDATE users SET device_key_hash = ? WHERE id = ?`, [
      deviceKeyHash,
      userId,
    ]);
  });
}

/**
 * Sign in on a new device. Wrong id and wrong password give the same answer so the
 * endpoint cannot be used to probe which ids exist.
 * @param {{ loginId: string, password: string, deviceKey?: string }} body
 */
async function loginWithLoginId(body) {
  const loginId = normalizeLoginId(body && body.loginId);
  const password = body && body.password;
  const rejected = httpError(401, '短号或密码错误', 'BAD_CREDENTIALS');

  if (!loginId || typeof password !== 'string' || password.length === 0) {
    throw rejected;
  }

  const rows = await query(
    `SELECT ${USER_COLS}, password_hash FROM users WHERE login_id = ? LIMIT 1`,
    [loginId]
  );
  const row = rows[0];
  if (!row || row.deleted_at || row.status === 'deleted') {
    throw rejected;
  }
  if (row.status === 'banned') {
    throw httpError(403, '账号已封禁', 'USER_BANNED');
  }
  if (!(await verifyPassword(password, row.password_hash))) {
    throw rejected;
  }

  if (body.deviceKey !== undefined) {
    await bindDeviceKey(row.id, hashDeviceKey(assertDeviceKey(body.deviceKey)));
  }

  return signSession(row);
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
 * Soft delete: clear device_key_hash so the same device may open a new account, and clear
 * the credentials so the login id returns to the pool.
 */
async function deleteMe(userId) {
  await requireActiveUser(userId);
  await query(
    `UPDATE users
     SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP, device_key_hash = NULL,
         login_id = NULL, password_hash = NULL,
         nick_name = NULL, flag_id = NULL, gender = NULL, avatar_id = NULL
     WHERE id = ? AND status = 'active'`,
    [userId]
  );
  return { deleted: true };
}

module.exports = {
  rowToUser,
  authAnonymous,
  pickLoginIdCandidates,
  registerLoginId,
  loginWithLoginId,
  getMe,
  patchMe,
  deleteMe,
  requireActiveUser,
  findActiveById,
  findUserById,
};
