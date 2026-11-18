/**
 * The one-time honor rename: a letter id becomes a digit id on the same UUID, password unchanged
 * (notee-go/docs/00-core/00-1-Account.md §5). Party Pass 499 / Ultra with Google bound only.
 * When the tier lapses (refund, staff downgrade) the digit id goes back and the account gets a
 * letter id again — never left without one.
 */

const { transaction, isDuplicateKey } = require('../database/connection');
const { getSecret } = require('../middleware/auth');
const { httpError } = require('../lib/httpError');
const { assertHonorLoginId, isHonorLoginId } = require('../lib/loginId');
const { hasHonorRename } = require('../lib/partyPass');
const { TICKET_ROUNDS, sealTicket, openTicket } = require('../lib/honorRename');
const {
  honorStateOf,
  requireActiveUser,
  pickLoginIdCandidates,
  getMe,
} = require('./userService');

const STATE_ERRORS = {
  none: () => httpError(403, '改号需要 Party Pass 499', 'HONOR_NOT_ELIGIBLE'),
  needs_google: () => httpError(409, '先绑定 Google 才能改号', 'HONOR_NEEDS_GOOGLE'),
  used: () => httpError(409, '这个账号已经改过号了', 'HONOR_USED'),
};

function assertRenameReady(row) {
  const state = honorStateOf(row);
  if (state !== 'ready') throw STATE_ERRORS[state]();
}

/**
 * First call without a ticket; the refresh sends the first ticket back and gets ids that
 * exclude the first batch. The returned ticket covers both batches.
 * @returns {Promise<{ loginIds: string[], partial: boolean, prefix: string|null, ticket: string }>}
 */
async function pickHonorCandidates(userId, { ticket } = {}) {
  assertRenameReady(await requireActiveUser(userId));
  const secret = getSecret();
  const previous = ticket ? openTicket(ticket, { userId, secret }) : null;
  if (previous && previous.round >= TICKET_ROUNDS) {
    throw httpError(409, '只能换一批', 'HONOR_REFRESH_USED');
  }
  const batch = await pickLoginIdCandidates({
    pool: 'honor',
    exclude: previous ? previous.loginIds : [],
  });
  const offered = previous ? [...previous.loginIds, ...batch.loginIds] : batch.loginIds;
  return {
    ...batch,
    ticket: sealTicket({ userId, loginIds: offered, round: previous ? previous.round + 1 : 1 }, secret),
  };
}

/**
 * @param {{ loginId: string, ticket: string }} body
 */
async function renameToHonorLoginId(userId, body) {
  const loginId = assertHonorLoginId(body && body.loginId);
  const offered = openTicket(body && body.ticket, { userId, secret: getSecret() });
  if (!offered.loginIds.includes(loginId)) {
    throw httpError(400, '只能从给出的号里挑', 'HONOR_TICKET_INVALID');
  }
  await requireActiveUser(userId);

  await transaction(async (conn) => {
    // Locked like the Party Pass recompute, so a refund cannot slip between check and write.
    const [rows] = await conn.query(
      `SELECT login_id, party_pass, google_sub, honor_renamed_at
       FROM users WHERE id = ? AND status = 'active' FOR UPDATE`,
      [userId]
    );
    const row = rows[0];
    if (!row) throw httpError(401, '账号已删除或不可用', 'USER_GONE');
    if (row.login_id === loginId) return;
    assertRenameReady(row);
    try {
      // MySQL applies SET left to right: copy the letter id before it is overwritten.
      await conn.query(
        `UPDATE users
         SET regular_login_id = login_id, login_id = ?, honor_renamed_at = UTC_TIMESTAMP()
         WHERE id = ?`,
        [loginId, userId]
      );
    } catch (err) {
      if (isDuplicateKey(err)) {
        throw httpError(409, '该短号刚被占用，请返回重新选择', 'LOGIN_ID_TAKEN');
      }
      throw err;
    }
  });

  return getMe(userId);
}

async function tryLoginId(conn, userId, loginId) {
  try {
    await conn.query(`UPDATE users SET login_id = ?, regular_login_id = NULL WHERE id = ?`, [
      loginId,
      userId,
    ]);
    return true;
  } catch (err) {
    if (isDuplicateKey(err)) return false;
    throw err;
  }
}

/**
 * Called inside the Party Pass recompute, on its locked row, after the tier is written.
 * The old letter id comes back when it is still free; otherwise one from the current letter
 * batch. The app shows the new id once (it watches for a changed id on GET /me).
 * @returns {Promise<string|null>} the letter id now on the account, or null when nothing changed
 */
async function revokeLapsedHonor(conn, userId, tier) {
  if (hasHonorRename(tier)) return null;
  const [rows] = await conn.query(
    `SELECT login_id, regular_login_id, honor_renamed_at FROM users WHERE id = ?`,
    [userId]
  );
  const row = rows[0];
  if (!row || !row.honor_renamed_at || !isHonorLoginId(row.login_id)) return null;

  if (row.regular_login_id && (await tryLoginId(conn, userId, row.regular_login_id))) {
    return row.regular_login_id;
  }
  const { loginIds } = await pickLoginIdCandidates({ pool: 'regular' });
  for (const loginId of loginIds) {
    if (await tryLoginId(conn, userId, loginId)) return loginId;
  }
  throw httpError(503, '暂时无法分配短号，请稍后重试', 'LOGIN_ID_POOL_BUSY');
}

module.exports = {
  pickHonorCandidates,
  renameToHonorLoginId,
  revokeLapsedHonor,
};
