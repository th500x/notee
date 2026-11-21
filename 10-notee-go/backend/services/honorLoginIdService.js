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
const {
  TICKET_ROUNDS,
  sealTicket,
  openTicket,
  decodeOffer,
  encodeOffer,
  secondOfferFromTicket,
} = require('../lib/honorRename');
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
 * The two batches stay on this account. No ticket returns what is already stored and draws
 * the first nine only when nothing is stored. A ticket draws the second batch once.
 * Later calls, with or without a ticket, return those same ids.
 * @returns {Promise<{ loginIds: string[], batch1: string[], batch2: string[], round: number, partial: boolean, prefix: string|null, ticket: string }>}
 */
async function pickHonorCandidates(userId, { ticket } = {}) {
  const secret = getSecret();
  return transaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT login_id, party_pass, google_sub, honor_renamed_at, honor_batch_1, honor_batch_2, status
       FROM users WHERE id = ? FOR UPDATE`,
      [userId]
    );
    const row = rows[0];
    if (!row || row.status === 'deleted') {
      throw httpError(401, '账号已删除或不可用', 'USER_GONE');
    }
    if (row.status === 'banned') throw httpError(403, '账号已封禁', 'USER_BANNED');
    if (row.status !== 'active') throw httpError(401, '账号已删除或不可用', 'USER_GONE');
    assertRenameReady(row);

    let batch1 = decodeOffer(row.honor_batch_1);
    let batch2 = decodeOffer(row.honor_batch_2);
    const previous = ticket ? openTicket(ticket, { userId, secret }) : null;
    let dirty = false;

    if (!batch1) {
      if (previous && previous.round === 1) {
        batch1 = decodeOffer(previous.loginIds.join(','));
      } else if (previous) {
        throw httpError(400, '这批号已过期，请重新打开', 'HONOR_TICKET_INVALID');
      } else {
        const drawn = await pickLoginIdCandidates({ pool: 'honor' });
        batch1 = drawn.loginIds;
      }
      dirty = true;
    }

    if (previous && !batch2) {
      const carried = previous.round >= TICKET_ROUNDS
        ? secondOfferFromTicket(batch1, previous.loginIds)
        : null;
      if (carried) {
        batch2 = carried;
      } else if (previous.round >= TICKET_ROUNDS) {
        throw httpError(409, '只能换一批', 'HONOR_REFRESH_USED');
      } else {
        const drawn = await pickLoginIdCandidates({ pool: 'honor', exclude: batch1 });
        batch2 = drawn.loginIds;
      }
      dirty = true;
    }

    if (dirty) {
      await conn.query(
        `UPDATE users
         SET honor_batch_1 = ?, honor_batch_2 = ?, last_seen_at = UTC_TIMESTAMP()
         WHERE id = ?`,
        [encodeOffer(batch1), batch2 ? encodeOffer(batch2) : null, userId]
      );
    } else {
      await conn.query(
        `UPDATE users SET last_seen_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'active'`,
        [userId]
      );
    }

    const shown = previous && batch2 ? batch2 : batch1;
    const offered = batch2 ? [...batch1, ...batch2] : batch1;
    return {
      loginIds: shown,
      batch1,
      batch2: batch2 || [],
      round: batch2 ? TICKET_ROUNDS : 1,
      partial: shown.length < 9,
      prefix: batch1[0] ? batch1[0][0] : null,
      ticket: sealTicket(
        { userId, loginIds: offered, round: batch2 ? TICKET_ROUNDS : 1 },
        secret
      ),
    };
  });
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
      `SELECT login_id, party_pass, google_sub, honor_renamed_at, honor_batch_1, honor_batch_2
       FROM users WHERE id = ? AND status = 'active' FOR UPDATE`,
      [userId]
    );
    const row = rows[0];
    if (!row) throw httpError(401, '账号已删除或不可用', 'USER_GONE');
    if (row.login_id === loginId) return;
    assertRenameReady(row);
    const stored = [
      ...(decodeOffer(row.honor_batch_1) || []),
      ...(decodeOffer(row.honor_batch_2) || []),
    ];
    if (!stored.includes(loginId)) {
      throw httpError(400, '只能从给出的号里挑', 'HONOR_TICKET_INVALID');
    }
    try {
      // MySQL applies SET left to right: copy the letter id before it is overwritten.
      await conn.query(
        `UPDATE users
         SET regular_login_id = login_id, login_id = ?, honor_renamed_at = UTC_TIMESTAMP(),
             honor_batch_1 = NULL, honor_batch_2 = NULL
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
